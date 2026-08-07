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
    string? Status,
    string FotoUrl);

public record DinasBuktiAdminListDto(IReadOnlyList<DinasBuktiAdminDto> Items);
