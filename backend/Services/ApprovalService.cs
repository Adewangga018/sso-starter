using System.Data;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Approval;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Layer persetujuan MyGCS terpadu. Fitur lain (Izin/Lembur/dst) memanggil CreateAsync saat
// pengajuan dikirim; manager terkait meng-acc lewat ListForManagerAsync/PutusanAsync.
// Tidak menyentuh tabel/status SDM.
public class ApprovalService
{
    private readonly ApplicationDbContext _db;

    public ApprovalService(ApplicationDbContext db)
    {
        _db = db;
    }

    // Dipanggil oleh fitur saat pengajuan dibuat. Idempoten (jenis+ref_id unik).
    public async Task CreateAsync(string jenis, string refId, string nik, string? nama, string? ringkasan)
    {
        if (await _db.ApprovalPengajuan.AnyAsync(a => a.Jenis == jenis && a.RefId == refId))
        {
            return;
        }
        var manager = await ResolveManagerAsync(nik);
        _db.ApprovalPengajuan.Add(new ApprovalPengajuan
        {
            Jenis = jenis,
            RefId = refId,
            IdKaryawan = nik,
            Nama = nama,
            IdManager = manager,
            Ringkasan = ringkasan,
            Status = "Menunggu",
            TglPengajuan = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    public async Task<PersetujuanInboxDto> InboxAsync(string nikManager)
    {
        var rows = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.IdManager == nikManager)
            .OrderByDescending(a => a.Id)
            .Take(100)
            .ToListAsync();
        var menunggu = rows.Where(a => a.Status == "Menunggu").Select(Map).ToList();
        var riwayat = rows.Where(a => a.Status != "Menunggu").Take(40).Select(Map).ToList();
        return new PersetujuanInboxDto(menunggu, riwayat);
    }

    public async Task<(bool Ok, string? Error)> PutusanAsync(long id, string nikManager, bool setuju, string? komentar)
    {
        var a = await _db.ApprovalPengajuan.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return (false, "Pengajuan tidak ditemukan.");
        if (a.IdManager != nikManager) return (false, "Anda bukan penyetuju pengajuan ini.");
        if (a.Status != "Menunggu") return (false, "Pengajuan sudah diproses.");
        a.Status = setuju ? "Disetujui" : "Ditolak";
        a.Komentar = string.IsNullOrWhiteSpace(komentar) ? null : komentar.Trim();
        a.TglKeputusan = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static PersetujuanDto Map(ApprovalPengajuan a) => new(
        a.Id, a.Jenis, a.RefId, a.IdKaryawan, a.Nama, a.Ringkasan, a.Status, a.Komentar, a.TglPengajuan, a.TglKeputusan);

    // Manager terkait: ancestor terdekat band Manager-ke-atas (urutan <= 2) yang terisi;
    // fallback ke atasan terdekat mana pun. Sama dengan CutiService.
    private async Task<string?> ResolveManagerAsync(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            var manager = await ScalarAsync(conn, @"
                SELECT TOP 1 pa.id_karyawan
                FROM grading.penempatan p
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
                JOIN grading.band   ba ON ba.id_band   = ja.id_band AND ba.urutan <= 2
                JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                ORDER BY h.kedalaman ASC", nik);
            if (!string.IsNullOrWhiteSpace(manager)) return manager;
            return await ScalarAsync(conn, @"
                SELECT TOP 1 pa.id_karyawan
                FROM grading.penempatan p
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
                JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                ORDER BY h.kedalaman ASC", nik);
        }
        finally
        {
            if (mustClose) await conn.CloseAsync();
        }
    }

    private static async Task<string?> ScalarAsync(System.Data.Common.DbConnection conn, string sql, string nik)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        var pr = cmd.CreateParameter();
        pr.ParameterName = "@nik";
        pr.Value = nik;
        cmd.Parameters.Add(pr);
        return (await cmd.ExecuteScalarAsync()) as string;
    }
}
