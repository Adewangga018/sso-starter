namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.vw_web_sdm_absensi view. Read-only: this app never writes here.
// Joined to MST_PEGAWAI via kode_pegawai = ID_KARYAWAN (id_pegawai in this view is NOT
// the same identity space as MST_PEGAWAI.ID_PEGAWAI - verified against real data before wiring this up).
public class AbsensiLog
{
    public string KodePegawai { get; set; } = string.Empty;
    public string NamaPegawai { get; set; } = string.Empty;
    public DateTime Tanggal { get; set; }
    public string? NamaHari { get; set; }
    public string? CheckIn { get; set; }
    public string? CheckOut { get; set; }
    public string? CatatanMangkir { get; set; }
}
