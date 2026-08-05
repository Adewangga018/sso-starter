using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Panel Admin IT > Akses Modul: menentukan modul mana yang aktif dan siapa yang boleh
// membukanya (semua pengguna atau Admin IT saja), serta mendaftarkan modul baru (mis. "My
// Library") dan logo tiap modul. Pengaturannya dipakai di tiga tempat: kartu modul dashboard
// (DashboardController), penjaga rute SPA (RequireModule.jsx), dan penjaga API tiap modul
// (ModuleGateAttribute).
[ApiController]
[Route("admin/modules")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminModulesController : ControllerBase
{
    private const string AdminRole = "Admin";
    private const long MaxLogoBytes = 2 * 1024 * 1024;
    private static readonly HashSet<string> AllowedLogoExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".svg", ".webp",
    };

    private readonly ModuleSettingsService _modules;
    private readonly FeatureSettingsService _features;
    private readonly IAuditLogger _audit;
    private readonly IWebHostEnvironment _env;

    public AdminModulesController(ModuleSettingsService modules, FeatureSettingsService features, IAuditLogger audit, IWebHostEnvironment env)
    {
        _modules = modules;
        _features = features;
        _audit = audit;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ModuleSettingDto>>> GetAll()
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        return Ok(await _modules.GetSettingsAsync());
    }

    // ---- Fitur (item menu) per modul ----
    [HttpGet("features")]
    public async Task<ActionResult<IReadOnlyList<FeatureSettingDto>>> GetFeatures()
    {
        if (!IsAdmin()) return Forbid();
        return Ok(await _features.GetSettingsAsync());
    }

    [HttpPut("features/{key}")]
    public async Task<ActionResult<FeatureSettingDto>> UpdateFeature(string key, [FromBody] FeatureSettingRequest request)
    {
        if (!IsAdmin()) return Forbid();
        var saved = await _features.SetAsync(key, request.Enabled, User.FindFirstValue("email"));
        if (saved is null) return NotFound(new { message = "Fitur tidak dikenal." });

        await _audit.LogAsync(
            "feature.access_changed",
            User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier),
            User.FindFirstValue("email"),
            $"Fitur {saved.Label} ({saved.Key}) diatur {(saved.Enabled ? "terbuka" : "terkunci")}.");
        return Ok(saved);
    }

    [HttpPut("{key}")]
    public async Task<ActionResult<ModuleSettingDto>> Update(string key, [FromBody] ModuleSettingRequest request)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var access = (request.Access ?? string.Empty).Trim().ToLowerInvariant();
        if (!ModuleAccessLevels.IsValid(access))
        {
            return BadRequest(new { message = "Tingkat akses harus 'semua', 'admin_modul', atau 'admin'." });
        }

        var saved = await _modules.SetAsync(key, request.Enabled, access, User.FindFirstValue("email"));
        if (saved is null)
        {
            return NotFound(new { message = "Modul tidak dikenal." });
        }

        var status = saved.Enabled ? "aktif" : "nonaktif";
        var siapa = saved.Access switch
        {
            ModuleAccessLevels.Admin => "Admin IT saja",
            ModuleAccessLevels.AdminModul => "Admin IT & Admin Modul terkait",
            _ => "semua pengguna",
        };
        await _audit.LogAsync(
            "module.access_changed",
            User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier),
            User.FindFirstValue("email"),
            $"Modul {saved.Label} ({saved.Key}) diatur {status}, akses {siapa}.");

        return Ok(saved);
    }

    // Mendaftarkan modul baru (mis. "My Library"). Modul yang baru dibuat belum punya
    // halaman sungguhan - tampil sebagai kartu "Coming Soon" di dashboard (tidak ada route
    // SPA yang cocok) sampai developer membangun modulnya secara terpisah.
    [HttpPost]
    public async Task<ActionResult<ModuleSettingDto>> Create([FromBody] CreateModuleRequest request)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var label = (request.Label ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(label))
        {
            return BadRequest(new { message = "Nama modul wajib diisi." });
        }

        var access = (request.Access ?? string.Empty).Trim().ToLowerInvariant();
        if (!ModuleAccessLevels.IsValid(access))
        {
            return BadRequest(new { message = "Tingkat akses harus 'semua' atau 'admin'." });
        }

        var result = await _modules.CreateModuleAsync(
            request.Key, label, request.Subtitle ?? string.Empty, request.Icon ?? string.Empty,
            request.Enabled, access, User.FindFirstValue("email"));

        if (result.Error == ModuleSettingsService.CreateModuleError.InvalidKey)
        {
            return BadRequest(new { message = "Key modul harus berupa huruf kecil/angka dipisah tanda hubung, 3-50 karakter (mis. 'my-library')." });
        }
        if (result.Error == ModuleSettingsService.CreateModuleError.DuplicateKey)
        {
            return Conflict(new { message = "Key modul sudah dipakai." });
        }

        await _audit.LogAsync(
            "module.created",
            User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier),
            User.FindFirstValue("email"),
            $"Modul baru {result.Module!.Label} ({result.Module.Key}) didaftarkan.");

        return Ok(result.Module);
    }

    // Upload/ganti logo modul. Berlaku untuk modul katalog maupun modul custom.
    [HttpPost("{key}/logo")]
    [RequestSizeLimit(MaxLogoBytes)]
    public async Task<ActionResult<ModuleSettingDto>> UploadLogo(string key, IFormFile file)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Berkas logo kosong." });
        }
        if (file.Length > MaxLogoBytes)
        {
            return BadRequest(new { message = "Ukuran logo maksimal 2 MB." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedLogoExt.Contains(ext))
        {
            return BadRequest(new { message = "Format logo harus PNG, JPG, SVG, atau WEBP." });
        }

        var dir = Path.Combine(_env.ContentRootPath, "uploads", "modules");
        Directory.CreateDirectory(dir);
        var fileName = $"{Guid.NewGuid():N}{ext}";
        var full = Path.Combine(dir, fileName);
        await using (var stream = System.IO.File.Create(full))
        {
            await file.CopyToAsync(stream);
        }

        var (module, oldLogoPath) = await _modules.SetLogoAsync(key, fileName, User.FindFirstValue("email"));
        if (module is null)
        {
            System.IO.File.Delete(full);
            return NotFound(new { message = "Modul tidak dikenal." });
        }

        if (!string.IsNullOrWhiteSpace(oldLogoPath) && oldLogoPath != fileName)
        {
            try
            {
                var oldFull = Path.Combine(dir, oldLogoPath);
                if (System.IO.File.Exists(oldFull))
                {
                    System.IO.File.Delete(oldFull);
                }
            }
            catch
            {
                // Berkas lama gagal dihapus - bukan alasan menggagalkan request, logo baru
                // sudah tersimpan dan tercatat di DB.
            }
        }

        await _audit.LogAsync(
            "module.logo_updated",
            User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier),
            User.FindFirstValue("email"),
            $"Logo modul {module.Label} ({module.Key}) diperbarui.");

        return Ok(module);
    }

    // Menyajikan file logo modul. Tanpa IsAdmin()/[Authorize] tambahan sengaja - logo modul
    // murni gambar branding (setara PNG statis di /public yang dipakai sebelum fitur ini),
    // dan dirender lewat <img src> langsung di banyak kartu dashboard untuk semua pengguna.
    [HttpGet("{key}/logo")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLogo(string key)
    {
        var logoPath = await _modules.GetLogoPathAsync(key);
        if (string.IsNullOrWhiteSpace(logoPath) || logoPath.Contains("..") || Path.IsPathRooted(logoPath))
        {
            return NotFound();
        }

        var full = Path.Combine(_env.ContentRootPath, "uploads", "modules", logoPath);
        if (!System.IO.File.Exists(full))
        {
            return NotFound();
        }

        var ext = Path.GetExtension(full).ToLowerInvariant();
        return PhysicalFile(full, ContentType(ext));
    }

    private static string ContentType(string ext) => ext switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".svg" => "image/svg+xml",
        ".webp" => "image/webp",
        _ => "application/octet-stream",
    };

    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
}
