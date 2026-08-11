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
[ModuleGate("my-personal")]
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

    // --- Pendaftaran mandiri tanggungan BPJS Kesehatan >3 (My Personal > Profil) - milik
    //     sendiri, TANPA persetujuan atasan (self-declared, dampaknya menambah potongan
    //     milik sendiri). Beda dari admin/* di bawah: endpoint ini milik SEMUA pegawai. ---

    [HttpGet("tanggungan-bpjs")]
    public async Task<ActionResult<TanggunganBpjsDto>> TanggunganBpjs()
    {
        var nik = await ResolveOwnNikAsync();
        if (nik is null) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        return Ok(await _gaji.GetTanggunganBpjsAsync(nik));
    }

    [HttpPut("tanggungan-bpjs")]
    public async Task<IActionResult> SimpanTanggunganBpjs([FromBody] SimpanTanggunganBpjsRequest req)
    {
        var nik = await ResolveOwnNikAsync();
        if (nik is null) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        var (ok, error) = await _gaji.SimpanTanggunganBpjsAsync(nik, req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    [HttpDelete("tanggungan-bpjs")]
    public async Task<IActionResult> HapusTanggunganBpjs()
    {
        var nik = await ResolveOwnNikAsync();
        if (nik is null) return NotFound(new { message = "Akun ini belum tertaut ke nomor karyawan." });
        await _gaji.HapusTanggunganBpjsAsync(nik);
        return NoContent();
    }

    private async Task<string?> ResolveOwnNikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
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

    // --- Pendapatan Dasar: tarif satu dimensi (Band | JG | PG) ---
    // Gaji Pokok (Band), Tunjangan Jabatan (JG), Tunjangan Perumahan (PG),
    // Tunjangan Pangan (Band), Tunjangan Angkutan (Band).

    [HttpGet("admin/pendapatan-dasar")]
    public async Task<ActionResult<PendapatanDasarDto>> PendapatanDasar([FromQuery] int tahun)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        return Ok(await _gaji.GetPendapatanDasarAsync(tahun));
    }

    [HttpPut("admin/pendapatan-dasar")]
    public async Task<IActionResult> SimpanPendapatanDasar([FromBody] SimpanPendapatanDasarRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (req.Tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        var (ok, error) = await _gaji.SimpanPendapatanDasarAsync(req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Potongan per Band/JG/PG (mis. Potongan DPLK per Band) - mekanisme sama dgn
    //     Pendapatan Dasar, dipisah agar tak tercampur dalam basis rumus BPJS Kesehatan ---

    [HttpGet("admin/potongan-tunggal")]
    public async Task<ActionResult<PendapatanDasarDto>> PotonganTunggal([FromQuery] int tahun)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        return Ok(await _gaji.GetPotonganTunggalAsync(tahun));
    }

    [HttpPut("admin/potongan-tunggal")]
    public async Task<IActionResult> SimpanPotonganTunggal([FromBody] SimpanPendapatanDasarRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (req.Tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        var (ok, error) = await _gaji.SimpanPotonganTunggalAsync(req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Komponen basis 'Flat': nilai sama untuk semua karyawan ---

    [HttpGet("admin/flat")]
    public async Task<ActionResult<FlatListDto>> Flat()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _gaji.GetFlatAsync());
    }

    [HttpPut("admin/flat")]
    public async Task<IActionResult> SimpanFlat([FromBody] SimpanFlatRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _gaji.SimpanFlatAsync(req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Nominal manual per karyawan (basis 'Karyawan_Periode': Lembur, RIT, Potongan
    //     Presensi, K3PG, KKCS, BMT, Angsuran, KSPPS, dst - nilainya beda tiap orang) ---

    [HttpGet("admin/pegawai")]
    public async Task<ActionResult<IReadOnlyList<GajiPegawaiPickerDto>>> CariPegawai([FromQuery] string? q)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _gaji.CariPegawaiAsync(q));
    }

    [HttpGet("admin/manual")]
    public async Task<IActionResult> Manual([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.GetManualAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    [HttpPut("admin/manual")]
    public async Task<IActionResult> SimpanManual([FromBody] SimpanGajiManualRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _gaji.SimpanManualAsync(req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Potongan Presensi: preview hitung otomatis dari Absensi + Surat Ijin disetujui
    //     (Nota Dinas 0188/08/ND 2018). TIDAK menyimpan - admin review lalu Simpan via
    //     admin/manual biasa (POT_PRESENSI tetap basis Karyawan_Periode). ---

    [HttpGet("admin/potongan-presensi")]
    public async Task<IActionResult> PotonganPresensi([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungPotonganPresensiAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- Lembur Biasa: preview hitung otomatis dari SPL "Biasa" disetujui (khusus Band
    //     V/VI). TIDAK menyimpan - admin review lalu Simpan via admin/manual biasa. ---

    [HttpGet("admin/lembur-biasa")]
    public async Task<IActionResult> LemburBiasa([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungLemburBiasaAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- Lembur Pengganti: preview hitung otomatis dari SPL "Mengganti" disetujui (rumus
    //     sama dgn Lembur Biasa, tanpa batasan Band). TIDAK menyimpan. ---

    [HttpGet("admin/lembur-pengganti")]
    public async Task<IActionResult> LemburPengganti([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungLemburPenggantiAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- Lembur Crash Program: preview hitung otomatis dari SPL "Crash Program" disetujui
    //     (khusus Band I-IV). TIDAK menyimpan - admin review lalu Simpan via admin/manual. ---

    [HttpGet("admin/lembur-crash")]
    public async Task<IActionResult> LemburCrash([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungLemburCrashAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- Tarif SPPD per Band (dipakai nominal komponen SPPD sendiri & basis formula
    //     Uang Makan Dinas rentang 75-150km). Endpoint SENDIRI (bukan panel Pendapatan
    //     Dasar generik) krn basis komponen TJ_SPPD = Karyawan_Periode, bukan Band. ---

    [HttpGet("admin/tarif-sppd")]
    public async Task<ActionResult<TarifSppdDto>> TarifSppd([FromQuery] int tahun)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        return Ok(await _gaji.GetTarifSppdAsync(tahun));
    }

    [HttpPut("admin/tarif-sppd")]
    public async Task<IActionResult> SimpanTarifSppd([FromBody] SimpanTarifSppdRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (req.Tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        var (ok, error) = await _gaji.SimpanTarifSppdAsync(req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Uang Makan Dinas (MAKAN_DINAS): preview hitung otomatis dari UMDL disetujui
    //     (<75km=Rp40rb flat, 75-150km=20% tarif SPPD Band). TIDAK menyimpan. ---

    [HttpGet("admin/umdl-formula")]
    public async Task<IActionResult> UmdlFormula([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungUmdlAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- SPPD (TJ_SPPD): preview hitung otomatis dari SPPD disetujui (tarif Band x jumlah
    //     SPPD dalam periode). TIDAK menyimpan. ---

    [HttpGet("admin/sppd-formula")]
    public async Task<IActionResult> SppdFormula([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungSppdAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- Tarif Tunjangan Luar Daerah per Wilayah x Band (Medan/Lampung/Makassar x Band
    //     III-VI saat ini). Endpoint SENDIRI (dua dimensi, beda dari tarif_tunggal). ---

    [HttpGet("admin/tarif-wilayah")]
    public async Task<ActionResult<TarifWilayahDto>> TarifWilayah([FromQuery] int tahun)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        return Ok(await _gaji.GetTarifWilayahAsync(tahun));
    }

    [HttpPut("admin/tarif-wilayah")]
    public async Task<IActionResult> SimpanTarifWilayah([FromBody] SimpanTarifWilayahRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (req.Tahun < 2000) return BadRequest(new { message = "Tahun tidak valid." });
        var (ok, error) = await _gaji.SimpanTarifWilayahAsync(req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    // --- Tunjangan Luar Daerah (TJ_LUAR): preview hitung otomatis dari wilayah kerja +
    //     Band pegawai saat ini. TIDAK menyimpan. ---

    [HttpGet("admin/luar-daerah-formula")]
    public async Task<IActionResult> LuarDaerahFormula([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungLuarDaerahAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- Potongan BPJS Kesehatan (POT_BPJS_KES): preview hitung otomatis dari status
    //     tanggungan pegawai saat ini (default 0, tanggungan >3 = tambahan 1%/orang dari
    //     Pendapatan Dasar). TIDAK menyimpan. ---

    [HttpGet("admin/bpjs-kes-formula")]
    public async Task<IActionResult> BpjsKesFormula([FromQuery] string nik, [FromQuery] int tahun, [FromQuery] int bulan)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        if (string.IsNullOrWhiteSpace(nik)) return BadRequest(new { message = "NIK wajib diisi." });
        if (bulan < 1 || bulan > 12) return BadRequest(new { message = "Bulan tidak valid." });
        var (ok, error, data) = await _gaji.HitungBpjsKesPotonganAsync(nik, tahun, bulan);
        return ok ? Ok(data) : NotFound(new { message = error });
    }

    // --- Komponen berbasis rumus (mis. Tunjangan BPJS Kesehatan = %  Pendapatan Dasar) ---

    [HttpGet("admin/formula")]
    public async Task<ActionResult<FormulaListDto>> Formula()
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        return Ok(await _gaji.GetFormulaAsync());
    }

    [HttpPut("admin/formula")]
    public async Task<IActionResult> SimpanFormula([FromBody] SimpanFormulaRequest req)
    {
        if (!await IsSdmAdminAsync()) return Forbid();
        var (ok, error) = await _gaji.SimpanFormulaAsync(req);
        return ok ? NoContent() : BadRequest(new { message = error });
    }

    private async Task<bool> IsSdmAdminAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN ?? user?.Nik;
        return await _access.IsSdmAdminAsync(nik);
    }
}
