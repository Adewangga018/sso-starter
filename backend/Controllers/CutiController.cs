using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Cuti tahunan (My Personal): saldo + pengajuan + persetujuan atasan.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal/cuti")]
[ModuleGate("my-personal")]
public class CutiController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly CutiService _cuti;

    public CutiController(CurrentUserContext currentUser, CutiService cuti)
    {
        _currentUser = currentUser;
        _cuti = cuti;
    }

    [HttpGet]
    public async Task<ActionResult<CutiDto>> Get()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        }
        return Ok(await _cuti.GetAsync(nik));
    }

    [HttpPost("ajukan")]
    public async Task<IActionResult> Ajukan([FromBody] AjukanCutiRequest req)
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return Unauthorized();
        }
        var nama = pegawai?.NAMA_LENGKAP ?? user?.Name;
        var (ok, error) = await _cuti.AjukanAsync(nik, nama, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("{id:long}/batal")]
    public async Task<IActionResult> Batal(long id)
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _cuti.BatalAsync(id, nik);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("{id:long}/putusan")]
    public async Task<IActionResult> Putusan(long id, [FromBody] PutusanCutiRequest req)
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _cuti.PutusanAsync(id, nik, req.Setuju, req.Komentar);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
