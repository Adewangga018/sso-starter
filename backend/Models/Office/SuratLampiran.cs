namespace SsoBackend.Models.Office;

// Lampiran surat. Berkas fisik disimpan di folder unggah; path relatif dicatat di sini.
public class SuratLampiran
{
    public long Id { get; set; }
    public long IdSurat { get; set; }
    public string NamaFile { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public long? Ukuran { get; set; }
    public string? Tipe { get; set; }
    public DateTime DibuatPada { get; set; }
}
