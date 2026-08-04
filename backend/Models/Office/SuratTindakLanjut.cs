namespace SsoBackend.Models.Office;

// Tindak lanjut / disposisi surat — penerima meneruskan surat ke pegawai lain
// dengan catatan dan (opsional) lampiran. Menopang tab "Tindak Lanjut" di detail surat.
public class SuratTindakLanjut
{
    public long Id { get; set; }
    public long IdSurat { get; set; }
    public string Keterangan { get; set; } = "Diteruskan";   // Diteruskan|Disposisi|Tanggapan|Selesai
    public string DariNik { get; set; } = string.Empty;
    public string? DariNama { get; set; }
    public string? UntukNik { get; set; }
    public string? UntukNama { get; set; }
    public string? Catatan { get; set; }
    public string? NamaLampiran { get; set; }
    public string? PathLampiran { get; set; }
    public long? Ukuran { get; set; }
    public string? Tipe { get; set; }
    public DateTime Tgl { get; set; }
}
