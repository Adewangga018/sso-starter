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
    int Sisa,                                       // saldo tersisa = hak - diambil
    bool AdaData,
    string? Periode,
    DateOnly? Tmt,
    int Akrual,                                     // basis periode (min(batas, sisa lalu + 12))
    int Hak,                                        // net = akrual - cuti bersama pengurang
    int Diambil,
    int CutiBersama,                                // total hari cuti bersama yang mengurangi hak
    int HakPerTahun,                                // akrual per tahun (mis. 12)
    int BatasAkumulasi,                             // saldo maksimum (mis. 24)
    bool BisaApprove,
    bool IsAdminSdm,                                // kelola cuti bersama & nasional (SDM)
    IReadOnlyList<CutiPengajuanDto> Pengajuan,      // pengajuan saya
    IReadOnlyList<CutiPengajuanDto> Persetujuan,    // menunggu persetujuan saya (sbg atasan)
    IReadOnlyList<CutiRiwayatDto> Riwayat,          // riwayat lama dari SDM
    IReadOnlyList<CutiBersamaDto> CutiBersamaList,  // daftar cuti bersama (info + kelola SDM)
    IReadOnlyList<CutiNasionalDto> CutiNasionalList);// daftar cuti nasional

// Entri cuti bersama & nasional (CRUD Admin SDM; ditampilkan ke semua sbg info).
public record CutiBersamaDto(
    long Id, DateOnly TglMulai, DateOnly TglSelesai, int JumlahHari,
    string Keterangan, bool MengurangiHak, int Tahun);
public record CutiNasionalDto(
    long Id, DateOnly TglMulai, DateOnly TglSelesai, int JumlahHari, string Keterangan, int Tahun);

// Request CRUD (JSON).
public record SimpanCutiBersamaRequest(
    DateOnly TglMulai, DateOnly TglSelesai, string Keterangan, bool MengurangiHak);
public record SimpanCutiNasionalRequest(
    DateOnly TglMulai, DateOnly TglSelesai, string Keterangan);
