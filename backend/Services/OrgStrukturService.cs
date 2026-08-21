using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Grading;

namespace SsoBackend.Services;

// Panel Admin SDM "Struktur Organisasi": CRUD grading.unit_organisasi/jabatan +
// pengelolaan penempatan karyawan (grading.penempatan). Data sudah ada & dipakai
// fitur lain (ApprovalService.ResolveApproverAsync, ModuleAccessService,
// OrgResolver) - service ini TIDAK membuat tabel baru, hanya lapisan CRUD di atas
// skema yang sudah ada (backend/Database/grading/01-schema-ddl.sql).
public class OrgStrukturService
{
    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly PosisiResolver _posisi;

    public OrgStrukturService(ApplicationDbContext db, GcsDbContext gcs, PosisiResolver posisi)
    {
        _db = db;
        _gcs = gcs;
        _posisi = posisi;
    }

    // ===================== Pencarian pegawai utk Penempatan (Tempatkan/Mutasi/PTS) =====================
    // Beda dari GajiService.CariPegawaiAsync (picker Payroll, SENGAJA dibatasi Tetap saja) -
    // di sini SEMUA jenis_pegawai aktif ikut muncul (termasuk Kontrak/InternShip/dst),
    // supaya karyawan yg "belum diplot" (lihat PegawaiDirektoriController.BelumDiplot)
    // bisa langsung ditempatkan dari sini begitu diperlukan (2026-08-20, diminta eksplisit -
    // sebelumnya sengaja ditahan dulu, sekarang dibuka utk Struktur Organisasi meski Payroll
    // tetap Tetap-only krn formula gajinya belum tentu cocok utk non-organik).
    public async Task<IReadOnlyList<GajiPegawaiPickerDto>> CariPegawaiUntukPenempatanAsync(string? q)
    {
        var term = (q ?? string.Empty).Trim();
        var query = _gcs.PegawaiSdm.AsNoTracking().Where(p => p.data_aktif == "Aktif");
        if (term.Length >= 2) query = query.Where(p => p.nama!.Contains(term) || p.Nik.Contains(term));
        var rows = await query
            .OrderBy(p => p.nama)
            .Take(100)
            .Select(p => new { p.Nik, p.nama, p.nm_jabatan, Unit = p.UNIT_KERJA ?? p.BAGIAN })
            .ToListAsync();

        var posisi = await _posisi.ResolveManyAsync(rows.Select(r => r.Nik).ToList());
        return rows.Select(r => new GajiPegawaiPickerDto(
            r.Nik, r.nama ?? r.Nik,
            PosisiResolver.NamaJabatanTerbaik(posisi.GetValueOrDefault(r.Nik), r.nm_jabatan),
            r.Unit,
            posisi.GetValueOrDefault(r.Nik)?.Band is not null)).ToList();
    }

    // ===================== Unit Organisasi =====================

    public async Task<IReadOnlyList<UnitDto>> ListUnitAsync()
    {
        var units = await _db.GradingUnitOrganisasi.AsNoTracking().ToListAsync();
        var byId = units.ToDictionary(u => u.IdUnit);
        var jumlahJabatan = await _db.GradingJabatan.AsNoTracking()
            .Where(j => j.IdUnit != null)
            .GroupBy(j => j.IdUnit!.Value)
            .Select(g => new { IdUnit = g.Key, N = g.Count() })
            .ToDictionaryAsync(g => g.IdUnit, g => g.N);
        var jumlahAnak = units.Where(u => u.IdUnitInduk != null)
            .GroupBy(u => u.IdUnitInduk!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        return units
            .OrderBy(u => u.Tipe).ThenBy(u => u.Nama)
            .Select(u => new UnitDto(
                u.IdUnit, u.Nama, u.Tipe, u.IdUnitInduk,
                u.IdUnitInduk is int induk && byId.TryGetValue(induk, out var indukUnit) ? indukUnit.Nama : null,
                u.Wilayah, u.Keterangan,
                jumlahJabatan.GetValueOrDefault(u.IdUnit), jumlahAnak.GetValueOrDefault(u.IdUnit)))
            .ToList();
    }

    public async Task<(bool Ok, string? Error, int? Id)> SimpanUnitAsync(int? id, SimpanUnitRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nama)) return (false, "Nama unit wajib diisi.", null);
        if (string.IsNullOrWhiteSpace(req.Tipe)) return (false, "Tipe unit wajib diisi.", null);
        if (req.IdUnitInduk == id) return (false, "Unit tidak boleh menjadi induk dirinya sendiri.", null);
        if (req.IdUnitInduk is int induk && !await _db.GradingUnitOrganisasi.AnyAsync(u => u.IdUnit == induk))
            return (false, "Unit induk tidak ditemukan.", null);

