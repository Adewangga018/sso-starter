/* ============================================================================
   Perbaikan aset.kondisi jadi historis (log, bukan upsert 1 baris) + tabel baru
   aset.nomor_internal (nomor aset internal buatan tim Aset, TERPISAH dari
   OBJECTID ERP). Aug 2026.
   ----------------------------------------------------------------------------
   aset.kondisi lama (dibuat 06-overlay-ddl.sql) di-DROP & dibuat ulang - AMAN
   karena tabelnya masih kosong (0 baris, belum pernah dipakai nyata). Tabel
   lain (kondisi, aktivitas, pic_assignment, dan SEMUA tabel di db_mygcs/GCS
   milik modul lain) TIDAK disentuh sama sekali.

   aset.nomor_internal: identifier internal tim Aset, bukan diskrit dari
   dbo.assets.OBJECTID (yang tetap sumber identitas utama). 1 baris per
   objectid (upsert) karena ini identitas/label yang jarang berubah - beda
   sifatnya dari kondisi (state yang berubah sepanjang usia aset).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\07-kondisi-historis-nomor-internal-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.kondisi', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM aset.kondisi)
BEGIN
    RAISERROR('BATAL: aset.kondisi sudah berisi data - skrip ini tidak boleh menjalankan DROP TABLE. Tinjau manual.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.kondisi', 'U') IS NOT NULL
BEGIN
    DROP TABLE aset.kondisi;
    PRINT 'Tabel aset.kondisi lama (upsert) dihapus - kosong, tidak ada data hilang.';
END
GO

IF OBJECT_ID('aset.kondisi', 'U') IS NULL
BEGIN
    CREATE TABLE aset.kondisi
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_kondisi PRIMARY KEY,
        objectid    VARCHAR(20)   NOT NULL,
        kondisi     NVARCHAR(20)  NOT NULL CONSTRAINT DF_aset_kondisi_kondisi DEFAULT ('Baik'), -- 'Baik' | 'Rusak Ringan' | 'Rusak Berat' | 'Hilang'
        catatan     NVARCHAR(500) NULL,
        id_pembuat  NVARCHAR(20)  NOT NULL,
        tgl_dibuat  DATETIME2     NOT NULL CONSTRAINT DF_aset_kondisi_tgldibuat DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_aset_kondisi_objectid ON aset.kondisi (objectid, tgl_dibuat DESC);
    PRINT 'Tabel aset.kondisi (historis) dibuat.';
END
GO

IF OBJECT_ID('aset.nomor_internal', 'U') IS NULL
BEGIN
    CREATE TABLE aset.nomor_internal
    (
        objectid     VARCHAR(20)  NOT NULL CONSTRAINT PK_aset_nomor_internal PRIMARY KEY,
        nomor_aset   NVARCHAR(50) NOT NULL CONSTRAINT UQ_aset_nomor_internal_nomor UNIQUE,
        catatan      NVARCHAR(500) NULL,
        id_pengubah  NVARCHAR(20) NOT NULL,
        tgl_diubah   DATETIME2    NOT NULL CONSTRAINT DF_aset_nomor_internal_tgl DEFAULT (SYSUTCDATETIME())
    );
    PRINT 'Tabel aset.nomor_internal dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.nomor_internal sudah ada.';
GO