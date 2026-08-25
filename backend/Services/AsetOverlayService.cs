using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Aset;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Lapisan operasional My Asset di atas master ERP (GCS.dbo.assets): kondisi fisik,
// PIC + histori, log aktivitas umum, dan clearance sheet SDM. Master aset (kode,
// nama, kategori, nilai) TETAP dari ERP - lihat AsetService.GetErpListAsync. Tabel
// di sini hanya menyimpan hal yang tidak ada di ERP, direferensikan lewat ObjectId
// (bukan FK - lintas database). Lihat backend/Database/aset/06-overlay-ddl.sql.
public class AsetOverlayService
{
    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly ModuleAccessService _access;
    private readonly OrgResolver _org;

    public AsetOverlayService(ApplicationDbContext db, GcsDbContext gcs, ModuleAccessService access, OrgResolver org)
    {
        _db = db;
        _gcs = gcs;
        _access = access;
        _org = org;
    }

    public Task<bool> IsAdminAsetAsync(string nik) => _access.IsAsetAdminAsync(nik);

    public async Task<AsetOverlayDto?> GetOverlayAsync(string nik, string objectId)
    {
        if (!await AsetExistsAsync(objectId)) return null;

        var kondisiRows = await _db.AsetKondisi.AsNoTracking()
            .Where(x => x.ObjectId == objectId)
            .OrderByDescending(x => x.TglDibuat).ThenByDescending(x => x.Id)
            .ToListAsync();
        var nomor = await _db.AsetNomorInternal.AsNoTracking().FirstOrDefaultAsync(x => x.ObjectId == objectId);
        var picRows = await _db.AsetPicAssignment.AsNoTracking()
            .Where(x => x.ObjectId == objectId)
            .OrderByDescending(x => x.TglMulai).ThenByDescending(x => x.Id)
            .ToListAsync();
        var aktRows = await _db.AsetAktivitas.AsNoTracking()
            .Where(x => x.ObjectId == objectId)
            .OrderByDescending(x => x.TglAktivitas).ThenByDescending(x => x.Id)
            .ToListAsync();
        var dokRows = await _db.AsetDokumen.AsNoTracking()
            .Where(x => x.ObjectId == objectId)
            .OrderByDescending(x => x.TglDibuat).ThenByDescending(x => x.Id)
            .ToListAsync();
        var mutasiRows = await _db.AsetMutasi.AsNoTracking()
            .Where(x => x.ObjectId == objectId)
            .OrderByDescending(x => x.TglDibuat).ThenByDescending(x => x.Id)
            .ToListAsync();
        var isAdmin = await _access.IsAsetAdminAsync(nik);

        var kondisiDtos = kondisiRows.Select(MapKondisi).ToList();
        var picDtos = picRows.Select(MapPic).ToList();
        var picAktif = picDtos.FirstOrDefault(p => p.Status == "Aktif");

        return new AsetOverlayDto(
            kondisiDtos.FirstOrDefault(),
            kondisiDtos,
            nomor is null ? null : MapNomor(nomor),
            picAktif,
            picDtos,
            aktRows.Select(MapAktivitas).ToList(),
            dokRows.Select(AsetShared.MapDokumen).ToList(),
            isAdmin,
            isAdmin || await CanCatatAktivitasSajaAsync(nik, objectId, picAktif),
            mutasiRows.Select(MapMutasi).ToList());
    }

    // Operator Aktivitas: hak terbatas "Catat Aktivitas SAJA", TIDAK termasuk isAdmin
    // (yang sudah dicek terpisah sebelum method ini dipanggil). picAktif dioper dari
    // caller (GetOverlayAsync) supaya tidak query ulang aset.pic_assignment.
    private async Task<bool> CanCatatAktivitasSajaAsync(string nik, string objectId, AsetPicDto? picAktif)
    {
        if (picAktif is null || picAktif.JenisPic != "Orang" || picAktif.Nik != nik) return false;
        return await IsAktivitasOperatorAsync(nik);
    }

