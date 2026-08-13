using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Dokumen aset (sertifikat/BPKB/STNK/IMB/polis) + reminder jatuh tempo. Route berbagi
// prefix "aset" dengan AsetController/AsetOverlayController - lihat catatan arsitektur
// di AsetDokumenService.cs.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("aset")]
[ModuleGate("my-asset")]
public class AsetDokumenController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly AsetDokumenService _dokumen;

    public AsetDokumenController(CurrentUserContext currentUser, AsetDokumenService dokumen)
    {
        _currentUser = currentUser;
        _dokumen = dokumen;
    }

    private async Task<string?> NikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
    }

    [HttpPost("{objectId}/dokumen")]
    [RequestSizeLimit(AsetDokumenService.MaxUploadBytes)]
    public async Task<ActionResult<AsetDokumenDto>> Upload(string objectId, [FromForm] UploadDokumenForm form)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, dto) = await _dokumen.UploadAsync(nik, objectId, form);
        return ok ? Ok(dto) : BadRequest(new { message = error });
    }

    [HttpPut("dokumen/{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] SimpanDokumenRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _dokumen.UpdateAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("dokumen/{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _dokumen.DeleteAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpGet("dokumen/{id:long}/file")]
    public async Task<IActionResult> GetFile(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (found, path, contentType) = await _dokumen.ResolveFileAsync(id);
        return found ? PhysicalFile(path!, contentType!) : NotFound();
    }

    // Dashboard "Dokumen Jatuh Tempo" - default 30 hari ke depan (H-30).
    [HttpGet("dokumen/jatuh-tempo")]
    public async Task<ActionResult<IReadOnlyList<AsetDokumenJatuhTempoDto>>> JatuhTempo([FromQuery] int hari = 30)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _dokumen.JatuhTempoAsync(hari));
    }
}