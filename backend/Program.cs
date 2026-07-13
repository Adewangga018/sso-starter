using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;

var builder = WebApplication.CreateBuilder(args);

// Menambahkan DbContext ke Dependency Injection container
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    // Konfigurasi menggunakan SQL Server
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));

    // Mendaftarkan entity sets dari OpenIddict ke Entity Framework
    options.UseOpenIddict();
});

builder.Services.AddControllers();

var app = builder.Build();

app.UseHttpsRedirection();

// Melayani file statis dari wwwroot (index.html + logo.png sebagai halaman bukti deploy)
app.UseDefaultFiles();
app.UseStaticFiles();

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