using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;

namespace SsoBackend.Services;

// Unit organisasi (Departemen + Kompartemen) hasil resolusi, ditelusuri lewat
// grading.penempatan -> jabatan -> unit_organisasi dan naik ke atas mengikuti
// id_unit_induk.
public record OrgUnit(int? IdDepartemen, string? NamaDepartemen, int? IdKompartemen, string? NamaKompartemen);

// Ringkas unit untuk dropdown Departemen Tujuan.
public record UnitRingkas(int Id, string Nama, string Tipe);

// Menentukan departemen & kompartemen (dari NIK atau dari unit), kepala unit
// (Manager/GM) untuk alur pengesahan, dan merangkai nomor registrasi inovasi.
// Semua data dari db_mygcs (grading.* + inovasi.*), lewat InovasiDbContext.
public class OrgResolver
{
    private readonly InovasiDbContext _db;

    public OrgResolver(InovasiDbContext db)
    {
        _db = db;
    }

    public async Task<OrgUnit> ResolveAsync(string? idKaryawan)
    {
        if (string.IsNullOrWhiteSpace(idKaryawan))
        {
            return new OrgUnit(null, null, null, null);
        }

        var unitId = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == idKaryawan && p.Status == "Aktif"
            select j.IdUnit).FirstOrDefaultAsync();

        return unitId is null ? new OrgUnit(null, null, null, null) : await ResolveUnitAsync(unitId.Value);
    }

    // Resolusi dept+komp mulai dari sebuah unit organisasi (mis. Departemen Tujuan).
    public async Task<OrgUnit> ResolveUnitAsync(int idUnit)
    {
        var units = await LoadUnitsAsync();
        int? deptId = null; string? deptNama = null;
        int? kompId = null; string? kompNama = null;

        var cursor = units.GetValueOrDefault(idUnit);
        var guard = 0;
        while (cursor is not null && guard++ < 10)
        {
            switch (cursor.Tipe)
            {
                case "Departemen":
                case "Region":
                case "Kelompok":
                    deptId ??= cursor.IdUnit;
                    deptNama ??= cursor.Nama;
                    break;
                case "Kompartemen":
                    kompId ??= cursor.IdUnit;
                    kompNama ??= cursor.Nama;
                    break;
            }
            cursor = cursor.IdUnitInduk is { } indukId ? units.GetValueOrDefault(indukId) : null;
        }
        return new OrgUnit(deptId, deptNama, kompId, kompNama);
    }

    // Kepala (pangkat tertinggi = id_band terkecil, lalu id_jabatan terkecil) yang
    // jabatannya berada tepat di unit tsb - dipakai sebagai Manager (Fasilitator /
    // Reviewer) untuk Departemen, atau GM (Verifikator / VP) untuk Kompartemen.
    public async Task<(string? Nik, string? Nama)?> ResolveKepalaUnitAsync(int? idUnit)
    {
        if (idUnit is null) return null;
        var kepala = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where j.IdUnit == idUnit && p.Status == "Aktif"
            orderby j.IdJabatan
            select new { p.IdKaryawan, p.Nama }).FirstOrDefaultAsync();
        return kepala is null ? null : (kepala.IdKaryawan, kepala.Nama);
    }

    // Daftar unit yang bisa dipilih sebagai Departemen Tujuan gagasan.
    public async Task<IReadOnlyList<UnitRingkas>> ListDepartemenAsync()
    {
        return await _db.UnitOrganisasi
            .Where(u => u.Tipe == "Departemen" || u.Tipe == "Region" || u.Tipe == "Kelompok")
            .OrderBy(u => u.Nama)
            .Select(u => new UnitRingkas(u.IdUnit, u.Nama, u.Tipe))
            .ToListAsync();
    }

    // Nomor registrasi gugus: {jenis}-{urut departemen}/{urut kompartemen}/{tahun}.
    public async Task<string> GenerateNoRegistrasiAsync(string jenis, string periode, int? idDepartemen, int? idKompartemen)
    {
        var tahun = periode.Length >= 4 ? periode[..4] : DateTime.Now.Year.ToString();

        var deptSeq = idDepartemen is null
            ? 1
            : await _db.Gugus.CountAsync(g => g.IdDepartemen == idDepartemen && g.NoRegistrasi != null) + 1;

        var kompSeq = idKompartemen is null
            ? 1
            : await _db.Gugus.CountAsync(g => g.IdKompartemen == idKompartemen && g.NoRegistrasi != null) + 1;

        return $"{jenis}-{deptSeq:00}/{kompSeq:00}/{tahun}";
    }

    // Nomor registrasi gagasan: SG-{tahun}-{urut global}.
    public async Task<string> GenerateNoGagasanAsync()
    {
        var tahun = DateTime.Now.Year;
        var seq = await _db.Gagasan.CountAsync(g => g.NoRegistrasi != null) + 1;
        return $"SG-{tahun}-{seq:0000}";
    }

    private async Task<Dictionary<int, UnitRow>> LoadUnitsAsync()
    {
        var units = await _db.UnitOrganisasi
            .Select(u => new UnitRow(u.IdUnit, u.Nama, u.Tipe, u.IdUnitInduk))
            .ToListAsync();
        return units.ToDictionary(u => u.IdUnit);
    }

    private record UnitRow(int IdUnit, string Nama, string Tipe, int? IdUnitInduk);
}
