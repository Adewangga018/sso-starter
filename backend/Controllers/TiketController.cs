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
[Route("api/personal/tiket")]
public class TiketController : ControllerBase
{
    private const string StatusDibuat = "Di Buat";

    // "LAIN" = pemesanan berdiri sendiri; EASy memakai "SPPD" kalau tiketnya diturunkan dari
    // surat perjalanan dinas. Di sini pemesanannya selalu berdiri sendiri.
    private const string SourceLain = "LAIN";

    // Nilai awal kode_tiket sebelum trigger menuliskannya ulang jadi ITK + yyyyMM + nomor urut.
    //
    // Enam nol di belakang WAJIB. Trigger menghitung nomor berikutnya dengan
    // MAX(CAST(RIGHT(kode_tiket, 6) AS INT)) atas seluruh baris berprefiks sama di bulan itu -
    // termasuk baris yang baru saja masuk ini. Kalau hanya diisi "ITK", RIGHT("ITK", 6)
    // menghasilkan "ITK" dan konversinya ke INT gagal, jadi INSERT-nya ditolak.
    private const string KodeAwal = "ITK000000";

    private static readonly string[] AllowedJenis =
        ["Bus", "Hotel", "Kapal Laut", "Kereta Api", "Pesawat"];

    private readonly GcsDbContext _db;
    private readonly CurrentUserContext _currentUser;

    public TiketController(GcsDbContext db, CurrentUserContext currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<TiketListDto>> GetAll()
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
        }

        var rows = await _db.WebSdmPesanTiket
            .Where(t => t.id_user == pegawai.ID_KARYAWAN)
            .OrderByDescending(t => t.id)
            .ToListAsync();

        var ids = rows.Select(r => r.id).ToList();
        var details = await _db.WebSdmPesanTiketDetail
            .Where(d => ids.Contains(d.id))
            .OrderBy(d => d.id_det)
            .ToListAsync();

        var items = rows.Select(t => new TiketDto(
            t.id,
            t.kode_tiket,
            t.status,
            t.tgl_input,
            t.keterangan,
            t.source,
            details
                .Where(d => d.id == t.id)
                .Select(d => $"{d.jenis_tiket} ({d.tgl_tiket_in:dd-MM-yyyy} s/d {d.tgl_tiket_out:dd-MM-yyyy})")
                .ToList())).ToList();

