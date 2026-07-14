namespace SsoBackend.Models.Dto;

public record SppdDto(
    int Id,
    string? KodeSppd,
    string? Status,
    DateTime TglInput,
    string? Tujuan,
    string? Keterangan,
    DateTime TglBerangkat,
    DateTime TglPulang,
    int LamaHari,
    string? Kendaraan,
    string? Jenis,
    // Semua peserta, bukan hanya ketuanya - satu SPPD lazim membawa beberapa orang.
    IReadOnlyList<string> NamaKaryawan,
    IReadOnlyList<string> Tugas);

public record SppdListDto(IReadOnlyList<SppdDto> Items);

public record SppdRequest(
    DateOnly TglBerangkat,
    DateOnly TglPulang,
    string Jenis,
    string Tujuan,
    string Keterangan,
    string Kendaraan);

// One traveller on the SPPD.
public record SppdDetailDto(
    int IdDet,
    string Nik,
    string? Nama,
    string? Golongan,
    string? Jabatan,
    string? Struktur,
    string Posisi,
    string Tugas);

public record SppdDetailRequest(string Nik, string Posisi, string Tugas);

// A row in the "Cari Data Pegawai" picker.
public record PegawaiPickerDto(
    string Nik,
    string? Nama,
    string? Wilayah,
    string? UnitKerja);

public record SppdPrintDetailDto(
    string Nama,
    string Nik,
    string? Golongan,
    string? Jabatan,
    string Posisi,
    string Tugas);

public record SppdPrintDto(
    string KodeSppd,
    DateTime TglSurat,
    string Tujuan,
    DateTime TglBerangkat,
    DateTime TglPulang,
    int LamaHari,
    string Kendaraan,
    IReadOnlyList<SppdPrintDetailDto> Peserta,
    string QrUrl,
    DateTime DicetakPada);
