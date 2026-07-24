namespace SsoBackend.Models.Approval;

// Catatan persetujuan MyGCS terpadu (approval.pengajuan, db_mygcs). Dibuat saat pengajuan
// (Izin/Lembur/SPPD/UMDL/Tiket) dikirim; dirutekan ke manager terkait. Tidak menyentuh SDM.
public class ApprovalPengajuan
{
    public long Id { get; set; }
    public string Jenis { get; set; } = string.Empty;      // Izin|Lembur|SPPD|UMDL|Tiket
    public string RefId { get; set; } = string.Empty;      // id record SDM
    public string IdKaryawan { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public string? IdManager { get; set; }
    public string? Ringkasan { get; set; }
    public string Status { get; set; } = "Menunggu";       // Menunggu|Disetujui|Ditolak|Batal
    public string? Komentar { get; set; }
    public DateTime TglPengajuan { get; set; }
    public DateTime? TglKeputusan { get; set; }
}
