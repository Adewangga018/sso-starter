using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Models;
using SsoBackend.Models.Office;

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
    // My Office (schema office) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<Surat> Surat => Set<Surat>();
    public DbSet<SuratPj> SuratPj => Set<SuratPj>();
    public DbSet<SuratDistribusi> SuratDistribusi => Set<SuratDistribusi>();
    public DbSet<SuratLampiran> SuratLampiran => Set<SuratLampiran>();
    public DbSet<SuratRiwayat> SuratRiwayat => Set<SuratRiwayat>();

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

        // My Office (schema office). Tabel dikelola manual (raw SQL) — ExcludeFromMigrations.
        builder.Entity<Surat>(e =>
        {
            e.ToTable("surat", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Nomor).HasColumnName("nomor");
            e.Property(x => x.Jenis).HasColumnName("jenis");
            e.Property(x => x.Klasifikasi).HasColumnName("klasifikasi");
            e.Property(x => x.Sifat).HasColumnName("sifat");
            e.Property(x => x.Kecepatan).HasColumnName("kecepatan");
            e.Property(x => x.Judul).HasColumnName("judul");
            e.Property(x => x.Keterangan).HasColumnName("keterangan");
            e.Property(x => x.Isi).HasColumnName("isi");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.PembuatNik).HasColumnName("pembuat_nik");
            e.Property(x => x.PembuatNama).HasColumnName("pembuat_nama");
            e.Property(x => x.TanggalSurat).HasColumnName("tanggal_surat");
            e.Property(x => x.BerlakuMulai).HasColumnName("berlaku_mulai");
            e.Property(x => x.BerlakuSampai).HasColumnName("berlaku_sampai");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
            e.Property(x => x.DiperbaruiPada).HasColumnName("diperbarui_pada");

            e.HasMany(x => x.PenanggungJawab).WithOne().HasForeignKey(x => x.IdSurat).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Distribusi).WithOne().HasForeignKey(x => x.IdSurat).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Lampiran).WithOne().HasForeignKey(x => x.IdSurat).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Riwayat).WithOne().HasForeignKey(x => x.IdSurat).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<SuratPj>(e =>
        {
            e.ToTable("surat_pj", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSurat).HasColumnName("id_surat");
            e.Property(x => x.Peran).HasColumnName("peran");
            e.Property(x => x.Urutan).HasColumnName("urutan");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Jabatan).HasColumnName("jabatan");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Komentar).HasColumnName("komentar");
            e.Property(x => x.Tgl).HasColumnName("tgl");
        });

        builder.Entity<SuratDistribusi>(e =>
        {
            e.ToTable("surat_distribusi", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSurat).HasColumnName("id_surat");
            e.Property(x => x.Tipe).HasColumnName("tipe");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Jabatan).HasColumnName("jabatan");
        });

        builder.Entity<SuratLampiran>(e =>
        {
            e.ToTable("surat_lampiran", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSurat).HasColumnName("id_surat");
            e.Property(x => x.NamaFile).HasColumnName("nama_file");
            e.Property(x => x.Path).HasColumnName("path");
            e.Property(x => x.Ukuran).HasColumnName("ukuran");
            e.Property(x => x.Tipe).HasColumnName("tipe");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
        });

        builder.Entity<SuratRiwayat>(e =>
        {
            e.ToTable("surat_riwayat", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSurat).HasColumnName("id_surat");
            e.Property(x => x.Aksi).HasColumnName("aksi");
            e.Property(x => x.OlehNik).HasColumnName("oleh_nik");
            e.Property(x => x.OlehNama).HasColumnName("oleh_nama");
            e.Property(x => x.Catatan).HasColumnName("catatan");
            e.Property(x => x.Tgl).HasColumnName("tgl");
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
