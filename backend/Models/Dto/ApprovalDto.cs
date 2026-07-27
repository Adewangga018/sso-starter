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
    string PeranSaya,        // "Manager" | "Atasan" | "Manager & Atasan"
    bool BisaAksi,           // true bila saya manager (berhak approve/reject)
    System.DateTime TglPengajuan,
    System.DateTime? TglKeputusan);

public record PersetujuanInboxDto(
    IReadOnlyList<PersetujuanDto> Menunggu,
    IReadOnlyList<PersetujuanDto> Riwayat);

public record PutusanApprovalRequest(bool Setuju, string? Komentar);

// Detail pengajuan untuk ditinjau atasan/manager. Field izin* terisi bila jenis = Izin.
public record ApprovalDetailDto(
    long Id,
    string Jenis,
    string IdKaryawan,
    string? Nama,
    string? Ringkasan,
    string Status,
    string? Komentar,
    string PeranSaya,
    bool BisaAksi,
    string? IzinJenis,
    string? IzinKepentingan,
    DateOnly? IzinMulai,
    DateOnly? IzinSelesai,
    string? IzinKeterangan,
    string? IzinKode,
    string? IzinStatusSdm);
