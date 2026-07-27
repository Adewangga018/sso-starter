using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Kotak Persetujuan manager (terpadu lintas jenis: Izin/Lembur/SPPD/UMDL/Tiket).
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("persetujuan")]
[ModuleGate("my-personal")]
public class ApprovalController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly ApprovalService _approval;

    public ApprovalController(CurrentUserContext currentUser, ApprovalService approval)
    {
        _currentUser = currentUser;
        _approval = approval;
    }

    [HttpGet]
    public async Task<ActionResult<PersetujuanInboxDto>> Inbox()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return Unauthorized();
        }
        return Ok(await _approval.InboxAsync(nik));
    }

    [HttpPost("{id:long}/putusan")]
    public async Task<IActionResult> Putusan(long id, [FromBody] PutusanApprovalRequest req)
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _approval.PutusanAsync(id, nik, req.Setuju, req.Komentar);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
