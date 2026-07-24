namespace SsoBackend.Models.Dto;

// Cuti tahunan (disederhanakan): saldo + pengajuan (approve = potong saldo). Cuti bersama diabaikan.
public record CutiRiwayatDto(
    string? Kode,
    DateOnly? Tanggal,
    string? Keterangan,
    string Status,
    DateOnly? TglDisetujui);

public record CutiPengajuanDto(
    long Id,
    string IdKaryawan,
    string? Nama,
    DateOnly TglMulai,
    DateOnly TglSelesai,
    int JumlahHari,
    string? Keterangan,
    string Status,
    string? Komentar,
    System.DateTime TglPengajuan,
    System.DateTime? TglKeputusan);

public record AjukanCutiRequest(DateOnly TglMulai, DateOnly TglSelesai, string? Keterangan);
public record PutusanCutiRequest(bool Setuju, string? Komentar);

public record CutiDto(
    int Sisa,
    bool AdaData,
    string? Periode,
    DateOnly? Tmt,
    int Hak,
    int Diambil,
    bool BisaApprove,
    IReadOnlyList<CutiPengajuanDto> Pengajuan,      // pengajuan saya
    IReadOnlyList<CutiPengajuanDto> Persetujuan,    // menunggu persetujuan saya (sbg atasan)
    IReadOnlyList<CutiRiwayatDto> Riwayat);         // riwayat lama dari SDM
