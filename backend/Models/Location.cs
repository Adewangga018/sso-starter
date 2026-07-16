namespace SsoBackend.Models;

// Titik geofence kantor/gudang untuk absensi kamera, dikelola lewat Admin IT
// (AdminLocationsController). Absensi hanya sah dalam RadiusMeters dari salah satu
// baris Aktif = true di sini (lihat PersonalController.PostAbsensi).
public class Location
{
    public int Id { get; set; }
    public string Nama { get; set; } = string.Empty;
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
    public double RadiusMeters { get; set; } = 150.0;
    public bool Aktif { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
