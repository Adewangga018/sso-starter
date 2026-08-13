using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;

namespace SsoBackend.Services;

// Posisi pegawai menurut SISTEM TINGKATAN BERBASIS BAND (bukan jabatan legacy SDM
// yang masih memuat label lama seperti "Lakma" / "Pjs ..."). Tingkatan diturunkan
// murni dari band jabatan aktif: grading.penempatan -> jabatan -> band, sesuai
// dokumen "Data 85 Pegawai Organik GCS" (kolom Band <-> Tingkatan).
public record Posisi(int? Band, string? Tingkatan, string? Jabatan);

public class PosisiResolver
{
    private readonly InovasiDbContext _db;
    private readonly ApplicationDbContext _appDb;

    // Peta band -> tingkatan (identik dengan grading.band.nama). Satu-satunya sumbu
    // kebenaran level; tidak ada "pjs", "lakma", "plt", dll.
    private static readonly IReadOnlyDictionary<int, string> TingkatanPerBand = new Dictionary<int, string>
    {
        [0] = "Direksi",
        [1] = "General Manager",
        [2] = "Manager",
        [3] = "Kepala Bagian",
        [4] = "Staf Pemula",
        [5] = "Pelaksana Senior",
        [6] = "Pelaksana Junior",
    };

    public PosisiResolver(InovasiDbContext db, ApplicationDbContext appDb)
    {
        _db = db;
        _appDb = appDb;
    }

    public static string? TingkatanDariBand(int? band) =>
        band is int b && TingkatanPerBand.TryGetValue(b, out var t) ? t : null;

    // Membersihkan jabatan legacy SDM untuk pegawai yang TIDAK ada di grading (mis. TKNO):
    // buang awalan penjabat sementara ("Pjs"/"Plt") dan buang label tanpa makna ("Lakma").
    public static string? BersihkanJabatanLegacy(string? jabatan)
    {
        var s = jabatan?.Trim();
        if (string.IsNullOrEmpty(s)) return null;

        // "Lakma" / "Laksana Madya" bukan nama jabatan -> tidak ditampilkan.
        if (s.Equals("Lakma", StringComparison.OrdinalIgnoreCase)
            || s.StartsWith("Lakma ", StringComparison.OrdinalIgnoreCase)
            || s.Equals("Laksana Madya", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        // Buang awalan "Pjs", "Pjs.", "Plt", "Plt." (pejabat sementara).
        foreach (var pref in new[] { "Pjs.", "Pjs", "Plt.", "Plt", "Pj." })
        {
            if (s.StartsWith(pref + " ", StringComparison.OrdinalIgnoreCase))
            {
                return s[(pref.Length + 1)..].Trim();
            }
        }
        return s;
    }

    // Posisi grading (band + tingkatan + jabatan struktural bersih) dari penempatan aktif.
    // Kalau karyawan sedang ditandai PTS (Pemangku Tugas Sementara, grading.pejabat_sementara
    // - lihat panel Struktur Organisasi), jabatan/band/tingkatan yg dikembalikan adalah
    // POSISI YANG DIGANTIKAN (diberi awalan "Pjs.") - BUKAN jabatan asli - supaya seluruh
    // tempat yg pakai resolver ini (header, picker pegawai, dst) konsisten menampilkan
    // status PTS-nya, bukan cuma panel Struktur Organisasi (diminta user 2026-08-14).
    public async Task<Posisi> ResolveAsync(string? nik)
    {
        if (string.IsNullOrWhiteSpace(nik)) return new Posisi(null, null, null);

        var row = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where p.IdKaryawan == nik && p.Status == "Aktif"
            select new { j.IdBand, j.NamaJabatan }).FirstOrDefaultAsync();

        if (row is null) return new Posisi(null, null, null);
        int band = row.IdBand;
        string? jabatan = row.NamaJabatan;

        // JOIN dgn GradingJabatan (BUKAN _db.Jabatan) - keduanya harus dari DbContext yg
        // SAMA (ApplicationDbContext); EF Core tak bisa menggabung IQueryable lintas
        // DbContext (InovasiDbContext vs ApplicationDbContext) dlm satu query.
        var pts = await (
            from x in _appDb.GradingPejabatSementara
            join j in _appDb.GradingJabatan on x.IdJabatanPengganti equals j.IdJabatan
            where x.IdKaryawan == nik && x.Status == "Aktif"
            select new { j.IdBand, j.NamaJabatan }).FirstOrDefaultAsync();
        if (pts is not null)
        {
            band = pts.IdBand;
            jabatan = $"Pjs. {pts.NamaJabatan}";
        }

        return new Posisi(band, TingkatanDariBand(band), jabatan);
    }

    // Versi banyak-NIK sekaligus (satu query) - dipakai daftar/picker pegawai supaya
    // tak N+1 query per baris. NIK tanpa penempatan grading aktif (mis. TKNO) tidak
    // muncul di hasil; caller jatuh ke NamaJabatanTerbaik (fallback legacy dibersihkan).
    // PTS aktif menimpa hasil dasar - sama aturan dgn ResolveAsync di atas.
    public async Task<Dictionary<string, Posisi>> ResolveManyAsync(IReadOnlyCollection<string> niks)
    {
        var result = new Dictionary<string, Posisi>();
        if (niks is null || niks.Count == 0) return result;
        var distinct = niks.Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().ToList();
        if (distinct.Count == 0) return result;

        var rows = await (
            from p in _db.Penempatan
            join j in _db.Jabatan on p.IdJabatan equals j.IdJabatan
            where distinct.Contains(p.IdKaryawan) && p.Status == "Aktif"
            select new { p.IdKaryawan, j.IdBand, j.NamaJabatan }).ToListAsync();

        foreach (var r in rows)
        {
            if (!result.ContainsKey(r.IdKaryawan))
                result[r.IdKaryawan] = new Posisi(r.IdBand, TingkatanDariBand(r.IdBand), r.NamaJabatan);
        }

        var ptsRows = await (
            from x in _appDb.GradingPejabatSementara
            join j in _appDb.GradingJabatan on x.IdJabatanPengganti equals j.IdJabatan
            where distinct.Contains(x.IdKaryawan) && x.Status == "Aktif"
            select new { x.IdKaryawan, j.IdBand, j.NamaJabatan }).ToListAsync();
        foreach (var r in ptsRows)
        {
            result[r.IdKaryawan] = new Posisi(r.IdBand, TingkatanDariBand(r.IdBand), $"Pjs. {r.NamaJabatan}");
        }

        return result;
    }

    // Nama jabatan TERBAIK utk ditampilkan: struktural (grading) kalau ada, kalau
    // tidak jatuh ke label legacy SDM yang sudah dibersihkan ("Pjs"/"Plt"/"Lakma" dst
    // dibuang) - SATU titik dipakai semua picker/daftar pegawai di seluruh app supaya
    // konsisten dengan yang tampil di header (DashboardController).
    public static string? NamaJabatanTerbaik(Posisi? posisi, string? legacy) =>
        posisi?.Jabatan ?? BersihkanJabatanLegacy(legacy);
}
