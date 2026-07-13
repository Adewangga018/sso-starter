namespace SsoBackend.Models.Gcs;

// Maps to the existing dbo.MST_PEGAWAI table. Read-only: this app never writes here.
public class MstPegawai
{
    public int ID_PEGAWAI { get; set; }
    public string NAMA_LENGKAP { get; set; } = string.Empty;
    public string NIK { get; set; } = string.Empty;
    public string ID_KARYAWAN { get; set; } = string.Empty;
    public string? TEMPAT_LAHIR { get; set; }
    public DateTime? TGL_LAHIR { get; set; }
    public string? JENIS_KELAMIN { get; set; }
    public string? STATUS_KARYAWAN { get; set; }
    public string? FILE_KTP { get; set; }
    public string? NO_HP { get; set; }
    public string? EMAIL { get; set; }
    public string? ALAMAT { get; set; }
    public string? RT { get; set; }
    public string? RW { get; set; }
    public string? PROVINSI { get; set; }
    public string? KABUPATEN { get; set; }
    public string? KECAMATAN { get; set; }
    public string? DESA { get; set; }
    public string? KODE_POS { get; set; }
    public string? AGAMA { get; set; }
    public string? PENDIDIKAN { get; set; }
    public string? FILE_IJAZAH { get; set; }
    public string? RIWAYAT_KESEHATAN { get; set; }
    public string? STATUS_NIKAH { get; set; }
    public string? NAMA_PASANGAN { get; set; }
    public string? TEMPAT_LAHIR_PASANGAN { get; set; }
    public DateTime? TGL_LAHIR_PASANGAN { get; set; }
    public string? FILE_BUKU_NIKAH { get; set; }
    public int? JUMLAH_ANAK { get; set; }
    public string? NAMA_DARURAT { get; set; }
    public string? HP_DARURAT { get; set; }
    public string? FILE_KK { get; set; }
    public DateTime CREATED_AT { get; set; }
    public string? FILE_SIM { get; set; }
    public string? FILE_GADA_PRATAMA { get; set; }
    public string? FILE_K3 { get; set; }
    public string? FILE_LAIN { get; set; }
}
