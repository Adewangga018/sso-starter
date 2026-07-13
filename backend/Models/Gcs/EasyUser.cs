namespace SsoBackend.Models.Gcs;

// Maps to the existing easy.users table (legacy Laravel auth). Read-only: this app never writes here.
public class EasyUser
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    // Despite the name, this holds the employee badge number (e.g. "P.224457"),
    // which joins to MST_PEGAWAI.ID_KARYAWAN / PEGAWAI_SDM.Nik - not the KTP NIK.
    public string? Nik { get; set; }
    public string? Status { get; set; }
}
