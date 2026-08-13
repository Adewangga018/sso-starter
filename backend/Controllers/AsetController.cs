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

    // Inventaris: sumber datanya GCS.dbo.assets (ERP Aktiva Tetap), read-only.
    // Lihat catatan arsitektur di AsetService.cs.
    [HttpGet]
    public async Task<ActionResult<AsetErpListDto>> List([FromQuery] string? q)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _aset.GetErpListAsync(q));
    }

    [HttpGet("{objectId}")]
    public async Task<ActionResult<AsetErpDto>> Detail(string objectId)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var detail = await _aset.GetErpDetailAsync(objectId);
        return detail is null ? NotFound(new { message = "Aset tidak ditemukan." }) : Ok(detail);
    }

    [HttpGet("maintenance")]
    public async Task<ActionResult<MaintenanceListDto>> Maintenance()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _aset.GetMaintenanceListAsync(nik));
    }

    // Buat/Ubah/Hapus Aset (core) DIHAPUS dari controller (Aug 2026): data induk aset
    // sekarang dikelola ERP (dbo.assets), bukan lagi ditulis dari MyGCS. Method-nya
    // (CreateAsync/UpdateAsync/DeleteAsync) masih ada di AsetService, sengaja dibiarkan
    // tidak dipanggil - lihat catatan arsitektur di AsetService.cs.

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

    // ---- aset tidak produktif ----
    [HttpGet("tidak-produktif")]
    public async Task<ActionResult<AsetTidakProduktifListDto>> TidakProduktif()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _aset.GetTidakProduktifListAsync(nik));
    }

    [HttpPost("tidak-produktif")]
    public async Task<IActionResult> BuatTidakProduktif([FromBody] SimpanAsetTidakProduktifRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _aset.CreateTidakProduktifAsync(nik, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPut("tidak-produktif/{id:long}")]
    public async Task<IActionResult> UbahTidakProduktif(long id, [FromBody] SimpanAsetTidakProduktifRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.UpdateTidakProduktifAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("tidak-produktif/{id:long}")]
    public async Task<IActionResult> HapusTidakProduktif(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.DeleteTidakProduktifAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // ---- aktivitas aset tidak produktif ----
    [HttpGet("tidak-produktif/aktivitas")]
    public async Task<ActionResult<AsetTidakProduktifAktivitasListDto>> Aktivitas([FromQuery] long? idAset)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _aset.GetAktivitasListAsync(nik, idAset));
    }

    [HttpPost("tidak-produktif/aktivitas")]
    public async Task<IActionResult> BuatAktivitas([FromBody] SimpanAktivitasRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _aset.CreateAktivitasAsync(nik, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPut("tidak-produktif/aktivitas/{id:long}")]
    public async Task<IActionResult> UbahAktivitas(long id, [FromBody] SimpanAktivitasRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.UpdateAktivitasAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("tidak-produktif/aktivitas/{id:long}")]
    public async Task<IActionResult> HapusAktivitas(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _aset.DeleteAktivitasAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
