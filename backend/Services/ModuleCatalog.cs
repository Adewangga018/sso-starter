namespace SsoBackend.Services;

// Satu definisi modul portal MyGCS. Label/Subtitle/Icon dipakai kartu modul di dashboard;
// DefaultEnabled = apakah modulnya sudah benar-benar dibangun (yang belum tampil sebagai
// "Coming Soon" sampai Admin IT mengaktifkannya).
public record ModuleDefinition(string Key, string Label, string Subtitle, string Icon, bool DefaultEnabled);

// Katalog modul: satu-satunya sumber daftar modul MyGCS. Dipakai DashboardController
// (kartu modul) dan AdminModulesController (halaman Akses Modul) supaya keduanya tidak
// pernah berbeda isi.
public static class ModuleCatalog
{
    public static readonly IReadOnlyList<ModuleDefinition> All =
    [
        new("my-personal", "My Personal", "HR MANAGEMENT", "users", true),
        new("my-office", "My Office", "SURAT-MENYURAT", "mail", true),
        new("my-prosedur", "My Prosedur", "SOP & KEBIJAKAN", "clipboard-check", true),
        new("my-health", "My Health", "KESEHATAN", "activity", false),
        new("my-innovation", "My Innovation", "INOVASI", "lightbulb", true),
        new("my-asset", "My Asset", "ASET", "archive", true),
        new("my-progress", "My Progress", "KPI", "trending-up", true),
        new("my-team", "My Team", "KINERJA TIM", "users-round", true),
    ];

    public static ModuleDefinition? Find(string? key) =>
        All.FirstOrDefault(m => string.Equals(m.Key, key, StringComparison.OrdinalIgnoreCase));
}
