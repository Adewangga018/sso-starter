namespace SsoBackend.Models.Dto;

public record ModuleTileDto(string Key, string Label, string Subtitle, string Icon, bool Enabled);

// Jabatan dipakai sebagai baris kecil di bawah nama pada bilah atas (mis. "INTERN").
public record DashboardSummaryDto(string Nama, string? Jabatan, IReadOnlyList<ModuleTileDto> Modules);
