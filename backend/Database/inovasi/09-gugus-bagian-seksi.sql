/* ============================================================================
   inovasi - bagian A Identitas Gugus: kolom "Bagian / Seksi".
   Form resmi (SS & F-GIO-01) mencantumkan Unit/Departemen DAN Bagian/Seksi pada
   identitas gugus. Departemen/Kompartemen sudah diturunkan otomatis dari data
   organisasi; Bagian/Seksi diisi manual oleh gugus.
   Idempoten. Jalankan setelah 01-schema-ddl.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('inovasi.gugus', 'bagian_seksi') IS NULL
BEGIN
    ALTER TABLE inovasi.gugus ADD bagian_seksi NVARCHAR(150) NULL;
    PRINT 'Kolom inovasi.gugus.bagian_seksi ditambahkan.';
END
ELSE
    PRINT 'Kolom inovasi.gugus.bagian_seksi sudah ada.';
GO

SET NOEXEC OFF;
GO
