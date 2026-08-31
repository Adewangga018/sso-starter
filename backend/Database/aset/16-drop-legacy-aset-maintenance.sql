/* ============================================================================
   Hapus tabel lama aset.aset & aset.maintenance (Aug 2026) - kode aplikasi yang
   memakainya sudah dihapus total (List/Detail/CRUD lama + fitur Maintenance,
   digantikan Inventaris berbasis ERP dbo.assets). Kedua tabel dikonfirmasi KOSONG
   (0 baris) sebelum skrip ini dibuat - lihat riwayat chat, dicek manual via
   SELECT COUNT(*), bukan asumsi.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\16-drop-legacy-aset-maintenance.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

-- Jaring pengaman: batalkan kalau ternyata ada baris (jangan sampai hapus data).
IF OBJECT_ID('aset.maintenance', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM aset.maintenance)
BEGIN
    RAISERROR('BATAL: aset.maintenance TIDAK kosong - hapus dibatalkan demi keamanan data.', 16, 1);
    SET NOEXEC ON;
END
GO
IF OBJECT_ID('aset.aset', 'U') IS NOT NULL AND EXISTS (SELECT 1 FROM aset.aset)
BEGIN
    RAISERROR('BATAL: aset.aset TIDAK kosong - hapus dibatalkan demi keamanan data.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.maintenance', 'U') IS NOT NULL
BEGIN
    DROP TABLE aset.maintenance;
    PRINT 'Tabel aset.maintenance dihapus.';
END
ELSE
    PRINT 'LEWATI: aset.maintenance sudah tidak ada.';
GO

IF OBJECT_ID('aset.aset', 'U') IS NOT NULL
BEGIN
    DROP TABLE aset.aset;
    PRINT 'Tabel aset.aset dihapus.';
END
ELSE
    PRINT 'LEWATI: aset.aset sudah tidak ada.';
GO
