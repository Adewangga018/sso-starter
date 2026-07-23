/* ============================================================================
   inovasi - Tahap 4: revisi alur Sumbang Gagasan.
   ----------------------------------------------------------------------------
   - Form gagasan kini berisi latar belakang + masalah + solusi (kolom baru).
   - Peran approval: Verifikator (Manager bagian) -> GM Kompartemen Asal ->
     GM Kompartemen Tujuan (bila lintas kompartemen). GM memilih metodologi;
     Fasilitator/Sekretaris/Anggota diisi Ketua saat mendaftarkan risalah
     (bukan lagi ditetapkan GM). Pembina GIO dihapus.
   - Status gagasan diperbarui mengikuti peran baru.

   Idempoten. Jalankan setelah 03-gagasan-assign.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('inovasi.gagasan', 'masalah') IS NULL
BEGIN
    ALTER TABLE inovasi.gagasan ADD masalah NVARCHAR(MAX) NULL;
    PRINT 'Kolom inovasi.gagasan.masalah ditambahkan.';
END
GO
IF COL_LENGTH('inovasi.gagasan', 'solusi') IS NULL
BEGIN
    ALTER TABLE inovasi.gagasan ADD solusi NVARCHAR(MAX) NULL;
    PRINT 'Kolom inovasi.gagasan.solusi ditambahkan.';
END
GO

/* Perbarui daftar status yang diizinkan mengikuti peran baru. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_inovasi_gagasan_status')
BEGIN
    ALTER TABLE inovasi.gagasan DROP CONSTRAINT CK_inovasi_gagasan_status;
    PRINT 'CK_inovasi_gagasan_status lama dihapus.';
END
GO
-- Normalisasi status lama (bila ada baris) supaya lolos constraint baru.
UPDATE inovasi.gagasan SET status = 'Disetujui Verifikator'         WHERE status = 'Disetujui Fasilitator';
UPDATE inovasi.gagasan SET status = 'Revisi Verifikator'            WHERE status = 'Revisi Fasilitator';
UPDATE inovasi.gagasan SET status = 'Disetujui GM Kompartemen Asal' WHERE status IN ('Disetujui Verifikator (VP)', 'Disetujui VP Departemen Asal');
UPDATE inovasi.gagasan SET status = 'Disetujui GM Kompartemen Tujuan' WHERE status = 'Disetujui VP Departemen Tujuan';
GO
ALTER TABLE inovasi.gagasan WITH NOCHECK ADD CONSTRAINT CK_inovasi_gagasan_status CHECK (status IN
    ('Dikirim','Ditolak','Revisi Verifikator','Disetujui Verifikator',
     'Revisi GM','Disetujui GM Kompartemen Asal','Disetujui GM Kompartemen Tujuan',
     'Terdaftar'));
PRINT 'CK_inovasi_gagasan_status baru dibuat.';
GO

PRINT '=== Skema inovasi Tahap 4 (alur gagasan) selesai. ===';
SET NOEXEC OFF;
GO
