namespace SsoBackend.Models.Dto;

public record AsetDto(
    long Id,
    string Kode,
    string Nama,
    string? Kategori,
    string? Merk,
    string? NomorSeri,
    string? Lokasi,
    string? IdPic,
    string? NamaPic,
    string Kondisi,
    string Status,
    decimal? Nilai,
    DateOnly? TglPerolehan,
    string? Catatan,
    DateOnly? MaintenanceBerikutnya,   // tgl_jadwal terdekat berstatus Terjadwal
    DateTime TglDibuat,
    DateTime? TglDiubah);

// Daftar aset + flag apakah pemakai adalah Admin Aset (pengelola).
public record AsetListDto(IReadOnlyList<AsetDto> Items, bool IsAdminAset);

public record AsetMaintenanceDto(
    long Id,
    long IdAset,
    string Jenis,
    DateOnly TglJadwal,
    DateOnly? TglSelesai,
    string Status,
    string? Pelaksana,
    decimal? Biaya,
    string? Catatan,
    DateTime TglDibuat);

// Detail aset + riwayat maintenance-nya.
public record AsetDetailDto(AsetDto Aset, IReadOnlyList<AsetMaintenanceDto> Maintenance, bool IsAdminAset);

// Baris maintenance dengan info aset (untuk halaman Jadwal Maintenance global).
public record MaintenanceRowDto(
    long Id,
    long IdAset,
    string KodeAset,
    string NamaAset,
    string Jenis,
    DateOnly TglJadwal,
    DateOnly? TglSelesai,
    string Status,
    string? Pelaksana,
    decimal? Biaya,
    string? Catatan);

public record MaintenanceListDto(IReadOnlyList<MaintenanceRowDto> Items, bool IsAdminAset);

// ---- request ----
public record SimpanAsetRequest(
    string Kode,
    string Nama,
    string? Kategori,
    string? Merk,
    string? NomorSeri,
    string? Lokasi,
    string? IdPic,
    string? NamaPic,
    string? Kondisi,
    string? Status,
    decimal? Nilai,
    DateOnly? TglPerolehan,
    string? Catatan);

public record SimpanMaintenanceRequest(
    string Jenis,
    DateOnly TglJadwal,
    DateOnly? TglSelesai,
    string? Status,
    string? Pelaksana,
    decimal? Biaya,
    string? Catatan);
