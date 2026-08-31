namespace SsoBackend.Models.Dto;

public record AdminOverrideDto(
    int Id,
    string IdKaryawan,
    string? NamaKaryawan,
    string Modul,          // SDM | Kepatuhan
    bool Aktif,
    string DiberikanOleh,
    DateTime DiberikanPada,
    DateTime DiperbaruiPada);

public record BuatAdminOverrideRequest(string IdKaryawan, string Modul);
public record SetAktifAdminOverrideRequest(bool Aktif);
