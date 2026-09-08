using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;

namespace SsoBackend.Controllers;

// Read-only view over the audit trail (SRS Fitur D), for Admin IT.
[ApiController]
[Route("audit")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AuditController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AuditController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Query(
        [FromQuery] string? email,
        [FromQuery] string? eventType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int take = 100)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        take = Math.Clamp(take, 1, 500);

        var query = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(email))
            query = query.Where(a => a.Email != null && a.Email.Contains(email));
        if (!string.IsNullOrWhiteSpace(eventType))
            query = query.Where(a => a.EventType == eventType);
        // `from`/`to` datang dari <input type="datetime-local"> di AdminAuditPage.jsx -
        // nilainya wall-clock WIB apa adanya (sama seperti yang ditampilkan tabel "Waktu
        // (WIB)"), TANPA info zona waktu. TimestampUtc di kolom DB genuinely UTC, jadi
        // harus digeser -7 jam dulu sebelum dibandingkan - kalau tidak, filter rentang
        // tanggal meleset ~7 jam dari yang dimaksud admin.
        if (from.HasValue)
            query = query.Where(a => a.TimestampUtc >= from.Value.AddHours(-7));
        if (to.HasValue)
            query = query.Where(a => a.TimestampUtc <= to.Value.AddHours(-7));

        var rows = await query
            .OrderByDescending(a => a.TimestampUtc)
            .Take(take)
            .Select(a => new
            {
                a.Id,
                a.TimestampUtc,
                a.EventType,
                a.Email,
                a.IpAddress,
                a.Module,
                a.Detail,
            })
            .ToListAsync();

        // SQL Server datetime2 has no offset/kind - EF Core reads TimestampUtc back as
        // Kind=Unspecified even though it was written from DateTime.UtcNow. Left as-is,
        // System.Text.Json serializes it WITHOUT a "Z" suffix, so the browser's
        // `new Date(...)` parses it as LOCAL time instead of UTC - the frontend's
        // Asia/Jakarta conversion (AdminAuditPage.jsx formatWib) then becomes a no-op,
        // silently displaying raw UTC mislabeled as WIB (reported 2026-09-03). Stamping
        // Kind=Utc here fixes it for every row retroactively - the stored instant was
        // always correct, only the Kind label was lost in the DB round-trip.
        var result = rows.Select(r => new
        {
            r.Id,
            TimestampUtc = DateTime.SpecifyKind(r.TimestampUtc, DateTimeKind.Utc),
            r.EventType,
            r.Email,
            r.IpAddress,
            r.Module,
            r.Detail,
        });

        return Ok(result);
    }

    // The role claim in the OIDC token is "role"; we don't rely on the framework's
    // role-claim-type mapping here to avoid ambiguity.
    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == "Admin");
}
