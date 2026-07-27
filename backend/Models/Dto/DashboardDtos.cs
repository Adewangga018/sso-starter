namespace SsoBackend.Models.Dto;

public record ModuleTileDto(string Key, string Label, string Subtitle, string Icon, bool Enabled);

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
    bool IsAdminModulSdm = false);
