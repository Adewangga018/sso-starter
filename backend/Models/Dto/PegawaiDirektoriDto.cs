namespace SsoBackend.Models.Dto;

// Direktori karyawan untuk Admin SDM (modul HR Management > Data Karyawan) - "lihat
// seluruh data karyawan termasuk file upload" (diminta 2026-08-20). SENGAJA tidak
// dibatasi jenis_pegawai='Tetap' spt picker lain (lihat [[pencarian-pegawai-organik-saja]]
// di memori) - tujuannya di sini telaah data HR utk SEMUA status kepegawaian, bukan
// penempatan struktur/payroll yang memang baru mendukung tenaga organik.
public record PegawaiDirektoriItemDto(
    int IdPegawai, string IdKaryawan, string Nik, string Nama, string? StatusKaryawan);

// Rekap karyawan (roster aktif PEGAWAI_SDM, semua jenis_pegawai - termasuk Kontrak) yang
// BELUM punya penempatan grading aktif, dipakai admin SDM melacak progres onboarding
// bertahap (2026-08-20) - akun/profil MyGCS boleh jalan duluan (banyak Kontrak sudah
// login & isi profil), plot jabatan/JG/PG menyusul belakangan per orang.
public record PegawaiBelumDiplotDto(
    int IdPegawai, string IdKaryawan, string Nama, string? StatusKaryawan,
    string? JenisPegawai, string? JabatanLegacy, string? UnitLegacy);

// Detail lengkap satu karyawan (biodata, alamat, keluarga, anak, berkas) - field yang
// sama dengan PersonalProfileDto (My Personal > Profil versi milik sendiri), ditambah
// konteks jabatan/unit/band. AlamatDto/PasanganDto/AnakDto/BerkasDto dipakai bersama
// (lihat PersonalProfileDto.cs).
public record PegawaiDetailAdminDto(
    int IdPegawai,
    string NamaLengkap,
    string IdKaryawan,
    string Nik,
    string? TempatLahir,
    DateOnly? TglLahir,
    string? JenisKelamin,
    string? StatusKaryawan,
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
    DateOnly TerdaftarSejak,
    DateOnly? TanggalMasukKerja,
    string? Jabatan,
    string? Unit,
    int? Band,
    string? Tingkatan,
    IReadOnlyList<AnakDto> Anak,
    IReadOnlyList<BerkasDto> Berkas);
