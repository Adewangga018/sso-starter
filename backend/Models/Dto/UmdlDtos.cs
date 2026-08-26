namespace SsoBackend.Models.Dto;

public record UmdlDto(
    long Id,
    string? KodeUmdl,
    string? Status,
    DateTime TglUmdl,
    string? Keterangan,
    string? KodeIjin,
    string? Source,
    // Bukti dinas (rentang km + foto lokasi) - null untuk baris lama sebelum fitur ini ada.
    string? RentangKm = null,
    string? FotoUrl = null,
    // Ketua/anggota (dinas.umdl_anggota) - mirror SPPD, diminta 2026-08-24. Kosong = belum
    // ada yang ditambahkan (hanya pengajunya sendiri yang tercatat).
    IReadOnlyList<UmdlDetailDto>? Peserta = null,
    // Hubungan SAYA dengan UMDL ini - "Pembuat" kalau saya yang mengajukan, atau
    // "Ketua"/"Anggota" kalau saya ditambahkan sbg peserta oleh orang lain.
    string PeranSaya = "Pembuat",
    // Status persetujuan MANAGER real-time dari approval.pengajuan - lihat catatan yg sama
    // di SppdDto.
    string? StatusPersetujuan = null,
    DateTime? TglKeputusan = null);

public record UmdlListDto(IReadOnlyList<UmdlDto> Items);

// Satu peserta UMDL (dinas.umdl_anggota).
public record UmdlDetailDto(int IdDet, string Nik, string? Nama, string Posisi);

public record UmdlDetailRequest(string Nik, string Posisi);

// Baris di pencarian "Cari Data SURAT IJIN": hanya izin yang berhak atas uang makan.
public record IjinUmdlDto(
    long IdIjin,
    string? KodeIjin,
    DateTime TglIjin,
    DateTime JamSelesai,
    string JenisIjin,
    string KepentinganIjin,
    string? Keterangan);

// RentangKm: "<75" | "75-150" (Pulang-Pergi) - ">150" TIDAK diizinkan di UMDL, harus lewat SPPD.
// Foto: data URL base64 (wajib saat Create; boleh dikosongkan saat Update utk pertahankan foto lama).
public record UmdlRequest(
    long IdIjin, DateOnly TglUmdl, string? Keterangan,
    string RentangKm, string? Foto, decimal Lat, decimal Lng, decimal? Accuracy);
