/* ============================================================================
   inovasi - penyesuaian template GIO (Form F-GIO-01, metode DELTA).
   1) inovasi.gugus.verifikasi_statistik : C.3 Verifikasi Statistik Hasil
      Perbaikan (control chart / histogram) - hanya dipakai risalah GIO.
   2) inovasi.jadwal.tahapan diperlebar : GIO memakai 8 Langkah DELTA yang
      disimpan sebagai kode 'L1'..'L8' (SS/5R tetap PLAN|DO|CHECK|ACTION).
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

IF COL_LENGTH('inovasi.gugus', 'verifikasi_statistik') IS NULL
BEGIN
    ALTER TABLE inovasi.gugus ADD verifikasi_statistik NVARCHAR(MAX) NULL;
    PRINT 'Kolom inovasi.gugus.verifikasi_statistik ditambahkan.';
END
ELSE
    PRINT 'Kolom inovasi.gugus.verifikasi_statistik sudah ada.';
GO

IF COL_LENGTH('inovasi.jadwal', 'tahapan') < 40   -- NVARCHAR(10) = 20 byte
BEGIN
    ALTER TABLE inovasi.jadwal ALTER COLUMN tahapan NVARCHAR(20) NOT NULL;
    PRINT 'Kolom inovasi.jadwal.tahapan diperlebar ke NVARCHAR(20).';
END
ELSE
    PRINT 'Kolom inovasi.jadwal.tahapan sudah cukup lebar.';
GO

/* Risalah GIO lama menyimpan jadwal dengan tahapan PDCA. Petakan ke langkah DELTA
   terdekat agar barisnya tidak yatim setelah form beralih ke 8 langkah:
     PLAN -> L1 Menentukan Tema        DO    -> L5 Melaksanakan Penanggulangan
     CHECK -> L6 Meneliti Hasil        ACTION-> L7 Standardisasi
   Gugus wajib meninjau ulang jadwalnya - pemetaan ini hanya penyelamat data. */
UPDATE j
   SET j.tahapan = CASE j.tahapan
                       WHEN 'PLAN'   THEN 'L1'
                       WHEN 'DO'     THEN 'L5'
                       WHEN 'CHECK'  THEN 'L6'
                       WHEN 'ACTION' THEN 'L7'
                   END
  FROM inovasi.jadwal AS j
  JOIN inovasi.gugus  AS g ON g.id = j.id_gugus
 WHERE g.jenis = 'GIO'
   AND j.tahapan IN ('PLAN', 'DO', 'CHECK', 'ACTION');
PRINT CONCAT('Baris jadwal GIO dipetakan ke kode DELTA: ', @@ROWCOUNT);
GO

SET NOEXEC OFF;
GO
