using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

// Bridges an authenticated MyGCS token back to the legacy GCS employee record.
// The token (issued by OpenIddict) carries "gcs_uid" (easy.users.Id) and "nik"
// (employee badge) claims, which we use to resolve the user + MST_PEGAWAI row.
public class CurrentUserContext
{
    private readonly GcsDbContext _db;

    public CurrentUserContext(GcsDbContext db)
    {
        _db = db;
    }

    public async Task<(EasyUser? User, MstPegawai? Pegawai)> ResolveAsync(ClaimsPrincipal principal)
    {
        EasyUser? user = null;

        // Preferred: resolve the exact legacy user row via the provenance claim.
        var uidClaim = principal.FindFirstValue("gcs_uid");
        if (long.TryParse(uidClaim, out var userId))
        {
            user = await _db.EasyUsers.FirstOrDefaultAsync(u => u.Id == userId);
        }

        var nik = user?.Nik ?? principal.FindFirstValue("nik");
        if (string.IsNullOrWhiteSpace(nik))
        {
            return (user, null);
        }

        var pegawai = await _db.MstPegawai.FirstOrDefaultAsync(p => p.ID_KARYAWAN == nik);
        return (user, pegawai);
    }
}
