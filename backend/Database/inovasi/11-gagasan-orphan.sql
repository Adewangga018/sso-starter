/* ============================================================================
   inovasi - membersihkan Sumbang Gagasan yang risalahnya sudah dihapus.
   Sebelum perbaikan ini, menghapus risalah (Draft/Revisi) di Daftar Inovasi tidak
   menghapus gagasan sumbernya: gagasan tertinggal berstatus "Terdaftar" sambil
   menunjuk inovasi.gugus yang sudah tidak ada, sehingga tidak bisa dihapus
   maupun didaftarkan ulang oleh pengaju.
   Skrip ini menghapus baris hantu tersebut (approval-nya ikut lewat cascade).
   Gagasan yang belum pernah didaftarkan (id_gugus NULL) tidak tersentuh.
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

DECLARE @n INT;

SELECT @n = COUNT(*)
FROM inovasi.gagasan g
WHERE g.id_gugus IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM inovasi.gugus x WHERE x.id = g.id_gugus);

IF @n = 0
    PRINT 'Tidak ada gagasan yatim (semua id_gugus menunjuk risalah yang ada).';
ELSE
BEGIN
    DELETE g
    FROM inovasi.gagasan g
    WHERE g.id_gugus IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM inovasi.gugus x WHERE x.id = g.id_gugus);

    PRINT CONCAT('Gagasan yatim dihapus: ', @n, ' baris.');
END
GO

SET NOEXEC OFF;
GO
