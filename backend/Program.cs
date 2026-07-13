using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;
using SsoBackend.Data;
using SsoBackend.Models;
using SsoBackend.Services;
using static OpenIddict.Abstractions.OpenIddictConstants;

var builder = WebApplication.CreateBuilder(args);

// --- SSO Hub database (Identity + OpenIddict tables) ---
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));

    // Registers the OpenIddict entity sets with EF Core.
    options.UseOpenIddict();
});

// --- View onto the live SDM/EASy database (GCS): employee master (MST_PEGAWAI,
//     MST_ANAK_PEGAWAI, easy.users) plus operational objects that MUST stay live in the
//     SDM system — attendance (vw_web_sdm_absensi), overtime submissions (web_sdm_spl +
//     triggers), and approval routing (vw_web_sdm_approval). These cannot be copied into
//     db_mygcs, so this context connects to GCS. ---
builder.Services.AddDbContext<GcsDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("GcsConnection"));
});

builder.Services.AddScoped<CurrentUserContext>();
builder.Services.AddScoped<DocumentResolver>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAuditLogger, AuditLogger>();

// Real SMTP when configured (Email:Smtp:Host), otherwise the dev sender that logs links.
if (!string.IsNullOrWhiteSpace(builder.Configuration["Email:Smtp:Host"]))
{
    builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
}
else
{
    builder.Services.AddScoped<IEmailSender, LoggingEmailSender>();
}

// --- ASP.NET Core Identity: the user store & credential management ---
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.User.RequireUniqueEmail = true;

    // Lockout after repeated failures (KF-A-06).
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);

    // Password policy applies to *new* passwords set via the app going forward;
    // legacy passwords migrated on first login bypass these validators.
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
})
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Accept legacy bcrypt hashes (migrated from easy.users) and upgrade them to PBKDF2 on login.
builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, BCryptAwarePasswordHasher>();

// Make Identity emit the claim types OpenIddict/OIDC expect (sub, name, email, role).
builder.Services.Configure<IdentityOptions>(options =>
{
    options.ClaimsIdentity.UserNameClaimType = Claims.Name;
    options.ClaimsIdentity.UserIdClaimType = Claims.Subject;
    options.ClaimsIdentity.EmailClaimType = Claims.Email;
    options.ClaimsIdentity.RoleClaimType = Claims.Role;
});

builder.Services.ConfigureApplicationCookie(options =>
{
    // The interactive login page lives in the React SPA at /login.
    options.LoginPath = "/login";
    options.LogoutPath = "/logout";
});

// --- OpenIddict: the OAuth 2.0 / OpenID Connect server (Identity Provider) ---
builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
            .UseDbContext<ApplicationDbContext>();
    })
    .AddServer(options =>
    {
        options.SetAuthorizationEndpointUris("connect/authorize")
            .SetTokenEndpointUris("connect/token")
            .SetUserInfoEndpointUris("connect/userinfo")
            .SetEndSessionEndpointUris("connect/logout");

        // In dev the SPA reaches the Hub through the Vite proxy, so pin the issuer to
        // the SPA origin (otherwise discovery would advertise the raw backend host and
        // oidc-client-ts would reject the mismatch). In prod the issuer is derived from
        // the request (includes the /api PathBase of the IIS sub-application).
        var issuer = builder.Configuration["Oidc:Issuer"];
        if (!string.IsNullOrWhiteSpace(issuer))
        {
            options.SetIssuer(new Uri(issuer));
        }

        options.AllowAuthorizationCodeFlow()
            .AllowRefreshTokenFlow();

        options.RegisterScopes(Scopes.OpenId, Scopes.Email, Scopes.Profile, Scopes.Roles, "mygcs.api");

        // Signing & encryption certificates.
        // - Dev: ephemeral development certificates (regenerated each run - fine locally).
        // - Prod: persistent X.509 certs from the Windows certificate store (by thumbprint),
        //   so tokens survive IIS app-pool recycles. See DEPLOY-IIS.md for how to create them.
        if (builder.Environment.IsDevelopment())
        {
            options.AddDevelopmentEncryptionCertificate()
                .AddDevelopmentSigningCertificate();
        }
        else
        {
            var signingThumbprint = builder.Configuration["Oidc:SigningCertificateThumbprint"]
                ?? throw new InvalidOperationException("Oidc:SigningCertificateThumbprint is not configured.");
            var encryptionThumbprint = builder.Configuration["Oidc:EncryptionCertificateThumbprint"]
                ?? throw new InvalidOperationException("Oidc:EncryptionCertificateThumbprint is not configured.");

            options.AddSigningCertificate(signingThumbprint)
                .AddEncryptionCertificate(encryptionThumbprint);
        }

        // Emit readable JWT access tokens (needed by non-.NET modules & easier debugging).
        options.DisableAccessTokenEncryption();

        var aspNetCore = options.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough()
            .EnableUserInfoEndpointPassthrough()
            .EnableEndSessionEndpointPassthrough()
            .EnableStatusCodePagesIntegration();

        // In development the app is served over plain HTTP; OpenIddict rejects that by
        // default. Production (HTTPS via IIS) keeps the transport security requirement.
        if (builder.Environment.IsDevelopment())
        {
            aspNetCore.DisableTransportSecurityRequirement();
        }
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });

builder.Services.AddHostedService<OidcSeeder>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddControllers();

var app = builder.Build();

// In development the SPA reaches the backend over plain HTTP (via the Vite proxy),
// so only enforce HTTPS redirection in production (IIS terminates TLS there).
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Serve the deployment-proof page (wwwroot/index.html + logo.png).
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Diagnostic endpoint to confirm the backend is alive on IIS.
app.MapGet("/health", async (ApplicationDbContext db) =>
{
    var dbConnected = false;
    try
    {
        dbConnected = await db.Database.CanConnectAsync();
    }
    catch
    {
        dbConnected = false;
    }

    return Results.Ok(new
    {
        status = "OK - Backend berjalan",
        environment = app.Environment.EnvironmentName,
        machineName = Environment.MachineName,
        databaseConnected = dbConnected,
        serverTimeUtc = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") + " UTC"
    });
});

app.Run();
