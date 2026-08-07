using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Bukti perjalanan dinas (rentang km + foto lokasi) lintas UMDL/SPPD - lihat DinasBuktiService.
// Dipisah dari UmdlController/SppdController krn otorisasinya BEDA dari CRUD milik sendiri:
// foto boleh dilihat pemilik ATAU atasan yang menyetujui (Kotak Persetujuan) ATAU Admin SDM
// (verifikasi lintas perusahaan) - bukan cuma "punya sendiri" spt endpoint UMDL/SPPD lainnya.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal/dinas")]
[ModuleGate("my-personal")]
public class DinasController : ControllerBase
{
    private static readonly string[] AllowedJenis = ["UMDL", "SPPD"];

    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly CurrentUserContext _currentUser;
    private readonly ModuleAccessService _access;
    private readonly DinasBuktiService _bukti;

    public DinasController(
        ApplicationDbContext db, GcsDbContext gcs, CurrentUserContext currentUser,
        ModuleAccessService access, DinasBuktiService bukti)
    {
        _db = db;
        _gcs = gcs;
        _currentUser = currentUser;
        _access = access;
        _bukti = bukti;
    }

    // Foto bukti dinas - pemilik ATAU atasan/manager penyetuju (approval.pengajuan) ATAU
    // Admin SDM boleh lihat.
    [HttpGet("foto/{jenis}/{refId}")]
    public async Task<IActionResult> Foto(string jenis, string refId)
    {
        if (!AllowedJenis.Contains(jenis))
        {
            return BadRequest(new { message = "Jenis tidak dikenal." });
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        var nik = pegawai?.ID_KARYAWAN;
        if (string.IsNullOrWhiteSpace(nik))
        {
            return NotFound(new { message = "Data pegawai tidak ditemukan untuk akun ini." });
        }

        var row = await _bukti.CariAsync(jenis, refId);
        if (row is null)
        {
            return NotFound(new { message = "Bukti dinas tidak ditemukan." });
        }

        var isPemilik = row.IdKaryawan == nik;
        var isAdminSdm = await _access.IsSdmAdminAsync(nik);
        var isPenyetuju = !isPemilik && !isAdminSdm && await _db.ApprovalPengajuan.AsNoTracking()
            .AnyAsync(a => a.Jenis == jenis && a.RefId == refId && (a.IdManager == nik || a.IdAtasan == nik));

        if (!isPemilik && !isAdminSdm && !isPenyetuju)
        {
            return Forbid();
        }

        var path = _bukti.ResolvePhysicalPath(row.Foto);
        if (!System.IO.File.Exists(path))
        {
            return NotFound(new { message = "Berkas foto tidak ditemukan di penyimpanan." });
        }

        return PhysicalFile(path, "image/jpeg");
    }

    // Daftar SEMUA bukti dinas perusahaan (Admin SDM) - verifikasi lintas UMDL/SPPD, tidak
    // terbatas pada alur approval sendiri.
    [HttpGet("admin")]
    public async Task<ActionResult<DinasBuktiAdminListDto>> AdminList(
        [FromQuery] string? jenis, [FromQuery] DateOnly? dari, [FromQuery] DateOnly? sampai, [FromQuery] string? nik)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        var myNik = pegawai?.ID_KARYAWAN;
        if (string.IsNullOrWhiteSpace(myNik) || !await _access.IsSdmAdminAsync(myNik))
        {
            return Forbid();
        }

        var query = _db.DinasBukti.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(jenis) && AllowedJenis.Contains(jenis))
        {
            query = query.Where(b => b.Jenis == jenis);
        }
        if (!string.IsNullOrWhiteSpace(nik))
        {
            var term = nik.Trim();
            query = query.Where(b => b.IdKaryawan == term);
        }
        if (dari is DateOnly d1)
        {
            var dt = d1.ToDateTime(TimeOnly.MinValue);
            query = query.Where(b => b.DibuatPada >= dt);
        }
        if (sampai is DateOnly d2)
        {
            var dt = d2.ToDateTime(TimeOnly.MaxValue);
            query = query.Where(b => b.DibuatPada <= dt);
        }

        var rows = await query.OrderByDescending(b => b.DibuatPada).Take(500).ToListAsync();

        var niks = rows.Select(r => r.IdKaryawan).Distinct().ToList();
        var nama = await _gcs.PegawaiSdm.Where(p => niks.Contains(p.Nik)).ToDictionaryAsync(p => p.Nik, p => p.nama);

        var umdlIds = rows.Where(r => r.Jenis == "UMDL").Select(r => decimal.Parse(r.RefId)).ToList();
        var umdlRows = umdlIds.Count == 0 ? []
            : await _gcs.WebSdmUmdl.Where(u => umdlIds.Contains(u.ID))
                .ToDictionaryAsync(u => u.ID.ToString(), u => new { Ringkasan = u.KETERANGAN, u.STATUS });

        var sppdIds = rows.Where(r => r.Jenis == "SPPD").Select(r => int.Parse(r.RefId)).ToList();
        var sppdRows = sppdIds.Count == 0 ? []
            : await _gcs.WebSdmSppd.Where(s => sppdIds.Contains(s.id))
                .ToDictionaryAsync(s => s.id.ToString(), s => new { Ringkasan = s.tujuan_sppd, s.status });

        var items = rows.Select(r =>
        {
            string? ringkasan = null;
            string? status = null;
            if (r.Jenis == "UMDL" && umdlRows.TryGetValue(r.RefId, out var u)) { ringkasan = u.Ringkasan; status = u.STATUS; }
            else if (r.Jenis == "SPPD" && sppdRows.TryGetValue(r.RefId, out var s)) { ringkasan = s.Ringkasan; status = s.status; }

            return new DinasBuktiAdminDto(
                r.Id, r.Jenis, r.RefId, r.IdKaryawan, nama.GetValueOrDefault(r.IdKaryawan),
                r.RentangKm, r.DibuatPada, ringkasan, status,
                $"/api/personal/dinas/foto/{r.Jenis}/{r.RefId}");
        }).ToList();

        return Ok(new DinasBuktiAdminListDto(items));
    }
}
