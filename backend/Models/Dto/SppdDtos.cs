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
    IReadOnlyList<string> Tugas,
    // Bukti dinas (rentang km + foto lokasi) - null untuk baris lama sebelum fitur ini ada.
    string? RentangKm = null,
    string? FotoUrl = null);

public record SppdListDto(IReadOnlyList<SppdDto> Items);

// RentangKm: HANYA ">150" (Pulang-Pergi) yang valid utk SPPD - <75/75-150 masuk UMDL.
// Foto: data URL base64 (wajib saat Create; boleh dikosongkan saat Update utk pertahankan foto lama).
public record SppdRequest(
    DateOnly TglBerangkat,
    DateOnly TglPulang,
    string Jenis,
    string Tujuan,
    string Keterangan,
    string Kendaraan,
    string RentangKm, string? Foto, decimal Lat, decimal Lng, decimal? Accuracy);

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
