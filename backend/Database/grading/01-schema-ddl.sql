/* ============================================================================
   grading - skema Band/Job Grade/Person Grade PT GCS, di db_mygcs
   ----------------------------------------------------------------------------
   LATAR BELAKANG
   Referensi desain: "Diagram Desain Database MYGCS - Skema Grading" (image),
   dikoreksi sbb (keputusan final dipakai di sini, BUKAN versi pertama diagram):
     - jabatan.jg (FK -> job_grade.jg, NULL untuk Direksi) - JG melekat di jabatan,
       bukan di band. band cuma jenjang (tanpa jg_min/jg_max).
     - Tabel transaksi "jabatan_grade" DIHAPUS - tidak diperlukan karena JG
       sudah melekat langsung di kolom jabatan.jg.
     - job_grade cuma peta jg(7-21) -> id_band, tanpa duplikasi rentang di band.
   Sumber data: "Analisis_Pemetaan_JG_PT_GCS_Revisi5", "Data 85 Pegawai Organik
   GCS", "Lampiran Struktur Organisasi 1 April 2026", "Contoh-JobGrade-PG-final".

   REFERENSI LINTAS DATABASE (TANPA FK)
   grading.penempatan.id_karyawan dan grading.person_grade.id_karyawan berisi
   nilai yang SECARA LOGIS sama dengan GCS.dbo.MST_PEGAWAI.ID_KARYAWAN (mis.
   'T.980187'). SQL Server tidak mendukung FOREIGN KEY lintas database, jadi
   relasi ini TIDAK diberi constraint FK sungguhan - hanya kolom + index, sama
   persis seperti anotasi "REFERENSI PEGAWAI (Lintas-DB, Tanpa FK)" di diagram.
   Integritasnya sudah diverifikasi manual sebelum seeding: seluruh 85
   ID_KARYAWAN yang dipakai di sini memang ada di GCS.dbo.MST_PEGAWAI.

   Skrip ini TIDAK menyentuh database GCS sama sekali (hanya SELECT terpisah
   dipakai untuk verifikasi, bukan bagian dari skrip ini).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\grading\01-schema-ddl.sql

   Idempoten: aman dijalankan ulang - tiap objek dicek dulu sebelum dibuat.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    DECLARE @db SYSNAME = DB_NAME();
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs, bukan %s.', 16, 1, @db);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'grading')
BEGIN
    EXEC('CREATE SCHEMA grading AUTHORIZATION dbo');
    PRINT 'Schema grading dibuat.';
END
ELSE
    PRINT 'LEWATI: schema grading sudah ada.';
GO

/* ---------------------------------------------------------------------------
   band - jenjang saja (tanpa jg_min/jg_max, itu sudah pindah ke job_grade)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.band', 'U') IS NULL
BEGIN
    CREATE TABLE grading.band
    (
        id_band     TINYINT      NOT NULL CONSTRAINT PK_grading_band PRIMARY KEY,
        kode        NVARCHAR(10) NOT NULL,
        nama        NVARCHAR(50) NOT NULL,
        urutan      TINYINT      NOT NULL,
        keterangan  NVARCHAR(200) NULL,
        CONSTRAINT UQ_grading_band_kode UNIQUE (kode),
        CONSTRAINT UQ_grading_band_urutan UNIQUE (urutan)
    );
    PRINT 'Tabel grading.band dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.band sudah ada.';
GO

/* ---------------------------------------------------------------------------
   job_grade - skala JG 7-21, tiap JG dipetakan ke satu band. Ini satu-satunya
   tempat rentang JG per band didefinisikan (band sendiri tidak lagi punya
   jg_min/jg_max).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.job_grade', 'U') IS NULL
BEGIN
    CREATE TABLE grading.job_grade
    (
        jg       TINYINT NOT NULL CONSTRAINT PK_grading_job_grade PRIMARY KEY,
        id_band  TINYINT NOT NULL,
        CONSTRAINT FK_job_grade_band FOREIGN KEY (id_band) REFERENCES grading.band (id_band)
    );
    PRINT 'Tabel grading.job_grade dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.job_grade sudah ada.';
GO

/* ---------------------------------------------------------------------------
   unit_organisasi - hierarki unit (Direktorat/Kompartemen/Departemen/Region)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.unit_organisasi', 'U') IS NULL
BEGIN
    CREATE TABLE grading.unit_organisasi
    (
        id_unit         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_grading_unit_organisasi PRIMARY KEY,
        nama            NVARCHAR(150) NOT NULL,
        tipe            NVARCHAR(30)  NOT NULL,  -- Direktorat, Kompartemen, Departemen, Region, Kelompok
        id_unit_induk   INT NULL,
        wilayah         NVARCHAR(50) NULL,
        id_struktur_sdm INT NULL,                -- reserved: id unit pada struktur SDM/payroll GCS (belum dipetakan)
        keterangan      NVARCHAR(200) NULL,
        CONSTRAINT FK_unit_organisasi_induk FOREIGN KEY (id_unit_induk) REFERENCES grading.unit_organisasi (id_unit)
    );
    CREATE INDEX IX_unit_organisasi_induk ON grading.unit_organisasi (id_unit_induk);
    PRINT 'Tabel grading.unit_organisasi dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.unit_organisasi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   jabatan - JG MELEKAT DI JABATAN (kolom jg, FK -> job_grade.jg, NULL untuk
   Direksi karena Direksi di luar skala 7-21). id_band tetap disimpan di sini
   sebagai jenjang (redundan-tapi-cepat terhadap job_grade.id_band; jg=NULL
   untuk Direksi maka id_band=0 dipakai untuk baris Direksi).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.jabatan', 'U') IS NULL
BEGIN
    CREATE TABLE grading.jabatan
    (
        id_jabatan       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_grading_jabatan PRIMARY KEY,
        kode             INT NULL,
        nama_jabatan     NVARCHAR(150) NOT NULL,
        id_band          TINYINT NOT NULL,
        jg               TINYINT NULL,            -- NULL hanya untuk Direksi (di luar skala 7-21)
        id_unit          INT NULL,
        id_atasan        INT NULL,                -- self-FK; NULL untuk Direktur Utama
        inti             BIT NULL,                 -- 1=Inti, 0=Pendukung, NULL=tidak diklasifikasi
        kelompok_fungsi  NVARCHAR(50) NULL,
        jumlah_formasi   SMALLINT NULL,
        alasan           NVARCHAR(500) NULL,
        id_jabatan_sdm   INT NULL,                 -- reserved: id jabatan pada struktur SDM/payroll GCS
        aktif            BIT NOT NULL CONSTRAINT DF_grading_jabatan_aktif DEFAULT (1),
        dibuat_pada      DATETIME2 NOT NULL CONSTRAINT DF_grading_jabatan_dibuat DEFAULT (SYSDATETIME()),
        diubah_pada      DATETIME2 NULL,
        CONSTRAINT FK_jabatan_band     FOREIGN KEY (id_band)   REFERENCES grading.band (id_band),
        CONSTRAINT FK_jabatan_jg       FOREIGN KEY (jg)        REFERENCES grading.job_grade (jg),
        CONSTRAINT FK_jabatan_unit     FOREIGN KEY (id_unit)   REFERENCES grading.unit_organisasi (id_unit),
        CONSTRAINT FK_jabatan_atasan   FOREIGN KEY (id_atasan) REFERENCES grading.jabatan (id_jabatan),
        CONSTRAINT CK_jabatan_jg_direksi CHECK (id_band <> 0 OR jg IS NULL)
    );
    CREATE INDEX IX_jabatan_atasan ON grading.jabatan (id_atasan);
    CREATE INDEX IX_jabatan_unit   ON grading.jabatan (id_unit);
    CREATE INDEX IX_jabatan_band_jg ON grading.jabatan (id_band, jg);
    PRINT 'Tabel grading.jabatan dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.jabatan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   jabatan_hirarki - closure table atasan-bawahan SEGALA TINGKAT, dibangun
   OTOMATIS dari jabatan.id_atasan lewat grading.usp_bangun_hirarki_jabatan
   (lihat 04-proc-views.sql). Baris (X,X,0) = dirinya sendiri (kedalaman 0).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.jabatan_hirarki', 'U') IS NULL
BEGIN
    CREATE TABLE grading.jabatan_hirarki
    (
        id_jabatan_atasan  INT NOT NULL,
        id_jabatan_bawahan INT NOT NULL,
        kedalaman          INT NOT NULL,
        CONSTRAINT PK_grading_jabatan_hirarki PRIMARY KEY (id_jabatan_atasan, id_jabatan_bawahan),
        CONSTRAINT FK_jabatan_hirarki_atasan  FOREIGN KEY (id_jabatan_atasan)  REFERENCES grading.jabatan (id_jabatan),
        CONSTRAINT FK_jabatan_hirarki_bawahan FOREIGN KEY (id_jabatan_bawahan) REFERENCES grading.jabatan (id_jabatan)
    );
    CREATE INDEX IX_jabatan_hirarki_bawahan ON grading.jabatan_hirarki (id_jabatan_bawahan);
    PRINT 'Tabel grading.jabatan_hirarki dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.jabatan_hirarki sudah ada.';
GO

/* ---------------------------------------------------------------------------
   penempatan - siapa mengisi jabatan mana (incumbent). id_karyawan mengacu ke
   GCS.dbo.MST_PEGAWAI.ID_KARYAWAN TANPA FK (lintas database - lihat catatan
   di atas). nama disimpan sebagai salinan/snapshot supaya tabel ini tetap
   terbaca tanpa harus JOIN lintas-database.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.penempatan', 'U') IS NULL
BEGIN
    CREATE TABLE grading.penempatan
    (
        id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_grading_penempatan PRIMARY KEY,
        id_jabatan       INT NOT NULL,
        id_karyawan      NVARCHAR(20) NOT NULL,   -- = GCS.dbo.MST_PEGAWAI.ID_KARYAWAN (tanpa FK, lintas-DB)
        nama             NVARCHAR(150) NOT NULL,
        tmt              DATE NULL,               -- tanggal mulai menjabat (dipakai: tanggal masuk kerja)
        tanggal_selesai  DATE NULL,
        status           NVARCHAR(20) NOT NULL CONSTRAINT DF_grading_penempatan_status DEFAULT ('Aktif'),
        catatan          NVARCHAR(400) NULL,
        dibuat_pada      DATETIME2 NOT NULL CONSTRAINT DF_grading_penempatan_dibuat DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_penempatan_jabatan FOREIGN KEY (id_jabatan) REFERENCES grading.jabatan (id_jabatan),
        CONSTRAINT CK_penempatan_status CHECK (status IN ('Aktif', 'Selesai'))
    );
    -- Satu karyawan hanya boleh punya SATU penempatan aktif pada satu waktu.
    CREATE UNIQUE INDEX UQ_penempatan_karyawan_aktif
        ON grading.penempatan (id_karyawan)
        WHERE status = 'Aktif';
    CREATE INDEX IX_penempatan_jabatan ON grading.penempatan (id_jabatan);
    PRINT 'Tabel grading.penempatan dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.penempatan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   person_grade - PG pegawai per tahun. id_karyawan sama aturannya dengan
   penempatan: mengacu ke GCS.dbo.MST_PEGAWAI.ID_KARYAWAN tanpa FK lintas-DB.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.person_grade', 'U') IS NULL
BEGIN
    CREATE TABLE grading.person_grade
    (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_grading_person_grade PRIMARY KEY,
        id_karyawan    NVARCHAR(20) NOT NULL,
        nama           NVARCHAR(150) NOT NULL,
        pg             TINYINT NOT NULL,
        golongan_lama  NCHAR(1) NULL,           -- golongan sistem lama (mis. 'D'), hanya terisi untuk sebagian Band 6
        tahun_berlaku  SMALLINT NOT NULL,
        catatan        NVARCHAR(400) NULL,
        dibuat_pada    DATETIME2 NOT NULL CONSTRAINT DF_grading_person_grade_dibuat DEFAULT (SYSDATETIME())
    );
    CREATE UNIQUE INDEX UQ_person_grade_karyawan_tahun ON grading.person_grade (id_karyawan, tahun_berlaku);
    PRINT 'Tabel grading.person_grade dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.person_grade sudah ada.';
GO

SET NOEXEC OFF;
GO
