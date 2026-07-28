/* ============================================================================
   inovasi - peran Sekretaris pada panel juri dihapus.
   ----------------------------------------------------------------------------
   Panel (stream) penilai kini berisi 1 Ketua + 3 Anggota, dan SELURUHNYA
   menilai. Sebelumnya ada peran Sekretaris yang hanya melihat tanpa memberi
   skor; perhitungan hasil memang selalu merata-ratakan Ketua + 3 Anggota, jadi
   penghapusan ini tidak mengubah nilai maupun kategori penghargaan mana pun.

   Batasan CHECK diperbarui supaya 'Sekretaris' tidak bisa masuk lagi lewat
   klien versi lama. Baris berperan Sekretaris yang masih ada (bila ada)
   dihapus lebih dulu, kalau tidak ALTER TABLE akan ditolak.
   Idempoten. Jalankan setelah 05-penilaian.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

DECLARE @sisa INT = (SELECT COUNT(*) FROM inovasi.penilaian_stream_anggota WHERE peran = N'Sekretaris');
IF @sisa > 0
BEGIN
    DELETE FROM inovasi.penilaian_stream_anggota WHERE peran = N'Sekretaris';
    PRINT CONCAT('Anggota berperan Sekretaris dihapus: ', @sisa, ' baris.');
END
ELSE
    PRINT 'Tidak ada anggota berperan Sekretaris.';
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_inovasi_psa_peran')
BEGIN
    ALTER TABLE inovasi.penilaian_stream_anggota DROP CONSTRAINT CK_inovasi_psa_peran;
    PRINT 'Batasan lama CK_inovasi_psa_peran dilepas.';
END
GO

ALTER TABLE inovasi.penilaian_stream_anggota
    ADD CONSTRAINT CK_inovasi_psa_peran CHECK (peran IN (N'Ketua', N'Anggota'));
PRINT 'Batasan baru dipasang: peran hanya Ketua atau Anggota.';
GO

SET NOEXEC OFF;
GO
