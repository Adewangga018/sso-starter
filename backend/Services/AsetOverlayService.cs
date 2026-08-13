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
            dokRows.Select(MapDokumen).ToList(),
            isAdmin);
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

        var current = await _db.AsetPicAssignment.FirstOrDefaultAsync(x => x.ObjectId == objectId && x.Status == "Aktif");
        if (current is not null)
        {
            current.Status = "Dipindahkan";
            current.TglSelesai = tglMulai;
        }

        _db.AsetPicAssignment.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, row.Id);
    }

    // Picker "Individu" di form PIC (search-as-you-type, min 2 karakter).
    public async Task<IReadOnlyList<AsetPegawaiDto>> SearchPegawaiAsync(string? q)
    {
        var term = (q ?? string.Empty).Trim();
        if (term.Length < 2) return Array.Empty<AsetPegawaiDto>();
        return await _gcs.PegawaiSdm.AsNoTracking()
            .Where(p => p.data_aktif == "Aktif" && (p.nama!.Contains(term) || p.Nik.Contains(term)))
            .OrderBy(p => p.nama).Take(20)
            .Select(p => new AsetPegawaiDto(p.Nik, p.nama ?? p.Nik, p.nm_jabatan, p.UNIT_KERJA ?? p.BAGIAN))
            .ToListAsync();
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

    public async Task<(bool Ok, string? Error, long Id)> CreateAktivitasAsync(string nik, string objectId, SimpanAktivitasUmumRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
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

    private const string ForbidMsg = "Hanya Admin Aset (Departemen Kepatuhan) yang dapat mengelola aset.";
    private static string ValidKondisi(string? s) => s is "Baik" or "Rusak Ringan" or "Rusak Berat" or "Hilang" ? s : "Baik";
    private static string ValidAktivitasStatus(string? s) => s is "Dijadwalkan" or "Proses" or "Selesai" or "Batal" ? s : "Selesai";
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static AsetKondisiDto MapKondisi(AsetKondisi k) => new(k.Id, k.ObjectId, k.Kondisi, k.Catatan, k.TglDibuat);
    private static AsetNomorInternalDto MapNomor(AsetNomorInternal n) => new(n.ObjectId, n.NomorAset, n.Catatan, n.TglDiubah);
    private static AsetPicDto MapPic(AsetPicAssignment p) => new(
        p.Id, p.ObjectId, p.JenisPic, p.Nik, p.NamaPic, p.Departemen, p.IdUnit, p.NamaUnit, p.TglMulai, p.TglSelesai, p.Status, p.Catatan, p.TglDibuat);
    private static AsetAktivitasUmumDto MapAktivitas(AsetAktivitas a) => new(
        a.Id, a.ObjectId, a.Jenis, a.TglAktivitas, a.Deskripsi, a.VendorPelaksana, a.Biaya, a.Status, a.TglDibuat, a.TglDiubah);

    // FileUrl null kalau baris dokumen dibuat tanpa upload berkas (metadata saja).
    private static AsetDokumenDto MapDokumen(AsetDokumen d) => new(
        d.Id, d.ObjectId, d.JenisDokumen, d.NomorDokumen, d.TglTerbit, d.TglJatuhTempo,
        d.FilePath is null ? null : $"/api/aset/dokumen/{d.Id}/file", d.FileNamaAsli, d.Catatan, d.Status, d.TglDibuat);
}