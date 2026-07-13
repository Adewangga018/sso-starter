namespace SsoBackend.Models.Dto;

// --- MFA (authenticator app / TOTP) ---
public record TwoFactorLoginRequest(string Code, bool RememberMachine = false);

public record AuthenticatorSetupDto(string SharedKey, string AuthenticatorUri);

public record EnableAuthenticatorRequest(string Code);

public record RecoveryCodesDto(IEnumerable<string> RecoveryCodes);

// --- Self-service password ---
public record ForgotPasswordRequest(string Email);

public record ResetPasswordRequest(string Email, string Token, string NewPassword);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
