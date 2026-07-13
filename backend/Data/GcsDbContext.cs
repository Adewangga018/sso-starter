using Microsoft.EntityFrameworkCore;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Data;

// Onto the existing "GCS" legacy database (dbo + easy schemas). No migrations are ever
// generated or run against this context - every table here already exists and is owned by
// other systems. Everything is read-only except web_sdm_spl, which employees submit into.
public class GcsDbContext : DbContext
{
    public GcsDbContext(DbContextOptions<GcsDbContext> options) : base(options)
    {
    }

    public DbSet<MstPegawai> MstPegawai => Set<MstPegawai>();
    public DbSet<MstAnakPegawai> MstAnakPegawai => Set<MstAnakPegawai>();
    public DbSet<EasyUser> EasyUsers => Set<EasyUser>();
    public DbSet<PegawaiSdm> PegawaiSdm => Set<PegawaiSdm>();
    public DbSet<AbsensiLog> AbsensiLog => Set<AbsensiLog>();
    public DbSet<WebSdmSpl> WebSdmSpl => Set<WebSdmSpl>();
    public DbSet<SdmApproval> SdmApproval => Set<SdmApproval>();

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

        builder.Entity<AbsensiLog>(e =>
        {
            e.HasNoKey();
            e.ToView("vw_web_sdm_absensi", "dbo");
            e.Property(x => x.KodePegawai).HasColumnName("kode_pegawai");
            e.Property(x => x.NamaPegawai).HasColumnName("nama_pegawai");
            e.Property(x => x.Tanggal).HasColumnName("tanggal");
            e.Property(x => x.NamaHari).HasColumnName("nama_hari");
            e.Property(x => x.CheckIn).HasColumnName("check_in");
            e.Property(x => x.CheckOut).HasColumnName("check_out");
            e.Property(x => x.CatatanMangkir).HasColumnName("catatan_mangkir");
        });

        builder.Entity<WebSdmSpl>(e =>
        {
            // The table carries legacy triggers, so EF must not use an OUTPUT clause when
            // writing - declaring them here switches it to the trigger-safe INSERT path.
            e.ToTable("web_sdm_spl", "dbo", tb =>
            {
                tb.HasTrigger("web_sdm_spl_tri");
                tb.HasTrigger("web_sdm_spl_tru");
            });
            e.HasKey(x => x.id);
            e.Property(x => x.id).ValueGeneratedOnAdd();
            // ROWID / tgl_spl2 etc. are NOT NULL but carry SQL defaults (newid(), getdate()).
            // ROWID is deliberately absent from the entity so INSERTs let the default fill it.
        });

        builder.Entity<SdmApproval>(e =>
        {
            e.HasNoKey();
            e.ToView("vw_web_sdm_approval", "dbo");
            e.Property(x => x.KodePegawai).HasColumnName("kode_pegawai");
            e.Property(x => x.KodeAtasan).HasColumnName("kode_atasan");
            e.Property(x => x.NamaAtasan).HasColumnName("nama_atasan");
            e.Property(x => x.Urut).HasColumnName("urut");
            e.Property(x => x.Status).HasColumnName("STATUS");
        });
    }
}
