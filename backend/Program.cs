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

// --- My Innovation (Sistem Saran / GIO): lives in db_mygcs (schema "inovasi")
//     alongside Identity & grading. Tables are created by the idempotent SQL
//     script (backend/Database/inovasi/01-schema-ddl.sql), NOT EF migrations. ---
builder.Services.AddDbContext<InovasiDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddScoped<CurrentUserContext>();
builder.Services.AddScoped<DocumentResolver>();
builder.Services.AddScoped<OrgResolver>();
builder.Services.AddScoped<PosisiResolver>();
builder.Services.AddScoped<TeamService>();
builder.Services.AddScoped<OfficeService>();
builder.Services.AddScoped<CutiService>();
builder.Services.AddScoped<ApprovalService>();
builder.Services.AddScoped<GajiService>();
builder.Services.AddScoped<ModuleAccessService>();
builder.Services.AddScoped<KpiService>();

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

    // The login UI is served by the SPA at the SITE ROOT (/login). In production the API
    // runs as an IIS sub-application under /api (PathBase=/api), so the default cookie
    // redirect would target /api/login — which doesn't exist. Redirect to the root /login
    // instead, keeping the original authorize URL (incl. PathBase) as ReturnUrl so the flow
    // resumes correctly. Works in dev too (PathBase is empty there).
    options.Events.OnRedirectToLogin = context =>
    {
        var returnUrl = context.Properties?.RedirectUri
            ?? (context.Request.PathBase + context.Request.Path + context.Request.QueryString);
        context.Response.Redirect("/login?ReturnUrl=" + Uri.EscapeDataString(returnUrl));
        return Task.CompletedTask;
    };
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

// Dev convenience: seed a ready-to-use Admin IT account (DevAdmin:Email/Password from
// user-secrets). Registered only in Development so it never runs in Production.
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddHostedService<DevAdminSeeder>();
}

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
app.MapGet("/health", async (ApplicationDbContext db, GcsDbContext gcs) =>
{
    static async Task<bool> Probe(Func<Task<bool>> check)
    {
        try { return await check(); }
        catch { return false; }
    }

    var myGcsOk = await Probe(() => db.Database.CanConnectAsync());
    var gcsOk = await Probe(() => gcs.Database.CanConnectAsync());

    // CanConnect alone is misleading here: the SDM views (PEGAWAI_SDM, vw_web_sdm_absensi,
    // vw_web_sdm_approval) read across into the GCSSDM database, which breaks SQL Server's
    // ownership chaining - the login needs SELECT rights in GCSSDM too. Without them the
    // connection still opens fine and only blows up later, as a 500, when a user opens the
    // dashboard. So probe a view for real.
    var gcsViewsOk = await Probe(async () =>
    {
        await gcs.PegawaiSdm.Take(1).ToListAsync();
        return true;
    });

    var healthy = myGcsOk && gcsOk && gcsViewsOk;

    return Results.Ok(new
    {
        status = healthy
            ? "OK - Backend berjalan"
            : "DEGRADED - ada koneksi/izin database yang gagal",
        environment = app.Environment.EnvironmentName,
        machineName = Environment.MachineName,
        databaseConnected = myGcsOk,
        gcsDatabaseConnected = gcsOk,
        // false = login SQL belum punya izin baca di GCSSDM (lihat DEPLOY-IIS.md Bab 3)
        gcsSdmViewsReadable = gcsViewsOk,
        serverTimeUtc = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") + " UTC"
    });
});

app.Run();
