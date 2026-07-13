using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Services;

public class CurrentUserContext
{
    private readonly GcsDbContext _db;

    public CurrentUserContext(GcsDbContext db)
    {
        _db = db;
    }

    public async Task<(EasyUser? User, MstPegawai? Pegawai)> ResolveAsync(ClaimsPrincipal principal)
    {
        var userIdClaim = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userIdClaim is null || !long.TryParse(userIdClaim, out var userId))
        {
            return (null, null);
        }

        var user = await _db.EasyUsers.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return (user, null);
        }

        var pegawai = await _db.MstPegawai.FirstOrDefaultAsync(p => p.ID_KARYAWAN == user.Nik);
        return (user, pegawai);
    }
}
