using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Panel Admin SDM "Struktur Organisasi" - modul dashboard tersendiri (spt "Payroll"),
// kartunya hanya muncul untuk Admin Modul SDM (lihat DashboardController), jadi gate
// di sini murni per-aksi IsSdmAdminAsync (bukan [ModuleGate], karena "org" tidak
// terdaftar di ModuleCatalog umum - sama pola dengan admin/* di GajiController).
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("org")]
public class OrgStrukturController : ControllerBase
{
    private readonly CurrentUserContext _currentUser;
    private readonly ModuleAccessService _access;
    private readonly OrgStrukturService _org;

    public OrgStrukturController(CurrentUserContext currentUser, ModuleAccessService access, OrgStrukturService org)
    {
        _currentUser = currentUser;
        _access = access;
        _org = org;
    }

    // --- Unit Organisasi ---

    [HttpGet("unit")]
    public async Task<ActionResult<IReadOnlyList<UnitDto>>> ListUnit()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.ListUnitAsync());
    }

    [HttpPost("unit")]
    public async Task<IActionResult> BuatUnit([FromBody] SimpanUnitRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, id) = await _org.SimpanUnitAsync(null, req);
        return ok ? Ok(new { idUnit = id }) : BadRequest(new { message = error });
    }

    [HttpPut("unit/{id:int}")]
    public async Task<IActionResult> UbahUnit(int id, [FromBody] SimpanUnitRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, _) = await _org.SimpanUnitAsync(id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("unit/{id:int}")]
    public async Task<IActionResult> HapusUnit(int id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _org.HapusUnitAsync(id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Jabatan ---

    [HttpGet("band")]
    public async Task<ActionResult<IReadOnlyList<BandOpsiDto>>> ListBand()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.ListBandAsync());
    }

    [HttpGet("jabatan")]
    public async Task<ActionResult<IReadOnlyList<JabatanDto>>> ListJabatan([FromQuery] int? idUnit)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.ListJabatanAsync(idUnit));
    }

    [HttpPost("jabatan")]
    public async Task<IActionResult> BuatJabatan([FromBody] SimpanJabatanRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, id) = await _org.SimpanJabatanAsync(null, req);
        return ok ? Ok(new { idJabatan = id }) : BadRequest(new { message = error });
    }

    [HttpPut("jabatan/{id:int}")]
    public async Task<IActionResult> UbahJabatan(int id, [FromBody] SimpanJabatanRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, _) = await _org.SimpanJabatanAsync(id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // paksa=true (opsi "Hapus Paksa" terpisah di frontend, dipakai admin utk bebersih
    // data manual, 2026-08-20 - lihat OrgStrukturService.HapusJabatanAsync) ikut menghapus
    // riwayat penempatan/PTS jabatan ini, bukan cuma jabatannya - dipakai sengaja/sadar,
    // bukan default tombol Hapus biasa.
    [HttpDelete("jabatan/{id:int}")]
    public async Task<IActionResult> HapusJabatan(int id, [FromQuery] bool paksa = false)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _org.HapusJabatanAsync(id, paksa);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Penempatan ---

    // Pencarian pegawai KHUSUS utk memilih siapa yg akan ditempatkan (Tempatkan/Mutasi) -
    // beda dari picker Payroll (cariPegawaiGaji, Tetap-only): di sini semua jenis_pegawai
    // aktif ikut muncul, termasuk Kontrak - lihat OrgStrukturService.CariPegawaiUntukPenempatanAsync.
    [HttpGet("penempatan/cari-pegawai")]
    public async Task<ActionResult<IReadOnlyList<GajiPegawaiPickerDto>>> CariPegawaiPenempatan([FromQuery] string? q)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.CariPegawaiUntukPenempatanAsync(q));
    }

    [HttpGet("penempatan")]
    public async Task<ActionResult<IReadOnlyList<PenempatanDto>>> ListPenempatan(
        [FromQuery] int? idJabatan, [FromQuery] string? idKaryawan, [FromQuery] bool hanyaAktif = true)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.ListPenempatanAsync(idJabatan, idKaryawan, hanyaAktif));
    }

    [HttpPost("penempatan")]
    public async Task<IActionResult> Tempatkan([FromBody] TempatkanKaryawanRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, id) = await _org.TempatkanKaryawanAsync(req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPost("penempatan/{id:int}/akhiri")]
    public async Task<IActionResult> AkhiriPenempatan(int id, [FromBody] AkhiriPenempatanRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _org.AkhiriPenempatanAsync(id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Pemangku Tugas Sementara (PTS) ---

    [HttpGet("pts")]
    public async Task<ActionResult<IReadOnlyList<PtsDto>>> ListPts()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.ListPtsAsync());
    }

    [HttpPost("pts")]
    public async Task<IActionResult> TandaiPts([FromBody] TandaiPtsRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, id) = await _org.TandaiPtsAsync(req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPost("pts/{id:int}/akhiri")]
    public async Task<IActionResult> AkhiriPts(int id, [FromBody] AkhiriPtsRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _org.AkhiriPtsAsync(id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Person Grade (PG) - lihat OrgStrukturService untuk penjelasan beda PG vs JG ---

    [HttpGet("person-grade")]
    public async Task<ActionResult<IReadOnlyList<PersonGradeDto>>> ListPersonGrade([FromQuery] string? idKaryawan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.ListPersonGradeAsync(idKaryawan));
    }

    [HttpPost("person-grade")]
    public async Task<IActionResult> BuatPersonGrade([FromBody] SimpanPersonGradeRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, id) = await _org.SimpanPersonGradeAsync(null, req);
        return ok ? Ok(new { id }) : BadRequest(new { message = error });
    }

    [HttpPut("person-grade/{id:int}")]
    public async Task<IActionResult> UbahPersonGrade(int id, [FromBody] SimpanPersonGradeRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error, _) = await _org.SimpanPersonGradeAsync(id, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("person-grade/{id:int}")]
    public async Task<IActionResult> HapusPersonGrade(int id)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _org.HapusPersonGradeAsync(id);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Akselerasi siklus naik PG (2 tahun, bukan 3) - lihat OrgStrukturService ---

    [HttpGet("person-grade/{idKaryawan}/akselerasi")]
    public async Task<ActionResult<PgAkselerasiStatusDto>> GetPgAkselerasi(string idKaryawan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _org.GetPgAkselerasiAsync(idKaryawan));
    }

    [HttpPut("person-grade/{idKaryawan}/akselerasi")]
    public async Task<IActionResult> SetPgAkselerasi(string idKaryawan, [FromBody] SetPgAkselerasiRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        await _org.SetPgAkselerasiAsync(idKaryawan, true, req, await CurrentNikAsync());
        return NoContent();
    }

    [HttpDelete("person-grade/{idKaryawan}/akselerasi")]
    public async Task<IActionResult> HapusPgAkselerasi(string idKaryawan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        await _org.SetPgAkselerasiAsync(idKaryawan, false, null, await CurrentNikAsync());
        return NoContent();
    }

    private async Task<string?> CurrentNikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
    }

    private async Task<bool> IsSdmAdminAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        return await _access.IsSdmAdminAsync(nik);
    }
}
