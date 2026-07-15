using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Admin-only browser over ANY employee's documents. Regular employees reach only their own
// files through PersonalController; this controller lets HR/IT Admins look up an employee and
// view the same set of documents. Files are streamed the same way (never public URLs).
[ApiController]
[Route("admin/documents")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminDocumentsController : ControllerBase
{
    private readonly GcsDbContext _db;
    private readonly DocumentResolver _documentResolver;

    public AdminDocumentsController(GcsDbContext db, DocumentResolver documentResolver)
    {
        _db = db;
        _documentResolver = documentResolver;
    }

    // Employee picker: search by name, NIK, or employee id. Returns a short list.
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var term = (q ?? string.Empty).Trim();
        if (term.Length < 2)
        {
            return Ok(Array.Empty<object>());
        }

        var rows = await _db.MstPegawai
            .AsNoTracking()
            .Where(p => p.NAMA_LENGKAP.Contains(term) || p.NIK.Contains(term) || p.ID_KARYAWAN.Contains(term))
            .OrderBy(p => p.NAMA_LENGKAP)
            .Take(25)
            .Select(p => new
            {
                idPegawai = p.ID_PEGAWAI,
                idKaryawan = p.ID_KARYAWAN,
                nik = p.NIK,
                nama = p.NAMA_LENGKAP,
                statusKaryawan = p.STATUS_KARYAWAN,
            })
            .ToListAsync();

        return Ok(rows);
    }

    // One employee's document manifest: which slots have a file, plus their children's akta.
    [HttpGet("{idPegawai:int}")]
    public async Task<IActionResult> GetManifest(int idPegawai)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var pegawai = await _db.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == idPegawai);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan." });
        }

        var berkas = EmployeeDocuments.Fields
            .Select(f => new
            {
                key = f.Key,
                label = f.Label,
                available = !string.IsNullOrWhiteSpace(f.Selector(pegawai)),
            })
            .ToList();

        var anak = await _db.MstAnakPegawai
            .AsNoTracking()
            .Where(a => a.ID_PEGAWAI == idPegawai)
            .OrderBy(a => a.URUTAN_ANAK)
            .Select(a => new
            {
                id = a.ID_ANAK,
                urutan = a.URUTAN_ANAK,
                nama = a.NAMA_ANAK,
                aktaAvailable = !string.IsNullOrWhiteSpace(a.FILE_AKTA),
            })
            .ToListAsync();

        return Ok(new
        {
            idPegawai = pegawai.ID_PEGAWAI,
            idKaryawan = pegawai.ID_KARYAWAN,
            nik = pegawai.NIK,
            nama = pegawai.NAMA_LENGKAP,
            statusKaryawan = pegawai.STATUS_KARYAWAN,
            statusNikah = pegawai.STATUS_NIKAH,
            berkas,
            anak,
        });
    }

    [HttpGet("{idPegawai:int}/file/{key}")]
    public async Task<IActionResult> GetFile(int idPegawai, string key)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var field = EmployeeDocuments.Find(key);
        if (field is null)
        {
            return NotFound();
        }

        var pegawai = await _db.MstPegawai.AsNoTracking().FirstOrDefaultAsync(p => p.ID_PEGAWAI == idPegawai);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan." });
        }

        return StreamDocument(field.Selector(pegawai));
    }

    [HttpGet("{idPegawai:int}/anak/{idAnak:int}/akta")]
    public async Task<IActionResult> GetAktaAnak(int idPegawai, int idAnak)
    {
        if (!IsAdmin())
        {
            return Forbid();
        }

        var anak = await _db.MstAnakPegawai
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.ID_ANAK == idAnak && a.ID_PEGAWAI == idPegawai);

        if (anak is null)
        {
            return NotFound(new { message = "Data anak tidak ditemukan." });
        }

        return StreamDocument(anak.FILE_AKTA);
    }

    private IActionResult StreamDocument(string? relativePath)
    {
        var file = _documentResolver.Resolve(relativePath);
        if (file is null)
        {
            return NotFound(new { message = "Dokumen belum tersedia." });
        }

        var stream = System.IO.File.OpenRead(file.PhysicalPath);
        return File(stream, file.ContentType);
    }

    // The role claim in the OIDC token is "role" (mirrors AuditController).
    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == "Admin");
}
