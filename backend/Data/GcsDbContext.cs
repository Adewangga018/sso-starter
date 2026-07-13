using Microsoft.EntityFrameworkCore;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Data;

// Read-only view onto the existing "GCS" legacy database (dbo + easy schemas).
// No migrations are ever generated or run against this context - it only queries
// tables that already exist and are owned by other systems.
public class GcsDbContext : DbContext
{
    public GcsDbContext(DbContextOptions<GcsDbContext> options) : base(options)
    {
    }

    public DbSet<MstPegawai> MstPegawai => Set<MstPegawai>();
    public DbSet<MstAnakPegawai> MstAnakPegawai => Set<MstAnakPegawai>();
    public DbSet<EasyUser> EasyUsers => Set<EasyUser>();
    public DbSet<PegawaiSdm> PegawaiSdm => Set<PegawaiSdm>();

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

        builder.Entity<PegawaiSdm>(e =>
        {
            // There is also an unrelated easy.PEGAWAI_SDM table - this must stay pinned to dbo.
            e.ToTable("PEGAWAI_SDM", "dbo");
            e.HasKey(x => x.id);
        });
    }
}
