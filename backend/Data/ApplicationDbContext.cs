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
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Tugas> Tugas => Set<Tugas>();

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
            e.Property(x => x.Accuracy).HasPrecision(10, 2);
            e.Property(x => x.Type).HasMaxLength(10).IsRequired();
            e.Property(x => x.Tempat).HasMaxLength(200);
            e.HasIndex(x => new { x.KodePegawai, x.Tanggal });
        });

        // Titik geofence kantor/gudang (lihat Location.cs). Dikelola dari halaman admin;
        // PersonalController mencari lokasi Aktif terdekat pada tiap absen.
        builder.Entity<Location>(e =>
        {
            e.ToTable("locations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Nama).HasMaxLength(200).IsRequired();
            e.Property(x => x.Lat).HasPrecision(10, 7);
            e.Property(x => x.Lng).HasPrecision(11, 7);
            e.HasIndex(x => x.Aktif);
        });

        // Tugas My Team (myteam.tugas). Tabel dikelola di luar EF (raw SQL, seperti skema
        // grading) - ExcludeFromMigrations agar EF tidak mencoba membuat/mengubahnya, hanya baca/tulis.
        builder.Entity<Tugas>(e =>
        {
            e.ToTable("tugas", "myteam", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.IdPemberi).HasColumnName("id_pemberi").HasMaxLength(30).IsRequired();
            e.Property(x => x.NamaPemberi).HasColumnName("nama_pemberi").HasMaxLength(150);
            e.Property(x => x.IdPenerima).HasColumnName("id_penerima").HasMaxLength(30).IsRequired();
            e.Property(x => x.NamaPenerima).HasColumnName("nama_penerima").HasMaxLength(150);
            e.Property(x => x.Judul).HasColumnName("judul").HasMaxLength(200).IsRequired();
            e.Property(x => x.Deskripsi).HasColumnName("deskripsi");
            e.Property(x => x.Tenggat).HasColumnName("tenggat");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
            e.Property(x => x.DiperbaruiPada).HasColumnName("diperbarui_pada");
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
