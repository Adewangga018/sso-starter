using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using KpiEntity = SsoBackend.Models.Kpi.Kpi;

namespace SsoBackend.Services;

// My Progress (KPI). Aturan:
//  - KPI Perusahaan (top-level): hanya Admin Modul SDM yang kelola.
//  - KPI Individu: atasan (jenjang mana pun di atasnya) menurunkan ke bawahan;
//    atasan/pembuat menilai realisasi. Bawahan hanya melihat KPI miliknya.
// Hirarki dibaca dari grading.jabatan_hirarki (raw SQL, db_mygcs).
public class KpiService
{
    private readonly ApplicationDbContext _db;
    private readonly ModuleAccessService _access;

    public KpiService(ApplicationDbContext db, ModuleAccessService access)
    {
        _db = db;
        _access = access;
    }

    // ---- Halaman "KPI Saya" (semua karyawan) ----
    public async Task<KpiSayaDto> GetSayaAsync(string nik)
    {
        var perusahaan = await _db.Kpi.AsNoTracking()
            .Where(k => k.Level == "Perusahaan")
            .OrderByDescending(k => k.Periode).ThenBy(k => k.Id)
            .ToListAsync();
        var saya = await _db.Kpi.AsNoTracking()
            .Where(k => k.Level == "Individu" && k.IdPemilik == nik)
            .OrderByDescending(k => k.Periode).ThenBy(k => k.Id)
            .ToListAsync();

        var isAtasan = await ExistsBawahanAsync(nik);
        var isAdminSdm = await _access.IsSdmAdminAsync(nik);

        return new KpiSayaDto(
            perusahaan.Select(Map).ToList(),
            saya.Select(Map).ToList(),
            isAtasan, isAdminSdm);
    }

    // ---- KPI Perusahaan (list; kelola khusus SDM) ----
    public async Task<IReadOnlyList<KpiDto>> GetPerusahaanAsync()
    {
        var rows = await _db.Kpi.AsNoTracking()
            .Where(k => k.Level == "Perusahaan")
            .OrderByDescending(k => k.Periode).ThenBy(k => k.Id)
            .ToListAsync();
        return rows.Select(Map).ToList();
    }

    // ---- Daftar anggota tim (seluruh jenjang) + jumlah KPI masing-masing ----
    public async Task<IReadOnlyList<KpiAnggotaDto>> GetTimAsync(string nik)
    {
        var bawahan = await GetBawahanAsync(nik);
        if (bawahan.Count == 0) return Array.Empty<KpiAnggotaDto>();

        var niks = bawahan.Select(b => b.Nik).ToList();
        var counts = await _db.Kpi.AsNoTracking()
            .Where(k => k.Level == "Individu" && niks.Contains(k.IdPemilik!))
            .GroupBy(k => k.IdPemilik!)
            .Select(g => new { Nik = g.Key, N = g.Count() })
            .ToDictionaryAsync(x => x.Nik, x => x.N);

        return bawahan.Select(b => new KpiAnggotaDto(
            b.Nik, b.Nama, b.Jabatan, counts.TryGetValue(b.Nik, out var n) ? n : 0)).ToList();
    }

    // ---- KPI milik seorang bawahan (untuk atasan) ----
    public async Task<(bool Ok, string? Error, IReadOnlyList<KpiDto>? Data)> GetKaryawanKpiAsync(string nik, string targetNik)
    {
        if (!await IsBawahanAsync(nik, targetNik))
        {
            return (false, "Karyawan ini bukan bawahan Anda.", null);
        }
        var rows = await _db.Kpi.AsNoTracking()
            .Where(k => k.Level == "Individu" && k.IdPemilik == targetNik)
            .OrderByDescending(k => k.Periode).ThenBy(k => k.Id)
            .ToListAsync();
        return (true, null, rows.Select(Map).ToList());
    }

