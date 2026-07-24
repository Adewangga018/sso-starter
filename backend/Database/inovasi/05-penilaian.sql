/* ============================================================================
   inovasi - subsistem PENILAIAN JURI (stream) untuk risalah My Innovation.
   ----------------------------------------------------------------------------
   LATAR BELAKANG
   Risalah dinilai oleh TIM JURI (mengikuti Form Penilaian PT Petrokimia Gresik
   "Versi 2024"): rubrik GIO/SS (24 kriteria) & 5R (22 kriteria), berbobot,
   skala 1-10 per kriteria, dengan kategori Platinum/Gold/Silver/Bronze/
   Partisipatif.

   MODEL
     - penilaian_kriteria      : master rubrik (di-seed) per jenis_form + tahap.
     - penilaian_stream        : panel juri (dibuat Admin).
     - penilaian_stream_anggota: 4 anggota per stream = 1 Ketua, 2 Anggota,
                                 1 Sekretaris (komposisi divalidasi di aplikasi).
     - penilaian_penugasan     : menautkan satu stream ke satu gugus (inovasi).
     - penilaian_skor          : skor 1-10 per (penugasan, kriteria, penilai).
   Ketua+Anggota menilai; Sekretaris hanya melihat.

   REFERENSI LINTAS DOMAIN (TANPA FK)
   user_id / penilai_user_id / dibuat_oleh = db_mygcs.dbo.Users.Id (Identity,
   NVARCHAR(450)). Sengaja tanpa FK (lintas domain identitas), konsisten dengan
   pola nik di skema inovasi/grading.

   PERHITUNGAN (dihitung di aplikasi, bukan di DB)
     nilai_penilai = SUM(nilai/10 * bobot_persen)          -> skala 0..100
     hasil_stream  = rata-rata nilai_penilai (Ketua + 2 Anggota)
     kategori: >=94 Platinum | >=87 Gold | >=79 Silver | >=61 Bronze | <61 Partisipatif

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\inovasi\05-penilaian.sql

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
ELSE PRINT 'LEWATI: schema inovasi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   penilaian_kriteria - master rubrik. jenis_form: 'GIO-SS' (untuk SS & GIO) |
   '5R'. tahap: PLAN | DO | CHECK | ACTION | MAKALAH | PRESENTATION.
   bobot_persen = bobot/kriteria dalam persen; total per jenis_form = 100.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.penilaian_kriteria', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.penilaian_kriteria
    (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_pk PRIMARY KEY,
        jenis_form   NVARCHAR(10)  NOT NULL,       -- 'GIO-SS' | '5R'
        tahap        NVARCHAR(15)  NOT NULL,       -- PLAN|DO|CHECK|ACTION|MAKALAH|PRESENTATION
        no           INT           NOT NULL,       -- nomor urut kriteria dalam form
        kriteria     NVARCHAR(300) NOT NULL,
        keterangan   NVARCHAR(MAX) NULL,            -- panduan penilaian (ringkasan JUKLAK)
        bobot_persen DECIMAL(5,2)  NOT NULL,
        aktif        BIT           NOT NULL CONSTRAINT DF_inovasi_pk_aktif DEFAULT (1),
        CONSTRAINT UQ_inovasi_pk_form_no UNIQUE (jenis_form, no),
        CONSTRAINT CK_inovasi_pk_form  CHECK (jenis_form IN ('GIO-SS','5R')),
        CONSTRAINT CK_inovasi_pk_tahap CHECK (tahap IN ('PLAN','DO','CHECK','ACTION','MAKALAH','PRESENTATION'))
    );
    PRINT 'Tabel inovasi.penilaian_kriteria dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.penilaian_kriteria sudah ada.';
GO

/* ---------------------------------------------------------------------------
   penilaian_stream - panel juri (dibuat & dikelola Admin).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.penilaian_stream', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.penilaian_stream
    (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_ps PRIMARY KEY,
        nama        NVARCHAR(150) NOT NULL,
        keterangan  NVARCHAR(300) NULL,
        aktif       BIT           NOT NULL CONSTRAINT DF_inovasi_ps_aktif DEFAULT (1),
        dibuat_oleh NVARCHAR(450) NULL,           -- Users.Id (tanpa FK)
        dibuat_pada DATETIME2     NOT NULL CONSTRAINT DF_inovasi_ps_dibuat DEFAULT (SYSDATETIME())
    );
    PRINT 'Tabel inovasi.penilaian_stream dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.penilaian_stream sudah ada.';
GO

/* ---------------------------------------------------------------------------
   penilaian_stream_anggota - 4 anggota/stream. peran: Ketua|Anggota|Sekretaris.
   nik & nama = snapshot untuk tampilan tanpa join lintas domain.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.penilaian_stream_anggota', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.penilaian_stream_anggota
    (
        id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_psa PRIMARY KEY,
        id_stream INT           NOT NULL,
        user_id   NVARCHAR(128) NOT NULL,          -- Users.Id GUID (tanpa FK; 128 cukup, hindari batas index 900B)
        nik       NVARCHAR(20)  NULL,
        nama      NVARCHAR(150) NULL,
        peran     NVARCHAR(15)  NOT NULL,          -- Ketua | Anggota | Sekretaris
        CONSTRAINT FK_inovasi_psa_stream FOREIGN KEY (id_stream) REFERENCES inovasi.penilaian_stream (id) ON DELETE CASCADE,
        CONSTRAINT UQ_inovasi_psa_stream_user UNIQUE (id_stream, user_id),
        CONSTRAINT CK_inovasi_psa_peran CHECK (peran IN ('Ketua','Anggota','Sekretaris'))
    );
    CREATE INDEX IX_inovasi_psa_stream ON inovasi.penilaian_stream_anggota (id_stream);
    CREATE INDEX IX_inovasi_psa_user   ON inovasi.penilaian_stream_anggota (user_id);
    PRINT 'Tabel inovasi.penilaian_stream_anggota dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.penilaian_stream_anggota sudah ada.';
GO

/* ---------------------------------------------------------------------------
   penilaian_penugasan - satu stream menilai satu gugus. Satu penugasan aktif
   (status 'Berjalan') per gugus dijaga filtered unique index.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.penilaian_penugasan', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.penilaian_penugasan
    (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_pp PRIMARY KEY,
        id_gugus    INT           NOT NULL,
        id_stream   INT           NOT NULL,
        status      NVARCHAR(15)  NOT NULL CONSTRAINT DF_inovasi_pp_status DEFAULT ('Berjalan'),
        dibuat_oleh NVARCHAR(450) NULL,
        dibuat_pada DATETIME2     NOT NULL CONSTRAINT DF_inovasi_pp_dibuat DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_inovasi_pp_gugus  FOREIGN KEY (id_gugus)  REFERENCES inovasi.gugus (id) ON DELETE CASCADE,
        CONSTRAINT FK_inovasi_pp_stream FOREIGN KEY (id_stream) REFERENCES inovasi.penilaian_stream (id),
        CONSTRAINT CK_inovasi_pp_status CHECK (status IN ('Berjalan','Selesai'))
    );
    CREATE UNIQUE INDEX UQ_inovasi_pp_gugus_aktif ON inovasi.penilaian_penugasan (id_gugus) WHERE status = 'Berjalan';
    CREATE INDEX IX_inovasi_pp_stream ON inovasi.penilaian_penugasan (id_stream);
    PRINT 'Tabel inovasi.penilaian_penugasan dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.penilaian_penugasan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   penilaian_skor - skor 1-10 per (penugasan, kriteria, penilai). Satu baris per
   penilai (Ketua/Anggota) per kriteria.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('inovasi.penilaian_skor', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.penilaian_skor
    (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_psk PRIMARY KEY,
        id_penugasan    INT           NOT NULL,
        id_kriteria     INT           NOT NULL,
        penilai_user_id NVARCHAR(128) NOT NULL,      -- Users.Id GUID (tanpa FK; 128 cukup, hindari batas index 900B)
        nilai           TINYINT       NOT NULL,
        catatan         NVARCHAR(500) NULL,
        diubah_pada     DATETIME2     NOT NULL CONSTRAINT DF_inovasi_psk_diubah DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_inovasi_psk_penugasan FOREIGN KEY (id_penugasan) REFERENCES inovasi.penilaian_penugasan (id) ON DELETE CASCADE,
        CONSTRAINT FK_inovasi_psk_kriteria  FOREIGN KEY (id_kriteria)  REFERENCES inovasi.penilaian_kriteria (id),
        CONSTRAINT UQ_inovasi_psk UNIQUE (id_penugasan, id_kriteria, penilai_user_id),
        CONSTRAINT CK_inovasi_psk_nilai CHECK (nilai BETWEEN 1 AND 10)
    );
    CREATE INDEX IX_inovasi_psk_penugasan ON inovasi.penilaian_skor (id_penugasan);
    PRINT 'Tabel inovasi.penilaian_skor dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.penilaian_skor sudah ada.';
GO

/* ---------------------------------------------------------------------------
   Seed rubrik (Form Penilaian PT Petrokimia Gresik - Versi 2024).
   Bobot per-kriteria; total tiap jenis_form = 100% (dicek di akhir).
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM inovasi.penilaian_kriteria WHERE jenis_form = 'GIO-SS')
BEGIN
    INSERT INTO inovasi.penilaian_kriteria (jenis_form, tahap, no, kriteria, bobot_persen) VALUES
    -- PLAN (25%)
    ('GIO-SS','PLAN',1, N'Menentukan Aktifitas', 2),
    ('GIO-SS','PLAN',2, N'Menentukan Masalah dan Tema', 4),
    ('GIO-SS','PLAN',3, N'Menentukan Sasaran dan Pengesahan Aktifitas', 2),
    ('GIO-SS','PLAN',4, N'Melakukan Tinjauan Obyek Masalah dan Brainstorming', 2),
    ('GIO-SS','PLAN',5, N'Menentukan Akar Penyebab Masalah dan Analisisnya', 3),
    ('GIO-SS','PLAN',6, N'Menentukan Akar Penyebab Dominan', 3),
    ('GIO-SS','PLAN',7, N'Menetapkan Alternatif Solusi dan Mengelola Risiko yang Timbul', 6),
    ('GIO-SS','PLAN',8, N'Menyusun Rencana Perbaikan dan Pengesahan Aktivitas', 3),
    -- DO (15%)
    ('GIO-SS','DO',9,  N'Mempersiapkan Kompetensi Pelaksanaan', 2),
    ('GIO-SS','DO',10, N'Melaksanakan Perbaikan', 8),
    ('GIO-SS','DO',11, N'Memantau dan Menyelesaikan Kesulitan Saat Perbaikan', 2),
    ('GIO-SS','DO',12, N'Mengukur, Memvalidasi Perbaikan, dan Mempertimbangkan Hasil Validasi dengan Aspek Mutu serta S-Curve Rencana dan Realisasinya', 3),
    -- CHECK (40%)
    ('GIO-SS','CHECK',13, N'Membandingkan Alur Proses dan Hasil Inovasi yang Dilakukan', 3),
    ('GIO-SS','CHECK',14, N'Membandingkan Pareto Masalah, Target dan Perbandingan Akar Penyebab Masalah', 2),
    ('GIO-SS','CHECK',15, N'Evaluasi Aspek mutu dan Verifikasi Kinerja Keuangan', 2),
    ('GIO-SS','CHECK',16, N'Pengaruh Hasil Inovasi Terhadap Pihak yang Berkepentingan serta Tindakan Pencegahan Terhadap Hasil Perbaikan', 3),
    ('GIO-SS','CHECK',17, N'Manfaat yang Diperoleh Anggota, Unit kerja, Perusahaan dan Perusahaan Lain', 20),
    ('GIO-SS','CHECK',18, N'Keaslian Ide dan Keunggulan Inovasi', 10),
    -- ACTION (15%)
    ('GIO-SS','ACTION',19, N'Standarisasi dan Tema Selanjutnya', 4),
    ('GIO-SS','ACTION',20, N'Menyampaikan Sosialisasi dan HAKI / Paten', 5),
    ('GIO-SS','ACTION',21, N'Pengembangan Inovasi', 3),
    ('GIO-SS','ACTION',22, N'Menyampaikan Sustainability dan Added Value', 3),
    -- MAKALAH (5%) & PRESENTATION
    ('GIO-SS','MAKALAH',23, N'Sistematika & Mutu Penulisan, Estetika, Daya Tarik Risalah dan Ketepatan Pembuatan QC Tools', 3),
    ('GIO-SS','PRESENTATION',24, N'Kejelasan dan Pengelolaan Presentasi', 2);
    PRINT 'Seed rubrik GIO-SS: 24 kriteria.';
END
ELSE PRINT 'LEWATI: rubrik GIO-SS sudah ada.';
GO

IF NOT EXISTS (SELECT 1 FROM inovasi.penilaian_kriteria WHERE jenis_form = '5R')
BEGIN
    INSERT INTO inovasi.penilaian_kriteria (jenis_form, tahap, no, kriteria, bobot_persen) VALUES
    -- PLAN
    ('5R','PLAN',1, N'Persiapan aktivitas 5R', 2),
    ('5R','PLAN',2, N'Menentukan aktivitas dan Tema', 5),
    ('5R','PLAN',3, N'Menentukan Sasaran, Dampak Masalah, Harapan Pihak Terkait, aspek mutu dan Pengesahan Aktifitas', 2),
    ('5R','PLAN',4, N'Pemetaan Sebab akibat dan menentukan Akar Penyebab Masalah', 2),
    ('5R','PLAN',5, N'Analisis akar penyebab dan menentukan Akar Penyebab Dominan', 3),
    ('5R','PLAN',6, N'Menetapkan Alternatif Solusi dan Mengelola Risiko yang Timbul', 8),
    ('5R','PLAN',7, N'Efektivitas solusi, Kreativitas solusi, Aplikatif dan Inspiratif', 5),
    ('5R','PLAN',8, N'Menyusun Rencana Perbaikan R-1 Seiri, R-2 Seiton, R-3 Seiso, R-4 Seiketsu dan R-5 Shitsuke', 3),
    -- DO
    ('5R','DO',9,  N'Mempersiapkan Kompetensi Pelaksanaan dan kesesuaian penerapan pelaksanaan', 2),
    ('5R','DO',10, N'Melaksanakan Perbaikan R-1 Seiri, R-2 Seiton, R-3 Seiso, R-4 Seiketsu dan R-5 Shitsuke', 15),
    ('5R','DO',11, N'Melakukan Monitoring dan Memvalidasi hasil perbaikan', 3),
    -- CHECK
    ('5R','CHECK',12, N'Perbandingan masalah', 2),
    ('5R','CHECK',13, N'Perbandingan Sasaran dan pencapaiannya', 2),
    ('5R','CHECK',14, N'Evaluasi Aspek mutu, added value dan Verifikasi Kinerja Keuangan', 4),
    ('5R','CHECK',15, N'Pengaruh Hasil 5R Terhadap Pihak yang Berkepentingan serta Tindakan Pencegahan terhadap Hasil Perbaikan', 4),
    ('5R','CHECK',16, N'Dampak hasil pada Organisasi, pada Tim dan pihak Eksternal', 10),
    ('5R','CHECK',17, N'Keberlangsungan hasil, Rasio hasil Upaya, Keaslian Ide dan Keunggulan Inovasi', 10),
    -- ACTION
    ('5R','ACTION',18, N'Standarisasi R-1 Seiri, R-2 Seiton, R-3 Seiso, R-4 Seiketsu dan R-5 Shitsuke', 5),
    ('5R','ACTION',19, N'Pengesahan Standar 5R', 2),
    ('5R','ACTION',20, N'Sosialisasi Standar 5R', 3),
    -- MAKALAH & PRESENTATION
    ('5R','MAKALAH',21, N'Sistematika & Mutu Penulisan, Estetika, Daya Tarik Risalah', 5),
    ('5R','PRESENTATION',22, N'Kejelasan dan Pengelolaan Presentasi', 3);
    PRINT 'Seed rubrik 5R: 22 kriteria.';
END
ELSE PRINT 'LEWATI: rubrik 5R sudah ada.';
GO

/* --- Cek integritas bobot: total tiap jenis_form harus 100% --- */
DECLARE @gioss DECIMAL(6,2) = (SELECT SUM(bobot_persen) FROM inovasi.penilaian_kriteria WHERE jenis_form='GIO-SS');
DECLARE @lima  DECIMAL(6,2) = (SELECT SUM(bobot_persen) FROM inovasi.penilaian_kriteria WHERE jenis_form='5R');
PRINT 'Total bobot GIO-SS = ' + CAST(@gioss AS VARCHAR(10)) + '% ; 5R = ' + CAST(@lima AS VARCHAR(10)) + '%';
IF (@gioss <> 100 OR @lima <> 100)
    RAISERROR('PERINGATAN: total bobot rubrik tidak 100%% - cek seed penilaian_kriteria.', 16, 1);
GO

SET NOEXEC OFF;
GO
