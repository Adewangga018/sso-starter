using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Lapisan operasional My Asset (kondisi, PIC + histori, aktivitas umum, clearance
// SDM) di atas master ERP (GCS.dbo.assets). Route berbagi prefix "aset" dengan
// AsetController - lihat catatan arsitektur di AsetOverlayService.cs.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("aset")]
[ModuleGate("my-asset")]
public class AsetOverlayController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly AsetOverlayService _overlay;

    public AsetOverlayController(CurrentUserContext currentUser, AsetOverlayService overlay)
    {
        _currentUser = currentUser;
        _overlay = overlay;
    }

    private async Task<string?> NikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
    }

    // Dipakai halaman daftar (mis. Input Nomor Aset) yang butuh tahu status admin
    // tanpa memuat overlay tiap baris satu-satu.
    [HttpGet("admin-status")]
    public async Task<ActionResult<object>> AdminStatus()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(new { isAdminAset = await _overlay.IsAdminAsetAsync(nik) });
    }

    // Picker "Individu" (search-as-you-type) & dropdown "Bagian" untuk form PIC.
    [HttpGet("pegawai")]
    public async Task<ActionResult<IReadOnlyList<AsetPegawaiDto>>> CariPegawai([FromQuery] string? q)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _overlay.SearchPegawaiAsync(q));
    }

    [HttpGet("bagian")]
    public async Task<ActionResult<IReadOnlyList<AsetUnitDto>>> ListBagian()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _overlay.ListBagianAsync());
    }

    // Autocomplete "Vendor/Pelaksana" di form Catat Aktivitas (dbo.akun_rekanan).
    [HttpGet("rekanan")]
    public async Task<ActionResult<IReadOnlyList<AsetRekananDto>>> CariRekanan([FromQuery] string? q)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _overlay.SearchRekananAsync(q));
    }

    // Dropdown "Lokasi Aktual" di form scan opname (WILAYAH, dbo.akun_account_cc).
    [HttpGet("lokasi")]
    public async Task<ActionResult<IReadOnlyList<string>>> ListLokasi()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _overlay.ListLokasiAsync());
    }

    [HttpGet("jenis-aktivitas")]
    public async Task<ActionResult<IReadOnlyList<AsetJenisAktivitasDto>>> ListJenisAktivitas()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _overlay.ListJenisAktivitasAsync());
    }

    [HttpGet("{objectId}/overlay")]
    public async Task<ActionResult<AsetOverlayDto>> Overlay(string objectId)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var dto = await _overlay.GetOverlayAsync(nik, objectId);
        return dto is null ? NotFound(new { message = "Aset tidak ditemukan." }) : Ok(dto);
    }

    // Historis: tiap panggilan menambah baris riwayat kondisi baru (POST, bukan PUT/upsert).
    [HttpPost("{objectId}/kondisi")]
    public async Task<IActionResult> SetKondisi(string objectId, [FromBody] SimpanKondisiRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _overlay.SetKondisiAsync(nik, objectId, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPut("{objectId}/nomor")]
    public async Task<IActionResult> SetNomorInternal(string objectId, [FromBody] SimpanNomorInternalRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _overlay.SetNomorInternalAsync(nik, objectId, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("{objectId}/pic")]
    public async Task<IActionResult> AssignPic(string objectId, [FromBody] SimpanPicRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _overlay.AssignPicAsync(nik, objectId, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPost("pic/{id:long}/kembalikan")]
    public async Task<IActionResult> KembalikanPic(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _overlay.ReturnPicAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("{objectId}/aktivitas")]
    public async Task<IActionResult> BuatAktivitas(string objectId, [FromBody] SimpanAktivitasUmumRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _overlay.CreateAktivitasAsync(nik, objectId, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPut("aktivitas/{id:long}")]
    public async Task<IActionResult> UbahAktivitas(long id, [FromBody] SimpanAktivitasUmumRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _overlay.UpdateAktivitasAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("aktivitas/{id:long}")]
    public async Task<IActionResult> HapusAktivitas(long id)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _overlay.DeleteAktivitasAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // Riwayat PIC lintas-aset (READ-ONLY) - filter opsional nik/idUnit/rentang tanggal.
    [HttpGet("pic/riwayat")]
    public async Task<ActionResult<IReadOnlyList<AsetPicRiwayatDto>>> RiwayatPic(
        [FromQuery] string? nik, [FromQuery] int? idUnit, [FromQuery] DateOnly? dari, [FromQuery] DateOnly? sampai)
    {
        var caller = await NikAsync();
        if (string.IsNullOrWhiteSpace(caller)) return Unauthorized();
        return Ok(await _overlay.GetRiwayatPicAsync(nik, idUnit, dari, sampai));
    }

    // Clearance sheet SDM: daftar aset yang masih jadi tanggungan seorang karyawan.
    [HttpGet("clearance")]
    public async Task<ActionResult<AsetClearanceDto>> Clearance([FromQuery] string nik)
    {
        var caller = await NikAsync();
        if (string.IsNullOrWhiteSpace(caller)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        var dto = await _overlay.GetClearanceAsync(nik);
        return dto is null ? NotFound(new { message = $"NIK '{nik}' tidak ditemukan di data pegawai." }) : Ok(dto);
    }
}