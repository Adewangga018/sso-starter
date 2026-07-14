namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.web_sdm_umdl table (Uang Makan Dinas Luar) in GCS - the same
// table the legacy EASy app writes to.
//
// A UMDL is never raised on its own: it always hangs off a Surat Izin, and ID_IJIN points at
// web_sdm_surat_ijin.id. Only an izin of jenis "Meninggalkan Pekerjaan" with kepentingan
// "Dinas" qualifies - leaving work for personal reasons earns no meal allowance.
//
// Unlike Surat Izin and SPPD, KODE_UMDL is NOT produced by a trigger (the only trigger here
// is an UPDATE one): the application mints it, following EASy's format
// "UL" + yyMM + 9 random alphanumerics, e.g. UL2607Z9LMECTLB.
public class WebSdmUmdl
{
    public decimal ID { get; set; }
    public DateTime TGL_INPUT { get; set; }
    public string? KETERANGAN { get; set; }
    public string STATUS { get; set; } = string.Empty;

    public string ID_USER { get; set; } = string.Empty;
    public string? ID_APPROVE { get; set; }
    public DateTime? TGL_APPROVE { get; set; }

    public string? KODE_UMDL { get; set; }
    public string? SOURCE { get; set; }
    public DateTime TGL_UMDL { get; set; }
    public string ID_PENGGUNA { get; set; } = string.Empty;

    // web_sdm_surat_ijin.id. Rows imported from the old GCSNET client carry 0 here.
    public decimal ID_IJIN { get; set; }

    public string? masa_atasan { get; set; }

    // ROWID is deliberately absent: it is NOT NULL but carries a newid() default, so the
    // database fills it on INSERT - exactly like web_sdm_spl.
}
