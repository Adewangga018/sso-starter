namespace SsoBackend.Models.Office;

// Penanda "surat sudah dibuka" per pegawai — dasar tab Belum Dibaca / Dibaca di kotak masuk.
// Tidak adanya baris berarti belum dibaca.
public class SuratDibaca
{
    public long IdSurat { get; set; }
    public string Nik { get; set; } = string.Empty;
    public DateTime DibacaPada { get; set; }
}
