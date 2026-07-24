using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Admin IT control panel (SRS "Admin IT"): platform overview + account & role management.
// Everything here is gated to the Admin role. Module registration and security-policy config
// are future work; the account/role management is the live piece.
[ApiController]
[Route("admin")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminController : ControllerBase
{
    private const string AdminRole = "Admin";
    private const string JuriRole = "Juri";
    private const string PengelolaJuriRole = "PengelolaJuri";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;
    private readonly IAuditLogger _audit;

    public AdminController(UserManager<ApplicationUser> userManager, ApplicationDbContext db, IAuditLogger audit)
    {
        _userManager = userManager;
        _db = db;
        _audit = audit;
    }

    // Cards for the admin dashboard: user counts + a security-events snapshot (last 7 days).
    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var totalUsers = await _userManager.Users.CountAsync();
        var activeUsers = await _userManager.Users.CountAsync(u => u.IsActive);
        var adminCount = (await _userManager.GetUsersInRoleAsync(AdminRole)).Count;

        var since = DateTime.UtcNow.AddDays(-7);
        var failedLogins = await _db.AuditLogs.CountAsync(a => a.TimestampUtc >= since && a.EventType == "login.failure");
        var lockouts = await _db.AuditLogs.CountAsync(a => a.TimestampUtc >= since && a.EventType == "login.lockout");

        return Ok(new
        {
            totalUsers,
            activeUsers,
            adminCount,
            securityEvents7d = failedLogins + lockouts,
            failedLogins7d = failedLogins,
            lockouts7d = lockouts,
        });
    }

    // Directory of SSO accounts with their role/status, for the management table.
    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] string? q)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var adminIds = (await _userManager.GetUsersInRoleAsync(AdminRole)).Select(u => u.Id).ToHashSet();
        var juriIds = (await _userManager.GetUsersInRoleAsync(JuriRole)).Select(u => u.Id).ToHashSet();
        var pengelolaIds = (await _userManager.GetUsersInRoleAsync(PengelolaJuriRole)).Select(u => u.Id).ToHashSet();
        var me = _userManager.GetUserId(User);

        var query = _userManager.Users.AsNoTracking();
        var term = (q ?? string.Empty).Trim();
        if (term.Length > 0)
        {
            query = query.Where(u =>
                (u.Email != null && u.Email.Contains(term)) ||
                (u.FullName != null && u.FullName.Contains(term)) ||
                (u.Nik != null && u.Nik.Contains(term)));
        }

        var users = await query
            .OrderBy(u => u.FullName)
            .Take(100)
            .ToListAsync();

        var now = DateTimeOffset.UtcNow;
        var rows = users.Select(u => new
        {
            id = u.Id,
            email = u.Email,
            fullName = u.FullName,
            nik = u.Nik,
            isActive = u.IsActive,
            isAdmin = adminIds.Contains(u.Id),
            isJuri = juriIds.Contains(u.Id),
            isPengelolaJuri = pengelolaIds.Contains(u.Id),
            locked = u.LockoutEnd.HasValue && u.LockoutEnd > now,
            twoFactor = u.TwoFactorEnabled,
            isSelf = u.Id == me,
        });

        return Ok(rows);
    }

    public record ToggleRequest(bool Enabled);

    // Grant/revoke the Admin (IT) role - the "toggle admin on/off" per account.
    [HttpPost("users/{id}/role/admin")]
    public async Task<IActionResult> SetAdmin(string id, [FromBody] ToggleRequest req)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var me = _userManager.GetUserId(User);
        if (id == me && !req.Enabled)
        {
            return BadRequest(new { message = "Anda tidak bisa mencabut hak Admin dari akun sendiri." });
        }

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound(new { message = "Pengguna tidak ditemukan." });
        }

        var isAdmin = await _userManager.IsInRoleAsync(user, AdminRole);
        if (req.Enabled && !isAdmin)
        {
            await _userManager.AddToRoleAsync(user, AdminRole);
            await _audit.LogAsync("role.admin_granted", user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");
        }
        else if (!req.Enabled && isAdmin)
        {
            await _userManager.RemoveFromRoleAsync(user, AdminRole);
            await _audit.LogAsync("role.admin_revoked", user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");
        }

        return NoContent();
    }

    // Grant/revoke the Juri (innovation jury) role - lets Admin appoint who may
    // be placed on a penilaian stream and score risalah in My Innovation.
    [HttpPost("users/{id}/role/juri")]
    public async Task<IActionResult> SetJuri(string id, [FromBody] ToggleRequest req)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound(new { message = "Pengguna tidak ditemukan." });
        }

        var isJuri = await _userManager.IsInRoleAsync(user, JuriRole);
        if (req.Enabled && !isJuri)
        {
            await _userManager.AddToRoleAsync(user, JuriRole);
            await _audit.LogAsync("role.juri_granted", user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");
        }
        else if (!req.Enabled && isJuri)
        {
            await _userManager.RemoveFromRoleAsync(user, JuriRole);
            await _audit.LogAsync("role.juri_revoked", user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");
        }

        return NoContent();
    }

    // Grant/revoke the PengelolaJuri (jury coordinator) role. Holders may ONLY
    // manage Stream Penilai & Penugasan ke Inovasi in My Innovation - no other
    // Admin IT privileges.
    [HttpPost("users/{id}/role/pengelola-juri")]
    public async Task<IActionResult> SetPengelolaJuri(string id, [FromBody] ToggleRequest req)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound(new { message = "Pengguna tidak ditemukan." });
        }

        var isPengelola = await _userManager.IsInRoleAsync(user, PengelolaJuriRole);
        if (req.Enabled && !isPengelola)
        {
            await _userManager.AddToRoleAsync(user, PengelolaJuriRole);
            await _audit.LogAsync("role.pengelola_juri_granted", user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");
        }
        else if (!req.Enabled && isPengelola)
        {
            await _userManager.RemoveFromRoleAsync(user, PengelolaJuriRole);
            await _audit.LogAsync("role.pengelola_juri_revoked", user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");
        }

        return NoContent();
    }

    // Activate/deactivate an account (a deactivated account cannot sign in).
    [HttpPost("users/{id}/active")]
    public async Task<IActionResult> SetActive(string id, [FromBody] ToggleRequest req)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var me = _userManager.GetUserId(User);
        if (id == me && !req.Enabled)
        {
            return BadRequest(new { message = "Anda tidak bisa menonaktifkan akun sendiri." });
        }

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound(new { message = "Pengguna tidak ditemukan." });
        }

        if (user.IsActive != req.Enabled)
        {
            user.IsActive = req.Enabled;
            await _userManager.UpdateAsync(user);
            await _audit.LogAsync(req.Enabled ? "account.activated" : "account.deactivated",
                user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");
        }

        return NoContent();
    }

    // Clear a lockout (e.g. after too many failed logins) so the user can sign in again.
    [HttpPost("users/{id}/unlock")]
    public async Task<IActionResult> Unlock(string id)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound(new { message = "Pengguna tidak ditemukan." });
        }

        await _userManager.SetLockoutEndDateAsync(user, null);
        await _userManager.ResetAccessFailedCountAsync(user);
        await _audit.LogAsync("account.unlocked", user.Id, user.Email, $"Via panel admin oleh {User.FindFirstValue("email")}");

        return NoContent();
    }

    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
}
