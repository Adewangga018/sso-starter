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
    private readonly IAuditLogger _audit;

    public AdminModulesController(ModuleSettingsService modules, IAuditLogger audit)
    {
        _modules = modules;
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
            return BadRequest(new { message = "Tingkat akses harus 'semua' atau 'admin'." });
        }

        var saved = await _modules.SetAsync(key, request.Enabled, access, User.FindFirstValue("email"));
        if (saved is null)
        {
            return NotFound(new { message = "Modul tidak dikenal." });
        }

        var status = saved.Enabled ? "aktif" : "nonaktif";
        var siapa = saved.Access == ModuleAccessLevels.Admin ? "Admin IT saja" : "semua pengguna";
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
