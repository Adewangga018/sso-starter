namespace SsoBackend.Models.Office;

// Distribusi surat: tujuan & tembusan (CC), mentarget pegawai (Nik = ID_KARYAWAN).
public class SuratDistribusi
{
    public long Id { get; set; }
    public long IdSurat { get; set; }
    public string Tipe { get; set; } = "Tujuan";   // Tujuan|CC
    public string Nik { get; set; } = string.Empty;
    public string? Nama { get; set; }
    public string? Jabatan { get; set; }
}