    // Sama seperti CanCatatAktivitasSajaAsync tapi query PIC-nya fresh (dipakai dari
    // endpoint yang belum load AsetPicDto, mis. CreateAktivitasAsync).
    public async Task<bool> CanCatatAktivitasAsync(string nik, string objectId)
    {
        if (await _access.IsAsetAdminAsync(nik)) return true;
        if (!await IsAktivitasOperatorAsync(nik)) return false;
        return await _db.AsetPicAssignment.AsNoTracking()
            .AnyAsync(x => x.ObjectId == objectId && x.JenisPic == "Orang" && x.Nik == nik && x.Status == "Aktif");
    }

    private async Task<bool> IsAktivitasOperatorAsync(string nik) =>
        await _db.AsetAktivitasOperator.AsNoTracking().AnyAsync(x => x.Nik == nik && x.Aktif);

    // ---- Kelola daftar Operator Aktivitas (admin only) ----
    public async Task<IReadOnlyList<AsetAktivitasOperatorDto>> ListAktivitasOperatorAsync(string nik)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return Array.Empty<AsetAktivitasOperatorDto>();
        var rows = await _db.AsetAktivitasOperator.AsNoTracking().OrderBy(x => x.Nama).ToListAsync();
        if (rows.Count == 0) return Array.Empty<AsetAktivitasOperatorDto>();

        var nikAktifPic = (await _db.AsetPicAssignment.AsNoTracking()
            .Where(x => x.JenisPic == "Orang" && x.Status == "Aktif" && x.Nik != null)
            .Select(x => x.Nik!)
            .Distinct().ToListAsync()).ToHashSet();

