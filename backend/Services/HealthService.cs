using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Health;

namespace SsoBackend.Services;

// My Health (inisiasi awal: MCU). Karyawan melihat HANYA hasil MCU dirinya;
// Admin Kepatuhan (Departemen Kepatuhan) mengelola periode & mencatat hasil semua peserta.
public class HealthService
{
    private readonly ApplicationDbContext _db;
    private readonly ModuleAccessService _access;

    public HealthService(ApplicationDbContext db, ModuleAccessService access)
    {
        _db = db;
        _access = access;
    }

    // ---- Karyawan: riwayat MCU sendiri ----
    public async Task<HealthRiwayatDto> GetRiwayatAsync(string nik)
    {
        var periodeMap = await _db.HealthPeriode.AsNoTracking()
            .ToDictionaryAsync(p => p.Id, p => p);

        var hasil = await _db.HealthHasil.AsNoTracking()
            .Where(h => h.Nik == nik)
            .Select(h => new
            {
                h.Id, h.IdPeriode, h.Nik, h.Nama, h.TglPemeriksaan, h.Tinggi, h.Berat,
                h.TekananDarah, h.StatusUmum, h.Ringkasan, h.Rekomendasi, h.StatusTindakLanjut,
                AdaLampiran = h.Konten != null, h.NamaFile, h.NamaPencatat, h.TglDicatat, h.TglDiubah,
            })
            .ToListAsync();

        var items = hasil
            .Select(h => ToHasilDto(h.Id, h.IdPeriode, periodeMap, h.Nik, h.Nama, h.TglPemeriksaan,
                h.Tinggi, h.Berat, h.TekananDarah, h.StatusUmum, h.Ringkasan, h.Rekomendasi,
                h.StatusTindakLanjut, h.AdaLampiran, h.NamaFile, h.NamaPencatat, h.TglDicatat, h.TglDiubah))
            .OrderByDescending(h => h.Tahun).ThenByDescending(h => h.TglPemeriksaan)
            .ToList();

        // Periode yang direncanakan/berlangsung (informasi bagi karyawan).
        var aktif = periodeMap.Values
            .Where(p => p.Status != "Selesai")
            .OrderByDescending(p => p.Tahun).ThenBy(p => p.Judul)
            .Select(p => new HealthPeriodeDto(p.Id, p.Judul, p.Tahun, p.Penyelenggara, p.Lokasi,
                p.TglMulai, p.TglSelesai, p.Catatan, p.Status, 0))
            .ToList();

        var isAdmin = await _access.IsHealthAdminAsync(nik);
        return new HealthRiwayatDto(items, aktif, isAdmin);
    }

    // Satu hasil (karyawan pemilik atau admin).
    public async Task<(bool Ok, string? Error, HealthHasilDto? Data)> GetHasilAsync(string nik, long id)
    {
        var h = await _db.HealthHasil.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (h is null) return (false, "Hasil MCU tidak ditemukan.", null);
        if (h.Nik != nik && !await _access.IsHealthAdminAsync(nik)) return (false, ForbidLihat, null);
        var periodeMap = await _db.HealthPeriode.AsNoTracking().Where(p => p.Id == h.IdPeriode)
            .ToDictionaryAsync(p => p.Id, p => p);
        var dto = ToHasilDto(h.Id, h.IdPeriode, periodeMap, h.Nik, h.Nama, h.TglPemeriksaan,
            h.Tinggi, h.Berat, h.TekananDarah, h.StatusUmum, h.Ringkasan, h.Rekomendasi,
            h.StatusTindakLanjut, h.Konten != null, h.NamaFile, h.NamaPencatat, h.TglDicatat, h.TglDiubah);
        return (true, null, dto);
    }

    // Lampiran laporan MCU (pemilik atau admin).
    public async Task<(bool Ok, string? Error, byte[] Konten, string? Tipe, string Nama)?> GetFileAsync(string nik, long hasilId)
    {
        var h = await _db.HealthHasil.AsNoTracking()
            .Where(x => x.Id == hasilId)
            .Select(x => new { x.Nik, x.Konten, x.TipeFile, x.NamaFile })
            .FirstOrDefaultAsync();
        if (h is null || h.Konten is null) return null;
        if (h.Nik != nik && !await _access.IsHealthAdminAsync(nik)) return (false, ForbidLihat, Array.Empty<byte>(), null, "");
        return (true, null, h.Konten, h.TipeFile, h.NamaFile ?? "lampiran");
    }

    // ---- Admin Kepatuhan: periode ----
    public async Task<HealthPeriodeListDto> GetPeriodeListAsync(string nik)
    {
        var counts = await _db.HealthHasil.AsNoTracking()
            .GroupBy(h => h.IdPeriode)
            .Select(g => new { IdPeriode = g.Key, N = g.Count() })
            .ToDictionaryAsync(x => x.IdPeriode, x => x.N);
        var items = (await _db.HealthPeriode.AsNoTracking()
            .OrderByDescending(p => p.Tahun).ThenBy(p => p.Judul).ToListAsync())
            .Select(p => new HealthPeriodeDto(p.Id, p.Judul, p.Tahun, p.Penyelenggara, p.Lokasi,
                p.TglMulai, p.TglSelesai, p.Catatan, p.Status,
                counts.TryGetValue(p.Id, out var n) ? n : 0))
            .ToList();
        var isAdmin = await _access.IsHealthAdminAsync(nik);
        return new HealthPeriodeListDto(items, isAdmin);
    }

