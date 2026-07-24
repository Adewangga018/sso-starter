using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SsoBackend.Models.Gcs;

namespace SsoBackend.Data;

// Onto the live GCS database (dbo + easy schemas) via GcsConnection - NOT db_mygcs. The
// employee master, attendance, overtime and approval objects must stay in the SDM system,
// so they are read where they live. No migrations are ever generated or run against this
// context - every table here already exists and is owned by other systems. Everything is
// read-only except web_sdm_spl, which employees submit into.
public class GcsDbContext : DbContext
{
    public GcsDbContext(DbContextOptions<GcsDbContext> options) : base(options)
    {
    }

    public DbSet<MstPegawai> MstPegawai => Set<MstPegawai>();
    public DbSet<MstAnakPegawai> MstAnakPegawai => Set<MstAnakPegawai>();
    public DbSet<EasyUser> EasyUsers => Set<EasyUser>();
    public DbSet<AbsensiLog> AbsensiLog => Set<AbsensiLog>();
    public DbSet<WebSdmSpl> WebSdmSpl => Set<WebSdmSpl>();
    public DbSet<SdmApproval> SdmApproval => Set<SdmApproval>();
    public DbSet<WebSdmSuratIjin> WebSdmSuratIjin => Set<WebSdmSuratIjin>();
    public DbSet<PegawaiSdm> PegawaiSdm => Set<PegawaiSdm>();
    public DbSet<TtdElektronik> TtdElektronik => Set<TtdElektronik>();
    public DbSet<WebSdmSppd> WebSdmSppd => Set<WebSdmSppd>();
    public DbSet<WebSdmSppdDetail> WebSdmSppdDetail => Set<WebSdmSppdDetail>();
    public DbSet<WebSdmUmdl> WebSdmUmdl => Set<WebSdmUmdl>();
    public DbSet<WebSdmPesanTiket> WebSdmPesanTiket => Set<WebSdmPesanTiket>();
    public DbSet<WebSdmPesanTiketDetail> WebSdmPesanTiketDetail => Set<WebSdmPesanTiketDetail>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
        // Kunci tabel legacy SDM bertipe numeric(25,0). Presisinya sudah dicocokkan di
        // OnModelCreating, sehingga peringatan "decimal type key" hanya derau — diabaikan
        // agar log startup bersih (tetap aman: presisi model = kolom DB).
        optionsBuilder.ConfigureWarnings(w => w.Ignore(SqlServerEventId.DecimalTypeKeyWarning));
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
            // Kolom asli numeric(25,0); cocokkan agar tidak terpotong & hilang warning EF.
            e.Property(x => x.id).ValueGeneratedOnAdd().HasPrecision(25, 0);
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
            e.Property(x => x.TitleKepada).HasColumnName("title_kepada");
            e.Property(x => x.Urut).HasColumnName("urut");
            e.Property(x => x.Status).HasColumnName("STATUS");
        });

        builder.Entity<WebSdmSuratIjin>(e =>
        {
            // Legacy triggers on this table: declaring them makes EF use the trigger-safe
            // INSERT path (SQL Server forbids an OUTPUT clause on a table with triggers).
            // web_sdm_surat_ijin_tri fills kode_ijin; web_sdm_surat_ijin_tru posts approved
            // leave into the attendance/payroll tables in GCSSDM.
            e.ToTable("web_sdm_surat_ijin", "dbo", tb =>
            {
                tb.HasTrigger("web_sdm_surat_ijin_tri");
                tb.HasTrigger("web_sdm_surat_ijin_tru");
            });
            e.HasKey(x => x.id);
            e.Property(x => x.id).ValueGeneratedOnAdd().HasPrecision(25, 0);
            // tgl_input carries a getdate() default; kode_ijin is filled by the INSERT trigger.
        });

        builder.Entity<PegawaiSdm>(e =>
        {
            e.HasNoKey();
            // There is also an unrelated easy.PEGAWAI_SDM view - this must stay pinned to dbo.
            e.ToView("PEGAWAI_SDM", "dbo");
        });

        builder.Entity<WebSdmSppd>(e =>
        {
            // web_sdm_sppd_tri rewrites kode_sppd after the INSERT, so EF must use the
            // trigger-safe path (no OUTPUT clause).
            e.ToTable("web_sdm_sppd", "intranet", tb =>
            {
                tb.HasTrigger("web_sdm_sppd_tri");
                tb.HasTrigger("web_sdm_sppd_tru");
            });
            e.HasKey(x => x.id);
            e.Property(x => x.id).ValueGeneratedOnAdd();
        });

        builder.Entity<WebSdmSppdDetail>(e =>
        {
            e.ToTable("web_sdm_sppd_detail", "intranet", tb =>
            {
                tb.HasTrigger("web_sdm_sppd_detail_triu");
            });
            // id_det is the identity key; "id" is the parent SPPD id, not a key.
            e.HasKey(x => x.id_det);
            e.Property(x => x.id_det).ValueGeneratedOnAdd();

            // The database DOES have a foreign key here (FK__web_sdm_sppd__id__...). It must be
            // declared, otherwise EF has no idea the two are related and is free to delete the
            // parent SPPD before its detail rows - which the FK then rejects, surfacing as a 500.
            e.HasOne<WebSdmSppd>()
                .WithMany()
                .HasForeignKey(x => x.id)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WebSdmPesanTiket>(e =>
        {
            // web_sdm_pesan_tiket_tri rewrites kode_tiket after the INSERT, so EF must use
            // the trigger-safe path (no OUTPUT clause).
            e.ToTable("web_sdm_pesan_tiket", "intranet", tb =>
            {
                tb.HasTrigger("web_sdm_pesan_tiket_tri");
            });
            e.HasKey(x => x.id);
            e.Property(x => x.id).ValueGeneratedOnAdd();
        });

        builder.Entity<WebSdmPesanTiketDetail>(e =>
        {
            e.ToTable("web_sdm_pesan_tiket_detail", "intranet");
            // id_det is the identity key; "id" is the parent booking id, not a key.
            e.HasKey(x => x.id_det);
            e.Property(x => x.id_det).ValueGeneratedOnAdd();
        });

        builder.Entity<WebSdmUmdl>(e =>
        {
            e.ToTable("web_sdm_umdl", "dbo", tb =>
            {
                tb.HasTrigger("web_sdm_umdl_tru");
            });
            e.HasKey(x => x.ID);
            // Kolom asli numeric(25,0) — sebelumnya salah (13,0) dan berisiko truncation.
            e.Property(x => x.ID).ValueGeneratedOnAdd().HasPrecision(25, 0);
            e.Property(x => x.ID_IJIN).HasPrecision(25, 0);
            // ROWID is NOT NULL with a newid() default and is absent from the entity on
            // purpose, so INSERTs let the database fill it.
        });

        builder.Entity<TtdElektronik>(e =>
        {
            e.ToTable("web_ttd_elektronik", "intranet");
            e.HasKey(x => x.id);
            e.Property(x => x.id).ValueGeneratedOnAdd();
            // kode_link carries a newid() default, so it is filled by the database on INSERT.
            e.Property(x => x.kode_link).ValueGeneratedOnAdd();
        });
    }
}
