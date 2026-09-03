namespace SsoBackend.Models.Tiket;

// Progres tindak lanjut staf Sekretariat atas pemesanan tiket yang SUDAH disetujui
// atasan (approval.pengajuan, Jenis="Tiket") - schema tiket, db_mygcs. Layer paralel,
// TIDAK menyentuh tabel legacy GCS (intranet.web_sdm_pesan_tiket, shared-write dgn
// EASy) - sama pola dengan DinasBukti (dipasangkan lewat RefId = web_sdm_pesan_tiket.id).
public class TiketProgres
{
    public int Id { get; set; }
    public string RefId { get; set; } = string.Empty;       // id baris legacy (web_sdm_pesan_tiket.id)
    public string Status { get; set; } = "Belum Diproses";  // Belum Diproses|Sedang Diproses|Selesai
    public string? Catatan { get; set; }
    public string? DiprosesOleh { get; set; }                // NIK staf Sekretariat
    public DateTime? DiprosesPada { get; set; }
}
