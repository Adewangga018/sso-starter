/* ============================================================================
   Cuti v3 - akrual berbasis TMT per 2 tahun (2026-08-13, diminta user):
   ganti "12 hari/tahun, reset bareng semua orang tiap 1 Januari kalender" jadi
   "24 hari tiap 2 tahun, di ulang tahun kerja (TMT) masing-masing karyawan".
   Logika baru sepenuhnya di C# (CutiService.AkrualJikaSiklusBaruAsync) - skrip
   ini HANYA update nilai konfigurasi, TANPA perubahan skema. NON-DESTRUKTIF &
   idempoten (dijalankan 3x aman).
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

-- hak_per_tahun sekarang berarti "hak per siklus akrual 2-tahunan" (nama kolom lama
-- dipertahankan, hindari migrasi skema) - nilainya jadi 24 (dari 12), match batas_akumulasi.
UPDATE cuti.setelan SET hak_per_tahun = 24 WHERE id = 1 AND hak_per_tahun <> 24;
PRINT 'cuti.setelan.hak_per_tahun dikoreksi jadi 24 (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' baris).';
GO

SET NOEXEC OFF;
GO
