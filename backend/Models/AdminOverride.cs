namespace SsoBackend.Models;

// Toggle manual "Admin SDM"/"Admin Kepatuhan" per karyawan, TERLEPAS dari jabatannya di
// Struktur Organisasi - hanya bisa dikelola dari Panel Admin IT (diminta user 2026-08-27,
// "fleksibilitas penugasan": kadang perlu kasih akses admin ke orang yang jabatannya tidak
// otomatis dapat hak itu). Bersifat ADDITIF - kalau Aktif=false, karyawan itu kembali ke
// status defaultnya (masih bisa jadi admin kalau jabatannya memang berhak, lihat
// ModuleAccessService.IsDeptAdminAsync).
public class AdminOverride
{
    public int Id { get; set; }
    public string IdKaryawan { get; set; } = string.Empty;
    public string? NamaKaryawan { get; set; }
    public string Modul { get; set; } = string.Empty;  // "SDM" | "Kepatuhan"
    public bool Aktif { get; set; } = true;
    public string DiberikanOleh { get; set; } = string.Empty;
    public DateTime DiberikanPada { get; set; }
    public DateTime DiperbaruiPada { get; set; }
}
