namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.PEGAWAI_SDM view. Read-only.
// Supplies the two fields the printed Surat Izin needs but MST_PEGAWAI does not carry:
// REGU (printed as "Kelompok", e.g. "Staf Teknologi Informasi dan Multimedia") and
// BAGIAN (used in the letter's addressee line, e.g. "Departemen Pengembangan").
// Note there is also an unrelated easy.PEGAWAI_SDM - this must stay pinned to dbo.
public class PegawaiSdm
{
    public string Nik { get; set; } = string.Empty;
    public string? REGU { get; set; }
    public string? BAGIAN { get; set; }
}
