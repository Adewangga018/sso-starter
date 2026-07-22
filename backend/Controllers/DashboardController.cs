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
    private readonly CurrentUserContext _currentUser;
    private readonly GcsDbContext _db;

    public DashboardController(CurrentUserContext currentUser, GcsDbContext db)
    {
        _currentUser = currentUser;
        _db = db;
    }

    private static readonly IReadOnlyList<ModuleTileDto> Modules = new[]
    {
        new ModuleTileDto("my-personal", "My Personal", "HR MANAGEMENT", "users", true),
        new ModuleTileDto("my-office", "My Office", "SURAT-MENYURAT", "mail", false),
        new ModuleTileDto("my-prosedur", "My Prosedur", "SOP & KEBIJAKAN", "clipboard-check", false),
        new ModuleTileDto("my-health", "My Health", "KESEHATAN", "activity", false),
        new ModuleTileDto("my-innovation", "My Innovation", "INOVASI", "lightbulb", true),
        new ModuleTileDto("my-asset", "My Asset", "ASET", "archive", false),
        new ModuleTileDto("my-progress", "My Progress", "KPI", "trending-up", false),
        new ModuleTileDto("my-team", "My Team", "KINERJA TIM", "users-round", false),
    };

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
        return Ok(new DashboardSummaryDto(user.Name, jabatan?.Trim(), Modules, ProfileComplete: profileComplete));
    }
}
