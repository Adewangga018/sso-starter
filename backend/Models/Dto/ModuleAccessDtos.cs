namespace SsoBackend.Models.Dto;

// Satu baris pada halaman Panel Admin IT > Akses Modul: metadata modul dari katalog
// digabung dengan pengaturannya di dbo.module_access.
public record ModuleSettingDto(
    string Key,
    string Label,
    string Subtitle,
    string Icon,
    bool Enabled,
    string Access,
    DateTime? UpdatedAt,
    string? UpdatedBy,
    string? LogoUrl = null);

// Body PUT /admin/modules/{key}.
public record ModuleSettingRequest(bool Enabled, string Access);

// Body POST /admin/modules - mendaftarkan modul baru (mis. "My Library") yang belum ada di
// ModuleCatalog. Modul yang baru dibuat belum punya halaman sungguhan - tampil sebagai kartu
// "Coming Soon" di dashboard sampai developer membangun modulnya dan menghubungkan route-nya.
public record CreateModuleRequest(string Key, string Label, string Subtitle, string Icon, bool Enabled, string Access);

// Satu baris fitur (item menu sidebar) di halaman Akses Modul, di bawah modulnya.
public record FeatureSettingDto(
    string Key,
    string ModuleKey,
    string Label,
    bool Enabled,
    DateTime? UpdatedAt,
    string? UpdatedBy);

// Body PUT /admin/features/{key}.
public record FeatureSettingRequest(bool Enabled);
