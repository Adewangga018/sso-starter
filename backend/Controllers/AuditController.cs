using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;

namespace SsoBackend.Controllers;

// Read-only view over the audit trail (SRS Fitur D), for Admin IT.
[ApiController]
[Route("api/audit")]
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
        if (from.HasValue)
            query = query.Where(a => a.TimestampUtc >= from.Value);
        if (to.HasValue)
            query = query.Where(a => a.TimestampUtc <= to.Value);

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

        return Ok(rows);
    }

    // The role claim in the OIDC token is "role"; we don't rely on the framework's
    // role-claim-type mapping here to avoid ambiguity.
    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == "Admin");
}
