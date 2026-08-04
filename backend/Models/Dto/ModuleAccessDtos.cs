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
    string? UpdatedBy);

// Body PUT /admin/modules/{key}.
public record ModuleSettingRequest(bool Enabled, string Access);

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