        return rows.Select(x => new AsetAktivitasOperatorDto(x.Id, x.Nik, x.Nama, x.Aktif, nikAktifPic.Contains(x.Nik), x.TglDibuat)).ToList();
    }

    // Syarat: pegawai yg mau digrant HARUS sudah jadi PIC aktif (JenisPic 'Orang') atas
    // aset apa pun saat ini - sesuai permintaan user, bukan tebakan.
    public async Task<(bool Ok, string? Error)> TambahAktivitasOperatorAsync(string nik, TambahAktivitasOperatorRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        if (string.IsNullOrWhiteSpace(req.Nik) || string.IsNullOrWhiteSpace(req.Nama))
            return (false, "Pegawai wajib dipilih.");
        var targetNik = req.Nik.Trim();

        var masihPic = await _db.AsetPicAssignment.AsNoTracking()
            .AnyAsync(x => x.JenisPic == "Orang" && x.Nik == targetNik && x.Status == "Aktif");
        if (!masihPic) return (false, "Pegawai ini belum ditunjuk sebagai PIC aset apa pun - tetapkan PIC-nya dulu.");

        var row = await _db.AsetAktivitasOperator.FirstOrDefaultAsync(x => x.Nik == targetNik);
        if (row is null)
        {
            row = new AsetAktivitasOperator { Nik = targetNik, IdPembuat = nik, TglDibuat = DateTime.UtcNow };
            _db.AsetAktivitasOperator.Add(row);
        }
        row.Nama = req.Nama.Trim();
        row.Aktif = true;
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> CabutAktivitasOperatorAsync(string nik, int id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetAktivitasOperator.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        row.Aktif = false;
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Historis: SELALU insert baris baru (bukan upsert), supaya riwayat kondisi lama tetap ada.
    public async Task<(bool Ok, string? Error)> SetKondisiAsync(string nik, string objectId, SimpanKondisiRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        if (!await AsetExistsAsync(objectId)) return (false, "Aset tidak ditemukan.");

        _db.AsetKondisi.Add(new AsetKondisi
        {
            ObjectId = objectId,
            Kondisi = ValidKondisi(req.Kondisi),
            Catatan = Clean(req.Catatan),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Nomor internal: upsert (1 baris per objectid) - identitas/label, bukan riwayat state.
    public async Task<(bool Ok, string? Error)> SetNomorInternalAsync(string nik, string objectId, SimpanNomorInternalRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        if (string.IsNullOrWhiteSpace(req.NomorAset)) return (false, "Nomor aset wajib diisi.");
        if (!await AsetExistsAsync(objectId)) return (false, "Aset tidak ditemukan.");

        var nomor = req.NomorAset.Trim();
        var dipakai = await _db.AsetNomorInternal.AnyAsync(x => x.NomorAset == nomor && x.ObjectId != objectId);
        if (dipakai) return (false, $"Nomor aset '{nomor}' sudah dipakai aset lain.");

        var row = await _db.AsetNomorInternal.FirstOrDefaultAsync(x => x.ObjectId == objectId);
        if (row is null)
        {
            row = new AsetNomorInternal { ObjectId = objectId };
            _db.AsetNomorInternal.Add(row);
        }
        row.NomorAset = nomor;
        row.Catatan = Clean(req.Catatan);
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Tutup assignment aktif sebelumnya (jadi "Dipindahkan") lalu buka assignment baru.
    // JenisPic 'Orang' -> isi Nik; JenisPic 'Bagian' -> isi IdUnit.
    public async Task<(bool Ok, string? Error, long Id)> AssignPicAsync(string nik, string objectId, SimpanPicRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
        if (!await AsetExistsAsync(objectId)) return (false, "Aset tidak ditemukan.", 0);

        var jenis = req.JenisPic == "Bagian" ? "Bagian" : "Orang";
        var tglMulai = req.TglMulai ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Ambil PIC aktif SEKARANG sekali di sini (tracked) - dipakai baik utk validasi
        // tanggal di bawah maupun utk ditutup jadi "Dipindahkan" nanti, supaya tidak query
        // baris yang sama dua kali.
        var current = await _db.AsetPicAssignment.FirstOrDefaultAsync(x => x.ObjectId == objectId && x.Status == "Aktif");
        if (current is not null && tglMulai < current.TglMulai)
            return (false, $"Tgl Mulai PIC baru ({tglMulai:dd/MM/yyyy}) tidak boleh lebih awal dari PIC aktif saat ini yang mulai {current.TglMulai:dd/MM/yyyy}.", 0);

        var row = new AsetPicAssignment
        {
            ObjectId = objectId,
            JenisPic = jenis,
            TglMulai = tglMulai,
            Status = "Aktif",
            Catatan = Clean(req.Catatan),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };

        if (jenis == "Orang")
        {
            if (string.IsNullOrWhiteSpace(req.Nik)) return (false, "NIK PIC wajib diisi.", 0);
            var pegawai = await _gcs.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_KARYAWAN == req.Nik);
            if (pegawai is null) return (false, "NIK tidak ditemukan di data pegawai.", 0);
            var org = await _org.ResolveAsync(req.Nik);
            row.Nik = req.Nik;
            row.NamaPic = pegawai.NAMA_LENGKAP;
            row.Departemen = org.NamaDepartemen;
        }
        else
        {
            if (req.IdUnit is not int idUnit) return (false, "Bagian wajib dipilih.", 0);
            var namaUnit = await _org.GetUnitNamaAsync(idUnit);
            if (namaUnit is null) return (false, "Bagian tidak ditemukan.", 0);
            row.IdUnit = idUnit;
            row.NamaUnit = namaUnit;
        }

        if (current is not null)
        {
            current.Status = "Dipindahkan";
            current.TglSelesai = tglMulai;
        }

        _db.AsetPicAssignment.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, row.Id);
    }

    // Picker "Individu" di form PIC (search-as-you-type, min 2 karakter). Beda dari
    // pencarian pegawai modul lain (GajiService dkk, yang khusus Tetap/organik) - PIC aset
    // BOLEH tenaga kerja non-organik (TKNO): Layanan Jasa/IK/BP, karena mereka juga bisa
    // jadi penanggung jawab fisik aset di lapangan (mis. petugas jasa outsourcing).
    public async Task<IReadOnlyList<AsetPegawaiDto>> SearchPegawaiAsync(string? q)
    {
        var term = (q ?? string.Empty).Trim();
        if (term.Length < 2) return Array.Empty<AsetPegawaiDto>();

        // Tetap (tenaga kerja organik) - lihat catatan di GajiService.CariPegawaiAsync.
        // Take(20) di query (bukan cuma di gabungan akhir) - term 2 huruf bisa cocok ratusan
        // pegawai, jangan tarik semuanya ke memori kalau cuma 20 teratas yang dipakai.
        var tetap = await _gcs.PegawaiSdm.AsNoTracking()
            .Where(p => p.data_aktif == "Aktif" && p.jenis_pegawai == "Tetap" && (p.nama!.Contains(term) || p.Nik.Contains(term)))
            .OrderBy(p => p.nama).Take(20)
            .Select(p => new AsetPegawaiDto(p.Nik, p.nama ?? p.Nik, p.nm_jabatan, p.UNIT_KERJA ?? p.BAGIAN))
            .ToListAsync();

        // TKNO (Layanan Jasa/IK/BP) - PEGAWAI_SDM (dipakai di atas) tidak punya kategori ini
        // sama sekali, jadi dicari dari MST_PEGAWAI.STATUS_KARYAWAN. PKWT sengaja TIDAK
        // diikutkan (di luar permintaan). MST_PEGAWAI sendiri TIDAK punya kolom aktif/keluar -
        // "masih aktif" dicek lewat akun SSO-nya (db_mygcs Users.IsActive, join Nik==ID_KARYAWAN,
        // diverifikasi manual: 184/189 TKNO kategori ini punya akun & semuanya IsActive=1 saat
        // dicek) - pegawai TKNO yang belum/tidak pernah punya akun SSO otomatis tidak ikut.
        var kategoriTkno = new[] { "BP", "IK", "Layanan Jasa" };
        var tkno = await _gcs.MstPegawai.AsNoTracking()
            .Where(p => p.STATUS_KARYAWAN != null && kategoriTkno.Contains(p.STATUS_KARYAWAN)
                && (p.NAMA_LENGKAP.Contains(term) || p.ID_KARYAWAN.Contains(term)))
            .Select(p => new { p.ID_KARYAWAN, p.NAMA_LENGKAP, p.STATUS_KARYAWAN })
            .ToListAsync();
        var nikTkno = tkno.Select(p => p.ID_KARYAWAN).ToList();
        var nikAktif = (await _db.Users.AsNoTracking()
            .Where(u => u.Nik != null && u.IsActive && nikTkno.Contains(u.Nik))
            .Select(u => u.Nik!).ToListAsync()).ToHashSet();
        var tknoAktif = tkno.Where(p => nikAktif.Contains(p.ID_KARYAWAN))
            .Select(p => new AsetPegawaiDto(p.ID_KARYAWAN, p.NAMA_LENGKAP, p.STATUS_KARYAWAN, null));

        return tetap.Concat(tknoAktif).OrderBy(p => p.Nama).Take(20).ToList();
    }

    // Dropdown "Bagian" di form PIC.
    public async Task<IReadOnlyList<AsetUnitDto>> ListBagianAsync()
    {
        var rows = await _org.ListBagianAsync();
        return rows.Select(r => new AsetUnitDto(r.Id, r.Nama, r.NamaInduk)).ToList();
    }

    // Autocomplete "Vendor/Pelaksana" (search-as-you-type, min 2 karakter) - dbo.akun_rekanan.
    // Boleh diisi manual kalau vendornya tidak ketemu di sini (field teks biasa di frontend).
    public async Task<IReadOnlyList<AsetRekananDto>> SearchRekananAsync(string? q)
    {
        var term = (q ?? string.Empty).Trim();
        if (term.Length < 2) return Array.Empty<AsetRekananDto>();
        return await _gcs.AsetErpRekanan.AsNoTracking()
            .Where(r => r.NAMA != null && r.NAMA.Contains(term) || r.KODEREKANAN.Contains(term))
            .OrderBy(r => r.NAMA)
            .Take(20)
            .Select(r => new AsetRekananDto(r.KODEREKANAN, r.NAMA ?? r.KODEREKANAN))
            .ToListAsync();
    }

    // Dropdown "Lokasi Aktual" di form scan opname - daftar WILAYAH (dbo.akun_account_cc),
    // sumber sama dengan kolom Lokasi di Inventaris - lihat AsetService.ErpLookupsAsync.
    public async Task<IReadOnlyList<string>> ListLokasiAsync()
    {
        var rows = await _gcs.AsetErpCc.AsNoTracking()
            .Where(c => c.WILAYAH != null && c.WILAYAH != "")
            .Select(c => c.WILAYAH!.Trim())
            .Distinct()
            .ToListAsync();
        return rows.OrderBy(x => x).ToList();
    }

    // Master "Jenis Aktivitas" (aktif saja), dengan daftar GROUP_ASSET terkait tiap jenis
    // (kosong = Umum, berlaku semua kategori). Diurutkan lewat kolom urutan.
    public async Task<IReadOnlyList<AsetJenisAktivitasDto>> ListJenisAktivitasAsync()
    {
        var jenisRows = await _db.AsetJenisAktivitas.AsNoTracking()
            .Where(x => x.Aktif)
            .OrderBy(x => x.Urutan).ThenBy(x => x.Nama)
            .ToListAsync();
        var kategoriRows = await _db.AsetJenisAktivitasKategori.AsNoTracking().ToListAsync();
        var kategoriPerJenis = kategoriRows.GroupBy(k => k.IdJenisAktivitas)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(k => k.GroupAsset).ToList());

        return jenisRows.Select(j => new AsetJenisAktivitasDto(
            j.Id, j.Nama, kategoriPerJenis.GetValueOrDefault(j.Id, Array.Empty<string>()))).ToList();
    }

    public async Task<(bool Ok, string? Error)> ReturnPicAsync(string nik, long assignmentId)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetPicAssignment.FirstOrDefaultAsync(x => x.Id == assignmentId);
        if (row is null) return (false, "Data tidak ditemukan.");
        if (row.Status != "Aktif") return (false, "Assignment ini sudah tidak aktif.");
        row.Status = "Dikembalikan";
        row.TglSelesai = DateOnly.FromDateTime(DateTime.UtcNow);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Pengajuan mutasi lokasi/wilayah - overlay MURNI, TIDAK menulis apa pun ke dbo.assets.
    // lokasi_lama/kode_cc_lama/wilayah_lama/nilai_buku_saat_diajukan diambil snapshot dari
    // ERP di saat pengajuan (konteks histori, bukan sumber kebenaran yg terus disinkron).
    // Perubahan LOKASI/KODE_CC/NILAI_BUKU yang SEBENARNYA di ERP tetap dilakukan tim
    // akunting secara manual di ERP setelah mereka proses approval-nya di sana - lihat
    // catatan arsitektur di AsetMutasi (AsetEntities.cs).
    public async Task<(bool Ok, string? Error, long Id)> CreateMutasiAsync(string nik, string objectId, SimpanMutasiRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
        if (string.IsNullOrWhiteSpace(req.LokasiBaru)) return (false, "Lokasi baru wajib diisi.", 0);

        var aset = await _gcs.AsetErp.AsNoTracking().FirstOrDefaultAsync(a => a.OBJECTID == objectId);
        if (aset is null) return (false, "Aset tidak ditemukan.", 0);

        // 1 query buat wilayah lama+baru sekaligus (bukan 2 round trip terpisah) - kode CC
        // lama & baru dicari dalam 1 IN-list.
        var kodeCcBaru = Clean(req.KodeCcBaru);
        var kodeCandidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(aset.KODE_CC)) kodeCandidates.Add(aset.KODE_CC);
        if (kodeCcBaru is not null) kodeCandidates.Add(kodeCcBaru);

        string? wilayahLama = null, wilayahBaru = null;
        if (kodeCandidates.Count > 0)
        {
            var ccRows = await _gcs.AsetErpCc.AsNoTracking().Where(c => kodeCandidates.Contains(c.KODE_CC)).ToListAsync();
            if (kodeCcBaru is not null && !ccRows.Any(c => c.KODE_CC == kodeCcBaru))
                return (false, "Kode CC / Wilayah baru tidak valid.", 0);
            wilayahLama = ccRows.FirstOrDefault(c => c.KODE_CC == aset.KODE_CC)?.WILAYAH?.Trim();
            wilayahBaru = ccRows.FirstOrDefault(c => c.KODE_CC == kodeCcBaru)?.WILAYAH?.Trim();
        }

        var row = new AsetMutasi
        {
            ObjectId = objectId,
            LokasiLama = aset.LOKASI?.Trim(),
            LokasiBaru = req.LokasiBaru.Trim(),
            KodeCcLama = aset.KODE_CC?.Trim(),
            WilayahLama = wilayahLama,
            KodeCcBaru = kodeCcBaru,
            WilayahBaru = wilayahBaru,
            NilaiBukuSaatDiajukan = aset.NILAI_BUKU,
            Alasan = Clean(req.Alasan),
            Status = "Diajukan",
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.AsetMutasi.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, row.Id);
    }

    // Ditandai manual oleh Admin Aset setelah mengonfirmasi tim akunting sudah memproses
    // perpindahan lokasi & nilai buku-nya LANGSUNG di ERP (di luar MyGCS) - bukan trigger
    // otomatis, murni pencatatan status di sisi MyGCS.
    public async Task<(bool Ok, string? Error)> SelesaikanMutasiAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetMutasi.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        if (row.Status == "Selesai") return (false, "Mutasi ini sudah ditandai selesai.");
        row.Status = "Selesai";
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Boleh dibuat oleh Admin Aset ATAU Operator Aktivitas yang jadi PIC aktif aset ini -
    // Ubah/Hapus (di bawah) TETAP admin-only, sesuai batasan "catat aktivitas SAJA".
    public async Task<(bool Ok, string? Error, long Id)> CreateAktivitasAsync(string nik, string objectId, SimpanAktivitasUmumRequest req)
    {
        if (!await CanCatatAktivitasAsync(nik, objectId))
            return (false, "Hanya Admin Aset, atau PIC aset ini yang sudah ditunjuk sebagai Operator Aktivitas, yang dapat mencatat aktivitas.", 0);
        if (string.IsNullOrWhiteSpace(req.Jenis)) return (false, "Jenis aktivitas wajib diisi.", 0);
        if (!await AsetExistsAsync(objectId)) return (false, "Aset tidak ditemukan.", 0);

        var row = new AsetAktivitas
        {
            ObjectId = objectId,
            Jenis = req.Jenis.Trim(),
            TglAktivitas = req.TglAktivitas,
            Deskripsi = Clean(req.Deskripsi),
            VendorPelaksana = Clean(req.VendorPelaksana),
            Biaya = req.Biaya,
            Status = ValidAktivitasStatus(req.Status),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.AsetAktivitas.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, row.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdateAktivitasAsync(string nik, long id, SimpanAktivitasUmumRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetAktivitas.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        if (string.IsNullOrWhiteSpace(req.Jenis)) return (false, "Jenis aktivitas wajib diisi.");

        row.Jenis = req.Jenis.Trim();
        row.TglAktivitas = req.TglAktivitas;
        row.Deskripsi = Clean(req.Deskripsi);
        row.VendorPelaksana = Clean(req.VendorPelaksana);
        row.Biaya = req.Biaya;
        row.Status = ValidAktivitasStatus(req.Status);
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAktivitasAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetAktivitas.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Data tidak ditemukan.");
        _db.AsetAktivitas.Remove(row);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Riwayat PIC lintas-aset (halaman Riwayat PIC) - READ-ONLY, query murni ke
    // aset.pic_assignment yang sudah ada (tidak ada tabel/kolom baru). Filter opsional:
    // nik (JenisPic Orang), idUnit (JenisPic Bagian), rentang tanggal mulai. Dibatasi
    // 500 baris terbaru sebagai pengaman kalau datanya sudah banyak nanti.
    public async Task<IReadOnlyList<AsetPicRiwayatDto>> GetRiwayatPicAsync(string? nik, int? idUnit, DateOnly? dari, DateOnly? sampai)
    {
        var query = _db.AsetPicAssignment.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(nik)) query = query.Where(x => x.Nik == nik);
        if (idUnit is int unit) query = query.Where(x => x.IdUnit == unit);
        if (dari is DateOnly d) query = query.Where(x => x.TglMulai >= d);
        if (sampai is DateOnly s) query = query.Where(x => x.TglMulai <= s);

        var rows = await query.OrderByDescending(x => x.TglMulai).ThenByDescending(x => x.Id).Take(500).ToListAsync();
        if (rows.Count == 0) return Array.Empty<AsetPicRiwayatDto>();

        var objectIds = rows.Select(r => r.ObjectId).Distinct().ToList();
        var assets = await _gcs.AsetErp.AsNoTracking()
            .Where(a => objectIds.Contains(a.OBJECTID))
            .ToDictionaryAsync(a => a.OBJECTID, a => (Nama: a.DESC_OBJECT?.Trim(), Kategori: a.GROUP_ASSET?.Trim()));

        return rows.Select(p =>
        {
            assets.TryGetValue(p.ObjectId, out var a);
            return new AsetPicRiwayatDto(
                p.Id, p.ObjectId, a.Nama, a.Kategori,
                p.JenisPic, p.Nik, p.NamaPic, p.Departemen, p.IdUnit, p.NamaUnit, p.TglMulai, p.TglSelesai, p.Status, p.Catatan, p.TglDibuat);
        }).ToList();
    }

    // Clearance sheet SDM: daftar aset yang masih jadi tanggungan (PIC aktif) 1 NIK.
    // Hanya PIC JenisPic='Orang' - PIC Bagian bukan urusan clearance per-karyawan.
    // null = NIK tidak ditemukan di data pegawai - controller mengubahnya jadi 404 supaya
    // frontend bisa tampilkan pesan yang jelas, bukan diam-diam menampilkan hasil kosong.
    public async Task<AsetClearanceDto?> GetClearanceAsync(string targetNik)
    {
        var pegawai = await _gcs.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_KARYAWAN == targetNik);
        if (pegawai is null) return null;

        var rows = await _db.AsetPicAssignment.AsNoTracking()
            .Where(x => x.JenisPic == "Orang" && x.Nik == targetNik && x.Status == "Aktif")
            .OrderBy(x => x.TglMulai)
            .ToListAsync();

        var objectIds = rows.Select(r => r.ObjectId).ToList();
        var assets = await _gcs.AsetErp.AsNoTracking()
            .Where(a => objectIds.Contains(a.OBJECTID))
            .ToDictionaryAsync(a => a.OBJECTID);

        var items = rows.Select(r =>
        {
            assets.TryGetValue(r.ObjectId, out var a);
            return new AsetClearanceItemDto(r.Id, r.ObjectId, a?.DESC_OBJECT?.Trim(), a?.LOKASI?.Trim(), r.TglMulai, r.Status);
        }).ToList();

        return new AsetClearanceDto(targetNik, pegawai.NAMA_LENGKAP, items);
    }

    private async Task<bool> AsetExistsAsync(string objectId) => await _gcs.AsetErp.AnyAsync(a => a.OBJECTID == objectId);

    private const string ForbidMsg = AsetShared.ForbidMsg;
    private static string ValidKondisi(string? s) => s is "Baik" or "Rusak Ringan" or "Rusak Berat" or "Hilang" ? s : "Baik";
    private static string ValidAktivitasStatus(string? s) => s is "Dijadwalkan" or "Proses" or "Selesai" or "Batal" ? s : "Selesai";
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static AsetKondisiDto MapKondisi(AsetKondisi k) => new(k.Id, k.ObjectId, k.Kondisi, k.Catatan, k.TglDibuat);
    private static AsetNomorInternalDto MapNomor(AsetNomorInternal n) => new(n.ObjectId, n.NomorAset, n.Catatan, n.TglDiubah);
    private static AsetPicDto MapPic(AsetPicAssignment p) => new(
        p.Id, p.ObjectId, p.JenisPic, p.Nik, p.NamaPic, p.Departemen, p.IdUnit, p.NamaUnit, p.TglMulai, p.TglSelesai, p.Status, p.Catatan, p.TglDibuat);
    private static AsetAktivitasUmumDto MapAktivitas(AsetAktivitas a) => new(
        a.Id, a.ObjectId, a.Jenis, a.TglAktivitas, a.Deskripsi, a.VendorPelaksana, a.Biaya, a.Status, a.TglDibuat, a.TglDiubah);
    private static AsetMutasiDto MapMutasi(AsetMutasi m) => new(
        m.Id, m.ObjectId, m.LokasiLama, m.LokasiBaru, m.KodeCcLama, m.WilayahLama, m.KodeCcBaru, m.WilayahBaru,
        m.NilaiBukuSaatDiajukan, m.Alasan, m.Status, m.TglDibuat, m.TglDiubah);
}