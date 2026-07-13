namespace SsoBackend.Models.Dto;

public record ModuleTileDto(string Key, string Label, string Subtitle, string Icon, bool Enabled);

public record DashboardSummaryDto(string Nama, string? Jabatan, IReadOnlyList<ModuleTileDto> Modules);
