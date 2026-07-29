namespace SsoBackend.Models.Dto;

// Ringkasan satu periode MCU + jumlah hasil tercatat.
public record HealthPeriodeDto(
    long Id, string Judul, int Tahun, string? Penyelenggara, string? Lokasi,
    DateOnly? TglMulai, DateOnly? TglSelesai, string? Catatan, string Status,
    int JumlahHasil);

// Satu hasil MCU (dipakai karyawan utk dirinya & admin utk semua).
public record HealthHasilDto(
    long Id, long IdPeriode, string PeriodeJudul, int Tahun,
    string Nik, string? Nama, DateOnly? TglPemeriksaan,
    decimal? Tinggi, decimal? Berat, double? Bmi, string? KategoriBmi,
    string? TekananDarah, string StatusUmum, string? Ringkasan, string? Rekomendasi,
    string StatusTindakLanjut, bool AdaLampiran, string? NamaFile,
    string? NamaPencatat, DateTime TglDicatat, DateTime? TglDiubah);

// Riwayat MCU milik karyawan sendiri + periode yang akan/masih berlangsung.
public record HealthRiwayatDto(
    IReadOnlyList<HealthHasilDto> Items,
    IReadOnlyList<HealthPeriodeDto> PeriodeAktif,
    bool IsAdmin);

// Daftar periode (Admin Kepatuhan).
public record HealthPeriodeListDto(IReadOnlyList<HealthPeriodeDto> Items, bool IsAdmin);

// Detail periode + seluruh hasil peserta (Admin Kepatuhan).
public record HealthPeriodeDetailDto(HealthPeriodeDto Periode, IReadOnlyList<HealthHasilDto> Hasil, bool IsAdmin);

// Buat/ubah periode MCU.
public record SimpanPeriodeRequest(
    string Judul, int Tahun, string? Penyelenggara, string? Lokasi,
    string? TglMulai, string? TglSelesai, string? Catatan, string? Status);
