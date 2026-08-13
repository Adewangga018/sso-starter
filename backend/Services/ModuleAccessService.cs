using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;

namespace SsoBackend.Services;

// Hak "Admin Modul" berbasis grading, DITAMBAH bypass Admin IT (role Identity
// "Admin") - Admin IT punya hak akses TERTINGGI, di atas Admin SDM/Admin Kepatuhan,
// jadi otomatis lolos semua pengecekan admin-modul di bawah ini (Payroll, Struktur
// Organisasi, My Prosedur, My Health, My Asset, dst - 2026-08-11, diminta user
// eksplisit). Pola grading (tanpa bypass): jajaran sebuah Departemen level Kepala
// Bagian ke atas (band urutan <= 3) + GM Kompartemen "SDM, Kepatuhan dan
// Pengembangan" (SKP, band urutan <= 1) yang membawahi ketiga departemen.
// Departemen sibling lain TIDAK termasuk.
//   - Admin Modul SDM  -> Departemen SDM (mis. tarif gaji JG x PG).
//   - Admin Aset       -> Departemen Kepatuhan (kelola inventaris & maintenance aset).
//
// Catatan: JANGAN dikacaukan dengan ModuleSettingsService - itu mengatur modul portal
// mana yang aktif & boleh dibuka siapa (Panel Admin IT > Akses Modul).
public class ModuleAccessService
{
    private const string AdminRole = "Admin";

    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ModuleAccessService(ApplicationDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    private bool IsAdminIt()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        return user?.Identity?.IsAuthenticated == true
            && user.HasClaim(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == AdminRole);
    }

    public Task<bool> IsSdmAdminAsync(string? nik) => IsDeptAdminAsync(nik, "Departemen SDM");

    public Task<bool> IsAsetAdminAsync(string? nik) => IsDeptAdminAsync(nik, "Departemen Kepatuhan");

    // Admin My Prosedur (SOP/Kebijakan) = fungsi Tata Kelola di Departemen Kepatuhan.
    public Task<bool> IsProsedurAdminAsync(string? nik) => IsDeptAdminAsync(nik, "Departemen Kepatuhan");

    // Admin My Health (MCU/Kesehatan) = dikelola Departemen Kepatuhan.
    public Task<bool> IsHealthAdminAsync(string? nik) => IsDeptAdminAsync(nik, "Departemen Kepatuhan");

    // "Admin Modul" untuk penjaga akses portal (tingkat akses "admin_modul"): apakah `nik`
    // berhak sebagai admin pengelola modul `moduleKey`. Modul dengan pengelola jelas dipetakan
    // ke departemennya; sisanya lolos bila termasuk salah satu kelompok Admin Modul (SDM atau
    // Kepatuhan). BUKAN role Admin IT - itu ditangani terpisah di ModuleGateFilter.
    public async Task<bool> IsModuleAdminAsync(string? moduleKey, string? nik)
    {
        if (IsAdminIt()) return true;
        if (string.IsNullOrWhiteSpace(nik)) return false;
        return (moduleKey ?? string.Empty).ToLowerInvariant() switch
        {
            "my-progress" or "my-personal" or "payroll" => await IsSdmAdminAsync(nik),
            "my-prosedur" or "my-health" or "my-asset" => await IsDeptAdminAsync(nik, "Departemen Kepatuhan"),
            _ => await IsSdmAdminAsync(nik) || await IsDeptAdminAsync(nik, "Departemen Kepatuhan"),
        };
    }

    // True bila jabatan aktif berada di subtree departemen `deptName` dengan band
    // urutan <= 3, ATAU GM Kompartemen SKP (band urutan <= 1).
    private async Task<bool> IsDeptAdminAsync(string? nik, string deptName)
    {
        if (IsAdminIt()) return true;
        if (string.IsNullOrWhiteSpace(nik)) return false;

        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                ;WITH dept AS (
                    SELECT id_unit FROM grading.unit_organisasi WHERE nama = @dept
                    UNION ALL
                    SELECT c.id_unit FROM grading.unit_organisasi c
                    JOIN dept ON c.id_unit_induk = dept.id_unit
                )
                SELECT TOP 1 CASE WHEN (
                        (b.urutan <= 3 AND j.id_unit IN (SELECT id_unit FROM dept))
                     OR (b.urutan <= 1 AND u.nama LIKE N'Kompartemen SDM%')
                    ) THEN 1 ELSE 0 END
                FROM grading.penempatan p
                JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                JOIN grading.band    b ON b.id_band    = j.id_band
                LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'";
            AddParam(cmd, "@nik", nik);
            AddParam(cmd, "@dept", deptName);
            var val = await cmd.ExecuteScalarAsync();
            return val is not null && val is not DBNull && Convert.ToInt32(val) == 1;
        }
        finally
        {
            if (mustClose) await conn.CloseAsync();
        }
    }

    private static void AddParam(System.Data.Common.DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }
}
