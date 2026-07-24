namespace SsoBackend.Models.Gcs;

// Hak cuti per periode (intranet.web_sdm_cuti_hak) — sumber kebenaran akrual cuti SDM/EASy.
// id_user = easy.users.id. Read-only.
public class WebSdmCutiHak
{
    public int Id { get; set; }
    public int IdUser { get; set; }
    public DateTime TglTerbit { get; set; }     // kapan cuti "timbul"
    public int HakTahun { get; set; }
    public int HakCuti { get; set; }            // akrual periode (mis. 12)
    public int UtangCuti { get; set; }          // hutang cuti (diambil di muka)
    public int AmbilCuti { get; set; }          // cuti tahunan diambil
    public string? Status { get; set; }
    public int BersamaCuti { get; set; }        // potongan cuti bersama
    public DateTime? TglBerakhir { get; set; }  // kedaluwarsa (batas carry-over)
}
