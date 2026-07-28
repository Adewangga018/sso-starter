using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using AsetEntity = SsoBackend.Models.Aset.Aset;
using MaintEntity = SsoBackend.Models.Aset.AsetMaintenance;

namespace SsoBackend.Services;

// My Asset. Inventaris + jadwal maintenance. Semua karyawan dapat MELIHAT inventaris
// & jadwal; hanya Admin Aset (Departemen Kepatuhan Kabag ke atas s/d GM SKP) yang
// boleh input/ubah/hapus.
public class AsetService
{
    private readonly ApplicationDbContext _db;
    private readonly ModuleAccessService _access;

    public AsetService(ApplicationDbContext db, ModuleAccessService access)
    {
        _db = db;
        _access = access;
    }

    public async Task<AsetListDto> GetListAsync(string nik, string? q)
    {
        var query = _db.Aset.AsNoTracking().Where(a => a.Status != "Dihapus");
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(a => a.Nama.Contains(term) || a.Kode.Contains(term)
                || (a.Kategori != null && a.Kategori.Contains(term))
                || (a.NamaPic != null && a.NamaPic.Contains(term)));
        }
        var rows = await query.OrderBy(a => a.Kode).ToListAsync();

        var next = await NextMaintenanceMapAsync(rows.Select(r => r.Id).ToList());
        var isAdmin = await _access.IsAsetAdminAsync(nik);
        return new AsetListDto(rows.Select(a => Map(a, next.GetValueOrDefault(a.Id))).ToList(), isAdmin);
    }

    public async Task<AsetDetailDto?> GetDetailAsync(string nik, long id)
    {
        var a = await _db.Aset.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return null;
        var maint = await _db.AsetMaintenance.AsNoTracking()
            .Where(m => m.IdAset == id)
            .OrderByDescending(m => m.TglJadwal).ThenByDescending(m => m.Id)
            .ToListAsync();
        var next = maint.Where(m => m.Status == "Terjadwal").OrderBy(m => m.TglJadwal).Select(m => (DateOnly?)m.TglJadwal).FirstOrDefault();
        var isAdmin = await _access.IsAsetAdminAsync(nik);
        return new AsetDetailDto(Map(a, next), maint.Select(MapMaint).ToList(), isAdmin);
    }

    // Jadwal maintenance global (semua aset), untuk halaman "Maintenance".
    public async Task<MaintenanceListDto> GetMaintenanceListAsync(string nik)
    {
        var rows = await (from m in _db.AsetMaintenance.AsNoTracking()
                          join a in _db.Aset.AsNoTracking() on m.IdAset equals a.Id
                          orderby m.Status, m.TglJadwal
                          select new MaintenanceRowDto(
                              m.Id, m.IdAset, a.Kode, a.Nama, m.Jenis, m.TglJadwal, m.TglSelesai,
                              m.Status, m.Pelaksana, m.Biaya, m.Catatan)).ToListAsync();
        var isAdmin = await _access.IsAsetAdminAsync(nik);
        return new MaintenanceListDto(rows, isAdmin);
    }

    // ---- mutasi (Admin Aset) ----
    public async Task<(bool Ok, string? Error, long Id)> CreateAsync(string nik, SimpanAsetRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg, 0);
        if (string.IsNullOrWhiteSpace(req.Kode)) return (false, "Kode aset wajib diisi.", 0);
        if (string.IsNullOrWhiteSpace(req.Nama)) return (false, "Nama aset wajib diisi.", 0);
        var kode = req.Kode.Trim();
        if (await _db.Aset.AnyAsync(a => a.Kode == kode)) return (false, $"Kode aset '{kode}' sudah dipakai.", 0);

        var a = new AsetEntity
        {
            Kode = kode,
            Nama = req.Nama.Trim(),
            Kategori = Clean(req.Kategori),
            Merk = Clean(req.Merk),
            NomorSeri = Clean(req.NomorSeri),
            Lokasi = Clean(req.Lokasi),
            IdPic = Clean(req.IdPic),
            NamaPic = Clean(req.NamaPic),
            Kondisi = ValidKondisi(req.Kondisi),
            Status = ValidStatus(req.Status),
            Nilai = req.Nilai,
            TglPerolehan = req.TglPerolehan,
            Catatan = Clean(req.Catatan),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        };
        _db.Aset.Add(a);
        await _db.SaveChangesAsync();
        return (true, null, a.Id);
    }

    public async Task<(bool Ok, string? Error)> UpdateAsync(string nik, long id, SimpanAsetRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var a = await _db.Aset.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return (false, "Aset tidak ditemukan.");
        if (string.IsNullOrWhiteSpace(req.Kode)) return (false, "Kode aset wajib diisi.");
        var kode = req.Kode.Trim();
        if (await _db.Aset.AnyAsync(x => x.Kode == kode && x.Id != id)) return (false, $"Kode aset '{kode}' sudah dipakai.");

        a.Kode = kode;
        a.Nama = req.Nama.Trim();
        a.Kategori = Clean(req.Kategori);
        a.Merk = Clean(req.Merk);
        a.NomorSeri = Clean(req.NomorSeri);
        a.Lokasi = Clean(req.Lokasi);
        a.IdPic = Clean(req.IdPic);
        a.NamaPic = Clean(req.NamaPic);
        a.Kondisi = ValidKondisi(req.Kondisi);
        a.Status = ValidStatus(req.Status);
        a.Nilai = req.Nilai;
        a.TglPerolehan = req.TglPerolehan;
        a.Catatan = Clean(req.Catatan);
        a.TglDiubah = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var a = await _db.Aset.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return (false, "Aset tidak ditemukan.");
        var maint = await _db.AsetMaintenance.Where(m => m.IdAset == id).ToListAsync();
        _db.AsetMaintenance.RemoveRange(maint);
        _db.Aset.Remove(a);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> AddMaintenanceAsync(string nik, long idAset, SimpanMaintenanceRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        if (!await _db.Aset.AnyAsync(a => a.Id == idAset)) return (false, "Aset tidak ditemukan.");
        _db.AsetMaintenance.Add(new MaintEntity
        {
            IdAset = idAset,
            Jenis = ValidJenis(req.Jenis),
            TglJadwal = req.TglJadwal,
            TglSelesai = req.TglSelesai,
            Status = ValidMaintStatus(req.Status),
            Pelaksana = Clean(req.Pelaksana),
            Biaya = req.Biaya,
            Catatan = Clean(req.Catatan),
            IdPembuat = nik,
            TglDibuat = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> UpdateMaintenanceAsync(string nik, long id, SimpanMaintenanceRequest req)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var m = await _db.AsetMaintenance.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return (false, "Data maintenance tidak ditemukan.");
        m.Jenis = ValidJenis(req.Jenis);
        m.TglJadwal = req.TglJadwal;
        m.TglSelesai = req.TglSelesai;
        m.Status = ValidMaintStatus(req.Status);
        m.Pelaksana = Clean(req.Pelaksana);
        m.Biaya = req.Biaya;
        m.Catatan = Clean(req.Catatan);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteMaintenanceAsync(string nik, long id)
    {
        if (!await _access.IsAsetAdminAsync(nik)) return (false, ForbidMsg);
        var m = await _db.AsetMaintenance.FirstOrDefaultAsync(x => x.Id == id);
        if (m is null) return (false, "Data maintenance tidak ditemukan.");
        _db.AsetMaintenance.Remove(m);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    // ---- helpers ----
    private const string ForbidMsg = "Hanya Admin Aset (Departemen Kepatuhan) yang dapat mengelola aset.";

    private async Task<Dictionary<long, DateOnly?>> NextMaintenanceMapAsync(List<long> ids)
    {
        if (ids.Count == 0) return new();
        var grouped = await _db.AsetMaintenance.AsNoTracking()
            .Where(m => m.Status == "Terjadwal" && ids.Contains(m.IdAset))
            .GroupBy(m => m.IdAset)
            .Select(g => new { Id = g.Key, Tgl = g.Min(x => x.TglJadwal) })
            .ToListAsync();
        return grouped.ToDictionary(x => x.Id, x => (DateOnly?)x.Tgl);
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string ValidKondisi(string? s) => s is "Baik" or "Rusak Ringan" or "Rusak Berat" or "Hilang" ? s : "Baik";
    private static string ValidStatus(string? s) => s is "Aktif" or "Dipinjam" or "Perbaikan" or "Dihapus" ? s : "Aktif";
    private static string ValidJenis(string? s) => s is "Rutin" or "Perbaikan" or "Inspeksi" ? s : "Rutin";
    private static string ValidMaintStatus(string? s) => s is "Terjadwal" or "Selesai" or "Batal" ? s : "Terjadwal";

    private static AsetDto Map(AsetEntity a, DateOnly? next) => new(
        a.Id, a.Kode, a.Nama, a.Kategori, a.Merk, a.NomorSeri, a.Lokasi, a.IdPic, a.NamaPic,
        a.Kondisi, a.Status, a.Nilai, a.TglPerolehan, a.Catatan, next, a.TglDibuat, a.TglDiubah);

    private static AsetMaintenanceDto MapMaint(MaintEntity m) => new(
        m.Id, m.IdAset, m.Jenis, m.TglJadwal, m.TglSelesai, m.Status, m.Pelaksana, m.Biaya, m.Catatan, m.TglDibuat);
}