    public async Task<(bool Ok, string? Error, HealthPeriodeDetailDto? Data)> GetPeriodeDetailAsync(string nik, long id)
    {
        if (!await _access.IsHealthAdminAsync(nik)) return (false, ForbidKelola, null);
        var p = await _db.HealthPeriode.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return (false, "Periode MCU tidak ditemukan.", null);
        var periodeMap = new Dictionary<long, HealthPeriode> { [p.Id] = p };
        var hasil = (await _db.HealthHasil.AsNoTracking()
            .Where(h => h.IdPeriode == id)
            .Select(h => new
            {
                h.Id, h.IdPeriode, h.Nik, h.Nama, h.TglPemeriksaan, h.Tinggi, h.Berat,
                h.TekananDarah, h.StatusUmum, h.Ringkasan, h.Rekomendasi, h.StatusTindakLanjut,
                AdaLampiran = h.Konten != null, h.NamaFile, h.NamaPencatat, h.TglDicatat, h.TglDiubah,
            })
            .ToListAsync())
            .Select(h => ToHasilDto(h.Id, h.IdPeriode, periodeMap, h.Nik, h.Nama, h.TglPemeriksaan,
                h.Tinggi, h.Berat, h.TekananDarah, h.StatusUmum, h.Ringkasan, h.Rekomendasi,
                h.StatusTindakLanjut, h.AdaLampiran, h.NamaFile, h.NamaPencatat, h.TglDicatat, h.TglDiubah))
            .OrderBy(h => h.Nama).ToList();
        var pd = new HealthPeriodeDto(p.Id, p.Judul, p.Tahun, p.Penyelenggara, p.Lokasi,
            p.TglMulai, p.TglSelesai, p.Catatan, p.Status, hasil.Count);
        return (true, null, new HealthPeriodeDetailDto(pd, hasil, true));
    }

