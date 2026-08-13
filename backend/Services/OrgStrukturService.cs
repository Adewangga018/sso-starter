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

    public OrgStrukturService(ApplicationDbContext db, GcsDbContext gcs)
    {
        _db = db;
        _gcs = gcs;
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

        return jabatan
            .OrderBy(j => j.IdBand).ThenBy(j => j.NamaJabatan)
            .Select(j => new JabatanDto(
                j.IdJabatan, j.Kode, j.NamaJabatan, j.IdBand,
                bandById.TryGetValue(j.IdBand, out var b) ? b.Nama : null, j.Jg,
                j.IdUnit, j.IdUnit is int uid2 && unitById.TryGetValue(uid2, out var u) ? u.Nama : null,
                j.IdAtasan, j.IdAtasan is int aid && jabatanById.TryGetValue(aid, out var a) ? a.NamaJabatan : null,
                j.Inti, j.KelompokFungsi, j.JumlahFormasi, j.Aktif,
                incumbentByJabatan.GetValueOrDefault(j.IdJabatan, Array.Empty<IncumbentDto>())))
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

    public async Task<(bool Ok, string? Error)> HapusJabatanAsync(int id)
    {
        var row = await _db.GradingJabatan.FirstOrDefaultAsync(j => j.IdJabatan == id);
        if (row is null) return (false, "Jabatan tidak ditemukan.");
        if (await _db.GradingPenempatan.AnyAsync(p => p.IdJabatan == id && p.Status == "Aktif"))
            return (false, "Jabatan ini masih ada karyawan aktif menempatinya - akhiri penempatannya dulu.");
        if (await _db.GradingJabatan.AnyAsync(j => j.IdAtasan == id))
            return (false, "Jabatan ini masih menjadi atasan jabatan lain - ubah dulu rantai atasannya.");

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
        return (true, null, baru.Id);
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
}
