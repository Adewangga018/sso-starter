using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// My Team (modul 08): atasan memantau tim + delegasi tugas; anggota melihat atasan, rekan
// setim, dan tugas yang diberikan kepadanya. Dibangun dari data grading + absensi + myteam.tugas.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("team")]
[ModuleGate("my-team")]
public class TeamController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly TeamService _team;

    public TeamController(CurrentUserContext currentUser, TeamService team)
    {
        _currentUser = currentUser;
        _team = team;
    }

    // semua=false -> bawahan langsung; semua=true -> seluruh tingkat (dari closure hierarki).
    [HttpGet]
    public async Task<ActionResult<TeamDto>> GetTeam([FromQuery] bool semua = false)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }
        if (string.IsNullOrWhiteSpace(user.Nik))
        {
            return Ok(new TeamDto(false, false, null, null, null, null, 0, 0, 0, [], [], [], []));
        }
        return Ok(await _team.GetTeamAsync(user.Nik, semua));
    }

    // Rekap Tim (monitoring operasional: kehadiran + produktivitas tugas). Hanya untuk atasan.
    [HttpGet("rekap")]
    public async Task<ActionResult<TeamRekapDto>> Rekap()
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var rekap = await _team.RekapTimAsync(user.Nik);
        if (rekap is null)
        {
            return NotFound(new { message = "Rekap tim hanya tersedia untuk atasan yang memiliki bawahan." });
        }
        return Ok(rekap);
    }

    // Unduh laporan tim (CSV siap-Excel) mencakup seluruh level bawahan. Hanya untuk atasan.
    [HttpGet("laporan")]
    public async Task<IActionResult> Laporan()
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var hasil = await _team.BuildLaporanTimAsync(user.Nik);
        if (hasil is null)
        {
            return BadRequest(new { message = "Laporan tim hanya tersedia untuk atasan yang memiliki bawahan." });
        }
        return File(hasil.Value.Content, "text/csv; charset=utf-8", hasil.Value.FileName);
    }

    [HttpPost("tugas")]
    public async Task<IActionResult> BeriTugas([FromBody] TugasCreateRequest req)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error, tugas) = await _team.CreateTugasAsync(user.Nik, user.Name, req);
        if (!ok)
        {
            return BadRequest(new { message = error });
        }
        return Ok(tugas);
    }

    [HttpPut("tugas/{id:int}/status")]
    public async Task<IActionResult> UbahStatus(int id, [FromBody] TugasStatusRequest req)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _team.UpdateStatusAsync(id, user.Nik, req.Status ?? string.Empty);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("tugas/{id:int}")]
    public async Task<IActionResult> HapusTugas(int id)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _team.DeleteTugasAsync(id, user.Nik);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
