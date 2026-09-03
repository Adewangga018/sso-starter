using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Tiket;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Monitoring pemesanan tiket seluruh karyawan (staf Sekretariat, mis. Eka & Farcha) -
// dipisah dari TiketController krn otorisasinya BEDA: bukan "punya sendiri" (CRUD
// pemohon), tapi lintas karyawan, dibatasi role SekretariatTiket (lihat AdminController.
// SetSekretariatTiket) - Admin IT otomatis termasuk. Sama pola dgn DinasController yg
// dipisah dari UmdlController/SppdController.
[ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
[Route("personal/tiket/admin")]
[ModuleGate("my-personal")]
[FeatureGate("my-personal:tiket")]
public class TiketAdminController : ControllerBase
{
    private static readonly string[] StatusProgresValid = ["Belum Diproses", "Sedang Diproses", "Selesai"];

    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;
    private readonly CurrentUserContext _currentUser;

    public TiketAdminController(ApplicationDbContext db, GcsDbContext gcs, CurrentUserContext currentUser)
    {
        _db = db;
        _gcs = gcs;
        _currentUser = currentUser;
    }

    private bool IsSekretariatTiket() => User.IsInRole("Admin") || User.IsInRole("SekretariatTiket");

    // Daftar pemesanan tiket SEMUA karyawan yang SUDAH disetujui atasan (approval.
    // pengajuan.Jenis="Tiket", Status="Disetujui" secara default) - alur: karyawan ajukan
    // -> atasan approve (Kotak Persetujuan) -> staf Sekretariat pantau & tindak lanjuti di
    // sini. Filter status=... boleh diisi utk lihat status persetujuan lain (mis. yg masih
    // "Menunggu", utk gambaran beban kerja yg akan datang).
    [HttpGet]
    public async Task<ActionResult<TiketAdminListDto>> GetAll(
        [FromQuery] string? status, [FromQuery] string? statusProgres, [FromQuery] string? jenis,
        [FromQuery] string? nik, [FromQuery] DateOnly? dari, [FromQuery] DateOnly? sampai)
    {
        if (!IsSekretariatTiket())
        {
            return Forbid();
        }

        var statusPersetujuan = string.IsNullOrWhiteSpace(status) ? "Disetujui" : status.Trim();

        var approvalQuery = _db.ApprovalPengajuan.AsNoTracking().Where(a => a.Jenis == "Tiket");
        if (statusPersetujuan != "Semua")
        {
            approvalQuery = approvalQuery.Where(a => a.Status == statusPersetujuan);
        }
        var approvals = await approvalQuery.ToListAsync();
        var approvalByRef = approvals.ToDictionary(a => a.RefId, a => a);

        var refIds = approvals.Select(a => int.Parse(a.RefId)).ToList();
        var tiketQuery = _gcs.WebSdmPesanTiket.AsNoTracking().Where(t => refIds.Contains(t.id));
        if (!string.IsNullOrWhiteSpace(nik))
        {
            var term = nik.Trim();
            tiketQuery = tiketQuery.Where(t => t.id_user == term);
        }
        if (dari is DateOnly d1)
        {
            var dt = d1.ToDateTime(TimeOnly.MinValue);
            tiketQuery = tiketQuery.Where(t => t.tgl_input >= dt);
        }
        if (sampai is DateOnly d2)
        {
            var dt = d2.ToDateTime(TimeOnly.MaxValue);
            tiketQuery = tiketQuery.Where(t => t.tgl_input <= dt);
        }

        var rows = await tiketQuery.OrderByDescending(t => t.tgl_input).Take(500).ToListAsync();

        var ids = rows.Select(r => r.id).ToList();
        var detailQuery = _gcs.WebSdmPesanTiketDetail.AsNoTracking().Where(d => ids.Contains(d.id));
        if (!string.IsNullOrWhiteSpace(jenis))
        {
            detailQuery = detailQuery.Where(d => d.jenis_tiket == jenis.Trim());
        }
        var details = await detailQuery.OrderBy(d => d.id_det).ToListAsync();
        // Filter jenis diterapkan ke rincian, bukan header - hanya sertakan header yg punya
        // >=1 rincian sesuai jenis yg dicari (kalau filter jenis dipakai).
        if (!string.IsNullOrWhiteSpace(jenis))
        {
            var idsWithJenis = details.Select(d => d.id).ToHashSet();
            rows = rows.Where(r => idsWithJenis.Contains(r.id)).ToList();
        }

        var niks = rows.Select(r => r.id_user).Distinct().ToList();
        var nama = await _gcs.PegawaiSdm.Where(p => niks.Contains(p.Nik)).ToDictionaryAsync(p => p.Nik, p => p.nama);

        var refIdStrs = refIds.Select(x => x.ToString()).ToList();
        var progresRows = await _db.TiketProgres.AsNoTracking()
            .Where(p => refIdStrs.Contains(p.RefId))
            .ToListAsync();
        var progresByRef = progresRows.ToDictionary(p => p.RefId, p => p);
        if (!string.IsNullOrWhiteSpace(statusProgres))
        {
            var wanted = statusProgres.Trim();
            rows = rows.Where(r =>
                (progresByRef.TryGetValue(r.id.ToString(), out var p) ? p.Status : "Belum Diproses") == wanted).ToList();
        }

        var items = rows.Select(t =>
        {
            var refIdStr = t.id.ToString();
            approvalByRef.TryGetValue(refIdStr, out var approval);
            progresByRef.TryGetValue(refIdStr, out var progres);

            return new TiketAdminItemDto(
                t.id, t.kode_tiket, t.id_user, nama.GetValueOrDefault(t.id_user), t.tgl_input, t.keterangan,
                approval?.Status, approval?.TglKeputusan,
                progres?.Status ?? "Belum Diproses", progres?.Catatan,
                details.Where(d => d.id == t.id)
                    .Select(d => new TiketDetailDto(d.id_det, d.jenis_tiket, d.tgl_tiket_in, d.tgl_tiket_out, d.keterangan))
                    .ToList());
        }).ToList();

        var ringkasan = new TiketAdminSummaryDto(
            TotalDisetujui: items.Count(i => i.StatusPersetujuan == "Disetujui"),
            BelumDiproses: items.Count(i => i.StatusProgres == "Belum Diproses"),
            SedangDiproses: items.Count(i => i.StatusProgres == "Sedang Diproses"),
            Selesai: items.Count(i => i.StatusProgres == "Selesai"),
            PerJenisTiket: items
                .SelectMany(i => i.Rincian)
                .GroupBy(r => r.JenisTiket)
                .ToDictionary(g => g.Key, g => g.Count()));

        return Ok(new TiketAdminListDto(ringkasan, items));
    }

    // Tandai progres tindak lanjut staf Sekretariat atas satu pemesanan tiket (Belum
    // Diproses -> Sedang Diproses -> Selesai), bebas catatan singkat (mis. "sudah dipesan
    // di [agen], kode booking XXX"). Baris tiket.progres dibuat on-demand.
    [HttpPut("{id:int}/progres")]
    public async Task<IActionResult> SetProgres(int id, TiketProgresRequest request)
    {
        if (!IsSekretariatTiket())
        {
            return Forbid();
        }

        if (!StatusProgresValid.Contains(request.Status))
        {
            return BadRequest(new { message = "Status progres tidak dikenal." });
        }

        if (!await _gcs.WebSdmPesanTiket.AnyAsync(t => t.id == id))
        {
            return NotFound(new { message = "Pemesanan tiket tidak ditemukan." });
        }

        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        var refIdStr = id.ToString();

        var progres = await _db.TiketProgres.AsTracking().FirstOrDefaultAsync(p => p.RefId == refIdStr);
        if (progres is null)
        {
            progres = new TiketProgres { RefId = refIdStr };
            _db.TiketProgres.Add(progres);
        }

        progres.Status = request.Status;
        progres.Catatan = string.IsNullOrWhiteSpace(request.Catatan) ? null : request.Catatan.Trim();
        progres.DiprosesOleh = pegawai?.ID_KARYAWAN;
        progres.DiprosesPada = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