    public async Task<(bool Ok, string? Error, long Id)> CreatePeriodeAsync(string nik, SimpanPeriodeRequest req)
    {
        if (!await _access.IsHealthAdminAsync(nik)) return (false, ForbidKelola, 0);
        var (valid, err) = ValidasiPeriode(req);
        if (!valid) return (false, err, 0);
        var p = new HealthPeriode
        {
            Judul = req.Judul.Trim(), Tahun = req.Tahun,
            Penyelenggara = Clean(req.Penyelenggara), Lokasi = Clean(req.Lokasi),
            TglMulai = ParseTgl(req.TglMulai), TglSelesai = ParseTgl(req.TglSelesai),
            Catatan = Clean(req.Catatan), Status = NormStatusPeriode(req.Status),
            IdPembuat = nik, TglDibuat = DateTime.UtcNow,
        };
        _db.HealthPeriode.Add(p);
        await _db.SaveChangesAsync();
        return (true, null, p.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdatePeriodeAsync(string nik, long id, SimpanPeriodeRequest req)
    {
        if (!await _access.IsHealthAdminAsync(nik)) return (false, ForbidKelola);
        var (valid, err) = ValidasiPeriode(req);
        if (!valid) return (false, err);
        var p = await _db.HealthPeriode.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return (false, "Periode MCU tidak ditemukan.");
        p.Judul = req.Judul.Trim(); p.Tahun = req.Tahun;
        p.Penyelenggara = Clean(req.Penyelenggara); p.Lokasi = Clean(req.Lokasi);
        p.TglMulai = ParseTgl(req.TglMulai); p.TglSelesai = ParseTgl(req.TglSelesai);
        p.Catatan = Clean(req.Catatan); p.Status = NormStatusPeriode(req.Status);
        p.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeletePeriodeAsync(string nik, long id)
    {
        if (!await _access.IsHealthAdminAsync(nik)) return (false, ForbidKelola);
        var p = await _db.HealthPeriode.FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return (false, "Periode MCU tidak ditemukan.");
        var hasil = await _db.HealthHasil.Where(h => h.IdPeriode == id).ToListAsync();
        _db.HealthHasil.RemoveRange(hasil);
        _db.HealthPeriode.Remove(p);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- Admin Kepatuhan: hasil MCU ----
    public async Task<(bool Ok, string? Error, long Id)> SimpanHasilAsync(
        string nik, string? namaPencatat, long? hasilId, long idPeriode,
        string pesertaNik, string? pesertaNama, DateOnly? tglPemeriksaan,
        decimal? tinggi, decimal? berat, string? tekananDarah, string statusUmum,
        string? ringkasan, string? rekomendasi, string statusTindakLanjut,
        byte[]? konten, string? namaFile, string? tipeFile, bool hapusLampiran)
    {
        if (!await _access.IsHealthAdminAsync(nik)) return (false, ForbidKelola, 0);
        if (string.IsNullOrWhiteSpace(pesertaNik)) return (false, "NIK peserta wajib diisi.", 0);
        if (!StatusUmumValid(statusUmum)) return (false, "Status umum tidak valid.", 0);
        if (!StatusTlValid(statusTindakLanjut)) return (false, "Status tindak lanjut tidak valid.", 0);
        var periode = await _db.HealthPeriode.FirstOrDefaultAsync(p => p.Id == idPeriode);
        if (periode is null) return (false, "Periode MCU tidak ditemukan.", 0);
        var pnik = pesertaNik.Trim();

        HealthHasil h;
        if (hasilId is { } hid && hid > 0)
        {
            var existing = await _db.HealthHasil.FirstOrDefaultAsync(x => x.Id == hid);
            if (existing is null) return (false, "Hasil MCU tidak ditemukan.", 0);
            h = existing;
            h.TglDiubah = DateTime.UtcNow;
        }
        else
        {
            if (await _db.HealthHasil.AnyAsync(x => x.IdPeriode == idPeriode && x.Nik == pnik))
                return (false, $"Peserta NIK {pnik} sudah memiliki hasil pada periode ini.", 0);
            h = new HealthHasil { IdPeriode = idPeriode, IdPencatat = nik, TglDicatat = DateTime.UtcNow };
            _db.HealthHasil.Add(h);
        }

        h.Nik = pnik;
        h.Nama = Clean(pesertaNama);
        h.TglPemeriksaan = tglPemeriksaan;
        h.Tinggi = tinggi;
        h.Berat = berat;
        h.TekananDarah = Clean(tekananDarah);
        h.StatusUmum = statusUmum;
        h.Ringkasan = Clean(ringkasan);
        h.Rekomendasi = Clean(rekomendasi);
        h.StatusTindakLanjut = statusTindakLanjut;
        h.NamaPencatat = Clean(namaPencatat) ?? h.NamaPencatat;
        if (konten is { Length: > 0 })
        {
            h.Konten = konten;
            h.NamaFile = namaFile;
            h.TipeFile = tipeFile;
        }
        else if (hapusLampiran)
        {
            h.Konten = null; h.NamaFile = null; h.TipeFile = null;
        }

        await _db.SaveChangesAsync();
        return (true, null, h.Id);
    }

    public async Task<(bool Ok, string? Error)> DeleteHasilAsync(string nik, long id)
    {
        if (!await _access.IsHealthAdminAsync(nik)) return (false, ForbidKelola);
        var h = await _db.HealthHasil.FirstOrDefaultAsync(x => x.Id == id);
        if (h is null) return (false, "Hasil MCU tidak ditemukan.");
        _db.HealthHasil.Remove(h);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- helpers ----
    private const string ForbidKelola = "Hanya Admin Kepatuhan yang dapat mengelola data MCU.";
    private const string ForbidLihat = "Anda hanya dapat melihat hasil MCU milik sendiri.";

    private static HealthHasilDto ToHasilDto(long id, long idPeriode, IReadOnlyDictionary<long, HealthPeriode> periodeMap,
        string pnik, string? nama, DateOnly? tglPemeriksaan, decimal? tinggi, decimal? berat, string? tekanan,
        string statusUmum, string? ringkasan, string? rekomendasi, string statusTl, bool adaLampiran, string? namaFile,
        string? namaPencatat, DateTime tglDicatat, DateTime? tglDiubah)
    {
        periodeMap.TryGetValue(idPeriode, out var p);
        var (bmi, kat) = HitungBmi(tinggi, berat);
        return new HealthHasilDto(
            id, idPeriode, p?.Judul ?? "-", p?.Tahun ?? 0, pnik, nama, tglPemeriksaan,
            tinggi, berat, bmi, kat, tekanan, statusUmum, ringkasan, rekomendasi, statusTl,
            adaLampiran, namaFile, namaPencatat, tglDicatat, tglDiubah);
    }

    private static (double?, string?) HitungBmi(decimal? tinggiCm, decimal? beratKg)
    {
        if (tinggiCm is not { } t || beratKg is not { } b || t <= 0) return (null, null);
        var m = (double)t / 100.0;
        var bmi = Math.Round((double)b / (m * m), 1);
        var kat = bmi < 18.5 ? "Kurang" : bmi < 25.0 ? "Normal" : bmi < 30.0 ? "Berlebih" : "Obesitas";
        return (bmi, kat);
    }

    private static (bool, string?) ValidasiPeriode(SimpanPeriodeRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Judul)) return (false, "Judul periode wajib diisi.");
        if (r.Tahun < 2000 || r.Tahun > 2100) return (false, "Tahun tidak valid.");
        return (true, null);
    }

    private static bool StatusUmumValid(string s) => s is "Sehat" or "Perlu Perhatian" or "Tindak Lanjut";
    private static bool StatusTlValid(string s) => s is "Tidak Perlu" or "Belum" or "Dijadwalkan" or "Selesai";
    private static string NormStatusPeriode(string? s) =>
        s is "Berlangsung" or "Selesai" ? s : "Direncanakan";
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static DateOnly? ParseTgl(string? s) => DateOnly.TryParse(s, out var d) ? d : null;
}
