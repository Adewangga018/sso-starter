using System.Security.Cryptography;
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
[Route("personal/spl")]
public class SplController : ControllerBase
{
    private const string StatusDibuat = "Di Buat";
    private const string SourceWebEasy = "WEBEASY";

    // Legacy EASy derives the kode_spl prefix from the source: WEBEASY rows start with "I".
    private const char KodePrefix = 'I';
    private const string KodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private static readonly string[] AllowedJenis = ["Biasa", "Mengganti", "Crash Program"];

    private readonly GcsDbContext _db;
    private readonly CurrentUserContext _currentUser;
    private readonly ApprovalService _approval;

    public SplController(GcsDbContext db, CurrentUserContext currentUser, ApprovalService approval)
    {
        _db = db;
        _currentUser = currentUser;
        _approval = approval;
    }

    [HttpGet]
    public async Task<ActionResult<SplListDto>> GetAll()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var items = await _db.WebSdmSpl
            .Where(s => s.id_user == pegawai.ID_KARYAWAN)
            .OrderByDescending(s => s.tgl_spl)
            .Select(s => new SplDto(
                (long)s.id,
                s.kode_spl,
                s.status,
                s.keterangan,
                s.tgl_spl,
                s.tgl_spl2,
                s.jenis_spl,
                s.source))
            .ToListAsync();

        var (min, max) = SplWindow.For(Today());
        return Ok(new SplListDto(items, new SplWindowDto(min, max)));
    }

    [HttpPost]
    public async Task<ActionResult<SplDto>> Create(SplRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var atasan = await ResolveAtasanAsync(pegawai.ID_KARYAWAN);
        if (atasan is null)
        {
            return BadRequest(new { message = "Atasan penyetuju belum terdaftar untuk Anda." });
        }

        var spl = new WebSdmSpl
        {
            kode_spl = await GenerateKodeAsync(),
            id_user = pegawai.ID_KARYAWAN,
            tgl_spl = Combine(request.MulaiTgl, request.JamMulai),
            tgl_spl2 = Combine(request.SampaiTgl, request.JamSelesai),
            jam_mulai = request.JamMulai,
            jam_selesai = request.JamSelesai,
            jenis_spl = request.JenisSpl,
            keterangan = request.Keterangan?.Trim(),
            status = StatusDibuat,
            source = SourceWebEasy,
            tgl_input = DateTime.Now,
            id_pengguna = atasan,
            status_pengguna = string.Empty,
        };

        _db.WebSdmSpl.Add(spl);
        await _db.SaveChangesAsync();

        var ringkasan = $"Lembur {request.JenisSpl} · {request.MulaiTgl:dd MMM} {request.JamMulai}–{request.JamSelesai}"
            + (string.IsNullOrWhiteSpace(request.Keterangan) ? string.Empty : $": {request.Keterangan.Trim()}");
        await _approval.CreateAsync("Lembur", spl.id.ToString(), pegawai.ID_KARYAWAN, pegawai.NAMA_LENGKAP, ringkasan);

        return Ok(new SplDto(
            (long)spl.id,
            spl.kode_spl,
            spl.status,
            spl.keterangan,
            spl.tgl_spl,
            spl.tgl_spl2,
            spl.jenis_spl,
            spl.source));
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, SplRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var spl = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (spl is null)
        {
            return NotFound(new { message = "SPL tidak ditemukan atau sudah diproses sehingga tidak bisa diubah." });
        }

        spl.tgl_spl = Combine(request.MulaiTgl, request.JamMulai);
        spl.tgl_spl2 = Combine(request.SampaiTgl, request.JamSelesai);
        spl.jam_mulai = request.JamMulai;
        spl.jam_selesai = request.JamSelesai;
        spl.jenis_spl = request.JenisSpl;
        spl.keterangan = request.Keterangan?.Trim();

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var spl = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (spl is null)
        {
            return NotFound(new { message = "SPL tidak ditemukan atau sudah diproses sehingga tidak bisa dihapus." });
        }

        _db.WebSdmSpl.Remove(spl);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Only the employee's own SPL that nobody has acted on yet may be edited or removed.
    private Task<WebSdmSpl?> FindOwnEditableAsync(long id, string idKaryawan) =>
        _db.WebSdmSpl
            .AsTracking()
            .FirstOrDefaultAsync(s => s.id == id && s.id_user == idKaryawan && s.status == StatusDibuat);

    private string? Validate(SplRequest request)
    {
        if (!AllowedJenis.Contains(request.JenisSpl))
        {
            return "Jenis SPL tidak dikenal.";
        }

        if (!TryParseJam(request.JamMulai, out _) || !TryParseJam(request.JamSelesai, out _))
        {
            return "Jam mulai dan jam selesai wajib diisi dengan format HH:mm.";
        }

        var today = Today();
        if (!SplWindow.Allows(today, request.MulaiTgl))
        {
            var (min, max) = SplWindow.For(today);
            return $"Tanggal lembur hanya boleh antara {min:dd-MM-yyyy} dan {max:dd-MM-yyyy}.";
        }

        // An overnight shift may spill into the next calendar day, but no further.
        if (request.SampaiTgl < request.MulaiTgl || request.SampaiTgl > request.MulaiTgl.AddDays(1))
        {
            return "Sampai tanggal harus sama dengan mulai tanggal atau paling lambat sehari sesudahnya.";
        }

        if (Combine(request.SampaiTgl, request.JamSelesai) <= Combine(request.MulaiTgl, request.JamMulai))
        {
            return "Waktu selesai harus setelah waktu mulai.";
        }

        return null;
    }

    private async Task<string?> ResolveAtasanAsync(string idKaryawan) =>
        await _db.SdmApproval
            .Where(a => a.KodePegawai == idKaryawan && a.KodeAtasan != null)
            .OrderBy(a => a.Urut)
            .Select(a => a.KodeAtasan)
            .FirstOrDefaultAsync();

    private async Task<string> GenerateKodeAsync()
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var kode = KodePrefix + RandomNumberGenerator.GetString(KodeAlphabet, 9);
            if (!await _db.WebSdmSpl.AnyAsync(s => s.kode_spl == kode))
            {
                return kode;
            }
        }

        throw new InvalidOperationException("Gagal membuat kode SPL yang unik.");
    }

    private static DateTime Combine(DateOnly date, string jam)
    {
        TryParseJam(jam, out var time);
        return date.ToDateTime(time);
    }

    private static bool TryParseJam(string? jam, out TimeOnly time) =>
        TimeOnly.TryParseExact(jam, "HH:mm", out time);

    private static DateOnly Today() => DateOnly.FromDateTime(DateTime.Now);
}
