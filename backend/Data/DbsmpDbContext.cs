using Microsoft.EntityFrameworkCore;
using SsoBackend.Models.Dbsmp;

namespace SsoBackend.Data;

// Onto the live SMP database (DBSMP) via DbsmpConnection - NOT db_mygcs. Master jenis
// surat dimiliki aplikasi SMP, jadi dibaca di tempatnya supaya dropdown My Office selalu
// ikut master itu tanpa sinkronisasi manual.
//
// SEPENUHNYA READ-ONLY: tidak ada migrasi yang dibuat/dijalankan terhadap context ini,
// dan seluruh tabelnya sudah ada serta dimiliki sistem lain.
public class DbsmpDbContext : DbContext
{
    public DbsmpDbContext(DbContextOptions<DbsmpDbContext> options) : base(options)
    {
    }

    public DbSet<SuratJenisDbsmp> SuratJenis => Set<SuratJenisDbsmp>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<SuratJenisDbsmp>(e =>
        {
            e.ToTable("TB_SURAT_JENIS", "dbo", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Kd);
            e.Property(x => x.Kd).HasColumnName("KD");
            e.Property(x => x.NamaJenis).HasColumnName("NM_JENIS");
            e.Property(x => x.Status).HasColumnName("STATUS");
            e.Property(x => x.Kode).HasColumnName("KODE");
        });
    }
}
