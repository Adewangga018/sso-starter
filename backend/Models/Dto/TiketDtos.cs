namespace SsoBackend.Models.Dto;

public record TiketDto(
    int Id,
    string? KodeTiket,
    string? Status,
    DateTime TglInput,
    string? Keterangan,
    string? Source,
    IReadOnlyList<string> Pemesanan);

public record TiketListDto(IReadOnlyList<TiketDto> Items);

public record TiketRequest(string Keterangan);

public record TiketDetailDto(
    int IdDet,
    string JenisTiket,
    DateTime TglIn,
    DateTime TglOut,
    string Keterangan);

public record TiketDetailRequest(
    string JenisTiket,
    DateOnly TglIn,
    DateOnly TglOut,
    string Keterangan);

public record TiketPrintDto(
    string KodeTiket,
    DateTime TglSurat,
    string Nama,
    IReadOnlyList<TiketDetailDto> Rincian,
    DateTime DicetakPada);
