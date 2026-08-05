/* ============================================================================
   Perbaikan penempatan (grading, db_mygcs): Dwi Rini P. (T.970200),
   "Kepala Bagian Pajak dan Asuransi" (jabatan 44) seharusnya melapor ke
   Manager Keuangan / Sri Rahayu (jabatan 25), BUKAN Manager Anggaran & Akuntansi /
   Bagus Adita (jabatan 26). Subtree Rini = {44, 62 (Staf Pajak & Asuransi, Aga)}.
   Kedua manager (25 & 26) sama-sama di bawah GM 11 -> kedalaman tidak berubah.
   Hanya struktur reporting (grading.jabatan.id_atasan + closure jabatan_hirarki).
   Tidak menyentuh unit_organisasi maupun tabel SDM legacy.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

BEGIN TRAN;

-- 1) reporting jabatan: 44 di bawah 25 (Manager Keuangan)
UPDATE grading.jabatan
SET id_atasan = 25, diubah_pada = SYSUTCDATETIME()
WHERE id_jabatan = 44 AND id_atasan = 26;

-- 2) closure: ganti ancestor 26 -> 25 HANYA untuk subtree Rini (44 & 62).
--    Kedalaman tetap karena 25 & 26 sederajat (sama-sama di bawah GM 11).
UPDATE grading.jabatan_hirarki
SET id_jabatan_atasan = 25
WHERE id_jabatan_atasan = 26 AND id_jabatan_bawahan IN (44, 62);

COMMIT;
PRINT 'Selesai: Rini (jab 44) + Aga (jab 62) kini di bawah Manager Keuangan (jab 25).';
GO

SET NOEXEC OFF;
GO
