namespace SsoBackend.Models.Dto;

public record ModuleTileDto(string Key, string Label, string Subtitle, string Icon, bool Enabled);

// Jabatan dipakai sebagai baris kecil di bawah nama pada bilah atas (mis. "INTERN").
// ProfileComplete = false berarti baris dbo.MST_PEGAWAI akun ini belum ada, ATAU sudah ada
// tapi field wajibnya belum lengkap (lihat ProfileRules.IsComplete - termasuk baris lama/legacy
// yang dibuat sebelum aturan wajib-isi ini ada) - SPA mengunci seluruh menu/modul lain di
// sidebar sampai Profil dilengkapi (lihat MyPersonalLayout.jsx).
public record DashboardSummaryDto(string Nama, string? Jabatan, IReadOnlyList<ModuleTileDto> Modules, bool ProfileComplete = true);