        return Ok(new TiketListDto(items));
    }

    [HttpPost]
    public async Task<ActionResult<TiketDto>> Create(TiketRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini. Hubungi HR/SDM." });
        }

        if (string.IsNullOrWhiteSpace(request.Keterangan))
        {
            return BadRequest(new { message = "Keterangan wajib diisi." });
        }

        var tiket = new WebSdmPesanTiket
        {
            // Trigger INSERT yang menuliskan kode_tiket sebenarnya.
            kode_tiket = KodeAwal,
            tgl_input = DateTime.Now,
            keterangan = request.Keterangan.Trim(),
            id_user = pegawai.ID_KARYAWAN,
            source = SourceLain,
            status = StatusDibuat,
            id_link = 0,
        };

        _db.WebSdmPesanTiket.Add(tiket);
        await _db.SaveChangesAsync();

        var kode = await _db.WebSdmPesanTiket
            .Where(t => t.id == tiket.id)
            .Select(t => t.kode_tiket)
            .FirstOrDefaultAsync();

        return Ok(new TiketDto(tiket.id, kode, tiket.status, tiket.tgl_input, tiket.keterangan, tiket.source, []));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, TiketRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (string.IsNullOrWhiteSpace(request.Keterangan))
        {
            return BadRequest(new { message = "Keterangan wajib diisi." });
        }

        var tiket = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (tiket is null)
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan atau sudah diproses." });
        }

        tiket.keterangan = request.Keterangan.Trim();
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var tiket = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (tiket is null)
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan atau sudah diproses." });
        }

        // Tidak ada foreign key di tabel ini, jadi baris rincian harus dihapus sendiri -
        // kalau tidak, mereka jadi yatim dan bisa menempel ke pemesanan lain ber-id sama.
        var details = await _db.WebSdmPesanTiketDetail.AsTracking().Where(d => d.id == id).ToListAsync();
        _db.WebSdmPesanTiketDetail.RemoveRange(details);
        _db.WebSdmPesanTiket.Remove(tiket);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // --- Rincian pemesanan ---

    [HttpGet("{id:int}/detail")]
    public async Task<ActionResult<IReadOnlyList<TiketDetailDto>>> GetDetail(int id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        if (!await _db.WebSdmPesanTiket.AnyAsync(t => t.id == id && t.id_user == pegawai.ID_KARYAWAN))
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan." });
        }

        return Ok(await LoadDetailAsync(id));
    }

    [HttpPost("{id:int}/detail")]
    public async Task<ActionResult<TiketDetailDto>> AddDetail(int id, TiketDetailRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var tiket = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (tiket is null)
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan atau sudah diproses." });
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var detail = new WebSdmPesanTiketDetail
        {
            id = id,
            jenis_tiket = request.JenisTiket,
            tgl_tiket_in = request.TglIn.ToDateTime(TimeOnly.MinValue),
            tgl_tiket_out = request.TglOut.ToDateTime(TimeOnly.MinValue),
            keterangan = request.Keterangan.Trim(),
        };

        _db.WebSdmPesanTiketDetail.Add(detail);
        await _db.SaveChangesAsync();

        return Ok(new TiketDetailDto(
            detail.id_det, detail.jenis_tiket, detail.tgl_tiket_in, detail.tgl_tiket_out, detail.keterangan));
    }

    [HttpPut("{id:int}/detail/{idDet:int}")]
    public async Task<IActionResult> UpdateDetail(int id, int idDet, TiketDetailRequest request)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var tiket = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (tiket is null)
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan atau sudah diproses." });
        }

        if (Validate(request) is { } error)
        {
            return BadRequest(new { message = error });
        }

        var detail = await _db.WebSdmPesanTiketDetail
            .AsTracking()
            .FirstOrDefaultAsync(d => d.id_det == idDet && d.id == id);
        if (detail is null)
        {
            return NotFound(new { message = "Rincian tidak ditemukan." });
        }

        detail.jenis_tiket = request.JenisTiket;
        detail.tgl_tiket_in = request.TglIn.ToDateTime(TimeOnly.MinValue);
        detail.tgl_tiket_out = request.TglOut.ToDateTime(TimeOnly.MinValue);
        detail.keterangan = request.Keterangan.Trim();

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}/detail/{idDet:int}")]
    public async Task<IActionResult> DeleteDetail(int id, int idDet)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var tiket = await FindOwnEditableAsync(id, pegawai.ID_KARYAWAN);
        if (tiket is null)
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan atau sudah diproses." });
        }

        var detail = await _db.WebSdmPesanTiketDetail
            .AsTracking()
            .FirstOrDefaultAsync(d => d.id_det == idDet && d.id == id);
        if (detail is null)
        {
            return NotFound(new { message = "Rincian tidak ditemukan." });
        }

        _db.WebSdmPesanTiketDetail.Remove(detail);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Surat pemesanan tiket. Berbeda dari Surat Izin dan SPPD, dokumen ini TIDAK didaftarkan
    // ke intranet.web_ttd_elektronik dan tidak ber-QR - EASy pun mencetaknya tanpa QR.
    [HttpPost("{id:int}/print")]
    public async Task<ActionResult<TiketPrintDto>> Print(int id)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        if (pegawai is null)
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var tiket = await _db.WebSdmPesanTiket
            .FirstOrDefaultAsync(t => t.id == id && t.id_user == pegawai.ID_KARYAWAN);
        if (tiket is null)
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan." });
        }

        if (string.IsNullOrWhiteSpace(tiket.kode_tiket) || tiket.kode_tiket == KodeAwal)
        {
            return BadRequest(new { message = "Kode tiket belum terbit, coba muat ulang halaman." });
        }

        var rincian = await LoadDetailAsync(id);
        if (rincian.Count == 0)
        {
            return BadRequest(new { message = "Tambahkan minimal satu rincian sebelum mencetak." });
        }

        return Ok(new TiketPrintDto(
            tiket.kode_tiket!,
            tiket.tgl_input,
            pegawai.NAMA_LENGKAP,
            rincian,
            DateTime.Now));
    }

    // Dipakai saat menambah maupun mengubah rincian - aturannya sama persis.
    private static string? Validate(TiketDetailRequest request)
    {
        if (!AllowedJenis.Contains(request.JenisTiket))
        {
            return "Jenis tiket tidak dikenal.";
        }

        if (string.IsNullOrWhiteSpace(request.Keterangan))
        {
            return "Keterangan rincian wajib diisi.";
        }

        if (request.TglOut < request.TglIn)
        {
            return "Tanggal OUT tidak boleh sebelum tanggal IN.";
        }

        return null;
    }

    private async Task<List<TiketDetailDto>> LoadDetailAsync(int id) =>
        await _db.WebSdmPesanTiketDetail
            .Where(d => d.id == id)
            .OrderBy(d => d.id_det)
            .Select(d => new TiketDetailDto(d.id_det, d.jenis_tiket, d.tgl_tiket_in, d.tgl_tiket_out, d.keterangan))
            .ToListAsync();

    private Task<WebSdmPesanTiket?> FindOwnEditableAsync(int id, string idKaryawan) =>
        _db.WebSdmPesanTiket
            .AsTracking()
            .FirstOrDefaultAsync(t => t.id == id && t.id_user == idKaryawan && t.status == StatusDibuat);
}
