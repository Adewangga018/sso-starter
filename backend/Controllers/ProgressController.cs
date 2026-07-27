using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// My Progress (KPI). Admin SDM kelola KPI perusahaan; atasan menurunkan & menilai
// KPI bawahan (seluruh jenjang); karyawan melihat KPI miliknya sendiri.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("progress")]
public class ProgressController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly KpiService _kpi;

    public ProgressController(CurrentUserContext currentUser, KpiService kpi)
    {
        _currentUser = currentUser;
        _kpi = kpi;
    }

    private async Task<(string? Nik, string? Nama)> MeAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return (pegawai?.ID_KARYAWAN ?? user?.Nik, pegawai?.NAMA_LENGKAP ?? user?.Name);
    }

    // KPI Saya (+ konteks KPI perusahaan, flag peran).
    [HttpGet]
    public async Task<ActionResult<KpiSayaDto>> Saya()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _kpi.GetSayaAsync(nik));
    }

    // Daftar KPI perusahaan.
    [HttpGet("perusahaan")]
    public async Task<ActionResult<IReadOnlyList<KpiDto>>> Perusahaan()
    {
        return Ok(await _kpi.GetPerusahaanAsync());
    }

    [HttpPost("perusahaan")]
    public async Task<IActionResult> BuatPerusahaan([FromBody] SimpanKpiRequest req)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _kpi.CreatePerusahaanAsync(nik, nama, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // Anggota tim (seluruh jenjang) untuk penurunan KPI.
    [HttpGet("tim")]
    public async Task<ActionResult<IReadOnlyList<KpiAnggotaDto>>> Tim()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _kpi.GetTimAsync(nik));
    }

    // KPI milik seorang bawahan.
    [HttpGet("tim/{targetNik}")]
    public async Task<ActionResult<IReadOnlyList<KpiDto>>> KpiKaryawan(string targetNik)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, data) = await _kpi.GetKaryawanKpiAsync(nik, targetNik);
        return ok ? Ok(data) : BadRequest(new { message = error });
    }

    // Turunkan KPI ke seorang bawahan.
    [HttpPost("tim/{targetNik}")]
    public async Task<IActionResult> TurunkanKpi(string targetNik, [FromBody] SimpanKpiRequest req)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _kpi.CreateIndividuAsync(nik, nama, targetNik, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Ubah(long id, [FromBody] SimpanKpiRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _kpi.UpdateAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // Nilai realisasi (atasan menilai).
    [HttpPut("{id:long}/nilai")]
    public async Task<IActionResult> Nilai(long id, [FromBody] NilaiKpiRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _kpi.NilaiAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Hapus(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _kpi.DeleteAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
