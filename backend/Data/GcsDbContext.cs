using Microsoft.EntityFrameworkCore;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Data;

// Read-only view onto the legacy employee tables (MST_PEGAWAI, MST_ANAK_PEGAWAI,
// easy.users), now hosted in db_mygcs alongside the app's own schema. No migrations
// are ever generated or run against this context - it only queries pre-existing tables.
public class GcsDbContext : DbContext
{
    public GcsDbContext(DbContextOptions<GcsDbContext> options) : base(options)
    {
    }

    public DbSet<MstPegawai> MstPegawai => Set<MstPegawai>();
    public DbSet<MstAnakPegawai> MstAnakPegawai => Set<MstAnakPegawai>();
    public DbSet<EasyUser> EasyUsers => Set<EasyUser>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<MstPegawai>(e =>
        {
            e.ToTable("MST_PEGAWAI", "dbo");
            e.HasKey(x => x.ID_PEGAWAI);
        });

        builder.Entity<MstAnakPegawai>(e =>
        {
            e.ToTable("MST_ANAK_PEGAWAI", "dbo");
            e.HasKey(x => x.ID_ANAK);
        });

        builder.Entity<EasyUser>(e =>
        {
            e.ToTable("users", "easy");
            e.HasKey(x => x.Id);
        });
    }
}
