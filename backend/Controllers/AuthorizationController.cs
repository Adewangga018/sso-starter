using System.Security.Claims;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using SsoBackend.Models;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace SsoBackend.Controllers;

// Implements the OpenID Connect endpoints of the SSO Hub (the Identity Provider):
// /connect/authorize, /connect/token, /connect/userinfo, /connect/logout.
// Interactive authentication is delegated to ASP.NET Core Identity (cookie).
public class AuthorizationController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;

    public AuthorizationController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager)
    {
        _signInManager = signInManager;
        _userManager = userManager;
    }

    [HttpGet("~/connect/authorize")]
    [HttpPost("~/connect/authorize")]
    public async Task<IActionResult> Authorize()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        // Is the user already signed in (Identity cookie) at the Hub?
        var result = await HttpContext.AuthenticateAsync(IdentityConstants.ApplicationScheme);
        if (result?.Succeeded != true)
        {
            // Send the browser to the login page, preserving the original authorize request.
            return Challenge(
                authenticationSchemes: IdentityConstants.ApplicationScheme,
                properties: new AuthenticationProperties
                {
                    RedirectUri = Request.PathBase + Request.Path + QueryString.Create(
                        Request.HasFormContentType ? Request.Form : Request.Query)
                });
        }

        // After a successful cookie authentication, Principal is guaranteed non-null.
        var user = await _userManager.GetUserAsync(result.Principal!)
            ?? throw new InvalidOperationException("The user details cannot be retrieved.");

        if (!user.IsActive)
        {
            return Forbid(
                authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                properties: new AuthenticationProperties(new Dictionary<string, string?>
                {
                    [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.AccessDenied,
                    [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                        "Akun tidak aktif. Hubungi HR/SDM."
                }));
        }

        var principal = await BuildPrincipalAsync(user);
        principal.SetScopes(request.GetScopes());

        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpPost("~/connect/token")]
    public async Task<IActionResult> Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        if (!request.IsAuthorizationCodeGrantType() && !request.IsRefreshTokenGrantType())
        {
            throw new InvalidOperationException("The specified grant type is not supported.");
        }

        // Recover the principal stored in the authorization code / refresh token.
        var result = await HttpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        var user = result.Principal is null ? null : await _userManager.GetUserAsync(result.Principal);

        if (user is null || !user.IsActive || !await _signInManager.CanSignInAsync(user))
        {
            return Forbid(
                authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                properties: new AuthenticationProperties(new Dictionary<string, string?>
                {
                    [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidGrant,
                    [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                        "Akun tidak lagi dapat masuk."
                }));
        }

        var principal = await BuildPrincipalAsync(user);
        principal.SetScopes(result.Principal!.GetScopes());

        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpGet("~/connect/userinfo")]
    [HttpPost("~/connect/userinfo")]
    public async Task<IActionResult> UserInfo()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
        {
            return Challenge(
                authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                properties: new AuthenticationProperties(new Dictionary<string, string?>
                {
                    [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidToken,
                    [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                        "Token tidak valid."
                }));
        }

        var claims = new Dictionary<string, object>(StringComparer.Ordinal)
        {
            [Claims.Subject] = user.Id,
            [Claims.Name] = user.FullName ?? user.UserName ?? string.Empty,
            [Claims.Email] = user.Email ?? string.Empty,
            ["nik"] = user.Nik ?? string.Empty,
            ["gcs_uid"] = user.GcsUserId?.ToString() ?? string.Empty
        };

        return Ok(claims);
    }

    [HttpGet("~/connect/logout")]
    [HttpPost("~/connect/logout")]
    public async Task<IActionResult> LogOut()
    {
        // Clear the Hub session cookie, then let OpenIddict honour the OIDC logout request.
        await _signInManager.SignOutAsync();

        return SignOut(
            authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            properties: new AuthenticationProperties { RedirectUri = "/" });
    }

    // Builds the token principal: the Identity claims plus the GCS bridge claims,
    // each tagged with the destinations (access token / id token) it belongs in.
    private async Task<ClaimsPrincipal> BuildPrincipalAsync(ApplicationUser user)
    {
        var principal = await _signInManager.CreateUserPrincipalAsync(user);

        principal.SetClaim("nik", user.Nik ?? string.Empty);
        principal.SetClaim("gcs_uid", user.GcsUserId?.ToString() ?? string.Empty);
        principal.SetClaim("full_name", user.FullName ?? string.Empty);
        principal.SetClaim("is_active", user.IsActive ? "true" : "false");

        foreach (var claim in principal.Claims)
        {
            claim.SetDestinations(GetDestinations(claim, principal));
        }

        return principal;
    }

    private static IEnumerable<string> GetDestinations(Claim claim, ClaimsPrincipal principal)
    {
        switch (claim.Type)
        {
            case Claims.Name or "nik" or "gcs_uid":
                yield return Destinations.AccessToken;
                if (principal.HasScope(Scopes.Profile))
                {
                    yield return Destinations.IdentityToken;
                }
                yield break;

            case Claims.Email:
                yield return Destinations.AccessToken;
                if (principal.HasScope(Scopes.Email))
                {
                    yield return Destinations.IdentityToken;
                }
                yield break;

            case Claims.Role:
                yield return Destinations.AccessToken;
                if (principal.HasScope(Scopes.Roles))
                {
                    yield return Destinations.IdentityToken;
                }
                yield break;

            // Never expose Identity's security stamp.
            case "AspNet.Identity.SecurityStamp":
                yield break;

            default:
                yield return Destinations.AccessToken;
                yield break;
        }
    }
}
