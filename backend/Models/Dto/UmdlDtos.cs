namespace SsoBackend.Models.Dto;

public record UmdlDto(
    long Id,
    string? KodeUmdl,
    string? Status,
    DateTime TglUmdl,
    string? Keterangan,
    string? KodeIjin,
    string? Source,
    // Bukti dinas (rentang km + foto lokasi) - null untuk baris lama sebelum fitur ini ada.
    string? RentangKm = null,
    string? FotoUrl = null);

public record UmdlListDto(IReadOnlyList<UmdlDto> Items);

// Baris di pencarian "Cari Data SURAT IJIN": hanya izin yang berhak atas uang makan.
public record IjinUmdlDto(
    long IdIjin,
    string? KodeIjin,
    DateTime TglIjin,
    DateTime JamSelesai,
    string JenisIjin,
    string KepentinganIjin,
    string? Keterangan);

// RentangKm: "<75" | "75-150" (Pulang-Pergi) - ">150" TIDAK diizinkan di UMDL, harus lewat SPPD.
// Foto: data URL base64 (wajib saat Create; boleh dikosongkan saat Update utk pertahankan foto lama).
public record UmdlRequest(
    long IdIjin, DateOnly TglUmdl, string? Keterangan,
    string RentangKm, string? Foto, decimal Lat, decimal Lng, decimal? Accuracy);
