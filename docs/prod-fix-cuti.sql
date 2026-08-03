/* ============================================================================
   PATCH PRODUKSI - Cuti My Personal (error 500 "Terjadi kesalahan").
   Penyebab: DB produksi belum punya objek/kolom cuti terbaru (dibuat di dev).

   AMAN & NON-DESTRUKTIF: TIDAK men-drop cuti.saldo / cuti.pengajuan, jadi data
   saldo & pengajuan yang sudah ada TIDAK hilang. Hanya membuat yang belum ada
   dan menambah kolom yang belum ada. Idempoten (boleh dijalankan berulang).

   JANGAN memakai docs\cuti-schema.sql di produksi: skrip itu DROP TABLE saldo &
   pengajuan (menghapus data). Pakai skrip ini.

   CARA PAKAI (di server DB PRODUKSI):
     sqlcmd -S <server-prod> -U sa -P <password> -d db_mygcs -C -i docs\prod-fix-cuti.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: jalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('cuti') IS NULL EXEC('CREATE SCHEMA cuti');
GO

/* 1) cuti.saldo -------------------------------------------------------------
   Bila belum ada, buat lengkap. Bila sudah ada (versi lama), tambah kolom yang
   belum ada saja - data lama tetap. */
IF OBJECT_ID('cuti.saldo', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.saldo (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_saldo PRIMARY KEY,
        id_karyawan     NVARCHAR(50)  NOT NULL,
        nama            NVARCHAR(200) NULL,
        tmt             DATE          NULL,
        periode         NVARCHAR(20)  NOT NULL CONSTRAINT df_saldo_periode DEFAULT '2024-2025',
        hak             INT           NOT NULL CONSTRAINT df_saldo_hak   DEFAULT 0,
        cuti_bersama    INT           NOT NULL CONSTRAINT df_saldo_cb    DEFAULT 0,
        diambil         INT           NOT NULL CONSTRAINT df_saldo_amb   DEFAULT 0,
        saldo           INT           NOT NULL CONSTRAINT df_saldo_sisa  DEFAULT 0,
        tgl_cutoff      DATE          NULL,
        dibuat_pada     DATETIME2     NOT NULL CONSTRAINT df_saldo_dibuat DEFAULT SYSUTCDATETIME(),
        diperbarui_pada DATETIME2     NOT NULL CONSTRAINT df_saldo_ubah   DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uq_cuti_saldo_karyawan UNIQUE (id_karyawan)
    );
    PRINT 'cuti.saldo dibuat.';
END
ELSE
BEGIN
    IF COL_LENGTH('cuti.saldo','periode')      IS NULL ALTER TABLE cuti.saldo ADD periode      NVARCHAR(20) NOT NULL CONSTRAINT df_saldo_periode DEFAULT '2024-2025';
    IF COL_LENGTH('cuti.saldo','hak')          IS NULL ALTER TABLE cuti.saldo ADD hak          INT NOT NULL CONSTRAINT df_saldo_hak  DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','cuti_bersama') IS NULL ALTER TABLE cuti.saldo ADD cuti_bersama INT NOT NULL CONSTRAINT df_saldo_cb   DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','diambil')      IS NULL ALTER TABLE cuti.saldo ADD diambil      INT NOT NULL CONSTRAINT df_saldo_amb  DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','saldo')        IS NULL ALTER TABLE cuti.saldo ADD saldo        INT NOT NULL CONSTRAINT df_saldo_sisa DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','tmt')          IS NULL ALTER TABLE cuti.saldo ADD tmt          DATE NULL;
    IF COL_LENGTH('cuti.saldo','nama')         IS NULL ALTER TABLE cuti.saldo ADD nama         NVARCHAR(200) NULL;
    IF COL_LENGTH('cuti.saldo','tgl_cutoff')   IS NULL ALTER TABLE cuti.saldo ADD tgl_cutoff   DATE NULL;
    IF COL_LENGTH('cuti.saldo','dibuat_pada')  IS NULL ALTER TABLE cuti.saldo ADD dibuat_pada  DATETIME2 NOT NULL CONSTRAINT df_saldo_dibuat DEFAULT SYSUTCDATETIME();
    IF COL_LENGTH('cuti.saldo','diperbarui_pada') IS NULL ALTER TABLE cuti.saldo ADD diperbarui_pada DATETIME2 NOT NULL CONSTRAINT df_saldo_ubah DEFAULT SYSUTCDATETIME();
    PRINT 'cuti.saldo diperiksa/ditambal (kolom yang belum ada ditambahkan).';
END
GO

/* 2) cuti.pengajuan --------------------------------------------------------- */
IF OBJECT_ID('cuti.pengajuan', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.pengajuan (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_peng PRIMARY KEY,
        id_karyawan   NVARCHAR(50)  NOT NULL,
        nama          NVARCHAR(200) NULL,
        id_atasan     NVARCHAR(50)  NULL,
        tgl_mulai     DATE          NOT NULL,
        tgl_selesai   DATE          NOT NULL,
        jumlah_hari   INT           NOT NULL,
        keterangan    NVARCHAR(500) NULL,
        status        NVARCHAR(20)  NOT NULL CONSTRAINT df_peng_status DEFAULT 'Menunggu',
        komentar      NVARCHAR(500) NULL,
        tgl_pengajuan DATETIME2     NOT NULL CONSTRAINT df_peng_tgl DEFAULT SYSUTCDATETIME(),
        tgl_keputusan DATETIME2     NULL,
        CONSTRAINT ck_peng_status CHECK (status IN ('Menunggu','Disetujui','Ditolak','Batal'))
    );
    PRINT 'cuti.pengajuan dibuat.';
END
ELSE PRINT 'cuti.pengajuan sudah ada (dilewati).';
GO

/* 3) cuti.setelan (penyebab paling mungkin dari 500) ------------------------ */
IF OBJECT_ID('cuti.setelan', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.setelan (
        id              TINYINT NOT NULL CONSTRAINT pk_cuti_setelan PRIMARY KEY,
        hak_dasar       INT NOT NULL CONSTRAINT df_cuti_setelan_hak DEFAULT (24),
        cuti_bersama    INT NOT NULL CONSTRAINT df_cuti_setelan_cb  DEFAULT (0),
        diperbarui_pada DATETIME2 NULL,
        diperbarui_oleh NVARCHAR(150) NULL,
        CONSTRAINT ck_cuti_setelan_single CHECK (id = 1)
    );
    INSERT INTO cuti.setelan (id, hak_dasar, cuti_bersama) VALUES (1, 24, 0);
    PRINT 'cuti.setelan dibuat + baris id=1 diisi.';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cuti.setelan WHERE id = 1)
        INSERT INTO cuti.setelan (id, hak_dasar, cuti_bersama) VALUES (1, 24, 0);
    PRINT 'cuti.setelan sudah ada (baris id=1 dipastikan ada).';
END
GO

PRINT '=== SELESAI. Muat ulang halaman Cuti. ===';
GO

SET NOEXEC OFF;
GO
