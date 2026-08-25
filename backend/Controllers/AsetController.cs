using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// My Asset. Semua karyawan melihat inventaris; hanya Admin Aset (Departemen
// Kepatuhan Kabag ke atas s/d GM SKP) yang mengelola.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("aset")]
[ModuleGate("my-asset")]
public class AsetController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly AsetService _aset;
    private readonly AsetExportService _export;

    public AsetController(CurrentUserContext currentUser, AsetService aset, AsetExportService export)
    {
        _currentUser = currentUser;
        _aset = aset;
        _export = export;
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

    // Export Excel dari daftar Inventaris - filter (q + 4 dropdown) sama seperti yang
    // sedang tampil di layar. Literal "export/excel" diregister sebelum {objectId} di
    // bawah supaya tidak ketabrak (rute literal menang atas rute parameter di ASP.NET Core).
    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? q, [FromQuery] string? kelompok, [FromQuery] string? lokasi,
        [FromQuery] string? pic, [FromQuery] string? klasifikasi)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var rows = await _aset.GetErpExportRowsAsync(q, kelompok, lokasi, pic, klasifikasi);
        var bytes = _export.BuildExcel(rows);
        var fileName = $"Inventaris-Aset-{DateTime.Now:yyyyMMdd-HHmm}.xlsx";
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    [HttpGet("{objectId}")]
    public async Task<ActionResult<AsetErpDto>> Detail(string objectId)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var detail = await _aset.GetErpDetailAsync(objectId);
        return detail is null ? NotFound(new { message = "Aset tidak ditemukan." }) : Ok(detail);
    }

    // ---- Pendaftaran aset baru (Aug 2026, keputusan berikutnya): dbo.assets tetap SSOT,
    // tapi MyGCS sekarang BOLEH menulis identitas dasar aset baru ke sana - lihat catatan
    // lengkap di AsetService.DaftarAsetBaruAsync.
    [HttpGet("group-asset")]
    public async Task<ActionResult<IReadOnlyList<AsetGroupDto>>> GroupAsset()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _aset.ListGroupAssetAsync());
    }

    [HttpGet("kelompok")]
    public async Task<ActionResult<IReadOnlyList<AsetKelompokDto>>> Kelompok([FromQuery] string? groupAsset)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _aset.ListKelompokAsync(groupAsset));
    }

    [HttpGet("kode-cc")]
    public async Task<ActionResult<IReadOnlyList<AsetKodeCcDto>>> KodeCc()
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _aset.ListKodeCcAsync());
    }

    [HttpPost("daftar")]
    public async Task<IActionResult> DaftarBaru([FromBody] SimpanAsetBaruRequest req)
    {
        var nik = await NikAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, objectId) = await _aset.DaftarAsetBaruAsync(nik, req);
        // ok=true dengan error terisi = aset TETAP berhasil didaftarkan ke ERP, tapi ada
        // langkah tambahan (Nomor Internal) yang gagal - dikirim sebagai peringatan, bukan
        // kegagalan, supaya frontend tidak mengira seluruh pendaftaran gagal lalu retry.
        return ok ? Ok(new { objectId, warning = error }) : BadRequest(new { message = error });
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
