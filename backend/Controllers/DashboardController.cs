using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("dashboard")]
public class DashboardController : ControllerBase
{
    private const string AdminRole = "Admin";

    private readonly CurrentUserContext _currentUser;
    private readonly GcsDbContext _db;
    private readonly ModuleAccessService _modules;

    public DashboardController(CurrentUserContext currentUser, GcsDbContext db, ModuleAccessService modules)
    {
        _currentUser = currentUser;
        _db = db;
        _modules = modules;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        // Jabatan hanya pelengkap tampilan: kalau pegawainya belum tertaut, dashboard tetap
        // tampil tanpa baris jabatan - bukan alasan untuk menggagalkan seluruh halaman.
        string? jabatan = null;
        if (pegawai is not null)
        {
            jabatan = await _db.PegawaiSdm
                .Where(p => p.Nik == pegawai.ID_KARYAWAN)
                .Select(p => p.nm_jabatan)
                .FirstOrDefaultAsync();
        }

        var profileComplete = pegawai is not null && ProfileRules.IsComplete(pegawai);

        // Kartu modul mengikuti Panel Admin IT > Akses Modul. Modul "khusus Admin" tidak
        // dikirim sama sekali ke akun biasa.
        var isAdmin = User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
        var modules = await _modules.GetTilesForAsync(isAdmin);

        return Ok(new DashboardSummaryDto(user.Name, jabatan?.Trim(), modules, ProfileComplete: profileComplete));
    }
}
