/* ============================================================================
   Pengelompokan tampilan (dropdown/accordion) untuk komponen yang punya
   sub-komponen: Lembur (3), Tunjangan BPJS Ketenagakerjaan (4), Potongan BPJS
   Ketenagakerjaan (2). Kolom baru grup_kode/grup_label di gaji.komponen -
   NULL berarti komponen berdiri sendiri (tampil baris biasa seperti sekarang).
   NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO
IF OBJECT_ID('gaji.komponen','U') IS NULL
BEGIN RAISERROR('gaji.komponen belum ada - jalankan gaji-schema.sql dulu.',16,1); SET NOEXEC ON; END
GO

IF COL_LENGTH('gaji.komponen', 'grup_kode') IS NULL
    ALTER TABLE gaji.komponen ADD grup_kode NVARCHAR(40) NULL;
GO
IF COL_LENGTH('gaji.komponen', 'grup_label') IS NULL
    ALTER TABLE gaji.komponen ADD grup_label NVARCHAR(80) NULL;
GO

UPDATE gaji.komponen SET grup_kode = 'LEMBUR', grup_label = N'Lembur'
    WHERE kode IN ('LEMBUR_BIASA','LEMBUR_CRASH','LEMBUR_PENGGANTI');

UPDATE gaji.komponen SET grup_kode = 'TJ_BPJS_TK', grup_label = N'Tunjangan BPJS Ketenagakerjaan'
    WHERE kode IN ('TJ_BPJS_JHT','TJ_BPJS_JKK','TJ_BPJS_JKM','TJ_BPJS_JP');

UPDATE gaji.komponen SET grup_kode = 'POT_BPJS_TK', grup_label = N'Potongan BPJS Ketenagakerjaan'
    WHERE kode IN ('POT_BPJS_JHT','POT_BPJS_JP');

PRINT 'Pengelompokan dropdown Lembur / BPJS TK (tunjangan & potongan) diterapkan.';
GO
SET NOEXEC OFF;
GO
