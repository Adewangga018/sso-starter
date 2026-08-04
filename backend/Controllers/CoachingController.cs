using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Coaching & Diskusi Tim (bagian dari My Team). Sesi 1-on-1 privat + Ruang Tim,
// asinkron berbasis thread. Arah/izin mengikuti hirarki grading.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("coaching")]
[ModuleGate("my-team")]
[FeatureGate("my-team:coaching")]
public class CoachingController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly CoachingService _coaching;

    public CoachingController(CurrentUserContext currentUser, CoachingService coaching)
    {
        _currentUser = currentUser;
        _coaching = coaching;
    }

    private async Task<(string? Nik, string? Nama)> MeAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return (pegawai?.ID_KARYAWAN ?? user?.Nik, pegawai?.NAMA_LENGKAP ?? user?.Name);
    }

    [HttpGet]
    public async Task<ActionResult<CoachingInboxDto>> Inbox()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _coaching.GetInboxAsync(nik));
    }

    [HttpGet("lawan-bicara")]
    public async Task<ActionResult<IReadOnlyList<LawanBicaraDto>>> LawanBicara()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _coaching.GetLawanBicaraAsync(nik));
    }

    // ---- sesi 1-on-1 ----
    [HttpPost("sesi")]
    public async Task<IActionResult> BuatSesi([FromBody] BuatSesiRequest req)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, id) = await _coaching.CreateSesiAsync(nik, nama, req.TargetNik, req.Topik);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpGet("sesi/{id:long}")]
    public async Task<ActionResult<CoachingSesiDetailDto>> Sesi(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var detail = await _coaching.GetSesiAsync(nik, id);
        return detail is null ? NotFound(new { message = "Sesi tidak ditemukan." }) : Ok(detail);
    }

    // Unduh transkrip PDF. Akses: peserta sesi, atau Admin Modul SDM.
    [HttpGet("sesi/{id:long}/download")]
    public async Task<IActionResult> DownloadSesi(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var t = await _coaching.GetSesiTranscriptAsync(nik, id);
        if (t is null) return NotFound(new { message = "Sesi tidak ditemukan atau bukan hak akses Anda." });
        return File(CoachingPdf.Build(t), "application/pdf", t.NamaBerkas);
    }

    [HttpPost("sesi/{id:long}/pesan")]
    public async Task<IActionResult> KirimPesanSesi(long id, [FromBody] KirimPesanRequest req)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _coaching.KirimPesanSesiAsync(nik, nama, id, req.Isi);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPut("sesi/{id:long}/status")]
    public async Task<IActionResult> StatusSesi(long id, [FromBody] UpdateStatusRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _coaching.SetStatusSesiAsync(nik, id, req.Status);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("sesi/{id:long}/tindak-lanjut")]
    public async Task<IActionResult> TambahTindakLanjut(long id, [FromBody] TindakLanjutRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _coaching.AddTindakLanjutAsync(nik, id, req.Isi);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPut("tindak-lanjut/{tlId:long}/status")]
    public async Task<IActionResult> StatusTindakLanjut(long tlId, [FromBody] UpdateStatusRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _coaching.SetStatusTindakLanjutAsync(nik, tlId, req.Status);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // ---- ruang tim ----
    [HttpGet("ruang/{ownerNik}")]
    public async Task<ActionResult<CoachingRuangDetailDto>> Ruang(string ownerNik)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var detail = await _coaching.GetRuangAsync(nik, ownerNik);
        return detail is null ? NotFound(new { message = "Ruang tim tidak ditemukan atau bukan anggota." }) : Ok(detail);
    }

    [HttpPost("ruang/{ownerNik}/pesan")]
    public async Task<IActionResult> KirimPesanRuang(string ownerNik, [FromBody] KirimPesanRequest req)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _coaching.KirimPesanRuangAsync(nik, nama, ownerNik, req.Isi);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // Unduh transkrip ruang tim (PDF). Akses: anggota ruang, atau Admin Modul SDM.
    [HttpGet("ruang/{ownerNik}/download")]
    public async Task<IActionResult> DownloadRuang(string ownerNik)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var t = await _coaching.GetRuangTranscriptAsync(nik, ownerNik);
        if (t is null) return NotFound(new { message = "Ruang tim tidak ditemukan atau bukan hak akses Anda." });
        return File(CoachingPdf.Build(t), "application/pdf", t.NamaBerkas);
    }

    // ---- Admin Modul SDM: daftar semua coaching untuk unduh ----
    [HttpGet("admin/semua")]
    public async Task<ActionResult<CoachingAdminListDto>> AdminSemua()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var data = await _coaching.GetAllCoachingAsync(nik);
        return data is null ? Forbid() : Ok(data);
    }
}
