namespace SsoBackend.Models;

// Tugas My Team (myteam.tugas di db_mygcs). Pemberi = atasan, penerima = bawahan; keduanya
// dirujuk lewat ID_KARYAWAN. Tabel dikelola manual (raw SQL), dipetakan ke EF sebagai
// ExcludeFromMigrations - EF hanya membaca/menulis, tidak mengelola skema-nya.
public class Tugas
{
    public int Id { get; set; }
    public string IdPemberi { get; set; } = string.Empty;
    public string? NamaPemberi { get; set; }
    public string IdPenerima { get; set; } = string.Empty;
    public string? NamaPenerima { get; set; }
    public string Judul { get; set; } = string.Empty;
    public string? Deskripsi { get; set; }
    public DateOnly? Tenggat { get; set; }
    public string Status { get; set; } = "Baru";       // Baru|Dikerjakan|Selesai|Batal
    public DateTime DibuatPada { get; set; }
    public DateTime DiperbaruiPada { get; set; }
}
