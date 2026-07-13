namespace SsoBackend.Models.Dto;

public record AlamatDto(
    string? Alamat,
    string? Rt,
    string? Rw,
    string? Provinsi,
    string? Kabupaten,
    string? Kecamatan,
    string? Desa,
    string? KodePos);

public record AnakDto(
    int Id,
    int Urutan,
    string? Nama,
    string? TempatLahir,
    DateOnly? TglLahir,
    bool HasAkta);

public record PasanganDto(
    string? Nama,
    string? TempatLahir,
    DateOnly? TglLahir);

public record BerkasDto(string Key, string Label, bool Available);

public record PersonalProfileDto(
    int IdPegawai,
    string NamaLengkap,
    string IdKaryawan,
    string Nik,
    string? TempatLahir,
    DateOnly? TglLahir,
    string? JenisKelamin,
    string? StatusKaryawan,
    bool IsActive,
    string? Agama,
    string? Pendidikan,
    string? NoHp,
    string? Email,
    AlamatDto Alamat,
    string? RiwayatKesehatan,
    string? StatusNikah,
    bool IsMarried,
    PasanganDto? Pasangan,
    int? JumlahAnak,
    string? NamaDarurat,
    string? HpDarurat,
    DateOnly? TerdaftarSejak,
    IReadOnlyList<AnakDto> Anak,
    IReadOnlyList<BerkasDto> Berkas);
