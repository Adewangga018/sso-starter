namespace SsoBackend.Models.Dto;

// Panel Admin SDM "Struktur Organisasi" (grading.unit_organisasi/jabatan/penempatan) -
// lihat backend/Database/grading/01-schema-ddl.sql. Tree unit organisasi DIBANGUN DI
// FRONTEND dari daftar flat (id_unit_induk) - dataset kecil (~40 unit), tak perlu
// endpoint tree terpisah.

// ---- Unit Organisasi ----
public record UnitDto(
    int IdUnit, string Nama, string Tipe, int? IdUnitInduk, string? NamaIndukUnit,
    string? Wilayah, string? Keterangan, int JumlahJabatan, int JumlahAnakUnit);

public record SimpanUnitRequest(string Nama, string Tipe, int? IdUnitInduk, string? Wilayah, string? Keterangan);

// ---- Jabatan ----
public record IncumbentDto(int IdPenempatan, string IdKaryawan, string Nama, DateTime? Tmt);

public record JabatanDto(
    int IdJabatan, int? Kode, string NamaJabatan, byte IdBand, string? NamaBand, byte? Jg,
    int? IdUnit, string? NamaUnit, int? IdAtasan, string? NamaAtasan, bool? Inti,
    string? KelompokFungsi, short? JumlahFormasi, bool Aktif,
    IReadOnlyList<IncumbentDto> Incumbent);

public record SimpanJabatanRequest(
    int? Kode, string NamaJabatan, byte IdBand, byte? Jg, int? IdUnit, int? IdAtasan,
    bool? Inti, string? KelompokFungsi, short? JumlahFormasi, string? Alasan, bool Aktif);

public record BandOpsiDto(byte IdBand, string Kode, string Nama);

// ---- Penempatan (siapa mengisi jabatan mana) ----
public record PenempatanDto(
    int Id, int IdJabatan, string NamaJabatan, string IdKaryawan, string Nama,
    DateTime? Tmt, DateTime? TanggalSelesai, string Status, string? Catatan);

public record TempatkanKaryawanRequest(int IdJabatan, string IdKaryawan, DateTime? Tmt, string? Catatan);

public record AkhiriPenempatanRequest(DateTime? TanggalSelesai, string? Catatan);
