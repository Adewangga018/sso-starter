using System.Data;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Approval;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Layer persetujuan MyGCS terpadu. Fitur lain (Izin/Lembur/dst) memanggil CreateAsync saat
// pengajuan dikirim. Dirutekan ke MANAGER terkait (hak approve/reject) + ATASAN langsung
// (tinjauan/lihat detail, tanpa hak acc). Tidak menyentuh tabel/status SDM.
public class ApprovalService
{
    private readonly ApplicationDbContext _db;
    private readonly GcsDbContext _gcs;

    public ApprovalService(ApplicationDbContext db, GcsDbContext gcs)
    {
        _db = db;
        _gcs = gcs;
    }

    public async Task CreateAsync(string jenis, string refId, string nik, string? nama, string? ringkasan)
    {
        if (await _db.ApprovalPengajuan.AnyAsync(a => a.Jenis == jenis && a.RefId == refId))
        {
            return;
        }
        var (manager, atasan) = await ResolveApproverAsync(nik);
        _db.ApprovalPengajuan.Add(new ApprovalPengajuan
        {
            Jenis = jenis,
            RefId = refId,
            IdKaryawan = nik,
            Nama = nama,
            IdManager = manager,
            IdAtasan = atasan,
            Ringkasan = ringkasan,
            Status = "Menunggu",
            TglPengajuan = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    // Kotak: pengajuan di mana saya manager (bisa acc) ATAU atasan langsung (tinjau saja).
    public async Task<PersetujuanInboxDto> InboxAsync(string nik)
    {
        var rows = await _db.ApprovalPengajuan.AsNoTracking()
            .Where(a => a.IdManager == nik || a.IdAtasan == nik)
            .OrderByDescending(a => a.Id)
            .Take(150)
            .ToListAsync();
        var menunggu = rows.Where(a => a.Status == "Menunggu").Select(a => Map(a, nik)).ToList();
        var riwayat = rows.Where(a => a.Status != "Menunggu").Take(40).Select(a => Map(a, nik)).ToList();
        return new PersetujuanInboxDto(menunggu, riwayat);
    }

    // Detail pengajuan (untuk tinjauan). Field izin* terisi bila jenis = Izin.
    public async Task<ApprovalDetailDto?> DetailAsync(long id, string nik)
    {
        var a = await _db.ApprovalPengajuan.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return null;
        var isManager = a.IdManager == nik;
        var isAtasan = a.IdAtasan == nik;
        if (!isManager && !isAtasan) return null;   // hanya manager/atasan terkait

        string? ijJenis = null, ijKep = null, ijKet = null, ijKode = null, ijStatus = null;
        DateOnly? ijMulai = null, ijSelesai = null;
        if (a.Jenis == "Izin" && decimal.TryParse(a.RefId, out var rid))
        {
            var iz = await _gcs.WebSdmSuratIjin.AsNoTracking().FirstOrDefaultAsync(s => s.id == rid);
            if (iz is not null)
            {
                ijJenis = iz.jenis_ijin;
                ijKep = iz.kepentingan_ijin;
                ijKet = iz.keterangan;
                ijKode = iz.kode_ijin;
                ijStatus = iz.status;
                ijMulai = DateOnly.FromDateTime(iz.tgl_ijin);
                ijSelesai = iz.tgl_ijin_sd.HasValue ? DateOnly.FromDateTime(iz.tgl_ijin_sd.Value) : null;
            }
        }

        return new ApprovalDetailDto(
            a.Id, a.Jenis, a.IdKaryawan, a.Nama, a.Ringkasan, a.Status, a.Komentar,
            PeranSaya(isManager, isAtasan), isManager,
            ijJenis, ijKep, ijMulai, ijSelesai, ijKet, ijKode, ijStatus);
    }

    // Hanya MANAGER yang boleh approve/reject.
    public async Task<(bool Ok, string? Error)> PutusanAsync(long id, string nikManager, bool setuju, string? komentar)
    {
        var a = await _db.ApprovalPengajuan.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return (false, "Pengajuan tidak ditemukan.");
        if (a.IdManager != nikManager) return (false, "Hanya manager terkait yang berhak menyetujui/menolak.");
        if (a.Status != "Menunggu") return (false, "Pengajuan sudah diproses.");
        a.Status = setuju ? "Disetujui" : "Ditolak";
        a.Komentar = string.IsNullOrWhiteSpace(komentar) ? null : komentar.Trim();
        a.TglKeputusan = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static string PeranSaya(bool isManager, bool isAtasan) =>
        isManager && isAtasan ? "Manager & Atasan" : isManager ? "Manager" : "Atasan";

    private static PersetujuanDto Map(ApprovalPengajuan a, string nik)
    {
        var isManager = a.IdManager == nik;
        var isAtasan = a.IdAtasan == nik;
        return new PersetujuanDto(
            a.Id, a.Jenis, a.RefId, a.IdKaryawan, a.Nama, a.Ringkasan, a.Status, a.Komentar,
            PeranSaya(isManager, isAtasan), isManager, a.TglPengajuan, a.TglKeputusan);
    }

    // (manager, atasanLangsung). Manager = ancestor terdekat band urutan <= 2 yang terisi;
    // atasan langsung = ancestor (atasan) terdekat mana pun yang terisi.
    private async Task<(string? Manager, string? Atasan)> ResolveApproverAsync(string nik)
    {
        var conn = _db.Database.GetDbConnection();
        var mustClose = conn.State != ConnectionState.Open;
        if (mustClose) await conn.OpenAsync();
        try
        {
            var atasan = await ScalarAsync(conn, @"
                SELECT TOP 1 pa.id_karyawan
                FROM grading.penempatan p
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
                JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                ORDER BY h.kedalaman ASC", nik);

            var manager = await ScalarAsync(conn, @"
                SELECT TOP 1 pa.id_karyawan
                FROM grading.penempatan p
                JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan AND h.kedalaman > 0
                JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
                JOIN grading.band   ba ON ba.id_band   = ja.id_band AND ba.urutan <= 2
                JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
                WHERE p.id_karyawan = @nik AND p.status = 'Aktif'
                ORDER BY h.kedalaman ASC", nik);

            // Bila tak ada manager di atasnya (pemohon sudah manager/GM), jatuhkan ke atasan terdekat.
            return (manager ?? atasan, atasan);
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
