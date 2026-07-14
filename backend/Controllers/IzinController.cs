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
[Route("api/personal/izin")]
public class IzinController : ControllerBase
{
    private const string StatusDibuat = "Di Buat";

    // Legacy EASy writes 'web' for rows submitted from the browser.
    private const string SourceWeb = "web";

    // Conventions of the intranet.web_ttd_elektronik document registry.
    private const string UnitDokumen = "SDM";
    private const string TipeDokumen = "Surat Ijin";
    private const string StatusTerdaftar = "Open";
    private const string ValidasiBaseUrl = "https://service.gcs-gresik.com/validasi";

    private static readonly string[] AllowedJenis =
    [
        "Datang Terlambat",
        "Sakit",
        "Tidak Masuk Kerja",
        "Pulang Lebih Awal",
        "Meninggalkan Pekerjaan",
        "Tidak Clocking In",
        "Tidak Clocking Out",
    ];

    private static readonly string[] AllowedKepentingan = ["Dinas", "Pribadi"];

    private readonly GcsDbContext _db;
    private readonly CurrentUserContext _currentUser;

    public IzinController(GcsDbContext db, CurrentUserContext currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IzinListDto>> GetAll()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
        }

        var items = await _db.WebSdmSuratIjin
            .Where(s => s.id_user == pegawai.ID_KARYAWAN)
            .OrderByDescending(s => s.tgl_ijin)
            .Select(s => new IzinDto(
                (long)s.id,
                s.kode_ijin,
                s.status,
                s.keterangan,
                s.tgl_ijin,
                s.tgl_ijin_sd ?? s.tgl_ijin,
                s.jenis_ijin,
                s.kepentingan_ijin,
                s.source))
            .ToListAsync();

