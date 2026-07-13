using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SsoBackend.Data;
using SsoBackend.Services;

var builder = WebApplication.CreateBuilder(args);

// Menambahkan DbContext ke Dependency Injection container
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    // Konfigurasi menggunakan SQL Server
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));

    // Mendaftarkan entity sets dari OpenIddict ke Entity Framework
    options.UseOpenIddict();
});

// Read-only DbContext onto the existing GCS database (dbo.MST_PEGAWAI, easy.users, ...).
// Never migrated - it only queries tables owned by other systems.
builder.Services.AddDbContext<GcsDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("GcsConnection"));
});

builder.Services.AddScoped<CurrentUserContext>();
builder.Services.AddScoped<DocumentResolver>();
builder.Services.AddScoped<TokenService>();

var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Without this, the handler remaps short claim names ("sub", "email") to long
        // legacy XML-Soap claim URIs, silently breaking JwtRegisteredClaimNames lookups.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!)),
        };
    });

builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddControllers();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseCors();

// Melayani file statis dari wwwroot (index.html + logo.png sebagai halaman bukti deploy)
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Endpoint diagnostik untuk memastikan backend hidup di IIS.
// Membantu membedakan apakah error ada di frontend atau backend.
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
