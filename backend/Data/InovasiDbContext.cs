using Microsoft.EntityFrameworkCore;
using SsoBackend.Models.Inovasi;

namespace SsoBackend.Data;

// Modul My Innovation (Sistem Saran / Gugus Inovasi Operasi). Hidup di db_mygcs
// (DefaultConnection, sama seperti Identity & grading) pada schema "inovasi".
//
// Tabel inovasi.* DIBUAT lewat skrip SQL idempoten
// (backend/Database/inovasi/01-schema-ddl.sql), BUKAN migrasi EF - persis pola
// skema grading. Karena itu TIDAK ada migrasi yang di-generate/di-run terhadap
// context ini; ia hanya memetakan tabel yang sudah ada. Tabel grading.* di sini
// juga read-only, dipakai untuk resolusi unit organisasi & pencarian pegawai.
public class InovasiDbContext : DbContext
{
    public InovasiDbContext(DbContextOptions<InovasiDbContext> options) : base(options)
    {
    }

    public DbSet<Gugus> Gugus => Set<Gugus>();
    public DbSet<Anggota> Anggota => Set<Anggota>();
    public DbSet<DataPendukung> DataPendukung => Set<DataPendukung>();
    public DbSet<Jadwal> Jadwal => Set<Jadwal>();
    public DbSet<Sasaran> Sasaran => Set<Sasaran>();
    public DbSet<Pareto> Pareto => Set<Pareto>();
    public DbSet<Qcdse> Qcdse => Set<Qcdse>();
    public DbSet<Fishbone> Fishbone => Set<Fishbone>();
    public DbSet<RencanaPerbaikan> RencanaPerbaikan => Set<RencanaPerbaikan>();
    public DbSet<Pengesahan> Pengesahan => Set<Pengesahan>();
    public DbSet<DoPelaksanaan> DoPelaksanaan => Set<DoPelaksanaan>();
    public DbSet<DoKendala> DoKendala => Set<DoKendala>();
    public DbSet<CheckPerbandingan> CheckPerbandingan => Set<CheckPerbandingan>();
    public DbSet<CheckSasaran> CheckSasaran => Set<CheckSasaran>();
    public DbSet<CheckBiaya> CheckBiaya => Set<CheckBiaya>();
    public DbSet<CheckRisiko> CheckRisiko => Set<CheckRisiko>();
    public DbSet<ActionStandarisasi> ActionStandarisasi => Set<ActionStandarisasi>();
    public DbSet<ActionTindakLanjut> ActionTindakLanjut => Set<ActionTindakLanjut>();

    // Sumbang Gagasan
    public DbSet<Gagasan> Gagasan => Set<Gagasan>();
    public DbSet<GagasanApproval> GagasanApproval => Set<GagasanApproval>();

