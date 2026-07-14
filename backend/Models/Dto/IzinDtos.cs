namespace SsoBackend.Models.Dto;

public record IzinDto(
    long Id,
    string? KodeIjin,
    string? Status,
    string? Keterangan,
    DateTime JamMulai,
    DateTime JamSelesai,
    string? JenisIjin,
    string? KepentinganIjin,
    string? Source);

public record IzinListDto(IReadOnlyList<IzinDto> Items);

public record IzinRequest(
    DateOnly TglIjin,
    DateOnly TglIjinSd,
    string JamMulai,
    string JamSelesai,
    string JenisIjin,
    string KepentinganIjin,
    string? Keterangan);

// Everything the printed Surat Izin renders. Assembled from four sources: the izin row,
// MST_PEGAWAI (name/badge), PEGAWAI_SDM (kelompok/bagian) and vw_web_sdm_approval (the
// supervisor it is addressed to). QrUrl points at the service.gcs-gresik.com validation page.
public record IzinPrintDto(
    string KodeIjin,
    string Nama,
    string Nik,
    string? Kelompok,
    string Kepada,
    string? NamaAtasan,
    string JenisIjin,
    string KepentinganIjin,
    string? Keterangan,
    string NamaHari,
    DateTime JamMulai,
    DateTime JamSelesai,
    string QrUrl,
    DateTime DicetakPada);
