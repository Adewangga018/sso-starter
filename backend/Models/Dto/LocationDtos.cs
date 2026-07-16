namespace SsoBackend.Models.Dto;

// CRUD lokasi geofence dari panel Admin IT (lihat AdminLocationsController). Berbeda dari
// LocationDto (PersonalProfileDto.cs) yang dipakai SPA absensi karyawan - versi admin ini
// juga menyertakan Aktif karena admin perlu mengaktifkan/menonaktifkan lokasi.
public record AdminLocationDto(
    int Id,
    string Nama,
    decimal Lat,
    decimal Lng,
    double RadiusMeters,
    bool Aktif);

public record LocationRequest(
    string Nama,
    decimal Lat,
    decimal Lng,
    double RadiusMeters,
    bool Aktif);
