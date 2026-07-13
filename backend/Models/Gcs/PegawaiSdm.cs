namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.PEGAWAI_SDM table. Read-only: this app never writes here.
// Used only to surface the job title in the shared app chrome (header/dashboard),
// joined the same way as MST_PEGAWAI: Nik = ID_KARYAWAN.
public class PegawaiSdm
{
    public int id { get; set; }
    public string? Nik { get; set; }
    public string? nama { get; set; }
    public string? jabatan { get; set; }
    public string? nm_jabatan { get; set; }
    public string? GOL { get; set; }
    public string? UNIT_KERJA { get; set; }
    public string? struktur { get; set; }
    public string? data_aktif { get; set; }
}
