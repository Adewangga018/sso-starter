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

    public PosisiResolver(InovasiDbContext db) => _db = db;

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
        return new Posisi(band, TingkatanDariBand(band), row.NamaJabatan);
    }
}
