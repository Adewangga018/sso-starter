/* ============================================================================
   prosedur - modul My Prosedur (SOP & Kebijakan) MyGCS, di db_mygcs. Layer paralel.
   Repository dokumen terpusat + kontrol versi + pencarian + acknowledgement.
   Pengelola = "Admin Kepatuhan" (Departemen Kepatuhan / fungsi Tata Kelola) -
   lihat ModuleAccessService.IsProsedurAdminAsync. Semua karyawan dapat membaca
   dokumen berlaku & menyatakan sudah baca (acknowledgement, dipantau).

   Kontrol versi: satu dokumen (prosedur.dokumen) punya banyak versi
   (prosedur.versi). Hanya SATU versi berstatus 'Berlaku'; versi lama jadi 'Usang'.
   Acknowledgement terikat ke VERSI (versi baru → perlu baca ulang).

   SQL Server 2014 (compat 120). NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE).
   Idempoten. File dokumen disimpan sebagai VARBINARY(MAX) di prosedur.versi.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\prosedur-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('prosedur') IS NULL
    EXEC('CREATE SCHEMA prosedur AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   dokumen - identitas dokumen (lintas versi)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('prosedur.dokumen', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.dokumen
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_dokumen PRIMARY KEY,
        kode        NVARCHAR(50)  NOT NULL,                 -- nomor dokumen (mis. SOP-SDM-001)
        judul       NVARCHAR(250) NOT NULL,
        jenis       NVARCHAR(30)  NOT NULL,                 -- SOP | Kebijakan | Instruksi Kerja | Formulir
        unit        NVARCHAR(150) NULL,                     -- unit/departemen pemilik
        kategori    NVARCHAR(100) NULL,                     -- tag utk pencarian
        deskripsi   NVARCHAR(1000) NULL,
        id_pembuat  NVARCHAR(20)  NOT NULL,
        tgl_dibuat  DATETIME2 NOT NULL CONSTRAINT df_prosedur_dok_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah  DATETIME2 NULL,
        CONSTRAINT uq_prosedur_dokumen_kode UNIQUE (kode),
        CONSTRAINT ck_prosedur_dokumen_jenis CHECK (jenis IN ('SOP','Kebijakan','Instruksi Kerja','Formulir'))
    );
    CREATE INDEX ix_prosedur_dokumen_jenis ON prosedur.dokumen (jenis);
    PRINT 'Tabel prosedur.dokumen dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.dokumen sudah ada.';
GO

/* ---------------------------------------------------------------------------
   versi - tiap versi dokumen + berkasnya. Berlaku = versi aktif (maks 1/dokumen).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('prosedur.versi', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.versi
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_versi PRIMARY KEY,
        id_dokumen    BIGINT NOT NULL,
        versi         INT NOT NULL,                         -- 1,2,3,...
        ringkasan     NVARCHAR(500) NULL,                   -- ringkasan perubahan
        nama_file     NVARCHAR(255) NOT NULL,
        tipe_file     NVARCHAR(120) NULL,
        konten        VARBINARY(MAX) NOT NULL,
        status        NVARCHAR(20) NOT NULL CONSTRAINT df_prosedur_versi_status DEFAULT ('Berlaku'),
        tgl_berlaku   DATE NULL,
        id_penerbit   NVARCHAR(20)  NOT NULL,
        nama_penerbit NVARCHAR(150) NULL,
        tgl_unggah    DATETIME2 NOT NULL CONSTRAINT df_prosedur_versi_unggah DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_prosedur_versi_dokumen FOREIGN KEY (id_dokumen) REFERENCES prosedur.dokumen (id),
        CONSTRAINT uq_prosedur_versi UNIQUE (id_dokumen, versi),
        CONSTRAINT ck_prosedur_versi_status CHECK (status IN ('Berlaku','Usang','Ditarik'))
    );
    CREATE INDEX ix_prosedur_versi_dokumen ON prosedur.versi (id_dokumen);
    CREATE INDEX ix_prosedur_versi_status ON prosedur.versi (status);
    PRINT 'Tabel prosedur.versi dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.versi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   acknowledgement - pernyataan "sudah baca & paham" per (versi, karyawan)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('prosedur.acknowledgement', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.acknowledgement
    (
        id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_ack PRIMARY KEY,
        id_versi   BIGINT NOT NULL,
        id_dokumen BIGINT NOT NULL,
        nik        NVARCHAR(20)  NOT NULL,
        nama       NVARCHAR(150) NULL,
        tgl        DATETIME2 NOT NULL CONSTRAINT df_prosedur_ack_tgl DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_prosedur_ack_versi FOREIGN KEY (id_versi) REFERENCES prosedur.versi (id),
        CONSTRAINT uq_prosedur_ack UNIQUE (id_versi, nik)
    );
    CREATE INDEX ix_prosedur_ack_nik ON prosedur.acknowledgement (nik);
    CREATE INDEX ix_prosedur_ack_dokumen ON prosedur.acknowledgement (id_dokumen);
    PRINT 'Tabel prosedur.acknowledgement dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.acknowledgement sudah ada.';
GO

SET NOEXEC OFF;
GO
