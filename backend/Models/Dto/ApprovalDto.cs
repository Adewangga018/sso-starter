namespace SsoBackend.Models.Dto;

public record PersetujuanDto(
    long Id,
    string Jenis,
    string RefId,
    string IdKaryawan,
    string? Nama,
    string? Ringkasan,
    string Status,
    string? Komentar,
    System.DateTime TglPengajuan,
    System.DateTime? TglKeputusan);

public record PersetujuanInboxDto(
    IReadOnlyList<PersetujuanDto> Menunggu,
    IReadOnlyList<PersetujuanDto> Riwayat);

public record PutusanApprovalRequest(bool Setuju, string? Komentar);
