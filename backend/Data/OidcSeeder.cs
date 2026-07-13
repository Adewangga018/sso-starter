using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
using SsoBackend.Models;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace SsoBackend.Data;

// Seeds the baseline OIDC configuration on startup: RBAC roles, the API scope,
// and the registered client application (Service Provider) for the React SPA.
// Idempotent - safe to run on every boot.
public class OidcSeeder : IHostedService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _configuration;

    private static readonly string[] Roles = ["Admin", "AdminModul", "Karyawan"];

    public OidcSeeder(IServiceProvider services, IConfiguration configuration)
    {
        _services = services;
        _configuration = configuration;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _services.CreateScope();

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var scopeManager = scope.ServiceProvider.GetRequiredService<IOpenIddictScopeManager>();
        if (await scopeManager.FindByNameAsync("mygcs.api", cancellationToken) is null)
        {
            await scopeManager.CreateAsync(new OpenIddictScopeDescriptor
            {
                Name = "mygcs.api",
                DisplayName = "MyGCS Module APIs",
                Resources = { "mygcs.api" }
            }, cancellationToken);
        }

        var appManager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();
        var redirectUris = _configuration.GetSection("Oidc:Spa:RedirectUris").Get<string[]>() ?? [];
        var postLogoutUris = _configuration.GetSection("Oidc:Spa:PostLogoutRedirectUris").Get<string[]>() ?? [];

        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = "mygcs-spa",
            ClientType = ClientTypes.Public,          // SPA: no client secret, PKCE instead
            ConsentType = ConsentTypes.Implicit,      // first-party app, no consent screen
            DisplayName = "MyGCS SSO Hub (Frontend)",
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.EndSession,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
                Permissions.Scopes.Roles,
                Permissions.Prefixes.Scope + "mygcs.api"
            },
            Requirements =
            {
                Requirements.Features.ProofKeyForCodeExchange
            }
        };

        foreach (var uri in redirectUris)
        {
            descriptor.RedirectUris.Add(new Uri(uri));
        }

        foreach (var uri in postLogoutUris)
        {
            descriptor.PostLogoutRedirectUris.Add(new Uri(uri));
        }

        var existing = await appManager.FindByClientIdAsync("mygcs-spa", cancellationToken);
        if (existing is null)
        {
            await appManager.CreateAsync(descriptor, cancellationToken);
        }
        else
        {
            // Keep the registration in sync with configuration (e.g. new redirect URIs).
            await appManager.UpdateAsync(existing, descriptor, cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
