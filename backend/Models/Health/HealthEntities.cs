namespace SsoBackend.Models.Health;

// Kampanye/batch MCU (mis. "MCU Tahunan 2026"). Schema health, db_mygcs.
public class HealthPeriode
{
    public long Id { get; set; }
    public string Judul { get; set; } = string.Empty;
    public int Tahun { get; set; }
    public string? Penyelenggara { get; set; }
    public string? Lokasi { get; set; }
    public DateOnly? TglMulai { get; set; }
    public DateOnly? TglSelesai { get; set; }
    public string? Catatan { get; set; }
    public string Status { get; set; } = "Direncanakan";
    public string IdPembuat { get; set; } = string.Empty;
    public DateTime TglDibuat { get; set; }
    public DateTime? TglDiubah { get; set; }
}

// Hasil MCU satu karyawan dalam satu periode (maks 1 per periode+nik). Data sensitif.
public class HealthHasil
{
    public long Id { get; set; }
    public long IdPeriode { get; set; }
    public string Nik { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public DateOnly? TglPemeriksaan { get; set; }
    public decimal? Tinggi { get; set; }
    public decimal? Berat { get; set; }
    public string? TekananDarah { get; set; }
    public string StatusUmum { get; set; } = "Sehat";
    public string? Ringkasan { get; set; }
    public string? Rekomendasi { get; set; }
    public string StatusTindakLanjut { get; set; } = "Tidak Perlu";
    public string? NamaFile { get; set; }
    public string? TipeFile { get; set; }
    public byte[]? Konten { get; set; }
    public string IdPencatat { get; set; } = string.Empty;
    public string? NamaPencatat { get; set; }
    public DateTime TglDicatat { get; set; }
    public DateTime? TglDiubah { get; set; }
}
