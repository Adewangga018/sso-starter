/* ============================================================================
   inovasi - skema modul My Innovation (Sistem Saran / SS & Gugus Inovasi
   Operasi / GIO) PT GCS, di db_mygcs.
   ----------------------------------------------------------------------------
   LATAR BELAKANG
   Mengacu pada template risalah inovasi PT Gresik Cipta Sejahtera:
     - Sistem Saran (SS)  : siklus PDCA (P.1-P.8, DO, CHECK, ACTION).
     - Gugus Inovasi (GIO): metode DELAPAN LANGKAH TUJUH ALAT (DELTA). Untuk
       tahap ini GIO dibangun di FRONTEND saja; skema tetap generik (kolom
       jenis membedakan SS/GIO) supaya bisa dipakai bila backend GIO menyusul.

   REFERENSI LINTAS SKEMA (TANPA FK)
   inovasi.gugus.created_by_nik, inovasi.anggota.nik, inovasi.pengesahan.nik
   berisi ID_KARYAWAN (mis. 'T.211270') yang SECARA LOGIS sama dengan
   GCS.dbo.MST_PEGAWAI.ID_KARYAWAN dan db_mygcs.dbo.Users.Nik serta
   grading.penempatan.id_karyawan. Tidak diberi FK (lintas DB / lintas domain
   identitas) - hanya kolom + index, konsisten dengan pola pada skema grading.

   id_departemen / id_kompartemen mengacu ke grading.unit_organisasi.id_unit
   (satu database, tapi tetap dibiarkan tanpa FK agar penghapusan/refaktor
   struktur organisasi tidak mengunci baris inovasi historis).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\inovasi\01-schema-ddl.sql

   Idempoten: aman dijalankan ulang - tiap objek dicek dulu sebelum dibuat.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    DECLARE @db SYSNAME = DB_NAME();
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs, bukan %s.', 16, 1, @db);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inovasi')
BEGIN
    EXEC('CREATE SCHEMA inovasi AUTHORIZATION dbo');
    PRINT 'Schema inovasi dibuat.';
END
ELSE
    PRINT 'LEWATI: schema inovasi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   gugus - kepala risalah: identitas gugus + metadata tahap PLAN + status.
   jenis = 'SS' (Sistem Saran) | 'GIO' (Gugus Inovasi Operasi).
   status alur: Draft -> Diajukan -> Diverifikasi (Fasilitator setuju)
                -> Divalidasi (Pembina setuju = PLAN disahkan; DO/CHECK/ACTION
                terbuka) -> Selesai ; cabang Ditolak / Revisi.
   no_registrasi diisi saat submit: {jenis}-{urut_departemen}/{urut_kompartemen}/{tahun}.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.gugus', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.gugus
    (
        id                       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_gugus PRIMARY KEY,
        jenis                    NVARCHAR(3)   NOT NULL,       -- 'SS' | 'GIO'
        no_registrasi            NVARCHAR(60)  NULL,
        nama_gugus               NVARCHAR(150) NULL,
        tema_ke                  INT           NULL,           -- numerik; satu gugus bisa >1 tema per periode
        periode                  NVARCHAR(9)   NOT NULL,       -- tahun bersilang, mis. '2026/2027'
        id_departemen            INT           NULL,           -- grading.unit_organisasi.id_unit (tanpa FK)
        nama_departemen          NVARCHAR(150) NULL,           -- snapshot nama saat dibuat
        id_kompartemen           INT           NULL,           -- grading.unit_organisasi.id_unit (tanpa FK)
        nama_kompartemen         NVARCHAR(150) NULL,           -- snapshot
        judul                    NVARCHAR(500) NULL,           -- P.8 Judul Sistem Saran
        latar_belakang           NVARCHAR(MAX) NULL,           -- P.1 Latar Belakang Masalah
        masalah_utama            NVARCHAR(300) NULL,           -- kepala fishbone (P.6)
        action_tema_berikutnya   NVARCHAR(MAX) NULL,           -- A.3 Rencana Tema / Inovasi Berikutnya
        status                   NVARCHAR(30)  NOT NULL CONSTRAINT DF_inovasi_gugus_status DEFAULT ('Draft'),
        plan_disahkan            BIT           NOT NULL CONSTRAINT DF_inovasi_gugus_plandisah DEFAULT (0),
        created_by_nik           NVARCHAR(20)  NOT NULL,       -- ID_KARYAWAN pembuat (Ketua/pengaju)
        created_by_nama          NVARCHAR(150) NULL,
        created_at               DATETIME2     NOT NULL CONSTRAINT DF_inovasi_gugus_created DEFAULT (SYSDATETIME()),
        updated_at               DATETIME2     NULL,
        submitted_at             DATETIME2     NULL,
        CONSTRAINT CK_inovasi_gugus_jenis  CHECK (jenis IN ('SS','GIO'))
    );
    CREATE INDEX IX_inovasi_gugus_creator  ON inovasi.gugus (created_by_nik);
    CREATE INDEX IX_inovasi_gugus_dept     ON inovasi.gugus (id_departemen);
    CREATE INDEX IX_inovasi_gugus_komp     ON inovasi.gugus (id_kompartemen);
    CREATE INDEX IX_inovasi_gugus_jenis    ON inovasi.gugus (jenis, periode);
    PRINT 'Tabel inovasi.gugus dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.gugus sudah ada.';
GO

/* ---------------------------------------------------------------------------
   anggota - susunan anggota gugus (A/B). nik = ID_KARYAWAN (tanpa FK).
   Dipakai untuk cross-link dashboard: bila Ketua mencantumkan anggota,
   inovasi ikut tampil di My Innovation anggota tsb.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.anggota', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.anggota
    (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_anggota PRIMARY KEY,
        id_gugus    INT           NOT NULL,
        peran       NVARCHAR(20)  NOT NULL,   -- Ketua | Sekretaris | Fasilitator | Anggota | Pembina
        nik         NVARCHAR(20)  NULL,       -- ID_KARYAWAN (boleh NULL untuk pihak eksternal)
        nama        NVARCHAR(150) NOT NULL,
        jabatan     NVARCHAR(150) NULL,
        dep_bagian  NVARCHAR(200) NULL,
        urutan      INT           NOT NULL CONSTRAINT DF_inovasi_anggota_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_anggota_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_anggota_gugus ON inovasi.anggota (id_gugus);
    CREATE INDEX IX_inovasi_anggota_nik   ON inovasi.anggota (nik);
    PRINT 'Tabel inovasi.anggota dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.anggota sudah ada.';
GO

/* ---------------------------------------------------------------------------
   data_pendukung - P.2 Data Pendukung (Kondisi Awal). sumber/keterangan bisa
   berupa teks, lampiran (file/foto) atau tautan (link).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.data_pendukung', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.data_pendukung
    (
        id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_data_pendukung PRIMARY KEY,
        id_gugus           INT           NOT NULL,
        indikator          NVARCHAR(400) NULL,       -- Indikator / Data Pendukung
        kondisi_awal       NVARCHAR(MAX) NULL,
        sumber_keterangan  NVARCHAR(MAX) NULL,       -- teks sumber/keterangan
        lampiran_path      NVARCHAR(400) NULL,       -- path relatif file/foto yang diunggah
        lampiran_nama      NVARCHAR(200) NULL,       -- nama asli berkas
        lampiran_link      NVARCHAR(500) NULL,       -- tautan (URL) sebagai sumber
        urutan             INT           NOT NULL CONSTRAINT DF_inovasi_dp_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_dp_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_dp_gugus ON inovasi.data_pendukung (id_gugus);
    PRINT 'Tabel inovasi.data_pendukung dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.data_pendukung sudah ada.';
GO

/* ---------------------------------------------------------------------------
   jadwal - P.3 Jadwal Kegiatan (PDCA). Satu baris per (tahapan, jenis).
   bulan = daftar nomor bulan dipisah koma, mis. '6,7'.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.jadwal', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.jadwal
    (
        id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_jadwal PRIMARY KEY,
        id_gugus  INT          NOT NULL,
        tahapan   NVARCHAR(10) NOT NULL,   -- PLAN | DO | CHECK | ACTION
        jenis     NVARCHAR(10) NOT NULL,   -- Rencana | Realisasi
        bulan     NVARCHAR(60) NULL,       -- csv nomor bulan (1-12)
        jumlah    INT          NULL,
        CONSTRAINT FK_inovasi_jadwal_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_jadwal_gugus ON inovasi.jadwal (id_gugus);
    PRINT 'Tabel inovasi.jadwal dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.jadwal sudah ada.';
GO

/* ---------------------------------------------------------------------------
   sasaran - P.4 Penentuan Sasaran (SMART).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.sasaran', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.sasaran
    (
        id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_sasaran PRIMARY KEY,
        id_gugus         INT           NOT NULL,
        sasaran          NVARCHAR(MAX) NULL,
        kondisi_sebelum  NVARCHAR(MAX) NULL,
        target           NVARCHAR(MAX) NULL,
        indikator        NVARCHAR(MAX) NULL,
        urutan           INT           NOT NULL CONSTRAINT DF_inovasi_sasaran_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_sasaran_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_sasaran_gugus ON inovasi.sasaran (id_gugus);
    PRINT 'Tabel inovasi.sasaran dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.sasaran sudah ada.';
GO

/* ---------------------------------------------------------------------------
   qcdse - P.5 Dampak Masalah terhadap QCDSE + M (OPSIONAL, boleh kosong).
   aspek = Q | C | D | S | E | M.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.qcdse', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.qcdse
    (
        id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_qcdse PRIMARY KEY,
        id_gugus            INT           NOT NULL,
        aspek               NVARCHAR(1)   NOT NULL,   -- Q C D S E M
        dampak_kualitatif   NVARCHAR(MAX) NULL,
        dampak_kuantitatif  NVARCHAR(MAX) NULL,
        CONSTRAINT FK_inovasi_qcdse_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE,
        CONSTRAINT CK_inovasi_qcdse_aspek CHECK (aspek IN ('Q','C','D','S','E','M'))
    );
    CREATE INDEX IX_inovasi_qcdse_gugus ON inovasi.qcdse (id_gugus);
    PRINT 'Tabel inovasi.qcdse dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.qcdse sudah ada.';
GO

/* ---------------------------------------------------------------------------
   fishbone - P.6 Analisa Akar Penyebab (Diagram Tulang Ikan). Satu baris per
   faktor 4M1E; akar_dominan = kotak akar terkecil (yang di frontend diberi
   tampilan box); prioritas 1-5.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.fishbone', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.fishbone
    (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_fishbone PRIMARY KEY,
        id_gugus      INT           NOT NULL,
        faktor        NVARCHAR(20)  NOT NULL,   -- Man | Method | Machine | Material | Environment
        penyebab      NVARCHAR(MAX) NULL,       -- penyebab yang teridentifikasi
        akar_dominan  NVARCHAR(MAX) NULL,       -- akar penyebab dominan (kotak terkecil)
        prioritas     TINYINT       NULL,       -- 1-5
        CONSTRAINT FK_inovasi_fishbone_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE,
        CONSTRAINT CK_inovasi_fishbone_prio CHECK (prioritas IS NULL OR prioritas BETWEEN 1 AND 5)
    );
    CREATE INDEX IX_inovasi_fishbone_gugus ON inovasi.fishbone (id_gugus);
    PRINT 'Tabel inovasi.fishbone dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.fishbone sudah ada.';
GO

/* ---------------------------------------------------------------------------
   rencana_perbaikan - P.7 Rencana Perbaikan (5W + 2H). Satu baris per akar
   penyebab dominan.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.rencana_perbaikan', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.rencana_perbaikan
    (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_rencana PRIMARY KEY,
        id_gugus       INT           NOT NULL,
        akar_penyebab  NVARCHAR(MAX) NULL,
        what           NVARCHAR(MAX) NULL,
        why            NVARCHAR(MAX) NULL,
        [where]        NVARCHAR(MAX) NULL,
        [when]         NVARCHAR(MAX) NULL,
        who            NVARCHAR(MAX) NULL,
        how            NVARCHAR(MAX) NULL,
        how_much       NVARCHAR(MAX) NULL,
        urutan         INT           NOT NULL CONSTRAINT DF_inovasi_rencana_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_rencana_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_rencana_gugus ON inovasi.rencana_perbaikan (id_gugus);
    PRINT 'Tabel inovasi.rencana_perbaikan dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.rencana_perbaikan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   pengesahan - Lembar Pengesahan. tahap = PLAN | FINAL. Urutan tanda tangan:
   Ketua Gugus -> Fasilitator -> Pembina Tk. Departemen -> Pembina Tk.
   Kompartemen. DO/CHECK/ACTION baru terbuka setelah SEMUA baris tahap PLAN
   berstatus 'Disetujui' (plan_disahkan = 1 pada gugus).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.pengesahan', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.pengesahan
    (
        id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_pengesahan PRIMARY KEY,
        id_gugus   INT           NOT NULL,
        tahap      NVARCHAR(10)  NOT NULL,   -- PLAN | FINAL
        peran      NVARCHAR(40)  NOT NULL,   -- Ketua Gugus | Fasilitator | Pembina Tk. Departemen | Pembina Tk. Kompartemen
        nik        NVARCHAR(20)  NULL,       -- ID_KARYAWAN yang berwenang menandatangani
        nama       NVARCHAR(150) NULL,
        urutan     INT           NOT NULL CONSTRAINT DF_inovasi_pengesahan_urut DEFAULT (0),
        status     NVARCHAR(20)  NOT NULL CONSTRAINT DF_inovasi_pengesahan_status DEFAULT ('Menunggu'),  -- Menunggu | Disetujui | Ditolak | Revisi
        komentar   NVARCHAR(MAX) NULL,
        tgl        DATETIME2     NULL,
        CONSTRAINT FK_inovasi_pengesahan_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE,
        CONSTRAINT CK_inovasi_pengesahan_tahap  CHECK (tahap IN ('PLAN','FINAL')),
        CONSTRAINT CK_inovasi_pengesahan_status CHECK (status IN ('Menunggu','Disetujui','Ditolak','Revisi'))
    );
    CREATE INDEX IX_inovasi_pengesahan_gugus ON inovasi.pengesahan (id_gugus);
    CREATE INDEX IX_inovasi_pengesahan_nik   ON inovasi.pengesahan (nik);
    PRINT 'Tabel inovasi.pengesahan dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.pengesahan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   do_pelaksanaan - D.1 Pelaksanaan Perbaikan & Monitoring (bisa unggah foto +
   tanggal).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.do_pelaksanaan', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.do_pelaksanaan
    (
        id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_do_pelaksanaan PRIMARY KEY,
        id_gugus          INT           NOT NULL,
        tahapan_kegiatan  NVARCHAR(MAX) NULL,
        monitoring_hasil  NVARCHAR(MAX) NULL,
        tanggal           DATE          NULL,
        evidence_path     NVARCHAR(400) NULL,   -- foto/berkas bukti
        evidence_nama     NVARCHAR(200) NULL,
        urutan            INT           NOT NULL CONSTRAINT DF_inovasi_do_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_do_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_do_gugus ON inovasi.do_pelaksanaan (id_gugus);
    PRINT 'Tabel inovasi.do_pelaksanaan dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.do_pelaksanaan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   do_kendala - D.2 Kendala Selama Pelaksanaan & Solusinya.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.do_kendala', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.do_kendala
    (
        id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_do_kendala PRIMARY KEY,
        id_gugus  INT           NOT NULL,
        kendala   NVARCHAR(MAX) NULL,
        solusi    NVARCHAR(MAX) NULL,
        waktu     NVARCHAR(100) NULL,
        pic       NVARCHAR(150) NULL,
        urutan    INT           NOT NULL CONSTRAINT DF_inovasi_dokendala_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_dokendala_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_dokendala_gugus ON inovasi.do_kendala (id_gugus);
    PRINT 'Tabel inovasi.do_kendala dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.do_kendala sudah ada.';
GO

/* ---------------------------------------------------------------------------
   check_perbandingan - C.1 Perbandingan Kondisi Sebelum & Sesudah.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.check_perbandingan', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.check_perbandingan
    (
        id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_check_perb PRIMARY KEY,
        id_gugus  INT           NOT NULL,
        sebelum   NVARCHAR(MAX) NULL,
        sesudah   NVARCHAR(MAX) NULL,
        urutan    INT           NOT NULL CONSTRAINT DF_inovasi_checkperb_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_checkperb_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_checkperb_gugus ON inovasi.check_perbandingan (id_gugus);
    PRINT 'Tabel inovasi.check_perbandingan dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.check_perbandingan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   check_sasaran - C.2 Pencapaian Sasaran Perbaikan.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.check_sasaran', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.check_sasaran
    (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_check_sasaran PRIMARY KEY,
        id_gugus        INT           NOT NULL,
        sasaran         NVARCHAR(MAX) NULL,
        sebelum         NVARCHAR(MAX) NULL,
        target          NVARCHAR(MAX) NULL,
        sesudah         NVARCHAR(MAX) NULL,
        persen_capaian  NVARCHAR(50)  NULL,
        urutan          INT           NOT NULL CONSTRAINT DF_inovasi_checksas_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_checksas_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_checksas_gugus ON inovasi.check_sasaran (id_gugus);
    PRINT 'Tabel inovasi.check_sasaran dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.check_sasaran sudah ada.';
GO

/* ---------------------------------------------------------------------------
   check_biaya - C.3 Analisa Manfaat & Biaya (Cost-Benefit).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.check_biaya', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.check_biaya
    (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_check_biaya PRIMARY KEY,
        id_gugus    INT           NOT NULL,
        komponen    NVARCHAR(MAX) NULL,
        perhitungan NVARCHAR(MAX) NULL,
        nilai       NVARCHAR(MAX) NULL,
        urutan      INT           NOT NULL CONSTRAINT DF_inovasi_checkbiaya_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_checkbiaya_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_checkbiaya_gugus ON inovasi.check_biaya (id_gugus);
    PRINT 'Tabel inovasi.check_biaya dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.check_biaya sudah ada.';
GO

/* ---------------------------------------------------------------------------
   check_risiko - C.4 Analisa Risiko / Dampak Negatif & Penanganannya.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.check_risiko', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.check_risiko
    (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_check_risiko PRIMARY KEY,
        id_gugus        INT           NOT NULL,
        dampak_negatif  NVARCHAR(MAX) NULL,
        mitigasi        NVARCHAR(MAX) NULL,
        urutan          INT           NOT NULL CONSTRAINT DF_inovasi_checkrisiko_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_checkrisiko_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_checkrisiko_gugus ON inovasi.check_risiko (id_gugus);
    PRINT 'Tabel inovasi.check_risiko dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.check_risiko sudah ada.';
GO

/* ---------------------------------------------------------------------------
   action_standarisasi - A.1 Standarisasi Hasil Perbaikan (menjadi SOP).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.action_standarisasi', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.action_standarisasi
    (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_act_std PRIMARY KEY,
        id_gugus     INT           NOT NULL,
        standar_baru NVARCHAR(MAX) NULL,
        no_dokumen   NVARCHAR(100) NULL,
        tgl_berlaku  DATE          NULL,
        pic          NVARCHAR(150) NULL,
        urutan       INT           NOT NULL CONSTRAINT DF_inovasi_actstd_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_actstd_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_actstd_gugus ON inovasi.action_standarisasi (id_gugus);
    PRINT 'Tabel inovasi.action_standarisasi dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.action_standarisasi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   action_tindak_lanjut - A.2 Rencana Tindak Lanjut & Perbaikan Berkelanjutan.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.action_tindak_lanjut', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.action_tindak_lanjut
    (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_act_tl PRIMARY KEY,
        id_gugus      INT           NOT NULL,
        rencana       NVARCHAR(MAX) NULL,
        target_waktu  NVARCHAR(100) NULL,
        pic           NVARCHAR(150) NULL,
        status        NVARCHAR(50)  NULL,
        urutan        INT           NOT NULL CONSTRAINT DF_inovasi_acttl_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_acttl_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_acttl_gugus ON inovasi.action_tindak_lanjut (id_gugus);
    PRINT 'Tabel inovasi.action_tindak_lanjut dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.action_tindak_lanjut sudah ada.';
GO

PRINT '=== Skema inovasi selesai diproses. ===';
SET NOEXEC OFF;
GO
