namespace SsoBackend.Models.Gcs;

// Maps to the existing intranet.web_sdm_pesan_tiket table (Pemesanan Tiket) in GCS.
//
// Like SPPD, kode_tiket is only half ours: the app inserts the 3-character prefix ("ITK")
// and the web_sdm_pesan_tiket_tri INSERT trigger rewrites it into ITK + yyyyMM + a 6-digit
// running number (e.g. ITK202607000007), so the row must be re-read after SaveChanges.
public class WebSdmPesanTiket
{
    public int id { get; set; }
    public string? kode_tiket { get; set; }
    public DateTime tgl_input { get; set; }

    public string keterangan { get; set; } = string.Empty;
    public string id_user { get; set; } = string.Empty;
    public string? id_approve { get; set; }
    public DateTime? tgl_approve { get; set; }

    // "LAIN" for a standalone booking, "SPPD" when it was raised off a travel order.
    public string source { get; set; } = string.Empty;
    public string status { get; set; } = string.Empty;

    // The SPPD this booking belongs to, or 0 when standalone.
    public int? id_link { get; set; }
}
