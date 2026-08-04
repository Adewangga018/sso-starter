using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Panel Admin IT > Akses Modul: menentukan modul mana yang aktif dan siapa yang boleh
// membukanya (semua pengguna atau Admin IT saja). Pengaturannya dipakai di tiga tempat:
// kartu modul dashboard (DashboardController), penjaga rute SPA (RequireModule.jsx), dan
// penjaga API tiap modul (ModuleGateAttribute).
[ApiController]
[Route("admin/modules")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminModulesController : ControllerBase
{
    private const string AdminRole = "Admin";

    private readonly ModuleSettingsService _modules;
    private readonly FeatureSettingsService _features;
    private readonly IAuditLogger _audit;

    public AdminModulesController(ModuleSettingsService modules, FeatureSettingsService features, IAuditLogger audit)
    {
        _modules = modules;
        _features = features;
        _audit = audit;
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

    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
}
