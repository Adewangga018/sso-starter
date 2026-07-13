using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Models;

namespace SsoBackend.Data;

// The SSO Hub's own database (db_mygcs): ASP.NET Core Identity tables +
// OpenIddict operational tables (registered clients, tokens, authorizations).
public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Registers the entity sets OpenIddict needs (applications, scopes, tokens, ...).
        // OpenIddict table names are kept as-is (distinctive & unambiguous).
        builder.UseOpenIddict();

        builder.Entity<AuditLog>(e =>
        {
            e.ToTable("AuditLogs");
            e.HasIndex(x => x.TimestampUtc);
            e.HasIndex(x => x.Email);
            e.HasIndex(x => x.EventType);
        });

        // Use generic table names for the Identity tables instead of the AspNet* prefix.
        builder.Entity<ApplicationUser>().ToTable("Users");
        builder.Entity<IdentityRole>().ToTable("Roles");
        builder.Entity<IdentityUserRole<string>>().ToTable("UserRoles");
        builder.Entity<IdentityUserClaim<string>>().ToTable("UserClaims");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("RoleClaims");
        builder.Entity<IdentityUserLogin<string>>().ToTable("UserLogins");
        builder.Entity<IdentityUserToken<string>>().ToTable("UserTokens");
    }
}
