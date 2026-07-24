namespace SsoBackend.Models.Office;

// Penanggung jawab surat: Reviewer / Approver / Signer. Berjenjang lewat `Urutan`.
public class SuratPj
{
    public long Id { get; set; }
    public long IdSurat { get; set; }
    public string Peran { get; set; } = string.Empty;   // Reviewer|Approver|Signer
    public int Urutan { get; set; }
    public string Nik { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public string? Jabatan { get; set; }
    public string Status { get; set; } = "Menunggu";    // Menunggu|Disetujui|Ditolak|Revisi
    public string? Komentar { get; set; }
    public DateTime? Tgl { get; set; }
}
