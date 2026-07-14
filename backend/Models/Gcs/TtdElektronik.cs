namespace SsoBackend.Models.Gcs;

// Maps to the existing intranet.web_ttd_elektronik table in GCS - the document registry
// behind service.gcs-gresik.com. Printing a document registers it here; the QR code on the
// printout points at https://service.gcs-gresik.com/validasi/{kode_link}.
//
// kode_link is deliberately absent from the INSERT path: the column carries a newid()
// default, so the database mints the GUID and we read it back.
public class TtdElektronik
{
    public int id { get; set; }
    public string unit_dokumen { get; set; } = string.Empty;
    public string kode_dokumen { get; set; } = string.Empty;
    public string tipe_dokumen { get; set; } = string.Empty;
    public string? uraian_dokumen { get; set; }
    public string? uraian2_dokumen { get; set; }
    public DateTime tgl_register { get; set; }
    public DateTime? tgl_approve { get; set; }

    // The legacy EASy app stores easy.users.Id here (our "gcs_uid" claim), not the badge number.
    public int id_register { get; set; }
    public int? id_approve { get; set; }
    public string status { get; set; } = string.Empty;
    public Guid kode_link { get; set; }
}
