using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;
using SsoBackend.Models.Gcs;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Panel Admin IT - toggle manual "Admin SDM"/"Admin Kepatuhan" per karyawan, TERLEPAS dari
// jabatannya di Struktur Organisasi (diminta user 2026-08-27, "fleksibilitas penugasan").
// HANYA Admin IT (role Identity "Admin") yang bisa mengelola ini - beda dari
// AdminController.cs (Identity Id + role Identity) karena override ini keyed by NIK dan
// perlu picker karyawan company-wide (bukan cuma yang sudah pernah login MyGCS).
[ApiController]
[Route("admin/overrides")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminOverrideController : ControllerBase
{
    private const string AdminRole = "Admin";
    private static readonly HashSet<string> ModulValid = new(StringComparer.OrdinalIgnoreCase) { "SDM", "Kepatuhan" };

    private readonly ApplicationDbContext _appDb;
    private readonly GcsDbContext _db;
    private readonly CurrentUserContext _currentUser;

    public AdminOverrideController(ApplicationDbContext appDb, GcsDbContext db, CurrentUserContext currentUser)
    {
        _appDb = appDb;
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminOverrideDto>>> List()
    {
        if (!IsAdmin()) return Forbid();

        var rows = await _appDb.AdminOverrides
            .OrderByDescending(o => o.DiberikanPada)
            .Select(o => new AdminOverrideDto(
                o.Id, o.IdKaryawan, o.NamaKaryawan, o.Modul, o.Aktif,
                o.DiberikanOleh, o.DiberikanPada, o.DiperbaruiPada))
            .ToListAsync();

        return Ok(rows);
    }

    // Picker karyawan company-wide (bukan dibatasi departemen tertentu - Admin IT boleh
    // beri akses admin SDM/Kepatuhan ke siapa saja), tenaga kerja organik (Tetap) - konsisten
    // dgn picker lain (lihat SppdController.CariPegawai).
    [HttpGet("cari-pegawai")]
    public async Task<ActionResult<IReadOnlyList<PegawaiPickerDto>>> CariPegawai([FromQuery] string? q)
    {
        if (!IsAdmin()) return Forbid();

        var query = _db.PegawaiSdm.Where(p => p.data_aktif == "Aktif" && p.jenis_pegawai == "Tetap");
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(p => p.Nik.Contains(term) || (p.nama != null && p.nama.Contains(term)));
        }

        var hasil = await query
            .OrderBy(p => p.nama)
            .Take(100)
            .Select(p => new PegawaiPickerDto(p.Nik, p.nama, p.WILAYAH, p.UNIT_KERJA))
            .ToListAsync();

        return Ok(hasil);
    }

    // Beri akses (Aktif = true dari awal). Menimpa baris lama kalau karyawan itu sudah
    // pernah punya override utk modul yg sama sebelumnya (UNIQUE id_karyawan+modul).
    [HttpPost]
    public async Task<IActionResult> Buat([FromBody] BuatAdminOverrideRequest req)
    {
        if (!IsAdmin()) return Forbid();
        if (string.IsNullOrWhiteSpace(req.IdKaryawan)) return BadRequest(new { message = "Karyawan wajib dipilih." });
        if (!ModulValid.Contains(req.Modul)) return BadRequest(new { message = "Modul harus SDM atau Kepatuhan." });

        var pegawai = await _db.PegawaiSdm.FirstOrDefaultAsync(p => p.Nik == req.IdKaryawan);
        var now = DateTime.UtcNow;
        var nik = await CurrentNikAsync();

        var existing = await _appDb.AdminOverrides.FirstOrDefaultAsync(o => o.IdKaryawan == req.IdKaryawan && o.Modul == req.Modul);
        if (existing is null)
        {
            existing = new AdminOverride { IdKaryawan = req.IdKaryawan, Modul = req.Modul, DiberikanPada = now };
            _appDb.AdminOverrides.Add(existing);
        }
        existing.NamaKaryawan = pegawai?.nama;
        existing.Aktif = true;
        existing.DiberikanOleh = nik ?? string.Empty;
        existing.DiperbaruiPada = now;

        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    // Nyalakan/matikan toggle - baris tetap ada (riwayat), tinggal diaktifkan lagi kapan pun
    // tanpa perlu pilih karyawan & modul dari awal.
    [HttpPut("{id:int}/aktif")]
    public async Task<IActionResult> SetAktif(int id, [FromBody] SetAktifAdminOverrideRequest req)
    {
        if (!IsAdmin()) return Forbid();

        var row = await _appDb.AdminOverrides.FirstOrDefaultAsync(o => o.Id == id);
        if (row is null) return NotFound(new { message = "Data tidak ditemukan." });

        row.Aktif = req.Aktif;
        row.DiperbaruiPada = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Hapus(int id)
    {
        if (!IsAdmin()) return Forbid();

        var row = await _appDb.AdminOverrides.FirstOrDefaultAsync(o => o.Id == id);
        if (row is null) return NotFound(new { message = "Data tidak ditemukan." });

        _appDb.AdminOverrides.Remove(row);
        await _appDb.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> CurrentNikAsync()
    {
        var (user, pegawai) = await _currentUser.ResolveAsync(User);
        return pegawai?.ID_KARYAWAN ?? user?.Nik;
    }

    private bool IsAdmin() =>
        User.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
}
