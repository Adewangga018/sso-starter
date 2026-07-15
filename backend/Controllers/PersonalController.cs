using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Gcs;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal")]
public class PersonalController : ControllerBase
{
    private static readonly string[] AllowedDocExt = [".pdf", ".png", ".jpg", ".jpeg"];
    private const long MaxDocBytes = 10 * 1024 * 1024;

    private readonly GcsDbContext _db;
    private readonly DocumentResolver _documentResolver;
    private readonly CurrentUserContext _currentUser;
    private readonly IAuditLogger _audit;

    public PersonalController(
        GcsDbContext db,
        DocumentResolver documentResolver,
        CurrentUserContext currentUser,
        IAuditLogger audit)
    {
        _db = db;
        _documentResolver = documentResolver;
        _currentUser = currentUser;
        _audit = audit;
    }

    [HttpGet("profile")]
    public async Task<ActionResult<PersonalProfileDto>> GetProfile()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
        }

        var anak = await _db.MstAnakPegawai
            .Where(a => a.ID_PEGAWAI == pegawai.ID_PEGAWAI)
            .OrderBy(a => a.URUTAN_ANAK)
            .Select(a => new AnakDto(
                a.ID_ANAK,
                a.URUTAN_ANAK,
                a.NAMA_ANAK,
                a.TEMPAT_LAHIR_ANAK,
                a.TGL_LAHIR_ANAK.HasValue ? DateOnly.FromDateTime(a.TGL_LAHIR_ANAK.Value) : null,
                !string.IsNullOrWhiteSpace(a.FILE_AKTA)))
            .ToListAsync();

        var isMarried = string.Equals(pegawai.STATUS_NIKAH, "Kawin", StringComparison.OrdinalIgnoreCase);

        var pasangan = isMarried
            ? new PasanganDto(
                pegawai.NAMA_PASANGAN,
                pegawai.TEMPAT_LAHIR_PASANGAN,
                pegawai.TGL_LAHIR_PASANGAN.HasValue ? DateOnly.FromDateTime(pegawai.TGL_LAHIR_PASANGAN.Value) : null)
            : null;

        var berkas = EmployeeDocuments.Fields
            .Select(f => new BerkasDto(f.Key, f.Label, !string.IsNullOrWhiteSpace(f.Selector(pegawai))))
            .ToList();

        var dto = new PersonalProfileDto(
            pegawai.ID_PEGAWAI,
            pegawai.NAMA_LENGKAP,
            pegawai.ID_KARYAWAN,
            pegawai.NIK,
            pegawai.TEMPAT_LAHIR,
            pegawai.TGL_LAHIR.HasValue ? DateOnly.FromDateTime(pegawai.TGL_LAHIR.Value) : null,
            pegawai.JENIS_KELAMIN,
            pegawai.STATUS_KARYAWAN,
            user.IsActive,
            pegawai.AGAMA,
            pegawai.PENDIDIKAN,
            pegawai.NO_HP,
            pegawai.EMAIL,
            new AlamatDto(pegawai.ALAMAT, pegawai.RT, pegawai.RW, pegawai.PROVINSI, pegawai.KABUPATEN, pegawai.KECAMATAN, pegawai.DESA, pegawai.KODE_POS),
            pegawai.RIWAYAT_KESEHATAN,
            pegawai.STATUS_NIKAH,
            isMarried,
            pasangan,
            pegawai.JUMLAH_ANAK,
            pegawai.NAMA_DARURAT,
            pegawai.HP_DARURAT,
            DateOnly.FromDateTime(pegawai.CREATED_AT),
            anak,
            berkas);

        return Ok(dto);
    }

    // Self-service profile edit. The employee may change their own biodata, contact, address,
    // marital/spouse and emergency fields. ID_KARYAWAN (the account link), ID_PEGAWAI, and the
    // HR-managed employment status are NOT editable here.
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (string.IsNullOrWhiteSpace(req.NamaLengkap))
        {
            return BadRequest(new { message = "Nama lengkap wajib diisi." });
        }

        var nik = Clean(req.Nik);
        if (nik is not null && (nik.Length != 16 || !nik.All(char.IsAsciiDigit)))
        {
            return BadRequest(new { message = "NIK harus 16 digit angka." });
        }

        var email = Clean(req.Email);
        if (email is not null && !email.Contains('@'))
        {
            return BadRequest(new { message = "Format email tidak valid." });
        }

        // NoTracking is the context default, so load a tracked copy to update + save.
        var entity = await _db.MstPegawai.AsTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (entity is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan." });
        }

        entity.NAMA_LENGKAP = req.NamaLengkap.Trim();
        entity.NIK = nik ?? string.Empty;
        entity.TEMPAT_LAHIR = Clean(req.TempatLahir);
        entity.TGL_LAHIR = req.TglLahir?.ToDateTime(TimeOnly.MinValue);
        entity.JENIS_KELAMIN = Clean(req.JenisKelamin);
        entity.AGAMA = Clean(req.Agama);
        entity.PENDIDIKAN = Clean(req.Pendidikan);
        entity.NO_HP = Clean(req.NoHp);
        entity.EMAIL = email;

        var alamat = req.Alamat;
        entity.ALAMAT = Clean(alamat?.Alamat);
        entity.RT = Clean(alamat?.Rt);
        entity.RW = Clean(alamat?.Rw);
        entity.PROVINSI = Clean(alamat?.Provinsi);
        entity.KABUPATEN = Clean(alamat?.Kabupaten);
        entity.KECAMATAN = Clean(alamat?.Kecamatan);
        entity.DESA = Clean(alamat?.Desa);
        entity.KODE_POS = Clean(alamat?.KodePos);

        entity.RIWAYAT_KESEHATAN = Clean(req.RiwayatKesehatan);
        entity.STATUS_NIKAH = Clean(req.StatusNikah);
        entity.NAMA_PASANGAN = Clean(req.NamaPasangan);
        entity.TEMPAT_LAHIR_PASANGAN = Clean(req.TempatLahirPasangan);
        entity.TGL_LAHIR_PASANGAN = req.TglLahirPasangan?.ToDateTime(TimeOnly.MinValue);
        entity.JUMLAH_ANAK = req.JumlahAnak;
        entity.NAMA_DARURAT = Clean(req.NamaDarurat);
        entity.HP_DARURAT = Clean(req.HpDarurat);

        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.updated", entity.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {entity.ID_KARYAWAN} memperbarui data profil.");

        return NoContent();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // --- Children (MST_ANAK_PEGAWAI), scoped to the signed-in employee ---

    [HttpPost("anak")]
    public async Task<IActionResult> AddAnak([FromBody] AnakUpsertRequest req)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (string.IsNullOrWhiteSpace(req.Nama))
        {
            return BadRequest(new { message = "Nama anak wajib diisi." });
        }

        // Default the sequence number to the next slot when the client doesn't send one.
        int nextUrutan;
        if (req.Urutan.HasValue)
        {
            nextUrutan = req.Urutan.Value;
        }
        else
        {
            var maxUrutan = await _db.MstAnakPegawai
                .Where(a => a.ID_PEGAWAI == pegawai.ID_PEGAWAI)
                .Select(a => (int?)a.URUTAN_ANAK)
                .MaxAsync();
            nextUrutan = (maxUrutan ?? 0) + 1;
        }

        var anak = new MstAnakPegawai
        {
            ID_PEGAWAI = pegawai.ID_PEGAWAI,
            URUTAN_ANAK = nextUrutan,
            NAMA_ANAK = Clean(req.Nama),
            TEMPAT_LAHIR_ANAK = Clean(req.TempatLahir),
            TGL_LAHIR_ANAK = req.TglLahir?.ToDateTime(TimeOnly.MinValue),
            // CREATED_AT is NOT NULL (datetime, getdate() default); set it explicitly so EF
            // doesn't send the invalid default(DateTime) 0001-01-01.
            CREATED_AT = DateTime.Now,
        };

        _db.MstAnakPegawai.Add(anak);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.anak.added", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} menambah data anak (id {anak.ID_ANAK}).");

        var dto = new AnakDto(
            anak.ID_ANAK,
            anak.URUTAN_ANAK,
            anak.NAMA_ANAK,
            anak.TEMPAT_LAHIR_ANAK,
            anak.TGL_LAHIR_ANAK.HasValue ? DateOnly.FromDateTime(anak.TGL_LAHIR_ANAK.Value) : null,
            !string.IsNullOrWhiteSpace(anak.FILE_AKTA));

        return Ok(dto);
    }

    [HttpPut("anak/{idAnak:int}")]
    public async Task<IActionResult> UpdateAnak(int idAnak, [FromBody] AnakUpsertRequest req)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (string.IsNullOrWhiteSpace(req.Nama))
        {
            return BadRequest(new { message = "Nama anak wajib diisi." });
        }

        var anak = await _db.MstAnakPegawai
            .AsTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        anak.NAMA_ANAK = Clean(req.Nama);
        anak.TEMPAT_LAHIR_ANAK = Clean(req.TempatLahir);
        anak.TGL_LAHIR_ANAK = req.TglLahir?.ToDateTime(TimeOnly.MinValue);
        if (req.Urutan.HasValue)
        {
            anak.URUTAN_ANAK = req.Urutan.Value;
        }

        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.anak.updated", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} memperbarui data anak (id {idAnak}).");

        return NoContent();
    }

    [HttpDelete("anak/{idAnak:int}")]
    public async Task<IActionResult> DeleteAnak(int idAnak)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var anak = await _db.MstAnakPegawai
            .AsTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        // Best-effort remove the akta file from the share before dropping the row.
        var aktaPhysical = _documentResolver.ToPhysicalPath(anak.FILE_AKTA);
        if (aktaPhysical is not null)
        {
            try { System.IO.File.Delete(aktaPhysical); } catch { /* best effort */ }
        }

        _db.MstAnakPegawai.Remove(anak);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.anak.deleted", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} menghapus data anak (id {idAnak}).");

        return NoContent();
    }

    [HttpGet("absensi")]
    public async Task<ActionResult<IReadOnlyList<AbsensiDto>>> GetAbsensi()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
        }

        var logs = await _db.AbsensiLog
            .Where(a => a.KodePegawai == pegawai.ID_KARYAWAN)
            .OrderByDescending(a => a.Tanggal)
            .Select(a => new AbsensiDto(
                a.NamaPegawai,
                DateOnly.FromDateTime(a.Tanggal),
                a.NamaHari,
                a.CheckIn,
                a.CheckOut,
                a.CatatanMangkir))
            .ToListAsync();

        return Ok(logs);
    }

    // Streams the employee's OWN document. The file physically lives on the WCP-GCS share;
    // it is never exposed as a public URL, so this ownership-scoped endpoint is the only way in.
    [HttpGet("documents/{key}")]
    public async Task<IActionResult> GetDocument(string key)
    {
        var field = EmployeeDocuments.Find(key);
        if (field is null)
        {
            return NotFound();
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (EmployeeDocuments.MaritalKeys.Contains(key) && !EmployeeDocuments.IsMarried(pegawai))
        {
            return Forbid();
        }

        return StreamDocument(field.Selector(pegawai));
    }

    [HttpGet("documents/anak/{idAnak:int}/akta")]
    public async Task<IActionResult> GetAktaAnak(int idAnak)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var anak = await _db.MstAnakPegawai
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);

        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        return StreamDocument(anak.FILE_AKTA);
    }

    // Uploads/replaces one of the employee's OWN documents. The file is written to the WCP-GCS
    // uploads folder (LegacyFiles:Root) and its relative path saved back to the FILE_* column.
    [HttpPost("documents/{key}")]
    [RequestSizeLimit(MaxDocBytes)]
    public async Task<IActionResult> UploadDocument(string key, IFormFile file)
    {
        var field = EmployeeDocuments.Find(key);
        if (field is null)
        {
            return NotFound();
        }

        var invalid = ValidateUpload(file);
        if (invalid is not null)
        {
            return invalid;
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var entity = await _db.MstPegawai.AsTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (entity is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan." });
        }

        if (EmployeeDocuments.MaritalKeys.Contains(key) && !EmployeeDocuments.IsMarried(entity))
        {
            return Forbid();
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var relative = BuildDocRelative(entity.ID_KARYAWAN, key, ext);

        var writeError = await WriteUploadedFileAsync(file, relative, previousRelative: field.Selector(entity));
        if (writeError is not null)
        {
            return writeError;
        }

        field.Setter(entity, relative);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.document.updated", entity.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {entity.ID_KARYAWAN} memperbarui dokumen '{field.Label}'.");

        return NoContent();
    }

    [HttpPost("documents/anak/{idAnak:int}/akta")]
    [RequestSizeLimit(MaxDocBytes)]
    public async Task<IActionResult> UploadAktaAnak(int idAnak, IFormFile file)
    {
        var invalid = ValidateUpload(file);
        if (invalid is not null)
        {
            return invalid;
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var anak = await _db.MstAnakPegawai
            .AsTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == pegawai.ID_PEGAWAI);
        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var relative = BuildDocRelative(pegawai.ID_KARYAWAN, $"akta_{idAnak}", ext);

        var writeError = await WriteUploadedFileAsync(file, relative, previousRelative: anak.FILE_AKTA);
        if (writeError is not null)
        {
            return writeError;
        }

        anak.FILE_AKTA = relative;
        await _db.SaveChangesAsync();

        await _audit.LogAsync("profile.document.updated", pegawai.ID_KARYAWAN, User.FindFirstValue("email"),
            $"Pegawai {pegawai.ID_KARYAWAN} memperbarui akta anak (id {idAnak}).");

        return NoContent();
    }

    private IActionResult? ValidateUpload(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Berkas kosong." });
        }

        if (file.Length > MaxDocBytes)
        {
            return BadRequest(new { message = "Ukuran berkas maksimal 10 MB." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedDocExt.Contains(ext))
        {
            return BadRequest(new { message = "Berkas harus berupa PDF, PNG, JPG, atau JPEG." });
        }

        return null;
    }

    // Deterministic, per-employee-per-slot filename so re-uploading replaces the same file:
    // uploads/karyawan/{idKaryawan}_{slot}{ext}. The employee id is sanitised because it lands
    // in a file path.
    private static string BuildDocRelative(string idKaryawan, string slot, string ext)
    {
        var safeId = new string(idKaryawan.Where(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_').ToArray());
        if (string.IsNullOrEmpty(safeId))
        {
            safeId = "pegawai";
        }

        return $"uploads/karyawan/{safeId}_{slot}{ext}";
    }

    // Writes the uploaded file to its physical location under the root, then best-effort deletes
    // the previously referenced file if it was at a different path. Returns an error result on
    // failure, or null on success.
    private async Task<IActionResult?> WriteUploadedFileAsync(IFormFile file, string relative, string? previousRelative)
    {
        var physical = _documentResolver.ToPhysicalPath(relative);
        if (physical is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Penyimpanan dokumen belum dikonfigurasi (LegacyFiles:Root). Hubungi IT."
            });
        }

        Directory.CreateDirectory(Path.GetDirectoryName(physical)!);
        await using (var stream = System.IO.File.Create(physical))
        {
            await file.CopyToAsync(stream);
        }

        var previousNormalised = previousRelative?.Replace('\\', '/').TrimStart('/');
        if (!string.IsNullOrWhiteSpace(previousNormalised) &&
            !string.Equals(previousNormalised, relative, StringComparison.OrdinalIgnoreCase))
        {
            var oldPhysical = _documentResolver.ToPhysicalPath(previousNormalised);
            if (oldPhysical is not null && !string.Equals(oldPhysical, physical, StringComparison.OrdinalIgnoreCase))
            {
                try { System.IO.File.Delete(oldPhysical); } catch { /* best effort - orphan is harmless */ }
            }
        }

        return null;
    }

    // Resolves the stored relative path to a real file on the WCP-GCS share and streams it
    // inline (the viewer displays it in an iframe). 404 when the document isn't available.
    private IActionResult StreamDocument(string? relativePath)
    {
        var file = _documentResolver.Resolve(relativePath);
        if (file is null)
        {
            return NotFound(new { message = "Dokumen belum tersedia. Silakan hubungi HR/SDM." });
        }

        var stream = System.IO.File.OpenRead(file.PhysicalPath);
        return File(stream, file.ContentType);
    }
}
