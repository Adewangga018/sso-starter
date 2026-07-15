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
    public DbSet<Attendance> Attendances => Set<Attendance>();

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

        // Camera attendance sink (see Attendance.cs). Lives in db_mygcs (dbo schema by
        // default); the Log Absensi merges these rows with GCS.dbo.vw_web_sdm_absensi at
        // read time only - the view and the GCS database are never written to.
        builder.Entity<Attendance>(e =>
        {
            e.ToTable("attendances");
            e.HasKey(x => x.Id);
            e.Property(x => x.KodePegawai).HasMaxLength(50).IsRequired();
            e.Property(x => x.NamaPegawai).HasMaxLength(200).IsRequired();
            e.Property(x => x.NamaHari).HasMaxLength(20);
            e.Property(x => x.CheckIn).HasMaxLength(20);
            e.Property(x => x.CheckOut).HasMaxLength(20);
            e.Property(x => x.CatatanMangkir).HasMaxLength(500);
            // nvarchar(max): base64 JPEG data URL of the selfie.
            e.Property(x => x.Foto);
            e.Property(x => x.Lat).HasPrecision(10, 7);
            e.Property(x => x.Lng).HasPrecision(11, 7);
            e.Property(x => x.Type).HasMaxLength(10).IsRequired();
            e.Property(x => x.Tempat).HasMaxLength(200);
            e.HasIndex(x => new { x.KodePegawai, x.Tanggal });
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
