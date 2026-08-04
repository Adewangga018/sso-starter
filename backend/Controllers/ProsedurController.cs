using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// My Prosedur (SOP & Kebijakan). Semua karyawan membaca & meng-acknowledge; hanya
// Admin Kepatuhan (Departemen Kepatuhan) yang mengunggah/mengelola dokumen.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("prosedur")]
[ModuleGate("my-prosedur")]
public class ProsedurController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly ProsedurService _prosedur;

    public ProsedurController(CurrentUserContext currentUser, ProsedurService prosedur)
    {
        _currentUser = currentUser;
        _prosedur = prosedur;
    }

    private async Task<(string? Nik, string? Nama)> MeAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return (pegawai?.ID_KARYAWAN ?? user?.Nik, pegawai?.NAMA_LENGKAP ?? user?.Name);
    }

    private static async Task<byte[]> ReadBytesAsync(IFormFile file)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        return ms.ToArray();
    }

    [HttpGet]
    public async Task<ActionResult<ProsedurListDto>> List([FromQuery] string? q, [FromQuery] string? jenis, [FromQuery] string? kompartemen, [FromQuery] string? lingkup)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _prosedur.GetListAsync(nik, q, jenis, kompartemen, lingkup));
    }

    // Opsi dropdown form (Departemen & Kompartemen dari grading).
    [HttpGet("opsi")]
    public async Task<ActionResult<ProsedurOpsiDto>> Opsi()
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        return Ok(await _prosedur.GetOpsiAsync());
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ProsedurDetailDto>> Detail(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var d = await _prosedur.GetDetailAsync(nik, id);
        return d is null ? NotFound(new { message = "Dokumen tidak ditemukan." }) : Ok(d);
    }

    [HttpGet("versi/{versiId:long}/file")]
    public async Task<IActionResult> File(long versiId)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var f = await _prosedur.GetFileAsync(nik, versiId);
        if (f is null) return NotFound();
        Response.Headers["Content-Disposition"] = $"inline; filename=\"{f.Value.Nama}\"";
        return File(f.Value.Konten, f.Value.Tipe ?? "application/octet-stream");
    }

    [HttpPost("{id:long}/ack")]
    public async Task<IActionResult> Ack(long id)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _prosedur.AckAsync(nik, nama, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpGet("{id:long}/acknowledgement")]
    public async Task<ActionResult<IReadOnlyList<ProsedurAckOrangDto>>> Acknowledgement(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error, data) = await _prosedur.GetAckOrangAsync(nik, id);
        return ok ? Ok(data) : Forbid();
    }

    // ---- Buat dokumen (multipart). lingkup 'Umum' (Admin Kepatuhan) atau 'Unit' (pimpinan unit) ----
    [HttpPost]
    public async Task<IActionResult> Buat(
        [FromForm] string kode, [FromForm] string judul, [FromForm] string jenis,
        [FromForm] string? unit, [FromForm] string? kategori, [FromForm] string? deskripsi,
        [FromForm] bool semuaKompartemen, [FromForm] List<string>? kompartemen, [FromForm] string? lingkup,
        [FromForm] string? ringkasan, [FromForm] string? tglBerlaku, IFormFile? file)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        if (file is null) return BadRequest(new { message = "Berkas dokumen wajib diunggah." });
        var meta = new UbahDokumenRequest(kode, judul, jenis, unit, kategori, deskripsi, semuaKompartemen, kompartemen, lingkup);
        var (ok, error, id) = await _prosedur.CreateAsync(nik, nama, meta, ParseTgl(tglBerlaku), ringkasan,
            await ReadBytesAsync(file), file.FileName, file.ContentType);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPost("{id:long}/versi")]
    public async Task<IActionResult> TambahVersi(long id,
        [FromForm] string? ringkasan, [FromForm] string? tglBerlaku, IFormFile? file)
    {
        var (nik, nama) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        if (file is null) return BadRequest(new { message = "Berkas dokumen wajib diunggah." });
        var (ok, error) = await _prosedur.AddVersiAsync(nik, nama, id, ParseTgl(tglBerlaku), ringkasan,
            await ReadBytesAsync(file), file.FileName, file.ContentType);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Ubah(long id, [FromBody] UbahDokumenRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _prosedur.UpdateMetaAsync(nik, id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPut("versi/{versiId:long}/status")]
    public async Task<IActionResult> StatusVersi(long versiId, [FromBody] SetStatusVersiRequest req)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _prosedur.SetStatusVersiAsync(nik, versiId, req.Status);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Hapus(long id)
    {
        var (nik, _) = await MeAsync();
        if (string.IsNullOrWhiteSpace(nik)) return Unauthorized();
        var (ok, error) = await _prosedur.DeleteAsync(nik, id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    private static DateOnly? ParseTgl(string? s) =>
        DateOnly.TryParse(s, out var d) ? d : null;
}
