using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dinas;

namespace SsoBackend.Services;

// Bukti perjalanan dinas (rentang km + foto lokasi) untuk UMDL & SPPD. Dipakai bersama
// oleh UmdlController/SppdController - jenis validasi rentang km berbeda per fitur
// (UMDL: <75/75-150, SPPD: >150 - dikonfirmasi user, mencerminkan aturan "jarak berapa
// masuk form yang mana"). Foto disimpan sbg file di disk (sama pola dgn foto absensi
// kamera, Attendance.Foto) - hanya path relatif yang dicatat di dinas.bukti.
public class DinasBuktiService
{
    private static readonly IReadOnlyDictionary<string, string[]> RentangValid = new Dictionary<string, string[]>
    {
        ["UMDL"] = ["<75", "75-150"],
        ["SPPD"] = [">150"],
    };

    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<DinasBuktiService> _logger;

    public DinasBuktiService(ApplicationDbContext db, IConfiguration config, IWebHostEnvironment env, ILogger<DinasBuktiService> logger)
    {
        _db = db;
        _config = config;
        _env = env;
        _logger = logger;
    }

    public bool RentangValidUntuk(string jenis, string rentangKm) =>
        RentangValid.TryGetValue(jenis, out var allowed) && allowed.Contains(rentangKm);

    public string PesanRentangSalah(string jenis) => jenis switch
    {
        "UMDL" => "Rentang km untuk UMDL hanya <75km atau 75-150km (Pulang-Pergi). Jarak di atas 150km wajib diajukan lewat SPPD.",
        "SPPD" => "Rentang km untuk SPPD adalah >150km (Pulang-Pergi). Jarak di bawah itu diajukan lewat UMDL.",
        _ => "Rentang km tidak valid.",
    };

    // Simpan/replace foto (kalau fotoDataUrl diisi) & upsert baris dinas.bukti. Panggil
    // SETELAH baris legacy (WebSdmUmdl/WebSdmSppd) berhasil dibuat & di-SaveChanges,
    // supaya refId sudah pasti ada. fotoDataUrl kosong saat Update = pertahankan foto lama.
    public async Task<(bool Ok, string? Error)> SimpanAsync(
        string jenis, string refId, string idKaryawan, string rentangKm,
        string? fotoDataUrl, decimal lat, decimal lng, decimal? accuracy)
    {
        var existing = await _db.DinasBukti.FirstOrDefaultAsync(b => b.Jenis == jenis && b.RefId == refId);

        string fotoPath;
        if (!string.IsNullOrWhiteSpace(fotoDataUrl))
        {
            byte[] bytes;
            try
            {
                bytes = DecodeDataUrl(fotoDataUrl);
            }
            catch (FormatException)
            {
                return (false, "Format foto tidak valid.");
            }

            var basePath = ResolveBasePath();
            var subDir = jenis.ToLowerInvariant();
            var safeNik = new string(idKaryawan.Where(char.IsLetterOrDigit).ToArray());
            var nowWib = DateTime.UtcNow.AddHours(7);
            var fileName = $"{safeNik}_{nowWib:yyyyMMdd_HHmmss}.jpg";
            try
            {
                Directory.CreateDirectory(Path.Combine(basePath, subDir));
                await File.WriteAllBytesAsync(Path.Combine(basePath, subDir, fileName), bytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gagal menyimpan foto bukti dinas ke {BasePath}/{SubDir} (file {FileName})", basePath, subDir, fileName);
                return (false, "Gagal menyimpan foto bukti dinas ke penyimpanan. Hubungi IT.");
            }
            fotoPath = $"{subDir}/{fileName}";
        }
        else if (existing is not null)
        {
            fotoPath = existing.Foto;
        }
        else
        {
            return (false, "Foto bukti dinas wajib diambil terlebih dahulu.");
        }

        if (existing is null)
        {
            var baru = new DinasBukti
            {
                Jenis = jenis,
                RefId = refId,
                IdKaryawan = idKaryawan,
                RentangKm = rentangKm,
                Foto = fotoPath,
                Lat = lat,
                Lng = lng,
                Accuracy = accuracy,
                DibuatPada = DateTime.UtcNow,
            };
            _db.DinasBukti.Add(baru);
        }
        else
        {
            existing.RentangKm = rentangKm;
            existing.Foto = fotoPath;
            existing.Lat = lat;
            existing.Lng = lng;
            existing.Accuracy = accuracy;
        }

        await _db.SaveChangesAsync();
        return (true, null);
    }

    public Task<DinasBukti?> CariAsync(string jenis, string refId) =>
        _db.DinasBukti.AsNoTracking().FirstOrDefaultAsync(b => b.Jenis == jenis && b.RefId == refId);

    // Batch lookup utk daftar (GetAll) - hindari N+1 query per baris.
    public async Task<Dictionary<string, DinasBukti>> CariBanyakAsync(string jenis, IReadOnlyCollection<string> refIds)
    {
        if (refIds.Count == 0) return [];
        var rows = await _db.DinasBukti.AsNoTracking()
            .Where(b => b.Jenis == jenis && refIds.Contains(b.RefId))
            .ToListAsync();
        return rows.ToDictionary(b => b.RefId);
    }

    public async Task HapusAsync(string jenis, string refId)
    {
        var row = await _db.DinasBukti.FirstOrDefaultAsync(b => b.Jenis == jenis && b.RefId == refId);
        if (row is not null)
        {
            _db.DinasBukti.Remove(row);
            await _db.SaveChangesAsync();
        }
    }

    public string ResolvePhysicalPath(string relativePath) =>
        Path.Combine(ResolveBasePath(), relativePath.Replace('/', Path.DirectorySeparatorChar));

    // Kosong = default lokal <ContentRoot>/uploads/dinas (cukup utk dev), sama pola dgn
    // Office:UploadPath. Prod: arahkan ke share ber-izin tulis lewat DinasBukti:PhotoPath.
    private string ResolveBasePath()
    {
        var configured = _config["DinasBukti:PhotoPath"];
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(_env.ContentRootPath, "uploads", "dinas")
            : configured;
    }

    private static byte[] DecodeDataUrl(string dataUrl)
    {
        var idx = dataUrl.IndexOf("base64,", StringComparison.Ordinal);
        var b64 = idx >= 0 ? dataUrl[(idx + 7)..] : dataUrl;
        return Convert.FromBase64String(b64);
    }
}
