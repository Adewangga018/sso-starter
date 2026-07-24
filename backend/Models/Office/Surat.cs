namespace SsoBackend.Models.Office;

// Naskah dinas (My Office). Tabel office.surat dikelola manual (raw SQL), EF hanya baca/tulis
// via ExcludeFromMigrations — pola sama dengan grading & myteam.
public class Surat
{
    public long Id { get; set; }
    public string? Nomor { get; set; }
    public string Jenis { get; set; } = "Surat";            // Surat|SP|ASP|Memo
    public string? Klasifikasi { get; set; }
    public string Sifat { get; set; } = "Biasa";            // Rahasia|Terbatas|Biasa
    public string Kecepatan { get; set; } = "Biasa";        // Biasa|Segera|Sangat Segera
    public string Judul { get; set; } = string.Empty;
    public string? Keterangan { get; set; }
    public string? Isi { get; set; }
    public string Status { get; set; } = "Draft";
    public string PembuatNik { get; set; } = string.Empty;
    public string? PembuatNama { get; set; }
    public DateOnly? TanggalSurat { get; set; }
    public DateOnly? BerlakuMulai { get; set; }
    public DateOnly? BerlakuSampai { get; set; }
    public DateTime DibuatPada { get; set; }
    public DateTime DiperbaruiPada { get; set; }

    public List<SuratPj> PenanggungJawab { get; set; } = [];
    public List<SuratDistribusi> Distribusi { get; set; } = [];
    public List<SuratLampiran> Lampiran { get; set; } = [];
    public List<SuratRiwayat> Riwayat { get; set; } = [];
}
