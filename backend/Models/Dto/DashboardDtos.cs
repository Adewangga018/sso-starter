namespace SsoBackend.Models.Dto;

// Access = "semua" | "admin" (lihat ModuleAccessLevels). Modul yang dibatasi ke Admin IT tetap
// dikirim ke semua akun supaya grid modul di dashboard tidak bolong, hanya saja Enabled-nya
// dipaksa false untuk non-Admin sehingga tampil "Coming Soon" (lihat
// ModuleSettingsService.GetTilesForAsync). Di dashboard Admin, Access = "admin" ditandai badge
// "Khusus Admin".
public record ModuleTileDto(string Key, string Label, string Subtitle, string Icon, bool Enabled, string Access = "semua");

// Jabatan dipakai sebagai baris kecil di bawah nama pada bilah atas (mis. "INTERN").
// Tingkatan/Band = level berbasis band (General Manager..Pelaksana Junior / Direksi),
// diturunkan dari grading (lihat PosisiResolver) - BUKAN dari jabatan legacy SDM.
// ProfileComplete = false berarti baris dbo.MST_PEGAWAI akun ini belum ada, ATAU sudah ada
// tapi field wajibnya belum lengkap (lihat ProfileRules.IsComplete - termasuk baris lama/legacy
// yang dibuat sebelum aturan wajib-isi ini ada) - SPA mengunci seluruh menu/modul lain di
// sidebar sampai Profil dilengkapi (lihat MyPersonalLayout.jsx).
public record DashboardSummaryDto(
    string Nama,
    string? Jabatan,
    IReadOnlyList<ModuleTileDto> Modules,
    bool ProfileComplete = true,
    string? Tingkatan = null,
    int? Band = null,
    bool IsAdminModulSdm = false,
    // Kunci fitur (item menu) yang dikunci Admin IT. Frontend menyembunyikannya bagi
    // non-Admin IT & memblok rutenya. Lihat FeatureCatalog / FeatureSettingsService.
    IReadOnlyList<string>? LockedFeatures = null);
