using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Slip Gaji pegawai (My Personal). Read-only untuk pegawai: slip terstruktur per
// periode. Nominal berasal dari sistem tarif JG x PG (lihat GajiService) - selama
// tarif belum dikonfigurasi admin modul SDM, seluruh nominal tampil Rp0.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal/gaji")]
public class GajiController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly GajiService _gaji;
    private readonly ModuleAccessService _access;

    public GajiController(CurrentUserContext currentUser, GajiService gaji, ModuleAccessService access)
    {
        _currentUser = currentUser;
        _gaji = gaji;
        _access = access;
    }

    // GET /personal/gaji?tahun=2026&bulan=7  (default: bulan WIB berjalan)
    [HttpGet]
    public async Task<ActionResult<GajiSlipDto>> Slip([FromQuery] int? tahun, [FromQuery] int? bulan)
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        }
        var nama = pegawai?.NAMA_LENGKAP ?? user?.Name ?? nik;

        var wib = DateTime.UtcNow.AddHours(7);
        var th = tahun ?? wib.Year;
        var bl = bulan ?? wib.Month;
        if (bl < 1 || bl > 12) return BadRequest(new { message = "Bulan tidak valid." });

        return Ok(await _gaji.GetSlipAsync(nik, nama, th, bl));
    }

    // --- Konfigurasi tarif (khusus Admin Modul SDM: Kabag SDM ke atas s/d GM SKP) ---

    // Pilihan JG & PG untuk pengisian tarif.
    [HttpGet("admin/grade")]
    public async Task<ActionResult<GajiGradeOpsiDto>> GradeOpsi()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _gaji.GetGradeOpsiAsync());
    }

    // Komponen JG_PG + nominal pada sel (tahun, jg, pg).
    [HttpGet("admin/tarif")]
    public async Task<ActionResult<GajiTarifSelDto>> GetTarif([FromQuery] int tahun, [FromQuery] int jg, [FromQuery] int pg)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _gaji.GetTarifSelAsync(tahun, jg, pg));
    }

    // Simpan nominal komponen untuk satu sel (tahun, jg, pg).
    [HttpPut("admin/tarif")]
    public async Task<IActionResult> SimpanTarif([FromBody] SimpanTarifRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (req.Jg <= 0 || req.Pg <= 0 || req.Tahun < 2000) return BadRequest(new { message = "Parameter tarif tidak valid." });
        await _gaji.SimpanTarifSelAsync(req);
        return NoContent();
    }

    private async Task<bool> IsSdmAdminAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        return await _access.IsSdmAdminAsync(nik);
    }
}