    // grading read-models
    public DbSet<UnitOrganisasi> UnitOrganisasi => Set<UnitOrganisasi>();
    public DbSet<Jabatan> Jabatan => Set<Jabatan>();
    public DbSet<Penempatan> Penempatan => Set<Penempatan>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Gugus>(e =>
        {
            e.ToTable("gugus", "inovasi");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Jenis).HasColumnName("jenis");
            e.Property(x => x.NoRegistrasi).HasColumnName("no_registrasi");
            e.Property(x => x.NamaGugus).HasColumnName("nama_gugus");
            e.Property(x => x.TemaKe).HasColumnName("tema_ke");
            e.Property(x => x.Periode).HasColumnName("periode");
            e.Property(x => x.IdDepartemen).HasColumnName("id_departemen");
            e.Property(x => x.NamaDepartemen).HasColumnName("nama_departemen");
            e.Property(x => x.IdKompartemen).HasColumnName("id_kompartemen");
            e.Property(x => x.NamaKompartemen).HasColumnName("nama_kompartemen");
            e.Property(x => x.Judul).HasColumnName("judul");
            e.Property(x => x.LatarBelakang).HasColumnName("latar_belakang");
            e.Property(x => x.MasalahUtama).HasColumnName("masalah_utama");
            e.Property(x => x.VerifikasiAkar).HasColumnName("verifikasi_akar");
            e.Property(x => x.IdGagasan).HasColumnName("id_gagasan");
            e.Property(x => x.ActionTemaBerikutnya).HasColumnName("action_tema_berikutnya");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.PlanDisahkan).HasColumnName("plan_disahkan");
            e.Property(x => x.CreatedByNik).HasColumnName("created_by_nik");
            e.Property(x => x.CreatedByNama).HasColumnName("created_by_nama");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
        });

        MapChild<Anggota>(b, "anggota", e =>
        {
            e.Property(x => x.Peran).HasColumnName("peran");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Jabatan).HasColumnName("jabatan");
            e.Property(x => x.DepBagian).HasColumnName("dep_bagian");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.Anggota);

        MapChild<DataPendukung>(b, "data_pendukung", e =>
        {
            e.Property(x => x.Indikator).HasColumnName("indikator");
            e.Property(x => x.KondisiAwal).HasColumnName("kondisi_awal");
            e.Property(x => x.SumberKeterangan).HasColumnName("sumber_keterangan");
            e.Property(x => x.LampiranPath).HasColumnName("lampiran_path");
            e.Property(x => x.LampiranNama).HasColumnName("lampiran_nama");
            e.Property(x => x.LampiranLink).HasColumnName("lampiran_link");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.DataPendukung);

        MapChild<Jadwal>(b, "jadwal", e =>
        {
            e.Property(x => x.Tahapan).HasColumnName("tahapan");
            e.Property(x => x.Jenis).HasColumnName("jenis");
            e.Property(x => x.Bulan).HasColumnName("bulan");
            e.Property(x => x.Jumlah).HasColumnName("jumlah");
        }, g => g.Jadwal);

        MapChild<Sasaran>(b, "sasaran", e =>
        {
            e.Property(x => x.SasaranText).HasColumnName("sasaran");
            e.Property(x => x.KondisiSebelum).HasColumnName("kondisi_sebelum");
            e.Property(x => x.Target).HasColumnName("target");
            e.Property(x => x.Indikator).HasColumnName("indikator");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.Sasaran);

        MapChild<Pareto>(b, "pareto", e =>
        {
            e.Property(x => x.Kategori).HasColumnName("kategori");
            e.Property(x => x.Frekuensi).HasColumnName("frekuensi");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.Pareto);

        MapChild<Qcdse>(b, "qcdse", e =>
        {
            e.Property(x => x.Aspek).HasColumnName("aspek");
            e.Property(x => x.DampakKualitatif).HasColumnName("dampak_kualitatif");
            e.Property(x => x.DampakKuantitatif).HasColumnName("dampak_kuantitatif");
        }, g => g.Qcdse);

        MapChild<Fishbone>(b, "fishbone", e =>
        {
            e.Property(x => x.Faktor).HasColumnName("faktor");
            e.Property(x => x.Penyebab).HasColumnName("penyebab");
            e.Property(x => x.AkarDominan).HasColumnName("akar_dominan");
            e.Property(x => x.Prioritas).HasColumnName("prioritas");
        }, g => g.Fishbone);

        MapChild<RencanaPerbaikan>(b, "rencana_perbaikan", e =>
        {
            e.Property(x => x.AkarPenyebab).HasColumnName("akar_penyebab");
            e.Property(x => x.What).HasColumnName("what");
            e.Property(x => x.Why).HasColumnName("why");
            e.Property(x => x.Dimana).HasColumnName("where");
            e.Property(x => x.Kapan).HasColumnName("when");
            e.Property(x => x.Who).HasColumnName("who");
            e.Property(x => x.How).HasColumnName("how");
            e.Property(x => x.HowMuch).HasColumnName("how_much");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.RencanaPerbaikan);

        MapChild<Pengesahan>(b, "pengesahan", e =>
        {
            e.Property(x => x.Tahap).HasColumnName("tahap");
            e.Property(x => x.Peran).HasColumnName("peran");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Urutan).HasColumnName("urutan");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Komentar).HasColumnName("komentar");
            e.Property(x => x.Tgl).HasColumnName("tgl");
        }, g => g.Pengesahan);

        MapChild<DoPelaksanaan>(b, "do_pelaksanaan", e =>
        {
            e.Property(x => x.TahapanKegiatan).HasColumnName("tahapan_kegiatan");
            e.Property(x => x.MonitoringHasil).HasColumnName("monitoring_hasil");
            e.Property(x => x.Tanggal).HasColumnName("tanggal");
            e.Property(x => x.EvidencePath).HasColumnName("evidence_path");
            e.Property(x => x.EvidenceNama).HasColumnName("evidence_nama");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.DoPelaksanaan);

        MapChild<DoKendala>(b, "do_kendala", e =>
        {
            e.Property(x => x.Kendala).HasColumnName("kendala");
            e.Property(x => x.Solusi).HasColumnName("solusi");
            e.Property(x => x.Waktu).HasColumnName("waktu");
            e.Property(x => x.Pic).HasColumnName("pic");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.DoKendala);

        MapChild<CheckPerbandingan>(b, "check_perbandingan", e =>
        {
            e.Property(x => x.Sebelum).HasColumnName("sebelum");
            e.Property(x => x.Sesudah).HasColumnName("sesudah");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.CheckPerbandingan);

        MapChild<CheckSasaran>(b, "check_sasaran", e =>
        {
            e.Property(x => x.SasaranText).HasColumnName("sasaran");
            e.Property(x => x.Sebelum).HasColumnName("sebelum");
            e.Property(x => x.Target).HasColumnName("target");
            e.Property(x => x.Sesudah).HasColumnName("sesudah");
            e.Property(x => x.PersenCapaian).HasColumnName("persen_capaian");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.CheckSasaran);

        MapChild<CheckBiaya>(b, "check_biaya", e =>
        {
            e.Property(x => x.Komponen).HasColumnName("komponen");
            e.Property(x => x.Perhitungan).HasColumnName("perhitungan");
            e.Property(x => x.Nilai).HasColumnName("nilai");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.CheckBiaya);

        MapChild<CheckRisiko>(b, "check_risiko", e =>
        {
            e.Property(x => x.DampakNegatif).HasColumnName("dampak_negatif");
            e.Property(x => x.Mitigasi).HasColumnName("mitigasi");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.CheckRisiko);

        MapChild<ActionStandarisasi>(b, "action_standarisasi", e =>
        {
            e.Property(x => x.StandarBaru).HasColumnName("standar_baru");
            e.Property(x => x.NoDokumen).HasColumnName("no_dokumen");
            e.Property(x => x.TglBerlaku).HasColumnName("tgl_berlaku");
            e.Property(x => x.Pic).HasColumnName("pic");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.ActionStandarisasi);

        MapChild<ActionTindakLanjut>(b, "action_tindak_lanjut", e =>
        {
            e.Property(x => x.Rencana).HasColumnName("rencana");
            e.Property(x => x.TargetWaktu).HasColumnName("target_waktu");
            e.Property(x => x.Pic).HasColumnName("pic");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Urutan).HasColumnName("urutan");
        }, g => g.ActionTindakLanjut);

        // --- Sumbang Gagasan ---
        b.Entity<Gagasan>(e =>
        {
            e.ToTable("gagasan", "inovasi");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.NoRegistrasi).HasColumnName("no_registrasi");
            e.Property(x => x.Judul).HasColumnName("judul");
            e.Property(x => x.LatarBelakang).HasColumnName("latar_belakang");
            e.Property(x => x.Metodologi).HasColumnName("metodologi");
            e.Property(x => x.CreatedByNik).HasColumnName("created_by_nik");
            e.Property(x => x.CreatedByNama).HasColumnName("created_by_nama");
            e.Property(x => x.IdDepartemenAsal).HasColumnName("id_departemen_asal");
            e.Property(x => x.NamaDepartemenAsal).HasColumnName("nama_departemen_asal");
            e.Property(x => x.IdKompartemenAsal).HasColumnName("id_kompartemen_asal");
            e.Property(x => x.NamaKompartemenAsal).HasColumnName("nama_kompartemen_asal");
            e.Property(x => x.IdDepartemenTujuan).HasColumnName("id_departemen_tujuan");
            e.Property(x => x.NamaDepartemenTujuan).HasColumnName("nama_departemen_tujuan");
            e.Property(x => x.IdKompartemenTujuan).HasColumnName("id_kompartemen_tujuan");
            e.Property(x => x.NamaKompartemenTujuan).HasColumnName("nama_kompartemen_tujuan");
            e.Property(x => x.FasilitatorNik).HasColumnName("fasilitator_nik");
            e.Property(x => x.FasilitatorNama).HasColumnName("fasilitator_nama");
            e.Property(x => x.PembinaNik).HasColumnName("pembina_nik");
            e.Property(x => x.PembinaNama).HasColumnName("pembina_nama");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.IdGugus).HasColumnName("id_gugus");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
        });
        b.Entity<GagasanApproval>(e =>
        {
            e.ToTable("gagasan_approval", "inovasi");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdGagasan).HasColumnName("id_gagasan");
            e.Property(x => x.Urutan).HasColumnName("urutan");
            e.Property(x => x.Peran).HasColumnName("peran");
            e.Property(x => x.Nik).HasColumnName("nik");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Komentar).HasColumnName("komentar");
            e.Property(x => x.Metodologi).HasColumnName("metodologi");
            e.Property(x => x.Tgl).HasColumnName("tgl");
            e.HasOne<Gagasan>().WithMany(g => g.Approval).HasForeignKey(x => x.IdGagasan).OnDelete(DeleteBehavior.Cascade);
        });

        // --- grading read-models (read-only) ---
        b.Entity<UnitOrganisasi>(e =>
        {
            e.ToTable("unit_organisasi", "grading");
            e.HasKey(x => x.IdUnit);
            e.Property(x => x.IdUnit).HasColumnName("id_unit");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Tipe).HasColumnName("tipe");
            e.Property(x => x.IdUnitInduk).HasColumnName("id_unit_induk");
        });
        b.Entity<Jabatan>(e =>
        {
            e.ToTable("jabatan", "grading");
            e.HasKey(x => x.IdJabatan);
            e.Property(x => x.IdJabatan).HasColumnName("id_jabatan");
            e.Property(x => x.NamaJabatan).HasColumnName("nama_jabatan");
            e.Property(x => x.IdUnit).HasColumnName("id_unit");
        });
        b.Entity<Penempatan>(e =>
        {
            e.ToTable("penempatan", "grading");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.IdJabatan).HasColumnName("id_jabatan");
            e.Property(x => x.IdKaryawan).HasColumnName("id_karyawan");
            e.Property(x => x.Nama).HasColumnName("nama");
            e.Property(x => x.Status).HasColumnName("status");
        });
    }

    // Semua tabel anak inovasi.* punya bentuk sama: PK "id", FK "id_gugus",
    // relasi ke Gugus dengan cascade delete. Helper ini memetakan bagian umum
    // itu sekali; delegate `cols` memetakan kolom spesifik tiap entitas.
    private static void MapChild<T>(
        ModelBuilder b,
        string table,
        Action<Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T>> cols,
        System.Linq.Expressions.Expression<Func<Gugus, IEnumerable<T>?>> nav) where T : class
    {
        b.Entity<T>(e =>
        {
            e.ToTable(table, "inovasi");
            e.Property("Id").HasColumnName("id");
            e.HasKey("Id");
            e.Property("IdGugus").HasColumnName("id_gugus");
            e.HasOne<Gugus>()
                .WithMany(nav)
                .HasForeignKey("IdGugus")
                .OnDelete(DeleteBehavior.Cascade);
            cols(e);
        });
    }
}