    // ---- Buat KPI Perusahaan (SDM) ----
    public async Task<(bool Ok, string? Error)> CreatePerusahaanAsync(string nik, string? nama, SimpanKpiRequest req)
    {
        if (!await _access.IsSdmAdminAsync(nik))
        {
            return (false, "Hanya Admin Modul SDM yang dapat mengelola KPI perusahaan.");
        }
        if (string.IsNullOrWhiteSpace(req.Judul)) return (false, "Judul KPI wajib diisi.");

        _db.Kpi.Add(new KpiEntity
        {
            Periode = req.Periode.Trim(),
            Judul = req.Judul.Trim(),
            Deskripsi = Clean(req.Deskripsi),
            Satuan = Clean(req.Satuan),
            Target = req.Target,
            Bobot = req.Bobot,
            Level = "Perusahaan",
            IdPemilik = null,
            NamaPemilik = null,
            IdParent = null,
            IdPembuat = nik,
            NamaPembuat = nama,
            Status = "Berjalan",
            TglDibuat = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- Turunkan KPI ke bawahan (atasan) ----
    public async Task<(bool Ok, string? Error)> CreateIndividuAsync(string nik, string? nama, string targetNik, SimpanKpiRequest req)
    {
        if (!await IsBawahanAsync(nik, targetNik))
        {
            return (false, "Anda hanya dapat menurunkan KPI ke bawahan Anda.");
        }
        if (string.IsNullOrWhiteSpace(req.Judul)) return (false, "Judul KPI wajib diisi.");

        var namaTarget = await NamaPenempatanAsync(targetNik);
        _db.Kpi.Add(new KpiEntity
        {
            Periode = req.Periode.Trim(),
            Judul = req.Judul.Trim(),
            Deskripsi = Clean(req.Deskripsi),
            Satuan = Clean(req.Satuan),
            Target = req.Target,
            Bobot = req.Bobot,
            Level = "Individu",
            IdPemilik = targetNik,
            NamaPemilik = namaTarget,
            IdParent = req.IdParent,
            IdPembuat = nik,
            NamaPembuat = nama,
            Status = "Berjalan",
            TglDibuat = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- Ubah definisi KPI ----
    public async Task<(bool Ok, string? Error)> UpdateAsync(string nik, long id, SimpanKpiRequest req)
    {
        var k = await _db.Kpi.FirstOrDefaultAsync(x => x.Id == id);
        if (k is null) return (false, "KPI tidak ditemukan.");
        var (allowed, err) = await CanManageAsync(nik, k);
        if (!allowed) return (false, err);

        k.Periode = req.Periode.Trim();
        k.Judul = req.Judul.Trim();
        k.Deskripsi = Clean(req.Deskripsi);
        k.Satuan = Clean(req.Satuan);
        k.Target = req.Target;
        k.Bobot = req.Bobot;
        k.IdParent = req.IdParent;
        k.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- Nilai realisasi (atasan menilai) ----
    public async Task<(bool Ok, string? Error)> NilaiAsync(string nik, long id, NilaiKpiRequest req)
    {
        var k = await _db.Kpi.FirstOrDefaultAsync(x => x.Id == id);
        if (k is null) return (false, "KPI tidak ditemukan.");
        var (allowed, err) = await CanManageAsync(nik, k);
        if (!allowed) return (false, err);

        var status = req.Status?.Trim() ?? "Berjalan";
        if (status is not ("Berjalan" or "Tercapai" or "Tidak Tercapai" or "Dibatalkan"))
        {
            return (false, "Status tidak valid.");
        }
        k.Realisasi = req.Realisasi;
        k.Status = status;
        k.Catatan = Clean(req.Catatan);
        k.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(string nik, long id)
    {
        var k = await _db.Kpi.FirstOrDefaultAsync(x => x.Id == id);
        if (k is null) return (false, "KPI tidak ditemukan.");
        var (allowed, err) = await CanManageAsync(nik, k);
        if (!allowed) return (false, err);

        // Lepas kaitan anak (cascade) supaya FK tidak menolak.
        var anak = await _db.Kpi.Where(x => x.IdParent == id).ToListAsync();
        foreach (var a in anak) a.IdParent = null;
        _db.Kpi.Remove(k);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // Boleh kelola bila: KPI Perusahaan → Admin SDM; KPI Individu → pembuat, atau
    // atasan pemilik (jenjang mana pun), atau Admin SDM.
    private async Task<(bool Ok, string? Error)> CanManageAsync(string nik, KpiEntity k)
    {
        if (k.Level == "Perusahaan")
        {
            return await _access.IsSdmAdminAsync(nik)
                ? (true, null)
                : (false, "Hanya Admin Modul SDM yang dapat mengelola KPI perusahaan.");
        }
        if (k.IdPembuat == nik) return (true, null);
        if (k.IdPemilik is not null && await IsBawahanAsync(nik, k.IdPemilik)) return (true, null);
        if (await _access.IsSdmAdminAsync(nik)) return (true, null);
        return (false, "Anda tidak berwenang mengubah KPI ini.");
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static KpiDto Map(KpiEntity k)
    {
        var persen = k.Target != 0 ? Math.Round(k.Realisasi / k.Target * 100m, 1) : 0m;
        if (persen < 0) persen = 0;
        return new KpiDto(
            k.Id, k.Periode, k.Judul, k.Deskripsi, k.Satuan, k.Target, k.Realisasi, k.Bobot, persen,
            k.Level, k.IdPemilik, k.NamaPemilik, k.IdParent, k.IdPembuat, k.NamaPembuat,
            k.Status, k.Catatan, k.TglDibuat, k.TglDiubah);
    }

    // ================= grading (raw SQL) =================

    private async Task<bool> ExistsBawahanAsync(string nik)
    {
        return await ScalarBoolAsync(@"
            SELECT TOP 1 1
            FROM grading.penempatan pm
            JOIN grading.jabatan_hirarki h ON h.id_jabatan_atasan = pm.id_jabatan AND h.kedalaman > 0
            JOIN grading.penempatan pp ON pp.id_jabatan = h.id_jabatan_bawahan AND pp.status = 'Aktif'
            WHERE pm.id_karyawan = @nik AND pm.status = 'Aktif'",
            ("@nik", nik));
    }

    private async Task<bool> IsBawahanAsync(string atasanNik, string targetNik)
    {
        return await ScalarBoolAsync(@"
            SELECT TOP 1 1
            FROM grading.penempatan pm
            JOIN grading.jabatan_hirarki h ON h.id_jabatan_atasan = pm.id_jabatan AND h.kedalaman > 0
            JOIN grading.penempatan pp ON pp.id_jabatan = h.id_jabatan_bawahan AND pp.status = 'Aktif'
            WHERE pm.id_karyawan = @me AND pm.status = 'Aktif' AND pp.id_karyawan = @target",
            ("@me", atasanNik), ("@target", targetNik));
    }

    // Seluruh jenjang bawahan (kedalaman > 0), berikut nama & jabatannya.
    private async Task<List<(string Nik, string Nama, string? Jabatan)>> GetBawahanAsync(string nik)
    {
        var list = new List<(string, string, string?)>();
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT DISTINCT pp.id_karyawan, pp.nama, j.nama_jabatan
                FROM grading.penempatan pm
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_atasan = pm.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan j ON j.id_jabatan = h.id_jabatan_bawahan
                JOIN grading.penempatan pp ON pp.id_jabatan = j.id_jabatan AND pp.status = 'Aktif'
                WHERE pm.id_karyawan = @nik AND pm.status = 'Aktif'
                ORDER BY pp.nama";
            AddParam(cmd, "@nik", nik);
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add((r.GetString(0), r.IsDBNull(1) ? "" : r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2)));
            }
            return list;
        }
        finally { if (mustClose) await conn.CloseAsync(); }
    }

    private async Task<string?> NamaPenempatanAsync(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT TOP 1 nama FROM grading.penempatan WHERE id_karyawan = @nik AND status = 'Aktif'";
            AddParam(cmd, "@nik", nik);
            return (await cmd.ExecuteScalarAsync()) as string;
        }
        finally { if (mustClose) await conn.CloseAsync(); }
    }

    private async Task<bool> ScalarBoolAsync(string sql, params (string Name, object Value)[] pars)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            foreach (var (name, value) in pars) AddParam(cmd, name, value);
            return (await cmd.ExecuteScalarAsync()) is not null;
        }
        finally { if (mustClose) await conn.CloseAsync(); }
    }

    private static void AddParam(DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }
}
