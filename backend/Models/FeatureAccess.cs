namespace SsoBackend.Models;

// Override lock/unlock per FITUR (item menu sidebar) tiap modul, dikelola Admin IT di
// Panel > Akses Modul (baris fitur di bawah tiap modul). Katalog fitur statis di
// FeatureCatalog; tabel ini hanya menyimpan override aktif/tidak. Fitur tanpa baris
// memakai bawaan katalog (default aktif).
public class FeatureAccess
{
    // Kunci fitur "moduleKey:featureKey", mis. "my-personal:cuti".
    public string FeatureKey { get; set; } = string.Empty;

    // false = fitur terkunci: item menu disembunyikan bagi non-Admin IT, rute & API ditolak.
    public bool Enabled { get; set; } = true;

    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}
