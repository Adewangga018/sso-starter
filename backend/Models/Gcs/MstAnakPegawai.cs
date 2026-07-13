namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.MST_ANAK_PEGAWAI table. Read-only: this app never writes here.
public class MstAnakPegawai
{
    public int ID_ANAK { get; set; }
    public int ID_PEGAWAI { get; set; }
    public int URUTAN_ANAK { get; set; }
    public string? NAMA_ANAK { get; set; }
    public string? TEMPAT_LAHIR_ANAK { get; set; }
    public DateTime? TGL_LAHIR_ANAK { get; set; }
    public string? FILE_AKTA { get; set; }
    public DateTime CREATED_AT { get; set; }
}
