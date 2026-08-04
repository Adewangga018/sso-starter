/* ============================================================================
   cuti v2 - aturan akrual & cuti bersama/nasional (schema cuti, db_mygcs).
   Perubahan aturan (permintaan atasan SDM):
   - Akrual 12 hari/tahun DI MUKA; saldo awal tahun = min(batas_akumulasi, sisa + 12).
   - batas_akumulasi = 24 (maks 2 tahun).
   - Cuti Bersama = CRUD (rentang tanggal + keterangan + flag mengurangi_hak).
     Yang 'mengurangi hak' memotong saldo SEMUA karyawan sebanyak jumlah harinya.
   - Cuti Nasional = CRUD (rentang tanggal + keterangan), TIDAK pernah memotong hak.

   SQL Server 2014. NON-DESTRUKTIF & idempoten (reset saldo dilakukan terpisah
   di cuti-v2-reset-saldo.sql, sekali jalan). Tidak menyentuh SDM.
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

/* setelan: parameter akrual & batas ---------------------------------------- */
IF COL_LENGTH('cuti.setelan', 'hak_per_tahun') IS NULL
    ALTER TABLE cuti.setelan ADD hak_per_tahun INT NOT NULL CONSTRAINT df_cuti_setelan_hpt DEFAULT (12);
GO
IF COL_LENGTH('cuti.setelan', 'batas_akumulasi') IS NULL
    ALTER TABLE cuti.setelan ADD batas_akumulasi INT NOT NULL CONSTRAINT df_cuti_setelan_batas DEFAULT (24);
GO
-- pastikan baris id=1 ada & nilai default terisi
IF EXISTS (SELECT 1 FROM cuti.setelan WHERE id = 1)
    UPDATE cuti.setelan SET hak_per_tahun = ISNULL(NULLIF(hak_per_tahun,0),12),
                            batas_akumulasi = ISNULL(NULLIF(batas_akumulasi,0),24)
    WHERE id = 1;
ELSE
    INSERT INTO cuti.setelan (id, hak_dasar, cuti_bersama, hak_per_tahun, batas_akumulasi)
    VALUES (1, 24, 0, 12, 24);
GO

/* saldo: kolom akrual (basis sebelum dikurangi cuti bersama) ---------------- */
IF COL_LENGTH('cuti.saldo', 'akrual') IS NULL
    ALTER TABLE cuti.saldo ADD akrual INT NOT NULL CONSTRAINT df_cuti_saldo_akrual DEFAULT (0);
GO

/* cuti_bersama - CRUD Admin SDM. mengurangi_hak=1 memotong saldo semua ------ */
IF OBJECT_ID('cuti.cuti_bersama', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.cuti_bersama
    (
        id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_bersama PRIMARY KEY,
        tgl_mulai      DATE NOT NULL,
        tgl_selesai    DATE NOT NULL,
        jumlah_hari    INT NOT NULL,                 -- hari kerja (Sen-Jum) dalam rentang
        keterangan     NVARCHAR(200) NOT NULL,
        mengurangi_hak BIT NOT NULL CONSTRAINT df_cutiber_kurang DEFAULT (0),
        tahun          INT NOT NULL,                 -- tahun (dari tgl_mulai) utk periode
        id_pembuat     NVARCHAR(50)  NULL,
        nama_pembuat   NVARCHAR(150) NULL,
        dibuat_pada    DATETIME2 NOT NULL CONSTRAINT df_cutiber_dibuat DEFAULT (SYSUTCDATETIME()),
        diubah_pada    DATETIME2 NULL
    );
    CREATE INDEX ix_cuti_bersama_tahun ON cuti.cuti_bersama (tahun);
    PRINT 'Tabel cuti.cuti_bersama dibuat.';
END
ELSE PRINT 'LEWATI: cuti.cuti_bersama sudah ada.';
GO

/* cuti_nasional - CRUD Admin SDM. TIDAK pernah memotong hak ----------------- */
IF OBJECT_ID('cuti.cuti_nasional', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.cuti_nasional
    (
        id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_nasional PRIMARY KEY,
        tgl_mulai    DATE NOT NULL,
        tgl_selesai  DATE NOT NULL,
        jumlah_hari  INT NOT NULL,
        keterangan   NVARCHAR(200) NOT NULL,
        tahun        INT NOT NULL,
        id_pembuat   NVARCHAR(50)  NULL,
        nama_pembuat NVARCHAR(150) NULL,
        dibuat_pada  DATETIME2 NOT NULL CONSTRAINT df_cutinas_dibuat DEFAULT (SYSUTCDATETIME()),
        diubah_pada  DATETIME2 NULL
    );
    CREATE INDEX ix_cuti_nasional_tahun ON cuti.cuti_nasional (tahun);
    PRINT 'Tabel cuti.cuti_nasional dibuat.';
END
ELSE PRINT 'LEWATI: cuti.cuti_nasional sudah ada.';
GO

SET NOEXEC OFF;
GO
