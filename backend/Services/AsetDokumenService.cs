using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Aset;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Lampiran dokumen per aset (sertifikat tanah, IMB, BPKB, STNK, polis asuransi, dll)
// + reminder jatuh tempo. Berkas fisik disimpan di disk (pola sama seperti modul
// Inovasi - lihat InovasiController.Upload/GetFile), path relatif disimpan di DB.
// Lihat backend/Database/aset/10-dokumen-ddl.sql.
public class AsetDokumenService
{
    private static readonly string[] AllowedExt = [".pdf", ".png", ".jpg", ".jpeg"];
    public const long MaxUploadBytes = 15 * 1024 * 1024;

    private static readonly string[] JenisDikenal =
        ["Sertifikat Tanah", "IMB/PBG", "BPKB", "STNK", "Polis Asuransi", "Kontrak/PO", "Lainnya"];

    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly ModuleAccessService _access;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public AsetDokumenService(ApplicationDbContext db, GcsDbContext gcs, ModuleAccessService access, IConfiguration config, IWebHostEnvironment env)
    {
        _db = db;
        _gcs = gcs;
        _access = access;
        _config = config;
        _env = env;
    }

    public async Task<(bool Ok, string? Error, AsetDokumenDto? Dto)> UploadAsync(string nik, string objectId, UploadDokumenForm form)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, null);
        if (!await AsetExistsAsync(objectId)) return (false, "Aset tidak ditemukan.", null);
        if (string.IsNullOrWhiteSpace(form.JenisDokumen)) return (false, "Jenis dokumen wajib diisi.", null);

        string? relPath = null;
        string? namaAsli = null;
        if (form.File is { Length: > 0 } file)
        {
            if (file.Length > MaxUploadBytes) return (false, "Ukuran berkas maksimal 15 MB.", null);
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExt.Contains(ext)) return (false, "Format berkas tidak didukung (PDF/JPG/PNG saja).", null);

            var dir = Path.Combine(UploadRoot(), objectId);
            Directory.CreateDirectory(dir);
            var fileName = $"{Guid.NewGuid():N}{ext}";
            await using (var stream = File.Create(Path.Combine(dir, fileName)))
                await file.CopyToAsync(stream);
            relPath = $"{objectId}/{fileName}";
            namaAsli = file.FileName;
        }

        var row = new AsetDokumen
        {
            ObjectId = objectId,
            JenisDokumen = JenisDikenal.Contains(form.JenisDokumen) ? form.JenisDokumen : "Lainnya",
            NomorDokumen = Clean(form.NomorDokumen),
            TglTerbit = form.TglTerbit,
            TglJatuhTempo = form.TglJatuhTempo,
            FilePath = relPath,
            FileNamaAsli = namaAsli,
            Catatan = Clean(form.Catatan),
            Status = "Aktif",
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.AsetDokumen.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, MapDokumen(row));
    }

    public async Task<(bool Ok, string? Error)> UpdateAsync(string nik, long id, SimpanDokumenRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetDokumen.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Dokumen tidak ditemukan.");
        if (string.IsNullOrWhiteSpace(req.JenisDokumen)) return (false, "Jenis dokumen wajib diisi.");

        row.JenisDokumen = JenisDikenal.Contains(req.JenisDokumen) ? req.JenisDokumen : "Lainnya";
        row.NomorDokumen = Clean(req.NomorDokumen);
        row.TglTerbit = req.TglTerbit;
        row.TglJatuhTempo = req.TglJatuhTempo;
        row.Catatan = Clean(req.Catatan);
        row.Status = req.Status == "Nonaktif" ? "Nonaktif" : "Aktif";
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetDokumen.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Dokumen tidak ditemukan.");

        if (row.FilePath is not null)
        {
            var full = Path.Combine(UploadRoot(), row.FilePath.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(full)) File.Delete(full);
        }
        _db.AsetDokumen.Remove(row);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // path harus milik folder {objectid} dokumen tsb - tolak traversal (pola sama seperti Inovasi).
    public async Task<(bool Found, string? FullPath, string? ContentType)> ResolveFileAsync(long id)
    {
        var row = await _db.AsetDokumen.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (row?.FilePath is null) return (false, null, null);
        if (row.FilePath.Contains("..") || Path.IsPathRooted(row.FilePath)) return (false, null, null);

        var full = Path.Combine(UploadRoot(), row.FilePath.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(full)) return (false, null, null);
        return (true, full, ContentType(Path.GetExtension(full).ToLowerInvariant()));
    }

    // Dashboard "Dokumen Jatuh Tempo": dokumen Aktif dengan tgl_jatuh_tempo dalam N hari
    // ke depan (termasuk yang sudah lewat - SisaHari negatif). Diurutkan paling mendesak dulu.
    public async Task<IReadOnlyList<AsetDokumenJatuhTempoDto>> JatuhTempoAsync(int hari)
    {
        var batas = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(hari));
        var rows = await _db.AsetDokumen.AsNoTracking()
            .Where(x => x.Status == "Aktif" && x.TglJatuhTempo != null && x.TglJatuhTempo <= batas)
            .OrderBy(x => x.TglJatuhTempo)
            .ToListAsync();
        if (rows.Count == 0) return Array.Empty<AsetDokumenJatuhTempoDto>();

        var objectIds = rows.Select(r => r.ObjectId).Distinct().ToList();
        var nama = await _gcs.AsetErp.AsNoTracking()
            .Where(a => objectIds.Contains(a.OBJECTID))
            .ToDictionaryAsync(a => a.OBJECTID, a => a.DESC_OBJECT);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return rows.Select(r => new AsetDokumenJatuhTempoDto(
            r.Id, r.ObjectId, nama.GetValueOrDefault(r.ObjectId)?.Trim(), r.JenisDokumen, r.NomorDokumen,
            r.TglJatuhTempo!.Value, r.TglJatuhTempo!.Value.DayNumber - today.DayNumber)).ToList();
    }

    private async Task<bool> AsetExistsAsync(string objectId) => await _gcs.AsetErp.AnyAsync(a => a.OBJECTID == objectId);

    private string UploadRoot()
    {
        var configured = _config["Aset:DokumenUploadPath"];
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(_env.ContentRootPath, "uploads", "aset", "dokumen")
            : configured;
    }

    private static string ContentType(string ext) => ext switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    };

    private const string ForbidMsg = "Hanya Admin Aset (Departemen Kepatuhan) yang dapat mengelola aset.";
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static AsetDokumenDto MapDokumen(AsetDokumen d) => new(
        d.Id, d.ObjectId, d.JenisDokumen, d.NomorDokumen, d.TglTerbit, d.TglJatuhTempo,
        d.FilePath is null ? null : $"/api/aset/dokumen/{d.Id}/file", d.FileNamaAsli, d.Catatan, d.Status, d.TglDibuat);
}