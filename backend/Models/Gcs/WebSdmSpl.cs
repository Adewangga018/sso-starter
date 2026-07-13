namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.web_sdm_spl table (Surat Perintah Lembur).
// Unlike the other GCS entities this one IS written to - employees submit their own SPL here.
// tgl_spl / tgl_spl2 hold the full start/end datetime; jam_mulai / jam_selesai repeat the
// "HH:mm" part as strings, which is how the legacy EASy app reads them.
public class WebSdmSpl
{
    public decimal id { get; set; }
    public string kode_spl { get; set; } = string.Empty;
    public string id_user { get; set; } = string.Empty;
    public DateTime tgl_spl { get; set; }
    public DateTime tgl_spl2 { get; set; }
    public string? jam_mulai { get; set; }
    public string? jam_selesai { get; set; }
    public string? jenis_spl { get; set; }
    public string? keterangan { get; set; }
    public string? status { get; set; }
    public string? source { get; set; }
    public DateTime tgl_input { get; set; }
    public string id_pengguna { get; set; } = string.Empty;
    public string status_pengguna { get; set; } = string.Empty;
    public string? id_approve { get; set; }
    public DateTime? tgl_approve { get; set; }
}
