/* ============================================================================
   aset.mutasi - catatan pengajuan mutasi lokasi/wilayah (kode CC) aset, Aug 2026.
   Overlay MyGCS MURNI - TIDAK PERNAH menulis ke dbo.assets (LOKASI/KODE_CC/NILAI_BUKU
   di ERP tetap diubah manual oleh tim akunting setelah mereka proses approval-nya di
   ERP sendiri). MyGCS di sini cuma mencatat riwayat pengajuan supaya ada jejak "aset X
   diajukan pindah dari wilayah A ke B pada tanggal Y", dan status apakah sudah diproses
   akunting atau belum (ditandai manual oleh Admin Aset, bukan integrasi otomatis ke ERP).

   status: 'Diajukan' -> 'Selesai' (upsert 1 arah, tidak ada 'Ditolak' - kalau batal cukup
   dihapus/diabaikan, ini murni catatan bukan approval-gate berjenjang).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\17-mutasi-lokasi-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.mutasi', 'U') IS NULL
BEGIN
    CREATE TABLE aset.mutasi
    (
        id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_mutasi PRIMARY KEY,
        objectid        VARCHAR(50)   NOT NULL,
        lokasi_lama     NVARCHAR(200) NULL,
        lokasi_baru     NVARCHAR(200) NOT NULL,
        kode_cc_lama    VARCHAR(20)   NULL,
        wilayah_lama    NVARCHAR(200) NULL,
        kode_cc_baru    VARCHAR(20)   NULL,
        wilayah_baru    NVARCHAR(200) NULL,
        nilai_buku_saat_diajukan DECIMAL(18,2) NULL,  -- snapshot NILAI_BUKU ERP saat pengajuan (bukan sumber kebenaran, cuma konteks)
        alasan          NVARCHAR(500) NULL,
        status          NVARCHAR(20)  NOT NULL CONSTRAINT DF_aset_mutasi_status DEFAULT (N'Diajukan'),
        id_pembuat      NVARCHAR(20)  NOT NULL,
        tgl_dibuat      DATETIME2     NOT NULL CONSTRAINT DF_aset_mutasi_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah     NVARCHAR(20)  NULL,
        tgl_diubah      DATETIME2     NULL,
        CONSTRAINT CK_aset_mutasi_status CHECK (status IN (N'Diajukan', N'Selesai'))
    );
    CREATE INDEX IX_aset_mutasi_objectid ON aset.mutasi (objectid);
    PRINT 'Tabel aset.mutasi dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.mutasi sudah ada.';
GO
