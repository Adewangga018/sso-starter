namespace SsoBackend.Models.Dto;

// Riwayat versi Struktur Organisasi terikat SK direksi (diminta 2026-08-24) -
// lihat OrgVersiService & grading.org_versi (backend/Database/grading/12-org-versi-ddl.sql).

public record OrgVersiRingkasDto(
    int Id, int VersiMajor, int VersiMinor, string Label, string Jenis,
    string? NomorSk, DateOnly? TanggalSk, string? Ringkasan, string Status,
    bool AdaFileSk, string? NamaFileSk, string? DiterbitkanOleh, string? NamaPenerbit,
    DateTime DiterbitkanPada, bool AdalahVersiBerlaku);

// Bentuk snapshot yang disimpan di kolom snapshot_json (dibaca/ditulis System.Text.Json,
// PropertyNameCaseInsensitive - portable, tidak bergantung T-SQL FOR JSON krn server dev
// tidak mendukungnya/SQL Server 2014). Subset kolom yang relevan utk render ulang tree
// versi lama (read-only) - bukan replikasi 1:1 seluruh kolom live.
public class OrgSnapshotUnit
{
    public int IdUnit { get; set; }
    public string Nama { get; set; } = string.Empty;
    public string Tipe { get; set; } = string.Empty;
    public int? IdUnitInduk { get; set; }
    public string? Wilayah { get; set; }
    public string? Keterangan { get; set; }
}

public class OrgSnapshotJabatan
{
    public int IdJabatan { get; set; }
    public int? Kode { get; set; }
    public string NamaJabatan { get; set; } = string.Empty;
    public byte IdBand { get; set; }
    public byte? Jg { get; set; }
    public int? IdUnit { get; set; }
    public int? IdAtasan { get; set; }
    public bool? Inti { get; set; }
    public string? KelompokFungsi { get; set; }
    public short? JumlahFormasi { get; set; }
    public bool Aktif { get; set; }
}

public class OrgSnapshotPenempatan
{
    public int Id { get; set; }
    public int IdJabatan { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public DateTime? Tmt { get; set; }
}

public class OrgSnapshotPts
{
    public int Id { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public int IdJabatanPengganti { get; set; }
    public DateTime? Tmt { get; set; }
}

public class OrgSnapshot
{
    public List<OrgSnapshotUnit> Unit { get; set; } = new();
    public List<OrgSnapshotJabatan> Jabatan { get; set; } = new();
    public List<OrgSnapshotPenempatan> Penempatan { get; set; } = new();
    public List<OrgSnapshotPts> Pts { get; set; } = new();
}

// DTO band ringkas dipakai render read-only (nama band, bukan cuma id).
public record OrgVersiBandDto(byte IdBand, string Kode, string Nama);

public record OrgVersiSnapshotDto(
    int Id, string Label, string Jenis, DateTime DiterbitkanPada, string? Ringkasan,
    IReadOnlyList<OrgVersiBandDto> Band,
    IReadOnlyList<OrgSnapshotUnit> Unit, IReadOnlyList<OrgSnapshotJabatan> Jabatan,
    IReadOnlyList<OrgSnapshotPenempatan> Penempatan, IReadOnlyList<OrgSnapshotPts> Pts);

public record TerbitkanVersiRequest(string Jenis, string? NomorSk, DateOnly? TanggalSk, string? Ringkasan);
