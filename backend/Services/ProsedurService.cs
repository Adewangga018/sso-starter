using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Prosedur;

namespace SsoBackend.Services;

// My Prosedur: repository SOP/Kebijakan + kontrol versi + pencarian + acknowledgement.
// Semua karyawan membaca dokumen berlaku & menyatakan sudah baca; hanya Admin
// Kepatuhan (Departemen Kepatuhan) yang mengunggah/mengelola.
public class ProsedurService
{
    private readonly ApplicationDbContext _db;
    private readonly ModuleAccessService _access;

    public ProsedurService(ApplicationDbContext db, ModuleAccessService access)
    {
        _db = db;
        _access = access;
    }

    public async Task<ProsedurListDto> GetListAsync(string nik, string? q, string? jenis)
    {
        var query = _db.ProsedurDokumen.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(jenis)) query = query.Where(d => d.Jenis == jenis);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var t = q.Trim();
            query = query.Where(d => d.Judul.Contains(t) || d.Kode.Contains(t)
                || (d.Kategori != null && d.Kategori.Contains(t))
                || (d.Deskripsi != null && d.Deskripsi.Contains(t))
                || (d.Unit != null && d.Unit.Contains(t)));
        }
        var docs = await query.OrderBy(d => d.Kode).ToListAsync();
        var ids = docs.Select(d => d.Id).ToList();

        // Versi berlaku (tanpa konten). Fallback: bila tak ada Berlaku, ambil versi terbaru.
        var versiRingkas = await _db.ProsedurVersi.AsNoTracking()
            .Where(v => ids.Contains(v.IdDokumen))
            .Select(v => new { v.Id, v.IdDokumen, v.Versi, v.Status, v.TglBerlaku, v.NamaFile, v.TglUnggah })
            .ToListAsync();
        var berlakuPerDok = versiRingkas.Where(v => v.Status == "Berlaku")
            .ToDictionary(v => v.IdDokumen);

        var berlakuVersiIds = berlakuPerDok.Values.Select(v => v.Id).ToList();
        var ackSet = (await _db.ProsedurAcknowledgement.AsNoTracking()
            .Where(a => a.Nik == nik && berlakuVersiIds.Contains(a.IdVersi))
            .Select(a => a.IdVersi).ToListAsync()).ToHashSet();

        var items = docs.Select(d =>
        {
            berlakuPerDok.TryGetValue(d.Id, out var v);
            var sudahAck = v is not null && ackSet.Contains(v.Id);
            return new ProsedurDokumenDto(
                d.Id, d.Kode, d.Judul, d.Jenis, d.Unit, d.Kategori, d.Deskripsi,
                v?.Versi, v is not null ? "Berlaku" : "Tidak Aktif", v?.TglBerlaku, v?.Id, v?.NamaFile,
                sudahAck, v?.TglUnggah);
        }).ToList();

        var belumAck = items.Count(i => i.IdVersiBerlaku is not null && !i.SudahAck);
        var isAdmin = await _access.IsProsedurAdminAsync(nik);
        return new ProsedurListDto(items, isAdmin, belumAck);
    }

    public async Task<ProsedurDetailDto?> GetDetailAsync(string nik, long id)
    {
        var d = await _db.ProsedurDokumen.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return null;

        var versi = await _db.ProsedurVersi.AsNoTracking()
            .Where(v => v.IdDokumen == id)
            .OrderByDescending(v => v.Versi)
            .Select(v => new { v.Id, v.Versi, v.Ringkasan, v.NamaFile, v.TipeFile, v.Status, v.TglBerlaku, v.NamaPenerbit, v.TglUnggah })
            .ToListAsync();

        var ackCounts = await _db.ProsedurAcknowledgement.AsNoTracking()
            .Where(a => a.IdDokumen == id)
            .GroupBy(a => a.IdVersi)
            .Select(g => new { IdVersi = g.Key, N = g.Count() })
            .ToDictionaryAsync(x => x.IdVersi, x => x.N);

        var berlaku = versi.FirstOrDefault(v => v.Status == "Berlaku");
        var sudahAckBerlaku = berlaku is not null &&
            await _db.ProsedurAcknowledgement.AsNoTracking().AnyAsync(a => a.IdVersi == berlaku.Id && a.Nik == nik);

        var versiDto = versi.Select(v => new ProsedurVersiDto(
            v.Id, v.Versi, v.Ringkasan, v.NamaFile, v.TipeFile, v.Status, v.TglBerlaku, v.NamaPenerbit, v.TglUnggah,
            ackCounts.TryGetValue(v.Id, out var n) ? n : 0)).ToList();

        var isAdmin = await _access.IsProsedurAdminAsync(nik);
        return new ProsedurDetailDto(
            d.Id, d.Kode, d.Judul, d.Jenis, d.Unit, d.Kategori, d.Deskripsi, versiDto,
            berlaku?.Id, berlaku?.Versi, sudahAckBerlaku, isAdmin,
            berlaku is not null && ackCounts.TryGetValue(berlaku.Id, out var nb) ? nb : 0);
    }

    // Berkas satu versi (untuk unduh/lihat). Semua karyawan boleh.
    public async Task<(byte[] Konten, string? Tipe, string Nama)?> GetFileAsync(long versiId)
    {
        var v = await _db.ProsedurVersi.AsNoTracking()
            .Where(x => x.Id == versiId)
            .Select(x => new { x.Konten, x.TipeFile, x.NamaFile })
            .FirstOrDefaultAsync();
        return v is null ? null : (v.Konten, v.TipeFile, v.NamaFile);
    }

    // Karyawan menyatakan sudah baca versi berlaku dari sebuah dokumen.
    public async Task<(bool Ok, string? Error)> AckAsync(string nik, string? nama, long dokumenId)
    {
        var berlaku = await _db.ProsedurVersi.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdDokumen == dokumenId && v.Status == "Berlaku");
        if (berlaku is null) return (false, "Dokumen ini tidak memiliki versi berlaku.");
        if (await _db.ProsedurAcknowledgement.AnyAsync(a => a.IdVersi == berlaku.Id && a.Nik == nik))
            return (true, null); // sudah, idempoten
        _db.ProsedurAcknowledgement.Add(new ProsedurAcknowledgement
        {
            IdVersi = berlaku.Id, IdDokumen = dokumenId, Nik = nik, Nama = nama, Tgl = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Daftar orang yang sudah acknowledge versi berlaku (Admin).
    public async Task<(bool Ok, string? Error, IReadOnlyList<ProsedurAckOrangDto>? Data)> GetAckOrangAsync(string nik, long dokumenId)
    {
        if (!await _access.IsProsedurAdminAsync(nik)) return (false, ForbidMsg, null);
        var berlaku = await _db.ProsedurVersi.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdDokumen == dokumenId && v.Status == "Berlaku");
        if (berlaku is null) return (true, null, Array.Empty<ProsedurAckOrangDto>());
        var rows = await _db.ProsedurAcknowledgement.AsNoTracking()
            .Where(a => a.IdVersi == berlaku.Id).OrderBy(a => a.Nama)
            .Select(a => new ProsedurAckOrangDto(a.Nik, a.Nama, a.Tgl)).ToListAsync();
        return (true, null, rows);
    }

    // ---- Admin Kepatuhan ----
    public async Task<(bool Ok, string? Error, long Id)> CreateAsync(string nik, string? nama, UbahDokumenRequest meta,
        DateOnly? tglBerlaku, string? ringkasan, byte[] konten, string namaFile, string? tipeFile)
    {
        if (!await _access.IsProsedurAdminAsync(nik)) return (false, ForbidMsg, 0);
        var (valid, err) = ValidasiMeta(meta);
        if (!valid) return (false, err, 0);
        if (konten.Length == 0) return (false, "Berkas dokumen wajib diunggah.", 0);
        var kode = meta.Kode.Trim();
        if (await _db.ProsedurDokumen.AnyAsync(d => d.Kode == kode)) return (false, $"Kode dokumen '{kode}' sudah dipakai.", 0);

        var dok = new ProsedurDokumen
        {
            Kode = kode, Judul = meta.Judul.Trim(), Jenis = meta.Jenis,
            Unit = Clean(meta.Unit), Kategori = Clean(meta.Kategori), Deskripsi = Clean(meta.Deskripsi),
            IdPembuat = nik, TglDibuat = DateTime.UtcNow,
        };
        _db.ProsedurDokumen.Add(dok);
        await _db.SaveChangesAsync();

        _db.ProsedurVersi.Add(new ProsedurVersi
        {
            IdDokumen = dok.Id, Versi = 1, Ringkasan = Clean(ringkasan),
            NamaFile = namaFile, TipeFile = tipeFile, Konten = konten, Status = "Berlaku",
            TglBerlaku = tglBerlaku, IdPenerbit = nik, NamaPenerbit = nama, TglUnggah = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null, dok.Id);
    }

    // Versi baru: versi lama 'Berlaku' → 'Usang', versi baru jadi 'Berlaku'.
    public async Task<(bool Ok, string? Error)> AddVersiAsync(string nik, string? nama, long dokumenId,
        DateOnly? tglBerlaku, string? ringkasan, byte[] konten, string namaFile, string? tipeFile)
    {
        if (!await _access.IsProsedurAdminAsync(nik)) return (false, ForbidMsg);
        if (konten.Length == 0) return (false, "Berkas dokumen wajib diunggah.");
        var dok = await _db.ProsedurDokumen.FirstOrDefaultAsync(d => d.Id == dokumenId);
        if (dok is null) return (false, "Dokumen tidak ditemukan.");

        var versiList = await _db.ProsedurVersi.Where(v => v.IdDokumen == dokumenId).ToListAsync();
        var next = (versiList.Count > 0 ? versiList.Max(v => v.Versi) : 0) + 1;
        foreach (var v in versiList.Where(v => v.Status == "Berlaku")) v.Status = "Usang";

        _db.ProsedurVersi.Add(new ProsedurVersi
        {
            IdDokumen = dokumenId, Versi = next, Ringkasan = Clean(ringkasan),
            NamaFile = namaFile, TipeFile = tipeFile, Konten = konten, Status = "Berlaku",
            TglBerlaku = tglBerlaku, IdPenerbit = nik, NamaPenerbit = nama, TglUnggah = DateTime.UtcNow,
        });
        dok.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> UpdateMetaAsync(string nik, long id, UbahDokumenRequest meta)
    {
        if (!await _access.IsProsedurAdminAsync(nik)) return (false, ForbidMsg);
        var (valid, err) = ValidasiMeta(meta);
        if (!valid) return (false, err);
        var dok = await _db.ProsedurDokumen.FirstOrDefaultAsync(d => d.Id == id);
        if (dok is null) return (false, "Dokumen tidak ditemukan.");
        var kode = meta.Kode.Trim();
        if (await _db.ProsedurDokumen.AnyAsync(d => d.Kode == kode && d.Id != id)) return (false, $"Kode dokumen '{kode}' sudah dipakai.");
        dok.Kode = kode; dok.Judul = meta.Judul.Trim(); dok.Jenis = meta.Jenis;
        dok.Unit = Clean(meta.Unit); dok.Kategori = Clean(meta.Kategori); dok.Deskripsi = Clean(meta.Deskripsi);
        dok.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Tarik/aktifkan sebuah versi. Mengaktifkan (Berlaku) menonaktifkan versi berlaku lain.
    public async Task<(bool Ok, string? Error)> SetStatusVersiAsync(string nik, long versiId, string status)
    {
        if (!await _access.IsProsedurAdminAsync(nik)) return (false, ForbidMsg);
        if (status is not ("Berlaku" or "Usang" or "Ditarik")) return (false, "Status tidak valid.");
        var v = await _db.ProsedurVersi.FirstOrDefaultAsync(x => x.Id == versiId);
        if (v is null) return (false, "Versi tidak ditemukan.");
        if (status == "Berlaku")
        {
            var lain = await _db.ProsedurVersi.Where(x => x.IdDokumen == v.IdDokumen && x.Status == "Berlaku" && x.Id != versiId).ToListAsync();
            foreach (var o in lain) o.Status = "Usang";
        }
        v.Status = status;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(string nik, long id)
    {
        if (!await _access.IsProsedurAdminAsync(nik)) return (false, ForbidMsg);
        var dok = await _db.ProsedurDokumen.FirstOrDefaultAsync(d => d.Id == id);
        if (dok is null) return (false, "Dokumen tidak ditemukan.");
        var acks = await _db.ProsedurAcknowledgement.Where(a => a.IdDokumen == id).ToListAsync();
        _db.ProsedurAcknowledgement.RemoveRange(acks);
        var versi = await _db.ProsedurVersi.Where(v => v.IdDokumen == id).ToListAsync();
        _db.ProsedurVersi.RemoveRange(versi);
        _db.ProsedurDokumen.Remove(dok);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private const string ForbidMsg = "Hanya Admin Kepatuhan yang dapat mengelola dokumen prosedur.";
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static (bool, string?) ValidasiMeta(UbahDokumenRequest m)
    {
        if (string.IsNullOrWhiteSpace(m.Kode)) return (false, "Kode/nomor dokumen wajib diisi.");
        if (string.IsNullOrWhiteSpace(m.Judul)) return (false, "Judul dokumen wajib diisi.");
        if (m.Jenis is not ("SOP" or "Kebijakan" or "Instruksi Kerja" or "Formulir")) return (false, "Jenis dokumen tidak valid.");
        return (true, null);
    }
}