        return Ok(new IzinListDto(items));
    }

    [HttpPost]
    public async Task<ActionResult<IzinDto>> Create(IzinRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var atasan = await ResolveAtasanAsync(pegawai.ID_KARYAWAN);
        if (atasan is null)
        {
            return BadRequest(new { message = "Atasan penyetuju belum terdaftar untuk Anda. Hubungi HR/SDM." });
        }

        var izin = new WebSdmSuratIjin
        {
            // kode_ijin is left unset on purpose: the INSERT trigger fills it.
            id_user = pegawai.ID_KARYAWAN,
            id_pegawai = pegawai.ID_KARYAWAN,
            tgl_ijin = Combine(request.TglIjin, request.JamMulai),
            tgl_ijin_sd = Combine(request.TglIjinSd, request.JamSelesai),
            jenis_ijin = request.JenisIjin,
            kepentingan_ijin = request.KepentinganIjin,
            keterangan = request.Keterangan?.Trim(),
            status = StatusDibuat,
            source = SourceWeb,
            tgl_input = DateTime.Now,
            // Legacy convention: the approver's badge goes in masa_atasan at submission time;
            // id_pengesah stays null until someone actually approves.
            masa_atasan = atasan,
        };

        _db.WebSdmSuratIjin.Add(izin);
        await _db.SaveChangesAsync();

        // kode_ijin was assigned by the trigger after the INSERT, so read the row back.
        var kodeIjin = await _db.WebSdmSuratIjin
            .Where(s => s.id == izin.id)
            .Select(s => s.kode_ijin)
            .FirstOrDefaultAsync();

        return Ok(new IzinDto(
            (long)izin.id,
            kodeIjin,
            izin.status,
            izin.keterangan,
            izin.tgl_ijin,
            izin.tgl_ijin_sd ?? izin.tgl_ijin,
            izin.jenis_ijin,
            izin.kepentingan_ijin,
            izin.source));
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, IzinRequest request)
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

        var izin = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (izin is null)
        {
            return NotFound(new { message = "Izin tidak ditemukan atau sudah diproses sehingga tidak bisa diubah." });
        }

        izin.tgl_ijin = Combine(request.TglIjin, request.JamMulai);
        izin.tgl_ijin_sd = Combine(request.TglIjinSd, request.JamSelesai);
        izin.jenis_ijin = request.JenisIjin;
        izin.kepentingan_ijin = request.KepentinganIjin;
        izin.keterangan = request.Keterangan?.Trim();

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

        var izin = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (izin is null)
        {
            return NotFound(new { message = "Izin tidak ditemukan atau sudah diproses sehingga tidak bisa dihapus." });
        }

        _db.WebSdmSuratIjin.Remove(izin);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Assembles the printed letter and registers the document for QR validation.
    [HttpPost("{id:long}/print")]
    public async Task<ActionResult<IzinPrintDto>> Print(long id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var izin = await _db.WebSdmSuratIjin
            .FirstOrDefaultAsync(s => s.id == id && s.id_user == pegawai.ID_KARYAWAN);
        if (izin is null)
        {
            return NotFound(new { message = "Izin tidak ditemukan." });
        }

        if (string.IsNullOrWhiteSpace(izin.kode_ijin))
        {
            return BadRequest(new { message = "Kode izin belum terbit, coba muat ulang halaman." });
        }

        var mulai = izin.tgl_ijin;
        var selesai = izin.tgl_ijin_sd ?? izin.tgl_ijin;

        var sdm = await _db.PegawaiSdm.FirstOrDefaultAsync(p => p.Nik == pegawai.ID_KARYAWAN);
        var atasan = await _db.SdmApproval
            .Where(a => a.KodePegawai == pegawai.ID_KARYAWAN && a.KodeAtasan != null)
            .OrderBy(a => a.Urut)
            .FirstOrDefaultAsync();

        // The registry stores easy.users.Id, which the token carries as the "gcs_uid" claim.
        _ = int.TryParse(User.FindFirstValue("gcs_uid"), out var gcsUid);

        var kodeLink = await EnsureRegisteredAsync(izin, mulai, selesai, gcsUid);

        return Ok(new IzinPrintDto(
            izin.kode_ijin!,
            pegawai.NAMA_LENGKAP,
            pegawai.ID_KARYAWAN,
            sdm?.REGU?.Trim(),
            BuildKepada(atasan?.TitleKepada, sdm?.BAGIAN),
            atasan?.NamaAtasan?.Trim(),
            izin.jenis_ijin,
            izin.kepentingan_ijin,
            izin.keterangan,
            NamaHari(mulai),
            mulai,
            selesai,
            $"{ValidasiBaseUrl}/{kodeLink}",
            DateTime.Now));
    }

    // The registry row is what the QR code resolves to, so it must exist exactly once per
    // document. Re-printing the same izin reuses the original kode_link rather than minting
    // a new one, otherwise previously printed letters would stop validating.
    private async Task<Guid> EnsureRegisteredAsync(WebSdmSuratIjin izin, DateTime mulai, DateTime selesai, int idRegister)
    {
        var existing = await _db.TtdElektronik
            .Where(t => t.kode_dokumen == izin.kode_ijin && t.tipe_dokumen == TipeDokumen)
            .Select(t => (Guid?)t.kode_link)
            .FirstOrDefaultAsync();

        if (existing is { } found)
        {
            return found;
        }

        var uraian = $"{izin.jenis_ijin} :: {izin.keterangan}. {mulai:dd-MM-yyyy} ({mulai:HH:mm} - {selesai:HH:mm})";

        var doc = new TtdElektronik
        {
            unit_dokumen = UnitDokumen,
            kode_dokumen = izin.kode_ijin!,
            tipe_dokumen = TipeDokumen,
            uraian_dokumen = uraian,
            uraian2_dokumen = string.Empty,
            tgl_register = mulai.Date,
            tgl_approve = DateTime.Now,
            id_register = idRegister,
            id_approve = 0,
            status = StatusTerdaftar,
            // kode_link intentionally not set - the newid() default mints it.
        };

        _db.TtdElektronik.Add(doc);
        await _db.SaveChangesAsync();

        // The table has no triggers, so EF reads the newid() default back via OUTPUT.
        return doc.kode_link;
    }

    // Only the employee's own izin that nobody has acted on yet may be edited or removed.
    private Task<WebSdmSuratIjin?> FindOwnEditableAsync(long id, string idKaryawan) =>
        _db.WebSdmSuratIjin
            .AsTracking()
            .FirstOrDefaultAsync(s => s.id == id && s.id_user == idKaryawan && s.status == StatusDibuat);

    private async Task<string?> ResolveAtasanAsync(string idKaryawan) =>
        await _db.SdmApproval
            .Where(a => a.KodePegawai == idKaryawan && a.KodeAtasan != null)
            .OrderBy(a => a.Urut)
            .Select(a => a.KodeAtasan)
            .FirstOrDefaultAsync();

    private string? Validate(IzinRequest request)
    {
        if (!AllowedJenis.Contains(request.JenisIjin))
        {
            return "Jenis izin tidak dikenal.";
        }

        if (!AllowedKepentingan.Contains(request.KepentinganIjin))
        {
            return "Kepentingan izin tidak dikenal.";
        }

        if (!TryParseJam(request.JamMulai, out _) || !TryParseJam(request.JamSelesai, out _))
        {
            return "Jam mulai dan jam selesai wajib diisi dengan format HH:mm.";
        }

        // Izin may be filed from yesterday onwards - a day late for something that already
        // happened, or any time ahead. Anything older than H-1 must go through SDM.
        var batasAwal = DateOnly.FromDateTime(DateTime.Now).AddDays(-1);
        if (request.TglIjin < batasAwal)
        {
            return $"Tanggal izin paling awal adalah {batasAwal:dd-MM-yyyy} (H-1).";
        }

        if (request.TglIjinSd < request.TglIjin)
        {
            return "Sampai tanggal tidak boleh sebelum tanggal izin.";
        }

        if (Combine(request.TglIjinSd, request.JamSelesai) <= Combine(request.TglIjin, request.JamMulai))
        {
            return "Waktu selesai harus setelah waktu mulai.";
        }

        return null;
    }

    // "Asisten Manager" is abbreviated to "Asman" on the printed letter, matching EASy.
    private static string BuildKepada(string? title, string? bagian)
    {
        var jabatan = title?.Trim() switch
        {
            "Asisten Manager" => "Asman",
            null or "" => "Atasan",
            var other => other,
        };

        bagian = bagian?.Trim();
        return string.IsNullOrEmpty(bagian) ? jabatan : $"{jabatan} {bagian}";
    }

    private static readonly string[] HariIndonesia =
        ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    private static string NamaHari(DateTime date) => HariIndonesia[(int)date.DayOfWeek];

    private static DateTime Combine(DateOnly date, string jam)
    {
        TryParseJam(jam, out var time);
        return date.ToDateTime(time);
    }

    private static bool TryParseJam(string? jam, out TimeOnly time) =>
        TimeOnly.TryParseExact(jam, "HH:mm", out time);
}
