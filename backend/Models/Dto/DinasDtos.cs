namespace SsoBackend.Models.Dto;

// Baris bukti dinas utk daftar Admin SDM (lintas seluruh perusahaan) - gabungan
// dinas.bukti (db_mygcs) + konteks dari baris legacy terkait (GCS: web_sdm_umdl/web_sdm_sppd).
public record DinasBuktiAdminDto(
    int Id,
    string Jenis,
    string RefId,
    string Nik,
    string? Nama,
    string RentangKm,
    DateTime DibuatPada,
    string? Ringkasan,
    // Status PERSETUJUAN MANAGER real-time (approval.pengajuan: Menunggu/Disetujui/Ditolak),
    // BUKAN status legacy web_sdm_umdl.STATUS/web_sdm_sppd.status - diminta 2026-08-24.
    string? Status,
    string FotoUrl);

public record DinasBuktiAdminListDto(IReadOnlyList<DinasBuktiAdminDto> Items);

// Satu peserta (Ketua/Anggota) - dipakai rincian SPPD/UMDL di panel Admin SDM.
public record DinasPesertaDto(string Nik, string? Nama, string Posisi);

// Rincian lengkap satu bukti dinas (diminta 2026-08-24) - dibuka lewat tombol "Rincian" di
// Verifikasi Dinas, supaya Admin SDM bisa lihat siapa saja Ketua/Anggotanya tanpa membuka
// akun pemohon.
public record DinasBuktiDetailDto(
    int Id,
    string Jenis,
    string RefId,
    string Nik,
    string? Nama,
    string RentangKm,
    DateTime DibuatPada,
    string? Ringkasan,
    string? Status,
    string? Tujuan,
    DateTime? TglMulai,
    DateTime? TglSelesai,
    IReadOnlyList<DinasPesertaDto> Peserta);
