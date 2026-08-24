using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Riwayat versi Struktur Organisasi terikat SK direksi (diminta 2026-08-24) - sub-panel
// "org/versi", gate sama spt OrgStrukturController (murni per-aksi IsSdmAdminAsync, bukan
// [ModuleGate] - lihat FeatureCatalog "org:versi").
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("org/versi")]
public class OrgVersiController : ControllerBase
{
    private const long MaxUploadBytes = 15 * 1024 * 1024; // 15 MB, sama batas dgn Office/Prosedur

    private readonly CurrentUserContext _currentUser;
    private readonly ModuleAccessService _access;
    private readonly OrgVersiService _versi;

    public OrgVersiController(CurrentUserContext currentUser, ModuleAccessService access, OrgVersiService versi)
    {
        _currentUser = currentUser;
        _access = access;
        _versi = versi;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrgVersiRingkasDto>>> List()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _versi.ListVersiAsync());
    }

    [HttpGet("berlaku")]
    public async Task<ActionResult<OrgVersiRingkasDto>> VersiBerlaku()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var v = await _versi.GetVersiBerlakuAsync();
        return v is null ? NotFound() : Ok(v);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrgVersiSnapshotDto>> Snapshot(int id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var s = await _versi.GetSnapshotAsync(id);
        return s is null ? NotFound() : Ok(s);
    }

    [HttpGet("{id:int}/sk")]
    public async Task<IActionResult> FileSk(int id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var f = await _versi.GetFileSkAsync(id);
        if (f is null) return NotFound();
        Response.Headers["Content-Disposition"] = $"inline; filename=\"{f.Value.Nama}\"";
        return File(f.Value.Konten, f.Value.Tipe ?? "application/octet-stream");
    }

    // Langkah 1: lampirkan SK sbg draft (belum resmi berlaku, belum membekukan apa pun).
    [HttpPost]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<IActionResult> BuatDraft(
        [FromForm] string jenis, [FromForm] string? nomorSk, [FromForm] string? tanggalSk,
        [FromForm] string? ringkasan, IFormFile? file)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (file is null) return BadRequest(new { message = "Berkas SK wajib diunggah." });
        if (file.Length > MaxUploadBytes) return BadRequest(new { message = "Berkas SK maksimal 15 MB." });

        DateOnly? tgl = null;
        if (!string.IsNullOrWhiteSpace(tanggalSk) && DateOnly.TryParse(tanggalSk, out var parsed)) tgl = parsed;

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);

        var (nik, nama) = await CurrentAsync();
        var req = new TerbitkanVersiRequest(jenis, nomorSk, tgl, ringkasan);
        var (ok, error, id) = await _versi.BuatDraftAsync(req, ms.ToArray(), file.FileName, file.ContentType, nik, nama);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    // Langkah 2: resmikan draft jadi versi Berlaku - membekukan snapshot LIVE saat ini.
    [HttpPost("{id:int}/berlakukan")]
    public async Task<IActionResult> Berlakukan(int id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _versi.BerlakukanVersiAsync(id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> HapusDraft(int id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _versi.HapusDraftAsync(id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    private async Task<(string? Nik, string? Nama)> CurrentAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return (pegawai?.ID_KARYAWAN ?? user?.Nik, pegawai?.NAMA_LENGKAP ?? user?.Name);
    }

    private async Task<bool> IsSdmAdminAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        return await _access.IsSdmAdminAsync(nik);
    }
}
