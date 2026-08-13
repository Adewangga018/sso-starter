/* ============================================================================
   Koreksi istilah PTS (2026-08-11, diminta user): "Pejabat Sementara" ->
   "Pemangku Tugas Sementara". Cuma ganti label tampilan gaji.komponen.nama utk
   TJ_PTS - kode/kolom/tabel TIDAK berubah. NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

UPDATE gaji.komponen
SET nama = N'Tunjangan PTS (Pemangku Tugas Sementara)',
    keterangan = N'Untuk pemangku tugas sementara; per karyawan & periode'
WHERE kode = 'TJ_PTS' AND nama <> N'Tunjangan PTS (Pemangku Tugas Sementara)';
PRINT 'gaji.komponen.nama TJ_PTS dikoreksi jadi Pemangku Tugas Sementara (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' baris).';
GO

SET NOEXEC OFF;
GO
