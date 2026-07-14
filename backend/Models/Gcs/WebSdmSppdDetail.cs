namespace SsoBackend.Models.Gcs;

// Maps to the existing intranet.web_sdm_sppd_detail table: one row per person travelling.
// "id" is the parent web_sdm_sppd.id (no FK is declared in the legacy schema); id_det is
// the identity primary key.
//
// The struktur/golongan/jabatan columns are snapshots copied from dbo.PEGAWAI_SDM at the
// moment the person is added, so the printed letter keeps showing what was true then even
// if the employee is later promoted or moved.
//
// A trigger (web_sdm_sppd_detail_triu) demotes any previous "Ketua" to "Anggota" when a new
// Ketua is added, so at most one leader exists per SPPD.
public class WebSdmSppdDetail
{
    public int id_det { get; set; }
    public int id { get; set; }

    // The employee badge (MST_PEGAWAI.ID_KARYAWAN / PEGAWAI_SDM.Nik), not a user account id.
    public string id_user { get; set; } = string.Empty;

    public string? struktur { get; set; }
    public string? golongan { get; set; }
    public string? jabatan { get; set; }
    public string tugas { get; set; } = string.Empty;

    // "Ketua" or "Anggota".
    public string posisi { get; set; } = string.Empty;

    public int id_golongan { get; set; }
    public int id_jabatan { get; set; }
    public int id_struktur { get; set; }
}
