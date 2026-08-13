/* ============================================================================
   Sinkron cuti.saldo.tmt dari GCS.dbo.PEGAWAI_SDM.tgl_masker (tanggal masuk kerja
   - sumber terpercaya, lihat memory pencarian-pegawai-organik-saja). cuti.saldo.tmt
   yang sudah ada (diimpor dari spreadsheet cutoff lama) sebagian kecil beda tipis
   dari tgl_masker - disamakan supaya akrual 2-tahunan (CutiService.
   AkrualJikaSiklusBaruAsync) berbasis tanggal yang paling akurat.

   SATU KALI JALAN, dijalankan manual (via sa) - TIDAK masuk prod-migrasi.sql krn
   query lintas-database (db_mygcs <-> GCS), belum tentu login aplikasi prod
   (svc_mygcs) punya akses baca ke database GCS scr langsung dari konteks
   db_mygcs. NON-DESTRUKTIF (cuma kolom tmt, tak menyentuh saldo/hak/diambil) &
   idempoten (aman dijalankan ulang - baris yg sudah sama dilewati).
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

UPDATE s
SET s.tmt = CAST(p.tgl_masker AS DATE),
    s.diperbarui_pada = SYSUTCDATETIME()
FROM cuti.saldo s
JOIN GCS.dbo.PEGAWAI_SDM p ON p.NIK = s.id_karyawan
WHERE p.tgl_masker IS NOT NULL
  AND (s.tmt IS NULL OR s.tmt <> CAST(p.tgl_masker AS DATE));
PRINT 'cuti.saldo.tmt disinkron dari tgl_masker (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' baris).';
GO

SET NOEXEC OFF;
GO
