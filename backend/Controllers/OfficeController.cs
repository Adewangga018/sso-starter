using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// My Office (persuratan) — penciptaan & daftar surat. Alur mengikuti DOF.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("office")]
public class OfficeController : ControllerBase
{
    private static readonly string[] AllowedExt =
        [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];
    private const long MaxUploadBytes = 15 * 1024 * 1024;

    private readonly CurrentUserContext _currentUser;
    private readonly OfficeService _office;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public OfficeController(CurrentUserContext currentUser, OfficeService office, IConfiguration config, IWebHostEnvironment env)
    {
        _currentUser = currentUser;
        _office = office;
        _config = config;
        _env = env;
    }

    // Cari pegawai untuk penanggung jawab / distribusi.
    [HttpGet("pegawai")]
    public async Task<ActionResult<IReadOnlyList<OfficePegawaiDto>>> CariPegawai([FromQuery] string q)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }
        return Ok(await _office.CariPegawaiAsync(q));
    }

    // Daftar surat milik saya; filter status opsional (?status=Draft dst).
    [HttpGet("surat")]
    public async Task<ActionResult<IReadOnlyList<SuratListItemDto>>> List([FromQuery] string? status = null)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        return Ok(await _office.ListAsync(user.Nik, status));
    }

    [HttpGet("surat/{id:long}")]
    public async Task<ActionResult<SuratDetailDto>> Detail(long id)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var detail = await _office.DetailAsync(id, user.Nik);
        return detail is null ? NotFound(new { message = "Surat tidak ditemukan." }) : Ok(detail);
    }

    [HttpPost("surat")]
    public async Task<IActionResult> Create([FromBody] CreateSuratRequest req)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error, id) = await _office.CreateAsync(user.Nik, user.Name, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    // Kotak masuk: surat final (Disetujui) yang ditujukan / ditembuskan ke saya.
    [HttpGet("inbox")]
    public async Task<ActionResult<IReadOnlyList<SuratListItemDto>>> Inbox()
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        return Ok(await _office.InboxAsync(user.Nik));
    }

    // Surat yang menunggu review saya.
    [HttpGet("review")]
    public async Task<ActionResult<IReadOnlyList<SuratListItemDto>>> MenungguReview()
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        return Ok(await _office.ListTugasAsync(user.Nik, "Reviewer"));
    }

    // Surat yang menunggu approval saya.
    [HttpGet("approval")]
    public async Task<ActionResult<IReadOnlyList<SuratListItemDto>>> MenungguApproval()
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        return Ok(await _office.ListTugasAsync(user.Nik, "Approver"));
    }

    // Aksi reviewer/approver: Setujui | Tolak | Revisi.
    [HttpPost("surat/{id:long}/pengesahan")]
    public async Task<IActionResult> Pengesahan(long id, [FromBody] PengesahanRequest req)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _office.ActPengesahanAsync(id, user.Nik, user.Name, req.Aksi ?? string.Empty, req.Komentar);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // ---- Lampiran ----

    [HttpPost("surat/{id:long}/lampiran")]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<IActionResult> UploadLampiran(long id, IFormFile file)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        // Cek hak & status sebelum menyimpan berkas.
        var (boleh, errBoleh) = await _office.BolehEditLampiranAsync(id, user.Nik);
        if (!boleh)
        {
            return BadRequest(new { message = errBoleh });
        }
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Berkas kosong." });
        }
        if (file.Length > MaxUploadBytes)
        {
            return BadRequest(new { message = "Ukuran berkas maksimal 15 MB." });
        }
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExt.Contains(ext))
        {
            return BadRequest(new { message = "Format berkas tidak didukung." });
        }

        var dir = Path.Combine(UploadRoot(), id.ToString());
        Directory.CreateDirectory(dir);
        var fileName = $"{Guid.NewGuid():N}{ext}";
        await using (var stream = System.IO.File.Create(Path.Combine(dir, fileName)))
        {
            await file.CopyToAsync(stream);
        }

        var rel = $"{id}/{fileName}";
        var (ok, error, dto) = await _office.TambahLampiranAsync(id, user.Nik, file.FileName, rel, file.Length, ContentType(ext));
        return ok ? Ok(dto) : BadRequest(new { message = error });
    }

    [HttpGet("surat/{id:long}/lampiran/{lampId:long}")]
    public async Task<IActionResult> GetLampiran(long id, long lampId)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var info = await _office.AmbilLampiranAsync(id, lampId, user.Nik);
        if (info is null)
        {
            return NotFound(new { message = "Lampiran tidak ditemukan." });
        }
        // Path harus milik folder surat ini - tolak traversal.
        var path = info.Value.Path;
        if (string.IsNullOrWhiteSpace(path) || !path.StartsWith($"{id}/") || path.Contains("..") || Path.IsPathRooted(path))
        {
            return BadRequest(new { message = "Path lampiran tidak valid." });
        }
        var full = Path.Combine(UploadRoot(), path.Replace('/', Path.DirectorySeparatorChar));
        if (!System.IO.File.Exists(full))
        {
            return NotFound(new { message = "Berkas lampiran tidak tersedia." });
        }
        return PhysicalFile(full, info.Value.Tipe ?? "application/octet-stream", info.Value.Nama);
    }

    [HttpDelete("surat/{id:long}/lampiran/{lampId:long}")]
    public async Task<IActionResult> HapusLampiran(long id, long lampId)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error, path) = await _office.HapusLampiranAsync(id, lampId, user.Nik);
        if (!ok)
        {
            return BadRequest(new { message = error });
        }
        // Best-effort hapus berkas fisik.
        if (!string.IsNullOrWhiteSpace(path) && path.StartsWith($"{id}/") && !path.Contains("..") && !Path.IsPathRooted(path))
        {
            try { System.IO.File.Delete(Path.Combine(UploadRoot(), path.Replace('/', Path.DirectorySeparatorChar))); }
            catch { /* best effort */ }
        }
        return NoContent();
    }

    private string UploadRoot()
    {
        var configured = _config["Office:UploadPath"];
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(_env.ContentRootPath, "uploads", "office")
            : configured;
    }

    private static string ContentType(string ext) => ext switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls" => "application/vnd.ms-excel",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt" => "application/vnd.ms-powerpoint",
        ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    };

    [HttpPost("surat/{id:long}/kirim")]
    public async Task<IActionResult> Kirim(long id)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _office.KirimReviewAsync(id, user.Nik, user.Name);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpPost("surat/{id:long}/batal")]
    public async Task<IActionResult> Batal(long id)
    {
        var (user, _) = await _currentUser.ResolveAsync(User);
        if (user is null || string.IsNullOrWhiteSpace(user.Nik))
        {
            return Unauthorized();
        }
        var (ok, error) = await _office.BatalkanAsync(id, user.Nik, user.Name);
        return ok ? NoContent() : BadRequest(new { message = error });
    }
}
