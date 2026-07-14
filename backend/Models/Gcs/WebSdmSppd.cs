namespace SsoBackend.Models.Gcs;

// Maps to the existing intranet.web_sdm_sppd table (Surat Perintah Perjalanan Dinas) -
// the same table the legacy EASy app writes to.
//
// kode_sppd is only half ours: the app inserts the 3-character prefix ("ISP") and the
// web_sdm_sppd_tri INSERT trigger rewrites it into ISP + yyyyMM + a 6-digit running number
// (e.g. ISP202607000024), so the row must be re-read after SaveChanges.
public class WebSdmSppd
{
    public int id { get; set; }
    public string? kode_sppd { get; set; }
    public DateTime tgl_input { get; set; }

    public string keterangan { get; set; } = string.Empty;
    public string id_user { get; set; } = string.Empty;
    public string? id_approve { get; set; }
    public DateTime? tgl_approve { get; set; }
    public string id_perintah { get; set; } = "-";

    public string tujuan_sppd { get; set; } = string.Empty;
    public DateTime tgl_berangkat { get; set; }
    public DateTime tgl_pulang { get; set; }
    public int lama_hari { get; set; }

    public string kendaraan { get; set; } = string.Empty;
    public string source { get; set; } = string.Empty;
    public string status { get; set; } = string.Empty;

    // "Dalam Negeri" / "Luar Negeri" - shown as "Lokasi" in the form.
    public string jenis { get; set; } = string.Empty;

    public string? id_approve2 { get; set; }
    public DateTime? tgl_approve2 { get; set; }
    public string? masa_atasan { get; set; }
}
