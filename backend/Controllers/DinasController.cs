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

        // Peserta (Ketua/Anggota, bukan cuma pengaju) ikut boleh lihat - diminta 2026-08-24,
        // sejalan dgn peserta yg sekarang ikut melihat baris SPPD/UMDL ini di akun mereka
        // sendiri (SppdController/UmdlController.GetAll).
        var isPeserta = false;
        if (!isPemilik && !isAdminSdm && !isPenyetuju)
        {
            if (jenis == "SPPD" && int.TryParse(refId, out var sppdId))
            {
                isPeserta = await _gcs.WebSdmSppdDetail.AsNoTracking().AnyAsync(d => d.id == sppdId && d.id_user == nik);
            }
            else if (jenis == "UMDL")
            {
                isPeserta = await _db.UmdlAnggota.AsNoTracking().AnyAsync(a => a.RefId == refId && a.IdKaryawan == nik);
            }
        }

        if (!isPemilik && !isAdminSdm && !isPenyetuju && !isPeserta)
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
                .ToDictionaryAsync(u => u.ID.ToString(), u => u.KETERANGAN);

        var sppdIds = rows.Where(r => r.Jenis == "SPPD").Select(r => int.Parse(r.RefId)).ToList();
        var sppdRows = sppdIds.Count == 0 ? []
            : await _gcs.WebSdmSppd.Where(s => sppdIds.Contains(s.id))
                .ToDictionaryAsync(s => s.id.ToString(), s => s.tujuan_sppd);

        // Status PERSETUJUAN MANAGER real-time (approval.pengajuan), bukan status legacy
        // web_sdm_umdl.STATUS/web_sdm_sppd.status - itu cuma menandai "Di Buat" vs sudah
        // diproses dari sisi pemohon sendiri (dikunci ubah/hapus), TIDAK ikut berubah saat
        // manager approve/reject lewat Kotak Persetujuan (diminta 2026-08-24, lihat
        // ApprovalService.PutusanAsync - hanya approval.pengajuan.Status yg dibalik utk jenis
        // SPPD/UMDL). Jadi ini satu-satunya sumber yg benar2 real-time.
        var refIds = rows.Select(r => r.RefId).Distinct().ToList();
        var approvalRows = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => (a.Jenis == "UMDL" || a.Jenis == "SPPD") && refIds.Contains(a.RefId))
            .ToListAsync();
        var approvalByKey = approvalRows.ToDictionary(a => (a.Jenis, a.RefId), a => a.Status);

        var items = rows.Select(r =>
        {
            string? ringkasan = null;
            if (r.Jenis == "UMDL") ringkasan = umdlRows.GetValueOrDefault(r.RefId);
            else if (r.Jenis == "SPPD") ringkasan = sppdRows.GetValueOrDefault(r.RefId);
            var status = approvalByKey.GetValueOrDefault((r.Jenis, r.RefId));

            return new DinasBuktiAdminDto(
                r.Id, r.Jenis, r.RefId, r.IdKaryawan, nama.GetValueOrDefault(r.IdKaryawan),
                r.RentangKm, r.DibuatPada, ringkasan, status,
                $"/api/personal/dinas/foto/{r.Jenis}/{r.RefId}");
        }).ToList();

        return Ok(new DinasBuktiAdminListDto(items));
    }

    // Rincian satu bukti dinas (Admin SDM) - siapa saja Ketua/Anggotanya, tujuan, dan
    // rentang tanggal. Diminta 2026-08-24, dibuka lewat tombol "Rincian" di Verifikasi Dinas.
    [HttpGet("admin/{jenis}/{refId}/detail")]
    public async Task<ActionResult<DinasBuktiDetailDto>> AdminDetail(string jenis, string refId)
    {
        var (_, pegawai) = await _currentUser.ResolveAsync(User);
        var myNik = pegawai?.ID_KARYAWAN;
        if (string.IsNullOrWhiteSpace(myNik) || !await _access.IsSdmAdminAsync(myNik))
        {
            return Forbid();
        }

        if (!AllowedJenis.Contains(jenis))
        {
            return BadRequest(new { message = "Jenis tidak dikenal." });
        }

        var row = await _db.DinasBukti.AsNoTracking().FirstOrDefaultAsync(b => b.Jenis == jenis && b.RefId == refId);
        if (row is null)
        {
            return NotFound(new { message = "Bukti dinas tidak ditemukan." });
        }

        string? ringkasan = null, status = null, tujuan = null;
        DateTime? tglMulai = null, tglSelesai = null;
        var peserta = new List<DinasPesertaDto>();

        if (jenis == "SPPD" && int.TryParse(refId, out var sppdId))
        {
            var sppd = await _gcs.WebSdmSppd.AsNoTracking().FirstOrDefaultAsync(s => s.id == sppdId);
            if (sppd is not null)
            {
                ringkasan = sppd.keterangan;
                tujuan = sppd.tujuan_sppd;
                tglMulai = sppd.tgl_berangkat;
                tglSelesai = sppd.tgl_pulang;
            }
            var details = await _gcs.WebSdmSppdDetail.AsNoTracking()
                .Where(d => d.id == sppdId)
                .OrderBy(d => d.posisi == "Ketua" ? 0 : 1).ThenBy(d => d.id_det)
                .ToListAsync();
            var niks = details.Select(d => d.id_user).Distinct().ToList();
            var nama = await _gcs.PegawaiSdm.Where(p => niks.Contains(p.Nik)).ToDictionaryAsync(p => p.Nik, p => p.nama);
            peserta = details.Select(d => new DinasPesertaDto(d.id_user, nama.GetValueOrDefault(d.id_user), d.posisi)).ToList();
        }
        else if (jenis == "UMDL" && decimal.TryParse(refId, out var umdlId))
        {
            var umdl = await _gcs.WebSdmUmdl.AsNoTracking().FirstOrDefaultAsync(u => u.ID == umdlId);
            if (umdl is not null)
            {
                ringkasan = umdl.KETERANGAN;
                tglMulai = umdl.TGL_UMDL;
            }
            var details = await _db.UmdlAnggota.AsNoTracking()
                .Where(a => a.RefId == refId)
                .OrderBy(a => a.Posisi == "Ketua" ? 0 : 1).ThenBy(a => a.Id)
                .ToListAsync();
            var niks = details.Select(d => d.IdKaryawan).Distinct().ToList();
            var nama = await _gcs.PegawaiSdm.Where(p => niks.Contains(p.Nik)).ToDictionaryAsync(p => p.Nik, p => p.nama);
            peserta = details.Select(d => new DinasPesertaDto(d.IdKaryawan, nama.GetValueOrDefault(d.IdKaryawan), d.Posisi)).ToList();
        }

        status = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.Jenis == jenis && a.RefId == refId)
            .Select(a => a.Status)
            .FirstOrDefaultAsync();

        var namaPemohon = await _gcs.PegawaiSdm.AsNoTracking()
            .Where(p => p.Nik == row.IdKaryawan)
            .Select(p => p.nama)
            .FirstOrDefaultAsync();

        return Ok(new DinasBuktiDetailDto(
            row.Id, row.Jenis, row.RefId, row.IdKaryawan, namaPemohon,
            row.RentangKm, row.DibuatPada, ringkasan, status, tujuan, tglMulai, tglSelesai, peserta));
    }
}
