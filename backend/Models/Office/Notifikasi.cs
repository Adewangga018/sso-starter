namespace SsoBackend.Models.Office;

// Pemberitahuan persuratan untuk satu pegawai (menu Notifikasi). Statusnya baca
// sendiri, terpisah dari status baca surat di SuratDibaca: seseorang bisa sudah
// membuka suratnya lewat Inbox tanpa pernah menyentuh notifikasinya.
public class Notifikasi
{
    public long Id { get; set; }
    public string Nik { get; set; } = string.Empty;
    public string Judul { get; set; } = string.Empty;
    public long? IdSurat { get; set; }
    public string? OlehNik { get; set; }
    public string? OlehNama { get; set; }
    public string? OlehJabatan { get; set; }
    public DateTime? DibacaPada { get; set; }
    public DateTime DibuatPada { get; set; }
}
