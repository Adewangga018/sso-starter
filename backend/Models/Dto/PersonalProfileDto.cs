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

public record AbsensiDto(
    string NamaPegawai,
    DateOnly Tanggal,
    string? NamaHari,
    string? CheckIn,
    string? CheckOut,
    string? CatatanMangkir,
    // "SDM" = baris resmi dari vw_web_sdm_absensi; "Kamera" = hasil absensi kamera (db_mygcs).
    string Sumber);

// Payload absensi kamera dari SPA: foto (data URL base64), koordinat, tempat, dan tipe in/out.
public record AbsensiCheckInDto(
    string Foto,
    decimal Lat,
    decimal Lng,
    string? Tempat,
    string Type);

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
