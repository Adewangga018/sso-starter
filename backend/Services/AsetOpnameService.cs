using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Aset;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

// Stock opname digital berbasis scan QR: opname_sesi = header/batch (opsional dibatasi
// ke kategori tertentu lewat LingkupKategori - GROUP_ASSET dipisah koma), opname_scan =
// event tiap scan (APPEND ONLY, bukan upsert). Laporan selisih (tercatat tapi belum
// discan) dihitung lewat query terhadap GCS.dbo.assets, bukan tabel tambahan.
// Lihat backend/Database/aset/11-opname-ddl.sql.
public class AsetOpnameService
{
    private static readonly string[] AllowedExt = [".jpg", ".jpeg", ".png"];
    public const long MaxUploadBytes = 8 * 1024 * 1024;

    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly ModuleAccessService _access;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AsetOpnameService> _logger;

    public AsetOpnameService(ApplicationDbContext db, GcsDbContext gcs, ModuleAccessService access, IConfiguration config, IWebHostEnvironment env, ILogger<AsetOpnameService> logger)
    {
        _db = db;
        _gcs = gcs;
        _access = access;
        _config = config;
        _env = env;
        _logger = logger;
    }

    public async Task<(bool Ok, string? Error, int Id)> CreateSesiAsync(string nik, SimpanOpnameSesiRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
        if (string.IsNullOrWhiteSpace(req.NamaSesi)) return (false, "Nama sesi wajib diisi.", 0);

        var row = new AsetOpnameSesi
        {
            NamaSesi = req.NamaSesi.Trim(),
            TglMulai = req.TglMulai,
            Status = "Berjalan",
            LingkupKategori = Clean(req.LingkupKategori),
            Catatan = Clean(req.Catatan),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.AsetOpnameSesi.Add(row);
        await _db.SaveChangesAsync();
        return (true, null, row.Id);
    }

    public async Task<(bool Ok, string? Error)> SelesaikanSesiAsync(string nik, int id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var row = await _db.AsetOpnameSesi.FirstOrDefaultAsync(x => x.Id == id);
        if (row is null) return (false, "Sesi tidak ditemukan.");
        row.Status = "Selesai";
        row.TglSelesai = DateOnly.FromDateTime(DateTime.UtcNow);
        row.IdPengubah = nik;
        row.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<IReadOnlyList<AsetOpnameSesiDto>> ListSesiAsync()
    {
        var rows = await _db.AsetOpnameSesi.AsNoTracking().OrderByDescending(x => x.TglDibuat).ToListAsync();
        var result = new List<AsetOpnameSesiDto>(rows.Count);
        foreach (var r in rows)
        {
            var (dalamLingkup, sudahDiscan) = await HitungAsync(r.Id, r.LingkupKategori);
            result.Add(MapSesi(r, dalamLingkup, sudahDiscan));
        }
        return result;
    }

    public async Task<AsetOpnameSesiDetailDto?> GetSesiDetailAsync(int id)
    {
        var sesi = await _db.AsetOpnameSesi.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (sesi is null) return null;

        var scope = await ScopeAsync(sesi.LingkupKategori);
        var scanRows = await _db.AsetOpnameScan.AsNoTracking()
            .Where(x => x.IdSesi == id)
            .OrderByDescending(x => x.TglScan)
            .ToListAsync();
        var scannedIds = scanRows.Select(x => x.ObjectId).Distinct().ToHashSet();
        var nama = await _gcs.AsetErp.AsNoTracking()
            .Where(a => scannedIds.Contains(a.OBJECTID))
            .ToDictionaryAsync(a => a.OBJECTID, a => a.DESC_OBJECT);

        var selisih = scope
            .Where(a => !scannedIds.Contains(a.OBJECTID))
            .Select(a => new AsetOpnameSelisihDto(a.OBJECTID, a.DESC_OBJECT?.Trim(), a.GROUP_ASSET?.Trim(), a.LOKASI?.Trim(), null))
            .OrderBy(a => a.ObjectId)
            .ToList();

        // Sumber dropdown "Kode Aset" di form Catat Scan - dibatasi ke lingkup sesi supaya
        // pemakai tidak bisa (tanpa sengaja) mencatat aset di luar cakupan sesi ini.
        var lingkupAset = scope
            .Select(a => new AsetOpnameLingkupItemDto(a.OBJECTID, a.DESC_OBJECT?.Trim(), a.GROUP_ASSET?.Trim(), scannedIds.Contains(a.OBJECTID)))
            .OrderBy(a => a.ObjectId)
            .ToList();

        var (_, sudahDiscan) = (scope.Count, scannedIds.Count);
        return new AsetOpnameSesiDetailDto(
            MapSesi(sesi, scope.Count, sudahDiscan),
            scanRows.Select(s => MapScan(s, nama.GetValueOrDefault(s.ObjectId)?.Trim())).ToList(),
            selisih,
            lingkupAset);
    }

    public async Task<(bool Ok, string? Error, AsetOpnameScanDto? Dto)> SubmitScanAsync(string nik, int idSesi, SubmitScanForm form)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, null);
        var sesi = await _db.AsetOpnameSesi.AsNoTracking().FirstOrDefaultAsync(x => x.Id == idSesi);
        if (sesi is null) return (false, "Sesi opname tidak ditemukan.", null);
        if (sesi.Status != "Berjalan") return (false, "Sesi opname ini sudah selesai.", null);
        if (string.IsNullOrWhiteSpace(form.ObjectId)) return (false, "Kode aset wajib diisi/discan.", null);

        var objectId = form.ObjectId.Trim();
        var aset = await _gcs.AsetErp.AsNoTracking().FirstOrDefaultAsync(a => a.OBJECTID == objectId);
        if (aset is null) return (false, "Aset tidak ditemukan di ERP.", null);

        // Aset harus sesuai lingkup kategori sesi (kalau sesi dibatasi kategori tertentu) -
        // supaya opname tidak tercampur dengan aset di luar cakupan yang sedang dihitung.
        if (!string.IsNullOrWhiteSpace(sesi.LingkupKategori))
        {
            var kategoriLingkup = sesi.LingkupKategori.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (aset.GROUP_ASSET is null || !kategoriLingkup.Contains(aset.GROUP_ASSET.Trim()))
                return (false, $"Aset ini di luar lingkup kategori sesi ({sesi.LingkupKategori}).", null);
        }

        string? relPath = null;
        string? namaAsli = null;
        if (form.Foto is { Length: > 0 } foto)
        {
            if (foto.Length > MaxUploadBytes) return (false, "Ukuran foto maksimal 8 MB.", null);
            var ext = Path.GetExtension(foto.FileName).ToLowerInvariant();
            if (!AllowedExt.Contains(ext)) return (false, "Format foto tidak didukung (JPG/PNG saja).", null);

            try
            {
                var dir = Path.Combine(UploadRoot(), idSesi.ToString());
                Directory.CreateDirectory(dir);
                var fileName = $"{Guid.NewGuid():N}{ext}";
                await using (var stream = File.Create(Path.Combine(dir, fileName)))
                    await foto.CopyToAsync(stream);
                relPath = $"{idSesi}/{fileName}";
                namaAsli = foto.FileName;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gagal menyimpan foto scan opname (sesi {IdSesi}, aset {ObjectId})", idSesi, objectId);
                return (false, "Gagal menyimpan foto. Coba unggah foto dengan ukuran lebih kecil.", null);
            }
        }

        try
        {
            var row = new AsetOpnameScan
            {
                IdSesi = idSesi,
                ObjectId = objectId,
                LokasiAktual = Clean(form.LokasiAktual),
                KondisiAktual = Clean(form.KondisiAktual),
                FotoPath = relPath,
                FotoNamaAsli = namaAsli,
                Catatan = Clean(form.Catatan),
                NikPemindai = nik,
                TglScan = DateTime.UtcNow,
            };
            _db.AsetOpnameScan.Add(row);
            await _db.SaveChangesAsync();
            return (true, null, MapScan(row, aset.DESC_OBJECT?.Trim()));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal menyimpan baris scan opname (sesi {IdSesi}, aset {ObjectId})", idSesi, objectId);
            return (false, "Gagal menyimpan scan ke database. Coba lagi; kalau berulang, hubungi admin.", null);
        }
    }

