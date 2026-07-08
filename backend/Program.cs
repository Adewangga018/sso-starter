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
app.UseAuthorization();
app.MapControllers();

app.Run();