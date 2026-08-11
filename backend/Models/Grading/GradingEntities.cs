namespace SsoBackend.Models.Grading;

// Refleksi TULIS (CRUD) dari skema grading (db_mygcs, backend/Database/grading/*.sql) -
// dipakai OrgStrukturService (panel Admin SDM "Struktur Organisasi"). Beda dari
// SsoBackend.Models.Inovasi.UnitOrganisasi/Jabatan/Penempatan yang read-only (subset
// kolom, "tidak pernah ditulis" - dipakai OrgResolver untuk resolusi departemen/atasan).
public class GradingUnitOrganisasi
{
    public int IdUnit { get; set; }
    public string Nama { get; set; } = string.Empty;
    public string Tipe { get; set; } = string.Empty;   // Direktorat|Kompartemen|Departemen|Region|Kelompok
    public int? IdUnitInduk { get; set; }
    public string? Wilayah { get; set; }
    public int? IdStrukturSdm { get; set; }
    public string? Keterangan { get; set; }
}

public class GradingJabatan
{
    public int IdJabatan { get; set; }
    public int? Kode { get; set; }
    public string NamaJabatan { get; set; } = string.Empty;
    public byte IdBand { get; set; }
    public byte? Jg { get; set; }               // NULL hanya untuk Direksi
    public int? IdUnit { get; set; }
    public int? IdAtasan { get; set; }          // self-FK; NULL untuk Direktur Utama
    public bool? Inti { get; set; }
    public string? KelompokFungsi { get; set; }
    public short? JumlahFormasi { get; set; }
    public string? Alasan { get; set; }
    public int? IdJabatanSdm { get; set; }
    public bool Aktif { get; set; } = true;
    public DateTime DibuatPada { get; set; }
    public DateTime? DiubahPada { get; set; }
}

public class GradingPenempatan
{
    public int Id { get; set; }
    public int IdJabatan { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;   // = GCS.dbo.MST_PEGAWAI.ID_KARYAWAN (tanpa FK)
    public string Nama { get; set; } = string.Empty;
    public DateTime? Tmt { get; set; }
    public DateTime? TanggalSelesai { get; set; }
    public string Status { get; set; } = "Aktif";
    public string? Catatan { get; set; }
    public DateTime DibuatPada { get; set; }
}

public class GradingBand
{
    public byte IdBand { get; set; }
    public string Kode { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public byte Urutan { get; set; }
}
