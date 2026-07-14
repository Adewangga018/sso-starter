namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.vw_web_sdm_approval view. Read-only.
// One row per approval level for an employee; "urut" orders them, so the row with the
// lowest urut and a non-null kode_atasan is the direct supervisor that a new SPL is assigned to.
public class SdmApproval
{
    public string KodePegawai { get; set; } = string.Empty;
    public string? KodeAtasan { get; set; }
    public string? NamaAtasan { get; set; }

    // The supervisor's role as printed in the letter's addressee line ("Asisten Manager").
    public string? TitleKepada { get; set; }
    public int? Urut { get; set; }
    public string? Status { get; set; }
}
