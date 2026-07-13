namespace SsoBackend.Models.Dto;

public record SplDto(
    long Id,
    string KodeSpl,
    string? Status,
    string? Keterangan,
    DateTime JamMulai,
    DateTime JamSelesai,
    string? JenisSpl,
    string? Source);

public record SplWindowDto(DateOnly MinDate, DateOnly MaxDate);

public record SplListDto(IReadOnlyList<SplDto> Items, SplWindowDto Window);

public record SplRequest(
    DateOnly MulaiTgl,
    DateOnly SampaiTgl,
    string JamMulai,
    string JamSelesai,
    string JenisSpl,
    string? Keterangan);
