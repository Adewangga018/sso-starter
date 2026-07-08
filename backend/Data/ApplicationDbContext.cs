using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace SsoBackend.Data;

// Kita menggunakan IdentityDbContext karena SSO butuh tabel user, role, dll.
public class ApplicationDbContext : IdentityDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        
        // Mendaftarkan entitas/tabel yang dibutuhkan oleh OpenIddict
        builder.UseOpenIddict();
    }
}