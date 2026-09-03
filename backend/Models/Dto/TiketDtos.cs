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

// --- Monitoring Tiket (staf Sekretariat) ---

public record TiketAdminItemDto(
    int Id,
    string? KodeTiket,
    string IdKaryawan,
    string? NamaKaryawan,
    DateTime TglInput,
    string? Keterangan,
    string? StatusPersetujuan,   // approval.pengajuan.Status: Menunggu|Disetujui|Ditolak|Batal
    DateTime? TglKeputusan,
    string StatusProgres,        // tiket.progres.Status: Belum Diproses|Sedang Diproses|Selesai
    string? CatatanProgres,
    IReadOnlyList<TiketDetailDto> Rincian);

public record TiketAdminSummaryDto(
    int TotalDisetujui,
    int BelumDiproses,
    int SedangDiproses,
    int Selesai,
    IReadOnlyDictionary<string, int> PerJenisTiket);

public record TiketAdminListDto(TiketAdminSummaryDto Ringkasan, IReadOnlyList<TiketAdminItemDto> Items);

public record TiketProgresRequest(string Status, string? Catatan);
