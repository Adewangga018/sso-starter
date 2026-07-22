/* ============================================================================
   inovasi - Tahap 3: GM menetapkan Fasilitator (SS/GIO/5R) & Pembina (GIO) saat
   menyetujui gagasan di kanal GM. Ditambahkan sebagai kolom pada inovasi.gagasan
   supaya bisa di-prefill ke anggota gugus saat pendaftaran.

   Aturan lingkup departemen (ditegakkan di aplikasi, bukan constraint DB):
     - SS  : hanya satu departemen (tidak boleh lintas departemen).
     - GIO/5R : boleh lintas departemen.

   Idempoten. Jalankan setelah 02-gagasan-gio.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('inovasi.gagasan', 'fasilitator_nik') IS NULL
BEGIN
    ALTER TABLE inovasi.gagasan ADD fasilitator_nik NVARCHAR(20) NULL;
    PRINT 'Kolom inovasi.gagasan.fasilitator_nik ditambahkan.';
END
GO
IF COL_LENGTH('inovasi.gagasan', 'fasilitator_nama') IS NULL
BEGIN
    ALTER TABLE inovasi.gagasan ADD fasilitator_nama NVARCHAR(150) NULL;
    PRINT 'Kolom inovasi.gagasan.fasilitator_nama ditambahkan.';
END
GO
IF COL_LENGTH('inovasi.gagasan', 'pembina_nik') IS NULL
BEGIN
    ALTER TABLE inovasi.gagasan ADD pembina_nik NVARCHAR(20) NULL;
    PRINT 'Kolom inovasi.gagasan.pembina_nik ditambahkan.';
END
GO
IF COL_LENGTH('inovasi.gagasan', 'pembina_nama') IS NULL
BEGIN
    ALTER TABLE inovasi.gagasan ADD pembina_nama NVARCHAR(150) NULL;
    PRINT 'Kolom inovasi.gagasan.pembina_nama ditambahkan.';
END
GO

PRINT '=== Skema inovasi Tahap 3 (assign fasilitator/pembina) selesai. ===';
SET NOEXEC OFF;
GO
