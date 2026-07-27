using System.Data;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;

namespace SsoBackend.Services;

// Hak "Admin Modul" berbasis grading (BUKAN role Identity/Admin IT). Admin Modul SDM
// = jajaran Departemen SDM level Kepala Bagian ke atas + GM yang membawahi SDM:
//   - jabatan di subtree Departemen SDM dengan band urutan <= 3 (Kabag, Manager SDM)
//   - GM Kompartemen "SDM, Kepatuhan dan Pengembangan" (SKP), band urutan <= 1
// Departemen Kepatuhan & Pengembangan (sibling) TIDAK termasuk.
// Mereka berhak konfigurasi lanjutan modul SDM (mis. tarif gaji JG x PG).
//
// Catatan: JANGAN dikacaukan dengan ModuleSettingsService - itu mengatur modul portal
// mana yang aktif & boleh dibuka siapa (Panel Admin IT > Akses Modul).
public class ModuleAccessService
{
    private readonly ApplicationDbContext _db;

    public ModuleAccessService(ApplicationDbContext db) => _db = db;

    public async Task<bool> IsSdmAdminAsync(string? nik)
    {
        if (string.IsNullOrWhiteSpace(nik)) return false;

        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                ;WITH sdm AS (
                    SELECT id_unit FROM grading.unit_organisasi WHERE nama = N'Departemen SDM'
                    UNION ALL
                    SELECT c.id_unit FROM grading.unit_organisasi c
                    JOIN sdm ON c.id_unit_induk = sdm.id_unit
                )
                SELECT TOP 1 CASE WHEN (
                        (b.urutan <= 3 AND j.id_unit IN (SELECT id_unit FROM sdm))
                     OR (b.urutan <= 1 AND u.nama LIKE N'Kompartemen SDM%')
                    ) THEN 1 ELSE 0 END
                FROM grading.penempatan p
                JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
                JOIN grading.band    b ON b.id_band    = j.id_band
                LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'";
            var pr = cmd.CreateParameter();
            pr.ParameterName = "@nik";
            pr.Value = nik;
            cmd.Parameters.Add(pr);
            var val = await cmd.ExecuteScalarAsync();
            return val is not null && val is not DBNull && Convert.ToInt32(val) == 1;
        }
        finally
        {
            if (mustClose) await conn.CloseAsync();
        }
    }
}
