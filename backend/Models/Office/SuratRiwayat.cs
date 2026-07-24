namespace SsoBackend.Models.Office;

// Riwayat aksi surat (audit alur: Dibuat, Dikirim ke Review, Disetujui, Revisi, dst).
public class SuratRiwayat
{
    public long Id { get; set; }
    public long IdSurat { get; set; }
    public string Aksi { get; set; } = string.Empty;
    public string? OlehNik { get; set; }
    public string? OlehNama { get; set; }
    public string? Catatan { get; set; }
    public DateTime Tgl { get; set; }
}
