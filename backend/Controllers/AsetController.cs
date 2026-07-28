using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// My Asset. Semua karyawan melihat inventaris & jadwal maintenance; hanya Admin
// Aset (Departemen Kepatuhan Kabag ke atas s/d GM SKP) yang mengelola.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("aset")]
[ModuleGate("my-asset")]
public class AsetController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly AsetService _aset;

    public AsetController(CurrentUserContext currentUser, AsetService aset)
    {
        _currentUser = currentUser;
        _aset = aset;
    }

    private async Task<string?> NikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
    }

    [HttpGet]
    public async Task<ActionResult<AsetListDto>> List([FromQuery] string? q)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _aset.GetListAsync(nik, q));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<AsetDetailDto>> Detail(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var detail = await _aset.GetDetailAsync(nik, id);
        return detail is null ? NotFound(new { message = "Aset tidak ditemukan." }) : Ok(detail);
    }

    [HttpGet("maintenance")]
    public async Task<ActionResult<MaintenanceListDto>> Maintenance()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _aset.GetMaintenanceListAsync(nik));
    }

    [HttpPost]
    public async Task<IActionResult> Buat([FromBody] SimpanAsetRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _aset.CreateAsync(nik, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Ubah(long id, [FromBody] SimpanAsetRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.UpdateAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Hapus(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.DeleteAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("{id:long}/maintenance")]
    public async Task<IActionResult> TambahMaintenance(long id, [FromBody] SimpanMaintenanceRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.AddMaintenanceAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPut("maintenance/{mid:long}")]
    public async Task<IActionResult> UbahMaintenance(long mid, [FromBody] SimpanMaintenanceRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.UpdateMaintenanceAsync(nik, mid, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("maintenance/{mid:long}")]
    public async Task<IActionResult> HapusMaintenance(long mid)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.DeleteMaintenanceAsync(nik, mid);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
