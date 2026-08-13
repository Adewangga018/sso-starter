/* ============================================================================
   aset.tidak_produktif_aktivitas - log aktivitas per aset tidak produktif
   (Aug 2026): pembersihan lingkungan, kunjungan calon pembeli, negosiasi
   harga, dsb. PT GCS, di db_mygcs, schema aset.
   ----------------------------------------------------------------------------
   BEDA dengan aset.tidak_produktif (yang sengaja berdiri sendiri tanpa FK):
   tabel ini SECARA SENGAJA punya FK ke aset.tidak_produktif.id, karena satu
   baris aktivitas memang milik satu aset spesifik (bukan entitas independen).
   ON DELETE CASCADE - riwayat aktivitas ikut terhapus kalau asetnya dihapus.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\05-tidak-produktif-aktivitas-ddl.sql

   Idempoten: aman dijalankan ulang.
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

IF OBJECT_ID('aset.tidak_produktif_aktivitas', 'U') IS NULL
BEGIN
    CREATE TABLE aset.tidak_produktif_aktivitas
    (
        id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_tp_aktivitas PRIMARY KEY,
        id_aset        BIGINT         NOT NULL CONSTRAINT FK_aset_tp_aktivitas_aset
                            REFERENCES aset.tidak_produktif (id) ON DELETE CASCADE,
        jenis          NVARCHAR(50)   NOT NULL,   -- 'Pembersihan Lingkungan' | 'Kunjungan Calon Pembeli' | 'Negosiasi Harga' | 'Perawatan/Keamanan' | 'Lainnya' (bebas, tidak divalidasi ketat)
        tgl_aktivitas  DATE           NOT NULL,
        deskripsi      NVARCHAR(1000) NULL,       -- detail bebas, mis. "pembersihan semak & pagar keliling"
        pihak_terkait  NVARCHAR(200)  NULL,       -- mis. nama calon pembeli / vendor kebersihan
        nilai_nego     DECIMAL(18,2)  NULL,       -- harga tawaran/nego (Rp), khusus aktivitas terkait calon pembeli
        id_pembuat     NVARCHAR(20)   NOT NULL,
        tgl_dibuat     DATETIME2      NOT NULL CONSTRAINT DF_aset_tp_aktivitas_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah    NVARCHAR(20)   NULL,
        tgl_diubah     DATETIME2      NULL
    );
    CREATE INDEX IX_aset_tp_aktivitas_id_aset ON aset.tidak_produktif_aktivitas (id_aset, tgl_aktivitas DESC);
    PRINT 'Tabel aset.tidak_produktif_aktivitas dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.tidak_produktif_aktivitas sudah ada.';
GO