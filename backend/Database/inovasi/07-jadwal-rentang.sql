/* ============================================================================
   inovasi - P.3 Jadwal (PDCA): rentang tanggal per sel bulan.
   Menambahkan kolom inovasi.jadwal.rentang (JSON) untuk menyimpan rentang tanggal
   tiap sel bulan per baris (tahapan x jenis), mis:
     {"7":["2026-07-01","2026-07-15"],"8":["2026-08-01","2026-08-20"]}
   Kolom `bulan` tetap menyimpan CSV bulan yang terisi (turunan dari rentang) untuk
   pengarsiran & tampilan ringkas. Idempoten. Jalankan setelah 01-schema-ddl.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('inovasi.jadwal', 'rentang') IS NULL
BEGIN
    ALTER TABLE inovasi.jadwal ADD rentang NVARCHAR(MAX) NULL;
    PRINT 'Kolom inovasi.jadwal.rentang ditambahkan.';
END
ELSE
    PRINT 'Kolom inovasi.jadwal.rentang sudah ada.';
GO

SET NOEXEC OFF;
GO
