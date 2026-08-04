using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// My Health (inisiasi awal: MCU). Karyawan melihat hasil MCU dirinya; hanya Admin
// Kepatuhan (Departemen Kepatuhan) yang mengelola periode & mencatat hasil peserta.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("health")]
[ModuleGate("my-health")]
[FeatureGate("my-health:mcu")]
public class HealthController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly HealthService _health;

    public HealthController(CurrentUserContext currentUser, HealthService health)
    {
        _currentUser = currentUser;
        _health = health;
    }

    private async Task<(string? Nik, string? Nama)> MeAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return (pegawai?.ID_KARYAWAN ?? user?.Nik, pegawai?.NAMA_LENGKAP ?? user?.Name);
    }

    private static async Task<byte[]?> ReadBytesAsync(IFormFile? file)
    {
        if (file is null) return null;
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        return ms.ToArray();
    }

    // ---- Karyawan ----
    [HttpGet("riwayat")]
    public async Task<ActionResult<HealthRiwayatDto>> Riwayat()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _health.GetRiwayatAsync(nik));
    }

    [HttpGet("hasil/{id:long}")]
    public async Task<ActionResult<HealthHasilDto>> Hasil(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, data) = await _health.GetHasilAsync(nik, id);
        return ok ? Ok(data) : BadRequest(new { message = error });
    }

    [HttpGet("hasil/{id:long}/file")]
    public async Task<IActionResult> File(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var f = await _health.GetFileAsync(nik, id);
        if (f is null) return NotFound();
        if (!f.Value.Ok) return Forbid();
        Response.Headers["Content-Disposition"] = $"inline; filename=\"{f.Value.Nama}\"";
        return File(f.Value.Konten, f.Value.Tipe ?? "application/octet-stream");
    }

    // ---- Admin Kepatuhan: periode ----
    [HttpGet("periode")]
    public async Task<ActionResult<HealthPeriodeListDto>> PeriodeList()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _health.GetPeriodeListAsync(nik));
    }

    [HttpGet("periode/{id:long}")]
    public async Task<ActionResult<HealthPeriodeDetailDto>> PeriodeDetail(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, data) = await _health.GetPeriodeDetailAsync(nik, id);
        return ok ? Ok(data) : BadRequest(new { message = error });
    }

    [HttpPost("periode")]
    public async Task<IActionResult> BuatPeriode([FromBody] SimpanPeriodeRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _health.CreatePeriodeAsync(nik, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPut("periode/{id:long}")]
    public async Task<IActionResult> UbahPeriode(long id, [FromBody] SimpanPeriodeRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _health.UpdatePeriodeAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("periode/{id:long}")]
    public async Task<IActionResult> HapusPeriode(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _health.DeletePeriodeAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // ---- Admin Kepatuhan: hasil (multipart, lampiran opsional) ----
    [HttpPost("periode/{idPeriode:long}/hasil")]
    public async Task<IActionResult> BuatHasil(long idPeriode,
        [FromForm] string pesertaNik, [FromForm] string? pesertaNama, [FromForm] string? tglPemeriksaan,
        [FromForm] decimal? tinggi, [FromForm] decimal? berat, [FromForm] string? tekananDarah,
        [FromForm] string statusUmum, [FromForm] string? ringkasan, [FromForm] string? rekomendasi,
        [FromForm] string statusTindakLanjut, IFormFile? file)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _health.SimpanHasilAsync(nik, nama, null, idPeriode,
            pesertaNik, pesertaNama, ParseTgl(tglPemeriksaan), tinggi, berat, tekananDarah,
            statusUmum, ringkasan, rekomendasi, statusTindakLanjut,
            await ReadBytesAsync(file), file?.FileName, file?.ContentType, false);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPut("hasil/{id:long}")]
    public async Task<IActionResult> UbahHasil(long id,
        [FromForm] long idPeriode, [FromForm] string pesertaNik, [FromForm] string? pesertaNama,
        [FromForm] string? tglPemeriksaan, [FromForm] decimal? tinggi, [FromForm] decimal? berat,
        [FromForm] string? tekananDarah, [FromForm] string statusUmum, [FromForm] string? ringkasan,
        [FromForm] string? rekomendasi, [FromForm] string statusTindakLanjut,
        [FromForm] bool hapusLampiran, IFormFile? file)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, _) = await _health.SimpanHasilAsync(nik, nama, id, idPeriode,
            pesertaNik, pesertaNama, ParseTgl(tglPemeriksaan), tinggi, berat, tekananDarah,
            statusUmum, ringkasan, rekomendasi, statusTindakLanjut,
            await ReadBytesAsync(file), file?.FileName, file?.ContentType, hapusLampiran);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("hasil/{id:long}")]
    public async Task<IActionResult> HapusHasil(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _health.DeleteHasilAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    private static DateOnly? ParseTgl(string? s) => DateOnly.TryParse(s, out var d) ? d : null;
}
