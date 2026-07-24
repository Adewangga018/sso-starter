namespace SsoBackend.Models.Gcs;

// Pengajuan/riwayat cuti (intranet.vw_web_sdm_cuti). id_user = NIK (ID_KARYAWAN),
// list_jenis membedakan jenis (mis. "Tahunan"). Read-only view.
public class WebSdmCutiView
{
    public string? KodeCuti { get; set; }
    public DateTime? TglInput { get; set; }
    public string? Keterangan { get; set; }
    public string? Status { get; set; }
    public string? IdUser { get; set; }      // = NIK
    public string? ListJenis { get; set; }
    public DateTime? TglApprove { get; set; }
}
