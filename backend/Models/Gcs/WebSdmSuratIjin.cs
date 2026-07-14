namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.web_sdm_surat_ijin table (Surat Izin) in the GCS database -
// the same table the legacy EASy app writes to.
//
// kode_ijin is NOT set by this app: the web_sdm_surat_ijin_tri INSERT trigger fills it via
// dbo.GET_NEXT_NUMBER right after the row lands, so we re-read the row after SaveChanges.
public class WebSdmSuratIjin
{
    public decimal id { get; set; }
    public string? kode_ijin { get; set; }
    public DateTime tgl_input { get; set; }

    // tgl_ijin carries the start date *and* time; tgl_ijin_sd the end date and time.
    public DateTime tgl_ijin { get; set; }
    public DateTime? tgl_ijin_sd { get; set; }

    public string jenis_ijin { get; set; } = string.Empty;
    public string kepentingan_ijin { get; set; } = string.Empty;
    public string? keterangan { get; set; }

    public string id_pegawai { get; set; } = string.Empty;
    public string? id_pengesah { get; set; }
    public DateTime? tgl_pengesahan { get; set; }

    public string status { get; set; } = string.Empty;
    public string id_user { get; set; } = string.Empty;
    public string source { get; set; } = string.Empty;
    public string masa_atasan { get; set; } = string.Empty;
}
