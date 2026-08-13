using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Stock opname digital berbasis scan QR. Route berbagi prefix "aset" dengan
// AsetController/AsetOverlayController - lihat catatan arsitektur di AsetOpnameService.cs.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("aset")]
[ModuleGate("my-asset")]
public class AsetOpnameController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly AsetOpnameService _opname;

    public AsetOpnameController(CurrentUserContext currentUser, AsetOpnameService opname)
    {
        _currentUser = currentUser;
        _opname = opname;
    }

    private async Task<string?> NikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
    }

    [HttpGet("opname-sesi")]
    public async Task<ActionResult<IReadOnlyList<AsetOpnameSesiDto>>> ListSesi()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _opname.ListSesiAsync());
    }

    [HttpPost("opname-sesi")]
    public async Task<IActionResult> CreateSesi([FromBody] SimpanOpnameSesiRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _opname.CreateSesiAsync(nik, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpGet("opname-sesi/{id:int}")]
    public async Task<ActionResult<AsetOpnameSesiDetailDto>> GetSesi(int id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var dto = await _opname.GetSesiDetailAsync(id);
        return dto is null ? NotFound(new { message = "Sesi tidak ditemukan." }) : Ok(dto);
    }

    [HttpPost("opname-sesi/{id:int}/selesai")]
    public async Task<IActionResult> Selesaikan(int id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _opname.SelesaikanSesiAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("opname-sesi/{id:int}/scan")]
    [RequestSizeLimit(AsetOpnameService.MaxUploadBytes)]
    public async Task<ActionResult<AsetOpnameScanDto>> SubmitScan(int id, [FromForm] SubmitScanForm form)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, dto) = await _opname.SubmitScanAsync(nik, id, form);
        return ok ? Ok(dto) : BadRequest(new { message = error });
    }

    [HttpGet("opname-sesi/scan/{scanId:long}/foto")]
    public async Task<IActionResult> GetFoto(long scanId)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (found, path, contentType) = await _opname.ResolveFotoAsync(scanId);
        return found ? PhysicalFile(path!, contentType!) : NotFound();
    }
}