using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Models;
using SsoBackend.Models.Approval;
using SsoBackend.Models.Aset;
using SsoBackend.Models.Coaching;
using SsoBackend.Models.Cuti;
using SsoBackend.Models.Dinas;
using SsoBackend.Models.Gaji;
using SsoBackend.Models.Kpi;
using SsoBackend.Models.Office;
using SsoBackend.Models.Prosedur;
using SsoBackend.Models.Health;

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
    public DbSet<DinasBukti> DinasBukti => Set<DinasBukti>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<ModuleAccess> ModuleAccess => Set<ModuleAccess>();
    public DbSet<FeatureAccess> FeatureAccess => Set<FeatureAccess>();
    public DbSet<Tugas> Tugas => Set<Tugas>();
    // My Office (schema office) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<Surat> Surat => Set<Surat>();
    public DbSet<SuratPj> SuratPj => Set<SuratPj>();
    public DbSet<SuratDistribusi> SuratDistribusi => Set<SuratDistribusi>();
    public DbSet<SuratLampiran> SuratLampiran => Set<SuratLampiran>();
    public DbSet<SuratRiwayat> SuratRiwayat => Set<SuratRiwayat>();
    public DbSet<SuratDibaca> SuratDibaca => Set<SuratDibaca>();
    public DbSet<RefJenisSurat> RefJenisSurat => Set<RefJenisSurat>();
    public DbSet<RefBagian> RefBagian => Set<RefBagian>();
    public DbSet<RefKlasifikasi> RefKlasifikasi => Set<RefKlasifikasi>();
    public DbSet<RefBagianUnit> RefBagianUnit => Set<RefBagianUnit>();
    public DbSet<SuratTindakLanjut> SuratTindakLanjut => Set<SuratTindakLanjut>();
    public DbSet<Notifikasi> Notifikasi => Set<Notifikasi>();
    // Cuti (schema cuti) — sistem cuti MyGCS baru, dikelola manual (raw SQL).
    public DbSet<CutiSaldo> CutiSaldo => Set<CutiSaldo>();
    public DbSet<CutiPengajuan> CutiPengajuan => Set<CutiPengajuan>();
    public DbSet<CutiSetelan> CutiSetelan => Set<CutiSetelan>();
    public DbSet<CutiBersama> CutiBersama => Set<CutiBersama>();
    public DbSet<CutiNasional> CutiNasional => Set<CutiNasional>();
    // Persetujuan terpadu (schema approval).
    public DbSet<ApprovalPengajuan> ApprovalPengajuan => Set<ApprovalPengajuan>();
    // Slip Gaji (schema gaji) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<GajiKomponen> GajiKomponen => Set<GajiKomponen>();
    public DbSet<GajiTarif> GajiTarif => Set<GajiTarif>();
    public DbSet<GajiTarifTunggal> GajiTarifTunggal => Set<GajiTarifTunggal>();
    public DbSet<GajiPeriode> GajiPeriode => Set<GajiPeriode>();
    public DbSet<GajiSlip> GajiSlip => Set<GajiSlip>();
    public DbSet<GajiSlipDetail> GajiSlipDetail => Set<GajiSlipDetail>();
    // My Progress (schema kpi) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<Kpi> Kpi => Set<Kpi>();
    // My Asset (schema aset) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<Aset> Aset => Set<Aset>();
    public DbSet<AsetMaintenance> AsetMaintenance => Set<AsetMaintenance>();
    // Coaching My Team (schema coaching) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<CoachingSesi> CoachingSesi => Set<CoachingSesi>();
    public DbSet<CoachingPesan> CoachingPesan => Set<CoachingPesan>();
    public DbSet<CoachingTindakLanjut> CoachingTindakLanjut => Set<CoachingTindakLanjut>();
    public DbSet<CoachingBaca> CoachingBaca => Set<CoachingBaca>();
    // My Prosedur (schema prosedur) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<ProsedurDokumen> ProsedurDokumen => Set<ProsedurDokumen>();
    public DbSet<ProsedurVersi> ProsedurVersi => Set<ProsedurVersi>();
    public DbSet<ProsedurAcknowledgement> ProsedurAcknowledgement => Set<ProsedurAcknowledgement>();
    public DbSet<ProsedurDokumenKompartemen> ProsedurDokumenKompartemen => Set<ProsedurDokumenKompartemen>();

    // My Health (schema health) — dikelola manual (raw SQL), EF baca/tulis saja.
    public DbSet<HealthPeriode> HealthPeriode => Set<HealthPeriode>();
    public DbSet<HealthHasil> HealthHasil => Set<HealthHasil>();

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

        // Akses modul portal (lihat ModuleAccess.cs). Hanya berisi modul yang pernah diubah
        // Admin IT; sisanya memakai bawaan ModuleCatalog. Dibaca ModuleAccessService.
        builder.Entity<ModuleAccess>(e =>
        {
            e.ToTable("module_access");
            e.HasKey(x => x.ModuleKey);
            e.Property(x => x.ModuleKey).HasMaxLength(50);
            e.Property(x => x.Access).HasMaxLength(20).IsRequired();
            e.Property(x => x.UpdatedBy).HasMaxLength(256);
            e.Property(x => x.Label).HasMaxLength(100);
            e.Property(x => x.Subtitle).HasMaxLength(200);
            e.Property(x => x.Icon).HasMaxLength(50);
            e.Property(x => x.LogoPath).HasMaxLength(300);
            e.Property(x => x.CreatedBy).HasMaxLength(256);
        });

        // Akses fitur (item menu sidebar) per modul — lihat FeatureAccess.cs / FeatureCatalog.
        builder.Entity<FeatureAccess>(e =>
        {
            e.ToTable("feature_access");
            e.HasKey(x => x.FeatureKey);
            e.Property(x => x.FeatureKey).HasMaxLength(80);
            e.Property(x => x.UpdatedBy).HasMaxLength(256);
        });

        // Bukti perjalanan dinas (rentang km + foto lokasi) UMDL/SPPD - lihat DinasBukti.cs.
        // Tabel dikelola raw SQL (docs/dinas-bukti-schema.sql) - ExcludeFromMigrations.
        builder.Entity<DinasBukti>(e =>
        {
            e.ToTable("bukti", "dinas", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Jenis).HasColumnName("jenis");
            e.Property(x => x.RefId).HasColumnName("ref_id");
            e.Property(x => x.IdKaryawan).HasColumnName("id_karyawan");
            e.Property(x => x.RentangKm).HasColumnName("rentang_km");
            e.Property(x => x.Foto).HasColumnName("foto");
            e.Property(x => x.Lat).HasColumnName("lat").HasPrecision(9, 6);
            e.Property(x => x.Lng).HasColumnName("lng").HasPrecision(9, 6);
            e.Property(x => x.Accuracy).HasColumnName("accuracy").HasPrecision(9, 2);
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
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
            e.Property(x => x.KodeBagian).HasColumnName("kode_bagian");
            e.Property(x => x.KodeKlasifikasi).HasColumnName("kode_klasifikasi");
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

        builder.Entity<Notifikasi>(e =>
        {
            e.ToTable("notifikasi", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Judul).HasColumnName("judul");
            e.Property(x => x.IdSurat).HasColumnName("id_surat");
            e.Property(x => x.OlehNik).HasColumnName("oleh_nik");
            e.Property(x => x.OlehNama).HasColumnName("oleh_nama");
            e.Property(x => x.OlehJabatan).HasColumnName("oleh_jabatan");
            e.Property(x => x.DibacaPada).HasColumnName("dibaca_pada");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
        });

        builder.Entity<SuratTindakLanjut>(e =>
        {
            e.ToTable("surat_tindak_lanjut", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSurat).HasColumnName("id_surat");
            e.Property(x => x.Keterangan).HasColumnName("keterangan");
            e.Property(x => x.DariNik).HasColumnName("dari_nik");
            e.Property(x => x.DariNama).HasColumnName("dari_nama");
            e.Property(x => x.UntukNik).HasColumnName("untuk_nik");
            e.Property(x => x.UntukNama).HasColumnName("untuk_nama");
            e.Property(x => x.Catatan).HasColumnName("catatan");
            e.Property(x => x.NamaLampiran).HasColumnName("nama_lampiran");
            e.Property(x => x.PathLampiran).HasColumnName("path_lampiran");
            e.Property(x => x.Ukuran).HasColumnName("ukuran");
            e.Property(x => x.Tipe).HasColumnName("tipe");
            e.Property(x => x.Tgl).HasColumnName("tgl");
        });

        // Master kode surat (diisi lewat docs/office-kode-surat.sql, aplikasi hanya membaca).
        builder.Entity<RefJenisSurat>(e =>
        {
            e.ToTable("ref_jenis_surat", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Kode);
            e.Property(x => x.Kode).HasColumnName("kode");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Urutan).HasColumnName("urutan");
            e.Property(x => x.Aktif).HasColumnName("aktif");
        });

        builder.Entity<RefBagian>(e =>
        {
            e.ToTable("ref_bagian", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Kode);
            e.Property(x => x.Kode).HasColumnName("kode");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Urutan).HasColumnName("urutan");
            e.Property(x => x.Aktif).HasColumnName("aktif");
        });

        builder.Entity<RefKlasifikasi>(e =>
        {
            e.ToTable("ref_klasifikasi", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Kode);
            e.Property(x => x.Kode).HasColumnName("kode");
            e.Property(x => x.Kelompok).HasColumnName("kelompok");
            e.Property(x => x.Masalah).HasColumnName("masalah");
            e.Property(x => x.Aktif).HasColumnName("aktif");
        });

        builder.Entity<RefBagianUnit>(e =>
        {
            e.ToTable("ref_bagian_unit", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.NamaUnit);
            e.Property(x => x.NamaUnit).HasColumnName("nama_unit");
            e.Property(x => x.KodeBagian).HasColumnName("kode_bagian");
            e.Property(x => x.Tingkat).HasColumnName("tingkat");
        });

        builder.Entity<SuratDibaca>(e =>
        {
            e.ToTable("surat_dibaca", "office", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.IdSurat, x.Nik });
            e.Property(x => x.IdSurat).HasColumnName("id_surat");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.DibacaPada).HasColumnName("dibaca_pada");
        });

        builder.Entity<CutiSaldo>(e =>
        {
            e.ToTable("saldo", "cuti", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdKaryawan).HasColumnName("id_karyawan");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Tmt).HasColumnName("tmt");
            e.Property(x => x.Periode).HasColumnName("periode");
            e.Property(x => x.Akrual).HasColumnName("akrual");
            e.Property(x => x.Hak).HasColumnName("hak");
            e.Property(x => x.CutiBersama).HasColumnName("cuti_bersama");
            e.Property(x => x.Diambil).HasColumnName("diambil");
            e.Property(x => x.Saldo).HasColumnName("saldo");
            e.Property(x => x.TglCutoff).HasColumnName("tgl_cutoff");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
            e.Property(x => x.DiperbaruiPada).HasColumnName("diperbarui_pada");
        });

        builder.Entity<CutiSetelan>(e =>
        {
            e.ToTable("setelan", "cuti", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.HakDasar).HasColumnName("hak_dasar");
            e.Property(x => x.CutiBersama).HasColumnName("cuti_bersama");
            e.Property(x => x.HakPerTahun).HasColumnName("hak_per_tahun");
            e.Property(x => x.BatasAkumulasi).HasColumnName("batas_akumulasi");
            e.Property(x => x.DiperbaruiPada).HasColumnName("diperbarui_pada");
            e.Property(x => x.DiperbaruiOleh).HasColumnName("diperbarui_oleh");
        });

        builder.Entity<CutiBersama>(e =>
        {
            e.ToTable("cuti_bersama", "cuti", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TglMulai).HasColumnName("tgl_mulai");
            e.Property(x => x.TglSelesai).HasColumnName("tgl_selesai");
            e.Property(x => x.JumlahHari).HasColumnName("jumlah_hari");
            e.Property(x => x.Keterangan).HasColumnName("keterangan");
            e.Property(x => x.MengurangiHak).HasColumnName("mengurangi_hak");
            e.Property(x => x.Tahun).HasColumnName("tahun");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.NamaPembuat).HasColumnName("nama_pembuat");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
            e.Property(x => x.DiubahPada).HasColumnName("diubah_pada");
        });

        builder.Entity<CutiNasional>(e =>
        {
            e.ToTable("cuti_nasional", "cuti", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TglMulai).HasColumnName("tgl_mulai");
            e.Property(x => x.TglSelesai).HasColumnName("tgl_selesai");
            e.Property(x => x.JumlahHari).HasColumnName("jumlah_hari");
            e.Property(x => x.Keterangan).HasColumnName("keterangan");
            e.Property(x => x.Tahun).HasColumnName("tahun");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.NamaPembuat).HasColumnName("nama_pembuat");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
            e.Property(x => x.DiubahPada).HasColumnName("diubah_pada");
        });

        builder.Entity<CutiPengajuan>(e =>
        {
            e.ToTable("pengajuan", "cuti", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdKaryawan).HasColumnName("id_karyawan");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.IdAtasan).HasColumnName("id_atasan");
            e.Property(x => x.TglMulai).HasColumnName("tgl_mulai");
            e.Property(x => x.TglSelesai).HasColumnName("tgl_selesai");
            e.Property(x => x.JumlahHari).HasColumnName("jumlah_hari");
            e.Property(x => x.Keterangan).HasColumnName("keterangan");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Komentar).HasColumnName("komentar");
            e.Property(x => x.TglPengajuan).HasColumnName("tgl_pengajuan");
            e.Property(x => x.TglKeputusan).HasColumnName("tgl_keputusan");
        });

        builder.Entity<ApprovalPengajuan>(e =>
        {
            e.ToTable("pengajuan", "approval", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Jenis).HasColumnName("jenis");
            e.Property(x => x.RefId).HasColumnName("ref_id");
            e.Property(x => x.IdKaryawan).HasColumnName("id_karyawan");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.IdManager).HasColumnName("id_manager");
            e.Property(x => x.IdAtasan).HasColumnName("id_atasan");
            e.Property(x => x.Ringkasan).HasColumnName("ringkasan");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Komentar).HasColumnName("komentar");
            e.Property(x => x.TglPengajuan).HasColumnName("tgl_pengajuan");
            e.Property(x => x.TglKeputusan).HasColumnName("tgl_keputusan");
        });

        builder.Entity<GajiKomponen>(e =>
        {
            e.ToTable("komponen", "gaji", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.IdKomponen);
            e.Property(x => x.IdKomponen).HasColumnName("id_komponen");
            e.Property(x => x.Kode).HasColumnName("kode");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Tipe).HasColumnName("tipe");
            e.Property(x => x.Kategori).HasColumnName("kategori");
            e.Property(x => x.Basis).HasColumnName("basis");
            e.Property(x => x.Opsional).HasColumnName("opsional");
            e.Property(x => x.KenaPotonganTerlambat).HasColumnName("kena_potongan_terlambat");
            e.Property(x => x.Urutan).HasColumnName("urutan");
            e.Property(x => x.Aktif).HasColumnName("aktif");
            e.Property(x => x.Keterangan).HasColumnName("keterangan");
            e.Property(x => x.GrupKode).HasColumnName("grup_kode");
            e.Property(x => x.GrupLabel).HasColumnName("grup_label");
            e.Property(x => x.FormulaPersen).HasColumnName("formula_persen").HasPrecision(7, 4);
            e.Property(x => x.FormulaBatas).HasColumnName("formula_batas").HasPrecision(18, 2);
            e.Property(x => x.NilaiFlat).HasColumnName("nilai_flat").HasPrecision(18, 2);
            e.Property(x => x.MasukTotal).HasColumnName("masuk_total");
        });

        builder.Entity<GajiTarif>(e =>
        {
            e.ToTable("tarif", "gaji", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdKomponen).HasColumnName("id_komponen");
            e.Property(x => x.Jg).HasColumnName("jg");
            e.Property(x => x.Pg).HasColumnName("pg");
            e.Property(x => x.TahunBerlaku).HasColumnName("tahun_berlaku");
            e.Property(x => x.Nominal).HasColumnName("nominal").HasPrecision(18, 2);
        });

        builder.Entity<GajiTarifTunggal>(e =>
        {
            e.ToTable("tarif_tunggal", "gaji", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdKomponen).HasColumnName("id_komponen");
            e.Property(x => x.Nilai).HasColumnName("nilai");
            e.Property(x => x.TahunBerlaku).HasColumnName("tahun_berlaku");
            e.Property(x => x.Nominal).HasColumnName("nominal").HasPrecision(18, 2);
        });

        builder.Entity<GajiPeriode>(e =>
        {
            e.ToTable("periode", "gaji", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.IdPeriode);
            e.Property(x => x.IdPeriode).HasColumnName("id_periode");
            e.Property(x => x.Tahun).HasColumnName("tahun");
            e.Property(x => x.Bulan).HasColumnName("bulan");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
        });

        builder.Entity<GajiSlip>(e =>
        {
            e.ToTable("slip", "gaji", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.IdSlip);
            e.Property(x => x.IdSlip).HasColumnName("id_slip");
            e.Property(x => x.IdPeriode).HasColumnName("id_periode");
            e.Property(x => x.IdKaryawan).HasColumnName("id_karyawan");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Jg).HasColumnName("jg");
            e.Property(x => x.Pg).HasColumnName("pg");
            e.Property(x => x.IdBand).HasColumnName("id_band");
            e.Property(x => x.Tingkatan).HasColumnName("tingkatan");
            e.Property(x => x.Jabatan).HasColumnName("jabatan");
            e.Property(x => x.PotonganTerlambat).HasColumnName("potongan_terlambat").HasPrecision(18, 2);
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.DibuatPada).HasColumnName("dibuat_pada");
        });

        builder.Entity<GajiSlipDetail>(e =>
        {
            e.ToTable("slip_detail", "gaji", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSlip).HasColumnName("id_slip");
            e.Property(x => x.IdKomponen).HasColumnName("id_komponen");
            e.Property(x => x.Nominal).HasColumnName("nominal").HasPrecision(18, 2);
        });

        builder.Entity<Kpi>(e =>
        {
            e.ToTable("kpi", "kpi", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Periode).HasColumnName("periode");
            e.Property(x => x.Judul).HasColumnName("judul");
            e.Property(x => x.Deskripsi).HasColumnName("deskripsi");
            e.Property(x => x.Satuan).HasColumnName("satuan");
            e.Property(x => x.Target).HasColumnName("target").HasPrecision(18, 2);
            e.Property(x => x.Realisasi).HasColumnName("realisasi").HasPrecision(18, 2);
            e.Property(x => x.Bobot).HasColumnName("bobot").HasPrecision(5, 2);
            e.Property(x => x.Level).HasColumnName("level");
            e.Property(x => x.IdPemilik).HasColumnName("id_pemilik");
            e.Property(x => x.NamaPemilik).HasColumnName("nama_pemilik");
            e.Property(x => x.IdParent).HasColumnName("id_parent");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.NamaPembuat).HasColumnName("nama_pembuat");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Catatan).HasColumnName("catatan");
            e.Property(x => x.TglDibuat).HasColumnName("tgl_dibuat");
            e.Property(x => x.TglDiubah).HasColumnName("tgl_diubah");
        });

        builder.Entity<Aset>(e =>
        {
            e.ToTable("aset", "aset", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Kode).HasColumnName("kode");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Kategori).HasColumnName("kategori");
            e.Property(x => x.Merk).HasColumnName("merk");
            e.Property(x => x.NomorSeri).HasColumnName("nomor_seri");
            e.Property(x => x.Lokasi).HasColumnName("lokasi");
            e.Property(x => x.IdPic).HasColumnName("id_pic");
            e.Property(x => x.NamaPic).HasColumnName("nama_pic");
            e.Property(x => x.Kondisi).HasColumnName("kondisi");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Nilai).HasColumnName("nilai").HasPrecision(18, 2);
            e.Property(x => x.TglPerolehan).HasColumnName("tgl_perolehan");
            e.Property(x => x.Catatan).HasColumnName("catatan");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.TglDibuat).HasColumnName("tgl_dibuat");
            e.Property(x => x.TglDiubah).HasColumnName("tgl_diubah");
        });

        builder.Entity<AsetMaintenance>(e =>
        {
            e.ToTable("maintenance", "aset", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdAset).HasColumnName("id_aset");
            e.Property(x => x.Jenis).HasColumnName("jenis");
            e.Property(x => x.TglJadwal).HasColumnName("tgl_jadwal");
            e.Property(x => x.TglSelesai).HasColumnName("tgl_selesai");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Pelaksana).HasColumnName("pelaksana");
            e.Property(x => x.Biaya).HasColumnName("biaya").HasPrecision(18, 2);
            e.Property(x => x.Catatan).HasColumnName("catatan");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.TglDibuat).HasColumnName("tgl_dibuat");
        });

        builder.Entity<CoachingSesi>(e =>
        {
            e.ToTable("sesi", "coaching", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdAtasan).HasColumnName("id_atasan");
            e.Property(x => x.NamaAtasan).HasColumnName("nama_atasan");
            e.Property(x => x.IdBawahan).HasColumnName("id_bawahan");
            e.Property(x => x.NamaBawahan).HasColumnName("nama_bawahan");
            e.Property(x => x.Topik).HasColumnName("topik");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.TglDibuat).HasColumnName("tgl_dibuat");
            e.Property(x => x.TglTerakhir).HasColumnName("tgl_terakhir");
        });

        builder.Entity<CoachingPesan>(e =>
        {
            e.ToTable("pesan", "coaching", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSesi).HasColumnName("id_sesi");
            e.Property(x => x.RuangNik).HasColumnName("ruang_nik");
            e.Property(x => x.IdPengirim).HasColumnName("id_pengirim");
            e.Property(x => x.NamaPengirim).HasColumnName("nama_pengirim");
            e.Property(x => x.Isi).HasColumnName("isi");
            e.Property(x => x.TglKirim).HasColumnName("tgl_kirim");
        });

        builder.Entity<CoachingTindakLanjut>(e =>
        {
            e.ToTable("tindak_lanjut", "coaching", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdSesi).HasColumnName("id_sesi");
            e.Property(x => x.Isi).HasColumnName("isi");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.TglDibuat).HasColumnName("tgl_dibuat");
            e.Property(x => x.TglSelesai).HasColumnName("tgl_selesai");
        });

        builder.Entity<CoachingBaca>(e =>
        {
            e.ToTable("baca", "coaching", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.Nik, x.Kanal });
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Kanal).HasColumnName("kanal");
            e.Property(x => x.TglBaca).HasColumnName("tgl_baca");
        });

        builder.Entity<ProsedurDokumen>(e =>
        {
            e.ToTable("dokumen", "prosedur", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Kode).HasColumnName("kode");
            e.Property(x => x.Judul).HasColumnName("judul");
            e.Property(x => x.Jenis).HasColumnName("jenis");
            e.Property(x => x.Unit).HasColumnName("unit");
            e.Property(x => x.Kategori).HasColumnName("kategori");
            e.Property(x => x.Deskripsi).HasColumnName("deskripsi");
            e.Property(x => x.SemuaKompartemen).HasColumnName("semua_kompartemen");
            e.Property(x => x.Lingkup).HasColumnName("lingkup");
            e.Property(x => x.IdUnitPemilik).HasColumnName("id_unit_pemilik");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.TglDibuat).HasColumnName("tgl_dibuat");
            e.Property(x => x.TglDiubah).HasColumnName("tgl_diubah");
        });

        builder.Entity<ProsedurDokumenKompartemen>(e =>
        {
            e.ToTable("dokumen_kompartemen", "prosedur", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdDokumen).HasColumnName("id_dokumen");
            e.Property(x => x.Kompartemen).HasColumnName("kompartemen");
        });

        builder.Entity<ProsedurVersi>(e =>
        {
            e.ToTable("versi", "prosedur", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdDokumen).HasColumnName("id_dokumen");
            e.Property(x => x.Versi).HasColumnName("versi");
            e.Property(x => x.Ringkasan).HasColumnName("ringkasan");
            e.Property(x => x.NamaFile).HasColumnName("nama_file");
            e.Property(x => x.TipeFile).HasColumnName("tipe_file");
            e.Property(x => x.Konten).HasColumnName("konten");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.TglBerlaku).HasColumnName("tgl_berlaku");
            e.Property(x => x.IdPenerbit).HasColumnName("id_penerbit");
            e.Property(x => x.NamaPenerbit).HasColumnName("nama_penerbit");
            e.Property(x => x.TglUnggah).HasColumnName("tgl_unggah");
        });

        builder.Entity<ProsedurAcknowledgement>(e =>
        {
            e.ToTable("acknowledgement", "prosedur", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdVersi).HasColumnName("id_versi");
            e.Property(x => x.IdDokumen).HasColumnName("id_dokumen");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Tgl).HasColumnName("tgl");
        });

        builder.Entity<HealthPeriode>(e =>
        {
            e.ToTable("periode", "health", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Judul).HasColumnName("judul");
            e.Property(x => x.Tahun).HasColumnName("tahun");
            e.Property(x => x.Penyelenggara).HasColumnName("penyelenggara");
            e.Property(x => x.Lokasi).HasColumnName("lokasi");
            e.Property(x => x.TglMulai).HasColumnName("tgl_mulai");
            e.Property(x => x.TglSelesai).HasColumnName("tgl_selesai");
            e.Property(x => x.Catatan).HasColumnName("catatan");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.IdPembuat).HasColumnName("id_pembuat");
            e.Property(x => x.TglDibuat).HasColumnName("tgl_dibuat");
            e.Property(x => x.TglDiubah).HasColumnName("tgl_diubah");
        });

        builder.Entity<HealthHasil>(e =>
        {
            e.ToTable("hasil", "health", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdPeriode).HasColumnName("id_periode");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.TglPemeriksaan).HasColumnName("tgl_pemeriksaan");
            e.Property(x => x.Tinggi).HasColumnName("tinggi");
            e.Property(x => x.Berat).HasColumnName("berat");
            e.Property(x => x.TekananDarah).HasColumnName("tekanan_darah");
            e.Property(x => x.StatusUmum).HasColumnName("status_umum");
            e.Property(x => x.Ringkasan).HasColumnName("ringkasan");
            e.Property(x => x.Rekomendasi).HasColumnName("rekomendasi");
            e.Property(x => x.StatusTindakLanjut).HasColumnName("status_tindak_lanjut");
            e.Property(x => x.NamaFile).HasColumnName("nama_file");
            e.Property(x => x.TipeFile).HasColumnName("tipe_file");
            e.Property(x => x.Konten).HasColumnName("konten");
            e.Property(x => x.IdPencatat).HasColumnName("id_pencatat");
            e.Property(x => x.NamaPencatat).HasColumnName("nama_pencatat");
            e.Property(x => x.TglDicatat).HasColumnName("tgl_dicatat");
            e.Property(x => x.TglDiubah).HasColumnName("tgl_diubah");
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
