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

// Add/edit payload for a child (MST_ANAK_PEGAWAI). Urutan is optional on add (auto-assigned
// to next in sequence when omitted).
public record AnakUpsertRequest(
    string? Nama,
    string? TempatLahir,
    DateOnly? TglLahir,
    int? Urutan);

// Self-service profile edit payload. ID_KARYAWAN (the account-to-employee link), Email (always
// the login account's own email - see PersonalController.UpdateProfile), and system fields
// (ID_PEGAWAI, CREATED_AT) are intentionally NOT here - they cannot be changed by the employee.
public record UpdateProfileRequest(
    string NamaLengkap,
    string? Nik,
    string? TempatLahir,
    DateOnly? TglLahir,
    string? JenisKelamin,
    string? StatusKaryawan,
    string? Agama,
    string? Pendidikan,
    string? NoHp,
    AlamatDto? Alamat,
    string? RiwayatKesehatan,
    string? StatusNikah,
    string? NamaPasangan,
    string? TempatLahirPasangan,
    DateOnly? TglLahirPasangan,
    int? JumlahAnak,
    string? NamaDarurat,
    string? HpDarurat);

public record AbsensiDto(
    string NamaPegawai,
    DateOnly Tanggal,
    string? NamaHari,
    string? CheckIn,
    string? CheckOut,
    string? CatatanMangkir,
    // "SDM" = baris resmi dari vw_web_sdm_absensi; "Kamera" = hasil absensi kamera (db_mygcs).
    string Sumber);

// Payload absensi kamera dari SPA: foto (data URL base64), koordinat, akurasi GPS (meter),
// tempat, dan tipe in/out.
public record AbsensiCheckInDto(
    string Foto,
    decimal Lat,
    decimal Lng,
    decimal? Accuracy,
    string? Tempat,
    string Type);

// Titik geofence aktif yang dikembalikan ke SPA absensi kamera (bukan admin-only).
public record LocationDto(
    int Id,
    string Nama,
    decimal Lat,
    decimal Lng,
    double RadiusMeters);

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
    // Tanggal masuk kerja (hire date) - dari GCS.dbo.PEGAWAI_SDM.tgl_masker (satu-satunya
    // sumber terpercaya, MST_PEGAWAI tak punya kolom ini). Null bila belum ada baris
    // PEGAWAI_SDM utk NIK ybs (mis. pegawai sangat baru/data belum diinput SDM).
    DateOnly? TanggalMasukKerja,
    IReadOnlyList<AnakDto> Anak,
    IReadOnlyList<BerkasDto> Berkas,
    // False when the signed-in account has a badge number (IdKaryawan) but HR hasn't created
    // the MST_PEGAWAI master row yet - the SPA renders an input form instead of read-only "-"s
    // in that case, and hides Data Keluarga/Data Anak/Berkas Pribadi (nothing to attach them to
    // yet). PUT /personal/profile creates the row on first save.
    bool Registered = true,
    // False when the row exists but the required fields (ProfileRules.IsComplete) aren't all
    // filled in yet - covers both a fresh self-registration in progress and a pre-existing
    // HR/legacy row that predates this rule. Drives the "*" markers, the Simpan validation, and
    // (via DashboardSummaryDto) whether the other My Personal modules are unlocked.
    bool ProfileComplete = true,
    // True when a profile photo file exists for this employee in Profile:PhotoPath
    // (named {ID_KARYAWAN}.jpg). The SPA fetches it via GET /personal/profile/photo and
    // shows it as the circular avatar; when false it falls back to the initial letter.
    bool HasPhoto = false);