    public async Task<(bool Found, string? FullPath, string? ContentType)> ResolveFotoAsync(long scanId)
    {
        var row = await _db.AsetOpnameScan.AsNoTracking().FirstOrDefaultAsync(x => x.Id == scanId);
        if (row?.FotoPath is null) return (false, null, null);
        if (row.FotoPath.Contains("..") || Path.IsPathRooted(row.FotoPath)) return (false, null, null);

        var full = Path.Combine(UploadRoot(), row.FotoPath.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(full)) return (false, null, null);
        return (true, full, ContentType(Path.GetExtension(full).ToLowerInvariant()));
    }

    // Aset dalam lingkup: kategori (GROUP_ASSET) sesuai LingkupKategori (null = semua),
    // dibatasi ke aset yang masih AKTIF (aset write-off tidak perlu diopname fisik).
    private async Task<List<AsetErp>> ScopeAsync(string? lingkupKategori)
    {
        var query = _gcs.AsetErp.AsNoTracking().Where(a => a.AKTIF != null && a.AKTIF == "Y");
        if (!string.IsNullOrWhiteSpace(lingkupKategori))
        {
            var kategori = lingkupKategori.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            query = query.Where(a => a.GROUP_ASSET != null && kategori.Contains(a.GROUP_ASSET));
        }
        return await query.ToListAsync();
    }

    private async Task<(int DalamLingkup, int SudahDiscan)> HitungAsync(int idSesi, string? lingkupKategori)
    {
        var scope = await ScopeAsync(lingkupKategori);
        var scanned = await _db.AsetOpnameScan.AsNoTracking().Where(x => x.IdSesi == idSesi).Select(x => x.ObjectId).Distinct().CountAsync();
        return (scope.Count, scanned);
    }

    private string UploadRoot()
    {
        var configured = _config["Aset:OpnameUploadPath"];
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(_env.ContentRootPath, "uploads", "aset", "opname")
            : configured;
    }

    private static string ContentType(string ext) => ext switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    };

    private const string ForbidMsg = "Hanya Admin Aset (Departemen Kepatuhan) yang dapat mengelola aset.";
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static AsetOpnameSesiDto MapSesi(AsetOpnameSesi s, int dalamLingkup, int sudahDiscan) => new(
        s.Id, s.NamaSesi, s.TglMulai, s.TglSelesai, s.Status, s.LingkupKategori, s.Catatan, dalamLingkup, sudahDiscan, s.TglDibuat);

    private static AsetOpnameScanDto MapScan(AsetOpnameScan s, string? namaAset) => new(
        s.Id, s.IdSesi, s.ObjectId, namaAset, s.LokasiAktual, s.KondisiAktual,
        s.FotoPath is null ? null : $"/api/aset/opname-sesi/scan/{s.Id}/foto", s.FotoNamaAsli, s.Catatan, s.NikPemindai, s.TglScan);
}