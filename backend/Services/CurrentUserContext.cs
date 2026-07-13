using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

// Lightweight identity of the caller, derived entirely from the token claims
// (name/status) — no longer touches easy.users.
public record ResolvedUser(string Name, bool IsActive, string? Nik);

// Bridges an authenticated MyGCS token to the GCS employee record. The token
// (issued by OpenIddict) carries "full_name", "is_active", and "nik" claims; the
// employee master (MST_PEGAWAI) is still read live from GCS by NIK.
public class CurrentUserContext
{
    private readonly GcsDbContext _db;

    public CurrentUserContext(GcsDbContext db)
    {
        _db = db;
    }

    public async Task<(ResolvedUser? User, MstPegawai? Pegawai)> ResolveAsync(ClaimsPrincipal principal)
    {
        var nik = principal.FindFirstValue("nik");

        var name = principal.FindFirstValue("full_name");
        if (string.IsNullOrWhiteSpace(name))
        {
            // Fallback for older tokens issued before the full_name claim existed.
            name = principal.FindFirstValue("name") ?? string.Empty;
        }

        // Absent claim (older tokens) is treated as active; the account was already
        // validated at login, IsActive only gates a deactivated employee.
        var isActiveClaim = principal.FindFirstValue("is_active");
        var isActive = isActiveClaim is null ||
            string.Equals(isActiveClaim, "true", StringComparison.OrdinalIgnoreCase);

        var user = new ResolvedUser(name, isActive, nik);

        if (string.IsNullOrWhiteSpace(nik))
        {
            return (user, null);
        }

        var pegawai = await _db.MstPegawai.FirstOrDefaultAsync(p => p.ID_KARYAWAN == nik);
        return (user, pegawai);
    }
}
