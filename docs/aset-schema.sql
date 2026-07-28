/* ============================================================================
   aset - skema My Asset MyGCS, di db_mygcs. Layer paralel; tidak menyentuh SDM.
   Tahap inisiasi: Inventaris aset (inti) + Jadwal maintenance. Peminjaman & QR
   menyusul. Pengelola = "Admin Aset" (jajaran Departemen Kepatuhan Kabag ke atas
   s/d GM SKP) - lihat ModuleAccessService.IsAsetAdminAsync.

   SQL Server 2014 (compat 120): tanpa CREATE OR ALTER / DROP IF EXISTS.
   NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE). Idempoten.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\aset-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('aset') IS NULL
    EXEC('CREATE SCHEMA aset AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   aset - master inventaris aset
   --------------------------------------------------------------------------- */
IF OBJECT_ID('aset.aset', 'U') IS NULL
BEGIN
    CREATE TABLE aset.aset
    (
        id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_aset PRIMARY KEY,
        kode           NVARCHAR(40)  NOT NULL,                 -- tag/kode aset (utk QR nanti)
        nama           NVARCHAR(200) NOT NULL,
        kategori       NVARCHAR(60)  NULL,                     -- Elektronik/Kendaraan/Furnitur/...
        merk           NVARCHAR(100) NULL,
        nomor_seri     NVARCHAR(100) NULL,
        lokasi         NVARCHAR(150) NULL,
        id_pic         NVARCHAR(20)  NULL,                     -- penanggung jawab (NIK), lintas-DB tanpa FK
        nama_pic       NVARCHAR(150) NULL,
        kondisi        NVARCHAR(20)  NOT NULL CONSTRAINT df_aset_kondisi DEFAULT ('Baik'),
        status         NVARCHAR(20)  NOT NULL CONSTRAINT df_aset_status DEFAULT ('Aktif'),
        nilai          DECIMAL(18,2) NULL,                     -- nilai/harga perolehan
        tgl_perolehan  DATE NULL,
        catatan        NVARCHAR(500) NULL,
        id_pembuat     NVARCHAR(20)  NOT NULL,
        tgl_dibuat     DATETIME2 NOT NULL CONSTRAINT df_aset_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah     DATETIME2 NULL,
        CONSTRAINT uq_aset_kode UNIQUE (kode),
        CONSTRAINT ck_aset_kondisi CHECK (kondisi IN ('Baik','Rusak Ringan','Rusak Berat','Hilang')),
        CONSTRAINT ck_aset_status  CHECK (status  IN ('Aktif','Dipinjam','Perbaikan','Dihapus'))
    );
    CREATE INDEX ix_aset_kategori ON aset.aset (kategori);
    CREATE INDEX ix_aset_pic ON aset.aset (id_pic);
    PRINT 'Tabel aset.aset dibuat.';
END
ELSE PRINT 'LEWATI: aset.aset sudah ada.';
GO

/* ---------------------------------------------------------------------------
   maintenance - jadwal & riwayat pemeliharaan aset
   --------------------------------------------------------------------------- */
IF OBJECT_ID('aset.maintenance', 'U') IS NULL
BEGIN
    CREATE TABLE aset.maintenance
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_aset_maintenance PRIMARY KEY,
        id_aset     BIGINT NOT NULL,
        jenis       NVARCHAR(30)  NOT NULL CONSTRAINT df_maint_jenis DEFAULT ('Rutin'),   -- Rutin/Perbaikan/Inspeksi
        tgl_jadwal  DATE NOT NULL,
        tgl_selesai DATE NULL,
        status      NVARCHAR(20)  NOT NULL CONSTRAINT df_maint_status DEFAULT ('Terjadwal'),
        pelaksana   NVARCHAR(150) NULL,                        -- teknisi/vendor
        biaya       DECIMAL(18,2) NULL,
        catatan     NVARCHAR(500) NULL,
        id_pembuat  NVARCHAR(20)  NOT NULL,
        tgl_dibuat  DATETIME2 NOT NULL CONSTRAINT df_maint_dibuat DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_maint_aset FOREIGN KEY (id_aset) REFERENCES aset.aset (id),
        CONSTRAINT ck_maint_jenis  CHECK (jenis  IN ('Rutin','Perbaikan','Inspeksi')),
        CONSTRAINT ck_maint_status CHECK (status IN ('Terjadwal','Selesai','Batal'))
    );
    CREATE INDEX ix_maint_aset ON aset.maintenance (id_aset);
    CREATE INDEX ix_maint_jadwal ON aset.maintenance (tgl_jadwal);
    PRINT 'Tabel aset.maintenance dibuat.';
END
ELSE PRINT 'LEWATI: aset.maintenance sudah ada.';
GO

SET NOEXEC OFF;
GO
