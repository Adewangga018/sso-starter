namespace SsoBackend.Models.Dto;

public record UmdlDto(
    long Id,
    string? KodeUmdl,
    string? Status,
    DateTime TglUmdl,
    string? Keterangan,
    string? KodeIjin,
    string? Source);

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

public record UmdlRequest(long IdIjin, DateOnly TglUmdl, string? Keterangan);
