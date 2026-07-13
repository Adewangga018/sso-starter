namespace SsoBackend.Models.Dto;

public record LoginRequest(string Email, string Password);

public record AuthUserDto(string Name, string Email);

public record LoginResponse(string Token, AuthUserDto User);