        if (id is int existingId)
        {
            var row = await _db.GradingUnitOrganisasi.FirstOrDefaultAsync(u => u.IdUnit == existingId);
            if (row is null) return (false, "Unit tidak ditemukan.", null);
            row.Nama = req.Nama.Trim();
            row.Tipe = req.Tipe.Trim();
            row.IdUnitInduk = req.IdUnitInduk;
            row.Wilayah = string.IsNullOrWhiteSpace(req.Wilayah) ? null : req.Wilayah.Trim();
            row.Keterangan = string.IsNullOrWhiteSpace(req.Keterangan) ? null : req.Keterangan.Trim();
            await _db.SaveChangesAsync();
            return (true, null, existingId);
        }
        else
        {
            var baru = new GradingUnitOrganisasi
            {
                Nama = req.Nama.Trim(),
                Tipe = req.Tipe.Trim(),
                IdUnitInduk = req.IdUnitInduk,
                Wilayah = string.IsNullOrWhiteSpace(req.Wilayah) ? null : req.Wilayah.Trim(),
                Keterangan = string.IsNullOrWhiteSpace(req.Keterangan) ? null : req.Keterangan.Trim(),
            };
            _db.GradingUnitOrganisasi.Add(baru);
            await _db.SaveChangesAsync();
            return (true, null, baru.IdUnit);
        }
    }

    public async Task<(bool Ok, string? Error)> HapusUnitAsync(int id)
    {
        var row = await _db.GradingUnitOrganisasi.FirstOrDefaultAsync(u => u.IdUnit == id);
        if (row is null) return (false, "Unit tidak ditemukan.");
        if (await _db.GradingUnitOrganisasi.AnyAsync(u => u.IdUnitInduk == id))
            return (false, "Unit ini masih punya unit anak - pindahkan/hapus dulu unit anaknya.");
        if (await _db.GradingJabatan.AnyAsync(j => j.IdUnit == id))
            return (false, "Unit ini masih dipakai jabatan - pindahkan/hapus dulu jabatan di unit ini.");

        _db.GradingUnitOrganisasi.Remove(row);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Jabatan =====================

    public async Task<IReadOnlyList<BandOpsiDto>> ListBandAsync()
    {
        return await _db.GradingBand.AsNoTracking().OrderBy(b => b.Urutan)
            .Select(b => new BandOpsiDto(b.IdBand, b.Kode, b.Nama)).ToListAsync();
    }

    public async Task<IReadOnlyList<JabatanDto>> ListJabatanAsync(int? idUnit)
    {
        var q = _db.GradingJabatan.AsNoTracking().AsQueryable();
        if (idUnit is int uid) q = q.Where(j => j.IdUnit == uid);
        var jabatan = await q.ToListAsync();

        var bandById = (await _db.GradingBand.AsNoTracking().ToListAsync()).ToDictionary(b => b.IdBand);
        var unitById = (await _db.GradingUnitOrganisasi.AsNoTracking().ToListAsync()).ToDictionary(u => u.IdUnit);
        var jabatanById = (await _db.GradingJabatan.AsNoTracking().ToListAsync()).ToDictionary(j => j.IdJabatan);
        var ids = jabatan.Select(j => j.IdJabatan).ToList();
        var incumbent = await _db.GradingPenempatan.AsNoTracking()
            .Where(p => p.Status == "Aktif" && ids.Contains(p.IdJabatan))
            .ToListAsync();
        var incumbentByJabatan = incumbent.GroupBy(p => p.IdJabatan)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<IncumbentDto>)g
                .Select(p => new IncumbentDto(p.Id, p.IdKaryawan, p.Nama, p.Tmt)).ToList());

        // PTS aktif yang sedang mengisi salah satu jabatan di daftar ini - dipakai frontend
        // menampilkan flag "PTS" di chart/tabel/detail/reporting (bukan cuma tab Penempatan).
        var ptsByJabatan = new Dictionary<int, PtsRingkasDto>();
        var ptsRows = await _db.GradingPejabatSementara.AsNoTracking()
            .Where(x => x.Status == "Aktif" && ids.Contains(x.IdJabatanPengganti))
            .ToListAsync();
        if (ptsRows.Count > 0)
        {
            var ptsNiks = ptsRows.Select(r => r.IdKaryawan).Distinct().ToList();
            var ptsNama = await _gcs.MstPegawai.AsNoTracking()
                .Where(p => ptsNiks.Contains(p.ID_KARYAWAN))
                .ToDictionaryAsync(p => p.ID_KARYAWAN, p => p.NAMA_LENGKAP ?? p.ID_KARYAWAN);
            var jabatanAsliByNik = await _db.GradingPenempatan.AsNoTracking()
                .Where(p => ptsNiks.Contains(p.IdKaryawan) && p.Status == "Aktif")
                .ToDictionaryAsync(p => p.IdKaryawan, p => p.IdJabatan);
            foreach (var r in ptsRows)
            {
                var jabatanAsliNama = jabatanAsliByNik.TryGetValue(r.IdKaryawan, out var jaId) && jabatanById.TryGetValue(jaId, out var ja)
                    ? ja.NamaJabatan : null;
                ptsByJabatan[r.IdJabatanPengganti] = new PtsRingkasDto(
                    r.IdKaryawan, ptsNama.GetValueOrDefault(r.IdKaryawan, r.IdKaryawan), jabatanAsliNama, r.Tmt);
            }
        }

        return jabatan
            .OrderBy(j => j.IdBand).ThenBy(j => j.NamaJabatan)
            .Select(j => new JabatanDto(
                j.IdJabatan, j.Kode, j.NamaJabatan, j.IdBand,
                bandById.TryGetValue(j.IdBand, out var b) ? b.Nama : null, j.Jg,
                j.IdUnit, j.IdUnit is int uid2 && unitById.TryGetValue(uid2, out var u) ? u.Nama : null,
                j.IdAtasan, j.IdAtasan is int aid && jabatanById.TryGetValue(aid, out var a) ? a.NamaJabatan : null,
                j.Inti, j.KelompokFungsi, j.JumlahFormasi, j.Aktif,
                incumbentByJabatan.GetValueOrDefault(j.IdJabatan, Array.Empty<IncumbentDto>()),
                ptsByJabatan.GetValueOrDefault(j.IdJabatan),
                j.Alasan))
            .ToList();
    }

    public async Task<(bool Ok, string? Error, int? Id)> SimpanJabatanAsync(int? id, SimpanJabatanRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NamaJabatan)) return (false, "Nama jabatan wajib diisi.", null);
        if (!await _db.GradingBand.AnyAsync(b => b.IdBand == req.IdBand)) return (false, "Band tidak valid.", null);
        if (req.IdUnit is int unit && !await _db.GradingUnitOrganisasi.AnyAsync(u => u.IdUnit == unit))
            return (false, "Unit tidak ditemukan.", null);
        if (req.IdAtasan == id) return (false, "Jabatan tidak boleh menjadi atasan dirinya sendiri.", null);
        if (req.IdAtasan is int atasan && !await _db.GradingJabatan.AnyAsync(j => j.IdJabatan == atasan))
            return (false, "Jabatan atasan tidak ditemukan.", null);

        int savedId;
        if (id is int existingId)
        {
            var row = await _db.GradingJabatan.FirstOrDefaultAsync(j => j.IdJabatan == existingId);
            if (row is null) return (false, "Jabatan tidak ditemukan.", null);
            row.Kode = req.Kode;
            row.NamaJabatan = req.NamaJabatan.Trim();
            row.IdBand = req.IdBand;
            row.Jg = req.Jg;
            row.IdUnit = req.IdUnit;
            row.IdAtasan = req.IdAtasan;
            row.Inti = req.Inti;
            row.KelompokFungsi = string.IsNullOrWhiteSpace(req.KelompokFungsi) ? null : req.KelompokFungsi.Trim();
            row.JumlahFormasi = req.JumlahFormasi;
            row.Alasan = string.IsNullOrWhiteSpace(req.Alasan) ? null : req.Alasan.Trim();
            row.Aktif = req.Aktif;
            row.DiubahPada = DateTime.UtcNow;
            savedId = existingId;
        }
        else
        {
            var baru = new GradingJabatan
            {
                Kode = req.Kode,
                NamaJabatan = req.NamaJabatan.Trim(),
                IdBand = req.IdBand,
                Jg = req.Jg,
                IdUnit = req.IdUnit,
                IdAtasan = req.IdAtasan,
                Inti = req.Inti,
                KelompokFungsi = string.IsNullOrWhiteSpace(req.KelompokFungsi) ? null : req.KelompokFungsi.Trim(),
                JumlahFormasi = req.JumlahFormasi,
                Alasan = string.IsNullOrWhiteSpace(req.Alasan) ? null : req.Alasan.Trim(),
                Aktif = req.Aktif,
                DibuatPada = DateTime.UtcNow,
            };
            _db.GradingJabatan.Add(baru);
            await _db.SaveChangesAsync();
            savedId = baru.IdJabatan;
            await BangunUlangHirarkiAsync();
            return (true, null, savedId);
        }

        await _db.SaveChangesAsync();
        await BangunUlangHirarkiAsync();
        return (true, null, savedId);
    }

    // paksa=true membolehkan hapus jabatan yg punya RIWAYAT penempatan/PTS - baris
    // grading.penempatan & grading.pejabat_sementara milik jabatan ini IKUT DIHAPUS
    // (siapa saja yg pernah/sedang menempatinya hilang dari riwayat, bukan cuma
    // jabatannya) supaya tak melanggar FK. Dipakai admin utk bebersih data manual
    // (2026-08-20, diminta eksplisit, "sementara" - lihat pesan di OrgStrukturController).
    // Placement AKTIF tetap SELALU diblok apa pun nilai paksa - jangan sampai
    // menghapus jabatan yg sedang benar-benar diisi orang.
    public async Task<(bool Ok, string? Error)> HapusJabatanAsync(int id, bool paksa = false)
    {
        var row = await _db.GradingJabatan.FirstOrDefaultAsync(j => j.IdJabatan == id);
        if (row is null) return (false, "Jabatan tidak ditemukan.");
        if (await _db.GradingPenempatan.AnyAsync(p => p.IdJabatan == id && p.Status == "Aktif"))
            return (false, "Jabatan ini masih ada karyawan aktif menempatinya - akhiri penempatannya dulu.");

        if (!paksa)
        {
            // Riwayat penempatan LAMA (status "Selesai") tetap punya FK ke jabatan
            // (grading.penempatan.id_jabatan, constraint FK_penempatan_jabatan) - cek di
            // atas cuma menyaring yang AKTIF, jadi jabatan yg formasinya sekarang kosong
            // tapi PERNAH diisi orang (mis. hasil mutasi/akhiri penempatan) tetap gagal
            // di-hapus permanen kalau tak dicek juga di sini - sebelumnya ini nyelonong
            // sampai DELETE lalu melanggar FK constraint mentah -> 500 tak tertangani
            // (ditemukan 2026-08-20). Arahkan admin ke "Non-Aktifkan" (field Aktif, sudah
            // ada di form Ubah Jabatan) sbg cara yg benar meretensi jabatan yg sudah tak
            // dipakai TANPA membuang riwayat - kalau memang mau buang riwayatnya jg,
            // pakai paksa=true (hapusJabatanPaksa di frontend).
            if (await _db.GradingPenempatan.AnyAsync(p => p.IdJabatan == id))
                return (false, "Jabatan ini punya riwayat penempatan karyawan (pernah/sedang ditempati) - tidak bisa dihapus permanen agar riwayatnya tidak hilang. Kalau sudah tidak dipakai, non-aktifkan saja lewat Ubah Jabatan (matikan status Aktif).");
            if (await _db.GradingPejabatSementara.AnyAsync(x => x.IdJabatanPengganti == id))
                return (false, "Jabatan ini pernah/sedang ditandai PTS (Pemangku Tugas Sementara) - akhiri/hapus dulu penandaan PTS-nya di Struktur Organisasi > Penempatan Karyawan.");
        }
        if (await _db.GradingJabatan.AnyAsync(j => j.IdAtasan == id))
            return (false, "Jabatan ini masih menjadi atasan jabatan lain - ubah dulu rantai atasannya.");

        if (paksa)
        {
            await _db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM grading.penempatan WHERE id_jabatan = {id}");
            await _db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM grading.pejabat_sementara WHERE id_jabatan_pengganti = {id}");
        }

        // grading.jabatan_hirarki (closure table) punya FK ke grading.jabatan - baris
        // dirinya sendiri (kedalaman 0) dari rebuild terakhir harus dibuang dulu SEBELUM
        // DELETE, baru proc rebuild dipanggil ulang (proc TRUNCATE lalu membangun ulang
        // dari data jabatan yang tersisa, jadi tak perlu hapus baris lain di sini).
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM grading.jabatan_hirarki WHERE id_jabatan_atasan = {id} OR id_jabatan_bawahan = {id}");

        _db.GradingJabatan.Remove(row);
        await _db.SaveChangesAsync();
        await BangunUlangHirarkiAsync();
        return (true, null);
    }

    // Membangun ulang grading.jabatan_hirarki (closure table) dari jabatan.id_atasan -
    // dipakai ApprovalService.ResolveApproverAsync untuk resolusi atasan/manager.
    // Wajib dipanggil ulang tiap kali jabatan/id_atasan berubah (lihat 05-proc-views.sql).
    private async Task BangunUlangHirarkiAsync()
    {
        await _db.Database.ExecuteSqlRawAsync("EXEC grading.usp_bangun_hirarki_jabatan");
    }

    // ===================== Penempatan (siapa mengisi jabatan mana) =====================

    public async Task<IReadOnlyList<PenempatanDto>> ListPenempatanAsync(int? idJabatan, string? idKaryawan, bool hanyaAktif)
    {
        var q = _db.GradingPenempatan.AsNoTracking().AsQueryable();
        if (idJabatan is int jid) q = q.Where(p => p.IdJabatan == jid);
        if (!string.IsNullOrWhiteSpace(idKaryawan)) q = q.Where(p => p.IdKaryawan == idKaryawan);
        if (hanyaAktif) q = q.Where(p => p.Status == "Aktif");

        var rows = await q.OrderByDescending(p => p.Tmt).ThenByDescending(p => p.Id).ToListAsync();
        var jabatanIds = rows.Select(r => r.IdJabatan).Distinct().ToList();
        var namaJabatan = await _db.GradingJabatan.AsNoTracking()
            .Where(j => jabatanIds.Contains(j.IdJabatan))
            .ToDictionaryAsync(j => j.IdJabatan, j => j.NamaJabatan);

        return rows.Select(p => new PenempatanDto(
            p.Id, p.IdJabatan, namaJabatan.GetValueOrDefault(p.IdJabatan, "?"), p.IdKaryawan, p.Nama,
            p.Tmt, p.TanggalSelesai, p.Status, p.Catatan)).ToList();
    }

    public async Task<(bool Ok, string? Error, int? Id)> TempatkanKaryawanAsync(TempatkanKaryawanRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IdKaryawan)) return (false, "Karyawan wajib dipilih.", null);
        var jabatan = await _db.GradingJabatan.AsNoTracking().FirstOrDefaultAsync(j => j.IdJabatan == req.IdJabatan);
        if (jabatan is null) return (false, "Jabatan tidak ditemukan.", null);
        if (!jabatan.Aktif) return (false, "Jabatan ini sudah tidak aktif.", null);

        var pegawai = await _gcs.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_KARYAWAN == req.IdKaryawan);
        if (pegawai is null) return (false, "Karyawan tidak ditemukan.", null);

        // Validasi silang thd PEGAWAI_SDM (roster aktif, SUMBER KEBENARAN payroll/picker
        // pencarian pegawai di seluruh app - lihat GajiService.CariPegawaiAsync) - BUKAN cuma
        // MST_PEGAWAI (tabel profil MyGCS, bisa "basi" - id_karyawan lama tetap ada di sana
        // meski badge pegawai sudah berganti, mis. probation "BP.xxx" -> Tetap "T.xxx").
        // Tanpa cek ini, tombol MUTASI (yang memindahkan baris penempatan LAMA apa adanya,
        // termasuk id_karyawan-nya) bisa diam-diam melanggengkan ID basi - persis kasus yg
        // ditemukan 2026-08-20 (Risma: grading.penempatan terikat "BP.226318", padahal roster
        // aktifnya sudah "T.226323", membuat SELURUH kalkulator payroll gagal menemukannya
        // walau dia tampil normal di bagan Struktur Organisasi).
        if (!await _gcs.PegawaiSdm.AsNoTracking().AnyAsync(p => p.Nik == req.IdKaryawan && p.data_aktif == "Aktif"))
        {
            return (false,
                $"ID karyawan \"{req.IdKaryawan}\" tidak ditemukan di roster SDM aktif (PEGAWAI_SDM) - kemungkinan sudah usang/berganti badge (mis. probation -> Tetap). " +
                "Jangan pakai Mutasi dari baris lama ini; akhiri dulu penempatan lamanya, lalu \"Tempatkan Karyawan\" ulang dgn mencari namanya dari kotak pencarian.",
                null);
        }

        // DbContext dikonfigurasi dgn EnableRetryOnFailure (SqlServerRetryingExecutionStrategy)
        // - transaksi user-initiated biasa (BeginTransactionAsync polos) TIDAK didukung
        // strategi retry itu (EF Core melempar InvalidOperationException saat retry mencoba
        // mengulang transaksi yg sudah separuh jalan). Harus dibungkus lewat
        // CreateExecutionStrategy().ExecuteAsync supaya seluruh blok (baca+tulis+commit)
        // diulang sebagai SATU unit yang retriable.
        var strategy = _db.Database.CreateExecutionStrategy();
        int idBaru = 0;
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            // Satu karyawan hanya boleh punya SATU penempatan aktif (constraint tabel) -
            // akhiri dulu penempatan aktifnya yang lama (kalau ada) sebelum menempatkan baru,
            // ini yang membuat aksi ini sekaligus berfungsi sebagai "mutasi".
            var lama = await _db.GradingPenempatan.FirstOrDefaultAsync(p => p.IdKaryawan == req.IdKaryawan && p.Status == "Aktif");
            if (lama is not null)
            {
                lama.Status = "Selesai";
                lama.TanggalSelesai = req.Tmt ?? DateTime.UtcNow.Date;
            }

            var baru = new GradingPenempatan
            {
                IdJabatan = req.IdJabatan,
                IdKaryawan = req.IdKaryawan,
                Nama = pegawai.NAMA_LENGKAP ?? req.IdKaryawan,
                Tmt = req.Tmt,
                Status = "Aktif",
                Catatan = string.IsNullOrWhiteSpace(req.Catatan) ? null : req.Catatan.Trim(),
                DibuatPada = DateTime.UtcNow,
            };
            _db.GradingPenempatan.Add(baru);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            idBaru = baru.Id;
        });
        return (true, null, idBaru);
    }

    public async Task<(bool Ok, string? Error)> AkhiriPenempatanAsync(int id, AkhiriPenempatanRequest req)
    {
        var row = await _db.GradingPenempatan.FirstOrDefaultAsync(p => p.Id == id);
        if (row is null) return (false, "Penempatan tidak ditemukan.");
        if (row.Status != "Aktif") return (false, "Penempatan ini sudah tidak aktif.");

        row.Status = "Selesai";
        row.TanggalSelesai = req.TanggalSelesai ?? DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(req.Catatan)) row.Catatan = req.Catatan.Trim();
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Pemangku Tugas Sementara (PTS) =====================
    // Karyawan menggantikan sementara formasi atasannya yang kosong - ditandai admin
    // di sini, dibaca GajiService (formula TJ_PTS).

    public async Task<IReadOnlyList<PtsDto>> ListPtsAsync()
    {
        var rows = await _db.GradingPejabatSementara.AsNoTracking()
            .Where(x => x.Status == "Aktif").OrderByDescending(x => x.DibuatPada).ToListAsync();
        if (rows.Count == 0) return Array.Empty<PtsDto>();

        var jabatanById = (await _db.GradingJabatan.AsNoTracking().ToListAsync()).ToDictionary(j => j.IdJabatan);
        var niks = rows.Select(r => r.IdKaryawan).Distinct().ToList();
        var nama = await _gcs.MstPegawai.AsNoTracking()
            .Where(p => niks.Contains(p.ID_KARYAWAN))
            .ToDictionaryAsync(p => p.ID_KARYAWAN, p => p.NAMA_LENGKAP ?? p.ID_KARYAWAN);
        var jabatanAsli = await _db.GradingPenempatan.AsNoTracking()
            .Where(p => niks.Contains(p.IdKaryawan) && p.Status == "Aktif")
            .ToDictionaryAsync(p => p.IdKaryawan, p => p.IdJabatan);

        return rows.Select(r => new PtsDto(
            r.Id, r.IdKaryawan, nama.GetValueOrDefault(r.IdKaryawan, r.IdKaryawan),
            jabatanAsli.TryGetValue(r.IdKaryawan, out var jaId) && jabatanById.TryGetValue(jaId, out var ja) ? ja.NamaJabatan : null,
            r.IdJabatanPengganti, jabatanById.TryGetValue(r.IdJabatanPengganti, out var jp) ? jp.NamaJabatan : "?",
            r.Tmt, r.TanggalSelesai, r.Status, r.Catatan)).ToList();
    }

    public async Task<(bool Ok, string? Error, int? Id)> TandaiPtsAsync(TandaiPtsRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IdKaryawan)) return (false, "Karyawan wajib dipilih.", null);
        var pegawai = await _gcs.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_KARYAWAN == req.IdKaryawan);
        if (pegawai is null) return (false, "Karyawan tidak ditemukan.", null);
        if (!await _db.GradingJabatan.AnyAsync(j => j.IdJabatan == req.IdJabatanPengganti))
            return (false, "Jabatan pengganti tidak ditemukan.", null);

        var lama = await _db.GradingPejabatSementara.FirstOrDefaultAsync(x => x.IdKaryawan == req.IdKaryawan && x.Status == "Aktif");
        if (lama is not null)
        {
            lama.Status = "Selesai";
            lama.TanggalSelesai = req.Tmt ?? DateTime.UtcNow.Date;
        }

        var baru = new GradingPejabatSementara
        {
            IdKaryawan = req.IdKaryawan,
            IdJabatanPengganti = req.IdJabatanPengganti,
            Tmt = req.Tmt,
            Status = "Aktif",
            Catatan = string.IsNullOrWhiteSpace(req.Catatan) ? null : req.Catatan.Trim(),
            DibuatPada = DateTime.UtcNow,
        };
        _db.GradingPejabatSementara.Add(baru);
        await _db.SaveChangesAsync();
        return (true, null, baru.Id);
    }

    public async Task<(bool Ok, string? Error)> AkhiriPtsAsync(int id, AkhiriPtsRequest req)
    {
        var row = await _db.GradingPejabatSementara.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Penandaan PTS tidak ditemukan.");
        if (row.Status != "Aktif") return (false, "Penandaan PTS ini sudah tidak aktif.");

        row.Status = "Selesai";
        row.TanggalSelesai = req.TanggalSelesai ?? DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(req.Catatan)) row.Catatan = req.Catatan.Trim();
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Person Grade (PG) =====================
    // PG melekat ke ORANGNYA (beda dari JG yg melekat ke jabatan, diatur lewat Ubah
    // Jabatan) - dipakai basis komponen tarif JG_PG di Payroll (GajiService.ResolvePgAsync).
    // Sebelumnya cuma bisa diisi lewat SQL manual; CRUD ini yg pertama (2026-08-20).

    public async Task<IReadOnlyList<PersonGradeDto>> ListPersonGradeAsync(string? idKaryawan)
    {
        // Susulkan siklus naik otomatis dulu (kalau ada) sebelum ditampilkan - supaya
        // admin selalu melihat PG yg sudah terkini, bukan baru ketahuan pas Payroll jalan.
        if (!string.IsNullOrWhiteSpace(idKaryawan))
            await NaikkanPgOtomatisJikaSaatnyaAsync(idKaryawan);

        var q = _db.GradingPersonGrade.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(idKaryawan)) q = q.Where(x => x.IdKaryawan == idKaryawan);
        var rows = await q.OrderBy(x => x.Nama).ThenByDescending(x => x.TahunBerlaku).ToListAsync();
        return rows.Select(x => new PersonGradeDto(
            x.Id, x.IdKaryawan, x.Nama, x.Pg, x.GolonganLama, x.TahunBerlaku, x.Catatan, x.DibuatPada)).ToList();
    }

    public async Task<(bool Ok, string? Error, int? Id)> SimpanPersonGradeAsync(int? id, SimpanPersonGradeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IdKaryawan)) return (false, "Karyawan wajib dipilih.", null);
        if (req.TahunBerlaku < 2000) return (false, "Tahun berlaku tidak valid.", null);

        // Validasi silang ke PEGAWAI_SDM (roster aktif) - sama pola dgn guardrail
        // Tempatkan/Mutasi Karyawan (lihat TempatkanKaryawanAsync) supaya PG tidak
        // pernah tersimpan atas ID basi yang sudah tak match roster aktif.
        var pegawai = await _gcs.PegawaiSdm.AsNoTracking().FirstOrDefaultAsync(p => p.Nik == req.IdKaryawan && p.data_aktif == "Aktif");
        if (pegawai is null) return (false, "Karyawan tidak ditemukan di roster SDM aktif.", null);

        // Satu (id_karyawan, tahun_berlaku) cuma boleh satu baris (UQ_person_grade_karyawan_tahun) -
        // baris LAIN (bukan diri sendiri kalau sedang edit) yg sudah pakai kombinasi ini
        // ditolak di sini drpd gagal mentah krn unique index.
        var bentrok = await _db.GradingPersonGrade.FirstOrDefaultAsync(
            x => x.IdKaryawan == req.IdKaryawan && x.TahunBerlaku == req.TahunBerlaku && x.Id != (id ?? 0));
        if (bentrok is not null)
            return (false, $"{pegawai.nama ?? req.IdKaryawan} sudah punya PG untuk tahun {req.TahunBerlaku} - ubah baris yang sudah ada itu saja.", null);

        if (id is int existingId)
        {
            var row = await _db.GradingPersonGrade.FirstOrDefaultAsync(x => x.Id == existingId);
            if (row is null) return (false, "Baris tidak ditemukan.", null);
            row.IdKaryawan = req.IdKaryawan;
            row.Nama = pegawai.nama ?? req.IdKaryawan;
            row.Pg = req.Pg;
            row.GolonganLama = string.IsNullOrWhiteSpace(req.GolonganLama) ? null : req.GolonganLama.Trim();
            row.TahunBerlaku = req.TahunBerlaku;
            row.Catatan = string.IsNullOrWhiteSpace(req.Catatan) ? null : req.Catatan.Trim();
            await _db.SaveChangesAsync();
            return (true, null, row.Id);
        }

        var baru = new GradingPersonGrade
        {
            IdKaryawan = req.IdKaryawan,
            Nama = pegawai.nama ?? req.IdKaryawan,
            Pg = req.Pg,
            GolonganLama = string.IsNullOrWhiteSpace(req.GolonganLama) ? null : req.GolonganLama.Trim(),
            TahunBerlaku = req.TahunBerlaku,
            Catatan = string.IsNullOrWhiteSpace(req.Catatan) ? null : req.Catatan.Trim(),
            DibuatPada = DateTime.UtcNow,
        };
        _db.GradingPersonGrade.Add(baru);
        await _db.SaveChangesAsync();
        return (true, null, baru.Id);
    }

    public async Task<(bool Ok, string? Error)> HapusPersonGradeAsync(int id)
    {
        var row = await _db.GradingPersonGrade.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Baris tidak ditemukan.");
        _db.GradingPersonGrade.Remove(row);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ===================== Siklus naik PG otomatis =====================
    // PG naik +1 tiap 3 tahun (2 tahun kalau diakselerasi - grading.pg_akselerasi),
    // dihitung dari tahun_berlaku baris PG TERAKHIR (baseline manual admin ATAU hasil
    // naik otomatis sebelumnya) - BUKAN dari TMT langsung, supaya tak dobel-hitung
    // riwayat manual yg sudah pernah dimasukkan admin (2026-08-20, diminta eksplisit).
    // PG TIDAK PERNAH melebihi JG jabatan aktif karyawan - kalau PG sudah = JG, mentok
    // (harus promosi jabatan dulu spy JG naik, baru PG bisa lanjut naik). Kalau karyawan
    // tak punya penempatan grading aktif, JG tak diketahui - dilewati (tak ada patokan).
    // Dipanggil lazy (pola sama dgn CutiService.AkrualJikaSiklusBaruAsync) - dari
    // ListPersonGradeAsync (halaman admin) & GajiService.ResolvePgAsync (Payroll), BUKAN
    // cron job (app ini tak punya infra scheduler terjadwal).
    public async Task NaikkanPgOtomatisJikaSaatnyaAsync(string idKaryawan)
    {
        var terakhir = await _db.GradingPersonGrade
            .Where(x => x.IdKaryawan == idKaryawan)
            .OrderByDescending(x => x.TahunBerlaku)
            .FirstOrDefaultAsync();
        if (terakhir is null) return; // belum ada baseline PG - admin blm pernah menetapkan PG awal

        var jg = await _db.GradingPenempatan.AsNoTracking()
            .Where(p => p.IdKaryawan == idKaryawan && p.Status == "Aktif")
            .Join(_db.GradingJabatan, p => p.IdJabatan, j => j.IdJabatan, (p, j) => j.Jg)
            .FirstOrDefaultAsync();
        if (jg is not byte jgValue || jgValue == 0) return; // tak ditempatkan / JG Direksi (null) - tak ada patokan batas atas

        var diakselerasi = await _db.GradingPgAkselerasi.AsNoTracking().AnyAsync(x => x.IdKaryawan == idKaryawan);
        var siklusTahun = diakselerasi ? 2 : 3;

        var tahunSekarang = (short)DateTime.UtcNow.Year;
        var pg = terakhir.Pg;
        var tahunAcuan = terakhir.TahunBerlaku;
        var adaPerubahan = false;

        // Satu baris PG baru per siklus terlewat (bukan lompat langsung ke nilai akhir) -
        // supaya riwayat tetap akurat kalau nanti ada yg butuh PG pada tahun tertentu di
        // masa lalu (mis. hitung ulang Payroll tahun lalu).
        while (pg < jgValue && tahunSekarang - tahunAcuan >= siklusTahun)
        {
            pg++;
            tahunAcuan = (short)(tahunAcuan + siklusTahun);
            _db.GradingPersonGrade.Add(new GradingPersonGrade
            {
                IdKaryawan = idKaryawan,
                Nama = terakhir.Nama,
                Pg = pg,
                TahunBerlaku = tahunAcuan,
                Catatan = $"Naik otomatis (siklus {siklusTahun} tahun)",
                DibuatPada = DateTime.UtcNow,
            });
            adaPerubahan = true;
        }

        if (adaPerubahan) await _db.SaveChangesAsync();
    }

    public async Task<PgAkselerasiStatusDto> GetPgAkselerasiAsync(string idKaryawan)
    {
        var row = await _db.GradingPgAkselerasi.AsNoTracking().FirstOrDefaultAsync(x => x.IdKaryawan == idKaryawan);
        return new PgAkselerasiStatusDto(row is not null, row?.Catatan, row?.DibuatPada);
    }

    public async Task SetPgAkselerasiAsync(string idKaryawan, bool aktif, SetPgAkselerasiRequest? req, string? olehNik)
    {
        var row = await _db.GradingPgAkselerasi.FirstOrDefaultAsync(x => x.IdKaryawan == idKaryawan);
        if (aktif)
        {
            if (row is null)
            {
                _db.GradingPgAkselerasi.Add(new GradingPgAkselerasi
                {
                    IdKaryawan = idKaryawan,
                    Catatan = string.IsNullOrWhiteSpace(req?.Catatan) ? null : req!.Catatan!.Trim(),
                    DitetapkanOleh = olehNik,
                    DibuatPada = DateTime.UtcNow,
                });
            }
        }
        else if (row is not null)
        {
            _db.GradingPgAkselerasi.Remove(row);
        }
        await _db.SaveChangesAsync();
    }
}
