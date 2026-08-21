namespace SsoBackend.Models.Dto;

// PG (Person Grade) per karyawan per tahun - lihat catatan lengkap di
// GradingPersonGrade.cs. Beda dari JG yang melekat ke jabatan (JabatanDto.Jg,
// diatur lewat Ubah Jabatan) - PG diatur di sini, per orang.
public record PersonGradeDto(
    int Id, string IdKaryawan, string Nama, byte Pg, string? GolonganLama,
    short TahunBerlaku, string? Catatan, DateTime DibuatPada);

public record SimpanPersonGradeRequest(
    string IdKaryawan, byte Pg, string? GolonganLama, short TahunBerlaku, string? Catatan);

// Status siklus naik PG otomatis satu karyawan - lihat GradingPgAkselerasi.
public record PgAkselerasiStatusDto(bool Aktif, string? Catatan, DateTime? DibuatPada);
public record SetPgAkselerasiRequest(string? Catatan);
