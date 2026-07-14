using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

// Interactive authentication + self-service account management for the SSO Hub.
// - Login establishes the Identity cookie that /connect/authorize consumes.
// - MFA (authenticator app), password reset, and change-password are self-service.
// - Every security-relevant event is written to the audit trail (SRS Fitur D).
[ApiController]
// Route is root-relative (no "api/"): in production IIS hosts this app as the /api
// sub-application and strips /api via PathBase, so the app must NOT repeat it.
[Route("account")]
public class AccountController : ControllerBase
{
    private const string BearerScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;

    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly GcsDbContext _gcs;
    private readonly IAuditLogger _audit;
    private readonly IEmailSender _email;
    private readonly IConfiguration _config;

    public AccountController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        GcsDbContext gcs,
        IAuditLogger audit,
        IEmailSender email,
        IConfiguration config)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _gcs = gcs;
        _audit = audit;
        _email = email;
        _config = config;
    }

    // ---------------------------------------------------------------- Login

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Email dan kata sandi wajib diisi." });
        }

        var email = request.Email.Trim();
        var user = await _userManager.FindByEmailAsync(email);

        // First-time login: migrate the account from the legacy GCS user store.
        if (user is null)
        {
            user = await ProvisionFromLegacyAsync(email, request.Password);
            if (user is null)
            {
                await _audit.LogAsync("login.failure", null, email, "Kredensial tidak dikenal");
                return Unauthorized(new { message = "Email atau kata sandi salah." });
            }
        }

        if (!user.IsActive)
        {
            await _audit.LogAsync("login.blocked", user.Id, email, "Akun tidak aktif");
            return Unauthorized(new { message = "Akun tidak aktif. Hubungi HR/SDM." });
        }

        var result = await _signInManager.PasswordSignInAsync(
            user, request.Password, isPersistent: true, lockoutOnFailure: true);

        if (result.RequiresTwoFactor)
        {
            await _audit.LogAsync("login.2fa_required", user.Id, email);
            return Ok(new { requiresTwoFactor = true });
        }

        if (result.IsLockedOut)
        {
            await _audit.LogAsync("login.lockout", user.Id, email);
            return Unauthorized(new { message = "Akun terkunci sementara karena terlalu banyak percobaan gagal." });
        }

        if (!result.Succeeded)
        {
            await _audit.LogAsync("login.failure", user.Id, email, "Kata sandi salah");
            return Unauthorized(new { message = "Email atau kata sandi salah." });
        }

        await EnsureConfiguredAdminAsync(user);
        await _audit.LogAsync("login.success", user.Id, email);
        return Ok(new AuthUserDto(user.FullName ?? user.UserName ?? email, user.Email ?? email));
    }

    [HttpPost("login-2fa")]
    [AllowAnonymous]
    public async Task<IActionResult> LoginTwoFactor(TwoFactorLoginRequest request)
    {
        var user = await _signInManager.GetTwoFactorAuthenticationUserAsync();
        if (user is null)
        {
            return Unauthorized(new { message = "Sesi verifikasi dua langkah tidak ditemukan atau kedaluwarsa. Silakan login ulang." });
        }

        var code = (request.Code ?? string.Empty).Replace(" ", string.Empty).Replace("-", string.Empty);
        var result = await _signInManager.TwoFactorAuthenticatorSignInAsync(
            code, isPersistent: true, rememberClient: request.RememberMachine);

        if (result.IsLockedOut)
        {
            await _audit.LogAsync("login.lockout", user.Id, user.Email, "Lockout saat verifikasi 2FA");
            return Unauthorized(new { message = "Akun terkunci sementara." });
        }

        if (!result.Succeeded)
        {
            await _audit.LogAsync("login.2fa_failure", user.Id, user.Email);
            return Unauthorized(new { message = "Kode autentikator salah." });
        }

        await EnsureConfiguredAdminAsync(user);
        await _audit.LogAsync("login.success", user.Id, user.Email, "Dengan 2FA");
        return Ok(new AuthUserDto(user.FullName ?? user.UserName ?? string.Empty, user.Email ?? string.Empty));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = _userManager.GetUserId(User);
        await _signInManager.SignOutAsync();
        await _audit.LogAsync("logout", userId, User.Identity?.Name);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize(AuthenticationSchemes = BearerScheme)]
    public async Task<IActionResult> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new
        {
            name = user.FullName ?? user.UserName,
            email = user.Email,
            twoFactorEnabled = user.TwoFactorEnabled,
        });
    }

    // ------------------------------------------------------------- MFA (TOTP)

    [HttpGet("2fa/setup")]
    [Authorize(AuthenticationSchemes = BearerScheme)]
    public async Task<ActionResult<AuthenticatorSetupDto>> GetAuthenticatorSetup()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var key = await _userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(key))
        {
            await _userManager.ResetAuthenticatorKeyAsync(user);
            key = await _userManager.GetAuthenticatorKeyAsync(user);
        }

        var uri = BuildAuthenticatorUri(user.Email ?? user.UserName ?? "user", key!);
        return Ok(new AuthenticatorSetupDto(FormatKey(key!), uri));
    }

    [HttpPost("2fa/enable")]
    [Authorize(AuthenticationSchemes = BearerScheme)]
    public async Task<IActionResult> EnableAuthenticator(EnableAuthenticatorRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var code = (request.Code ?? string.Empty).Replace(" ", string.Empty).Replace("-", string.Empty);
        var valid = await _userManager.VerifyTwoFactorTokenAsync(
            user, _userManager.Options.Tokens.AuthenticatorTokenProvider, code);

        if (!valid)
        {
            return BadRequest(new { message = "Kode verifikasi salah. Coba lagi." });
        }

        await _userManager.SetTwoFactorEnabledAsync(user, true);
        await _audit.LogAsync("mfa.enabled", user.Id, user.Email);

        var recoveryCodes = await _userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);
        return Ok(new RecoveryCodesDto(recoveryCodes ?? Enumerable.Empty<string>()));
    }

    [HttpPost("2fa/disable")]
    [Authorize(AuthenticationSchemes = BearerScheme)]
    public async Task<IActionResult> DisableAuthenticator()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        await _userManager.SetTwoFactorEnabledAsync(user, false);
        await _userManager.ResetAuthenticatorKeyAsync(user);
        await _audit.LogAsync("mfa.disabled", user.Id, user.Email);

        return NoContent();
    }

    // -------------------------------------------------------- Password (self)

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = (request.Email ?? string.Empty).Trim();
        var user = string.IsNullOrWhiteSpace(email) ? null : await _userManager.FindByEmailAsync(email);

        // Always report success so we don't reveal whether an email is registered.
        if (user is not null && user.IsActive)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var link = $"{FrontendBaseUrl()}/reset-password" +
                       $"?email={Uri.EscapeDataString(user.Email!)}&token={Uri.EscapeDataString(token)}";

            await _email.SendAsync(user.Email!, "Reset Kata Sandi MyGCS",
                $"Kami menerima permintaan reset kata sandi.\nKlik tautan berikut untuk membuat kata sandi baru:\n{link}\n\nAbaikan email ini bila Anda tidak meminta.");
            await _audit.LogAsync("password.reset.requested", user.Id, user.Email);
        }
        else
        {
            await _audit.LogAsync("password.reset.requested", null, email, "Email tidak terdaftar/aktif");
        }

        return Ok(new { message = "Jika email terdaftar, tautan reset telah dikirim." });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Token) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Data tidak lengkap." });
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            // Same generic error as an invalid token, to avoid account enumeration.
            return BadRequest(new { message = "Tautan reset tidak valid atau sudah kedaluwarsa." });
        }

        var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
            var reason = string.Join("; ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = "Gagal reset: " + reason });
        }

        await _audit.LogAsync("password.reset.completed", user.Id, user.Email);
        return Ok(new { message = "Kata sandi berhasil diganti. Silakan login." });
    }

    [HttpPost("change-password")]
    [Authorize(AuthenticationSchemes = BearerScheme)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var reason = string.Join("; ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = "Gagal ganti kata sandi: " + reason });
        }

        await _audit.LogAsync("password.changed", user.Id, user.Email);
        return NoContent();
    }

    // -------------------------------------------------------------- Helpers

    private async Task<ApplicationUser?> ProvisionFromLegacyAsync(string email, string password)
    {
        var legacy = await _gcs.EasyUsers
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

        if (legacy is null || !BCrypt.Net.BCrypt.Verify(password, legacy.Password))
        {
            return null;
        }

        var user = new ApplicationUser
        {
            UserName = legacy.Email,
            Email = legacy.Email,
            EmailConfirmed = true,
            FullName = legacy.Name,
            Nik = legacy.Nik,
            GcsUserId = legacy.Id,
            IsActive = string.Equals(legacy.Status, "Aktif", StringComparison.OrdinalIgnoreCase),
        };

        user.PasswordHash = _userManager.PasswordHasher.HashPassword(user, password);

        var create = await _userManager.CreateAsync(user);
        if (!create.Succeeded)
        {
            return null;
        }

        await _audit.LogAsync("account.provisioned", user.Id, user.Email, "Migrasi dari easy.users");
        return user;
    }

    // Grants the Admin role to emails listed in Admin:Emails config (bootstrap so the
    // audit dashboard is reachable before a full user-management UI exists).
    private async Task EnsureConfiguredAdminAsync(ApplicationUser user)
    {
        var adminEmails = _config.GetSection("Admin:Emails").Get<string[]>() ?? [];
        if (user.Email is not null &&
            adminEmails.Any(e => string.Equals(e, user.Email, StringComparison.OrdinalIgnoreCase)) &&
            !await _userManager.IsInRoleAsync(user, "Admin"))
        {
            await _userManager.AddToRoleAsync(user, "Admin");
            await _audit.LogAsync("role.admin_granted", user.Id, user.Email, "Via konfigurasi Admin:Emails");
        }
    }

    private string FrontendBaseUrl() =>
        _config["Frontend:BaseUrl"]?.TrimEnd('/') ?? $"{Request.Scheme}://{Request.Host}";

    private static string BuildAuthenticatorUri(string email, string unformattedKey)
    {
        const string issuer = "MyGCS";
        return $"otpauth://totp/{UrlEncoder.Default.Encode(issuer)}:{UrlEncoder.Default.Encode(email)}" +
               $"?secret={unformattedKey}&issuer={UrlEncoder.Default.Encode(issuer)}&digits=6";
    }

    // Groups the shared key into 4-char blocks for easier manual entry.
    private static string FormatKey(string key)
    {
        var result = new System.Text.StringBuilder();
        for (var i = 0; i < key.Length; i += 4)
        {
            result.Append(key.AsSpan(i, Math.Min(4, key.Length - i))).Append(' ');
        }
        return result.ToString().ToLowerInvariant().Trim();
    }
}
