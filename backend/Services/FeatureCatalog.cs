namespace SsoBackend.Services;

// Satu fitur = satu item menu sidebar di dalam sebuah modul. Key = "moduleKey:featureKey"
// (harus sama dengan atribut `feature` pada item sidebar di frontend). DefaultEnabled =
// bawaan bila belum pernah diubah Admin IT.
public record FeatureDefinition(string Key, string ModuleKey, string Label, bool DefaultEnabled = true);

// Katalog fitur MyGCS: satu-satunya sumber daftar fitur yang bisa dikunci/dibuka.
// Dipakai FeatureSettingsService (halaman Akses Modul), gate API, & summary dashboard.
public static class FeatureCatalog
{
    public static readonly IReadOnlyList<FeatureDefinition> All =
    [
        // My Personal
        new("my-personal:profil",      "my-personal", "Profil"),
        new("my-personal:absensi",     "my-personal", "Absensi"),
        new("my-personal:izin",        "my-personal", "Izin"),
        new("my-personal:lembur",      "my-personal", "Lembur"),
        new("my-personal:cuti",        "my-personal", "Cuti"),
        new("my-personal:persetujuan", "my-personal", "Persetujuan"),
        new("my-personal:sppd",        "my-personal", "SPPD"),
        new("my-personal:umdl",        "my-personal", "UMDL"),
        new("my-personal:tiket",       "my-personal", "Tiket"),
        new("my-personal:gaji",        "my-personal", "Slip Gaji"),

        // My Team
        new("my-team:tim",             "my-team", "Tim & Tugas"),
        new("my-team:coaching",        "my-team", "Coaching"),
        new("my-team:rekap",           "my-team", "Rekap Tim"),

        // My Office
        new("my-office:beranda",       "my-office", "Beranda"),
        new("my-office:inbox",         "my-office", "Kotak Masuk"),
        new("my-office:buat",          "my-office", "Buat Surat"),
        new("my-office:daftar",        "my-office", "Daftar Surat"),
        new("my-office:review",        "my-office", "Menunggu Review"),
        new("my-office:approval",      "my-office", "Menunggu Approval"),

        // My Asset
        new("my-asset:inventaris",     "my-asset", "Inventaris"),
        new("my-asset:maintenance",    "my-asset", "Maintenance"),

        // My Progress
        new("my-progress:saya",        "my-progress", "KPI Saya"),
        new("my-progress:tim",         "my-progress", "KPI Tim"),
        new("my-progress:perusahaan",  "my-progress", "KPI Perusahaan"),

        // My Prosedur
        new("my-prosedur:dokumen",     "my-prosedur", "SOP & Kebijakan"),

        // My Health
        new("my-health:mcu",           "my-health", "Medical Check-Up"),

        // Payroll
        new("payroll:formula",         "payroll", "Formula & Generalisasi"),
        new("payroll:manual",          "payroll", "Manual per Karyawan"),
        new("payroll:dinas",           "payroll", "Verifikasi Dinas"),

        // Struktur Organisasi
        new("org:struktur",            "org", "Unit & Jabatan"),
        new("org:penempatan",          "org", "Penempatan Karyawan"),
    ];

    public static FeatureDefinition? Find(string? key) =>
        All.FirstOrDefault(f => string.Equals(f.Key, key, StringComparison.OrdinalIgnoreCase));

    public static IEnumerable<FeatureDefinition> ForModule(string moduleKey) =>
        All.Where(f => string.Equals(f.ModuleKey, moduleKey, StringComparison.OrdinalIgnoreCase));
}
