/* ============================================================================
   gaji.tarif_wilayah - tarif Tunjangan Luar Daerah (komponen TJ_LUAR, sudah ada
   sejak schema gaji awal) per (wilayah, Band, tahun). Dua dimensi (beda dari
   gaji.tarif_tunggal yg cuma satu dimensi Band/JG/PG) - butuh tabel sendiri.

   Cakupan SAAT INI (dikonfirmasi user): 3 wilayah (Medan, Lampung, Makassar -
   dari PEGAWAI_SDM.WILAYAH) x Band III-VI (Staf Madya/Muda/Pemula/Pelaksana,
   urutan kiri->kanan pada tabel Nota Dinas = Band III->VI). Wilayah/Band lain
   BELUM diisi (tabel generik, bisa ditambah admin lewat panel kapan saja).

   TJ_LUAR TETAP basis 'Karyawan_Periode' (nominal dikonfirmasi lewat kalkulator
   "Hitung dari Wilayah" di halaman Manual per Karyawan, bukan otomatis penuh) -
   tabel ini cuma sumber REFERENSI tarifnya, sama pola dgn gaji.tarif_wilayah utk
   TJ_SPPD/dst yang basisnya juga Karyawan_Periode.

   Seed awal dari tabel Nota Dinas "Tunjangan Luar Daerah" (difoto user) - tahun
   2026, boleh ditambah/diubah admin SDM lewat panel Formula & Generalisasi.

   NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO
IF OBJECT_ID('gaji.komponen','U') IS NULL
BEGIN RAISERROR('gaji.komponen belum ada - jalankan gaji-schema.sql dulu.',16,1); SET NOEXEC ON; END
GO

IF OBJECT_ID('gaji.tarif_wilayah', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.tarif_wilayah (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_tarif_wilayah PRIMARY KEY,
        id_komponen   INT           NOT NULL,
        wilayah       NVARCHAR(50)  NOT NULL,
        band          SMALLINT      NOT NULL,
        tahun_berlaku SMALLINT      NOT NULL,
        nominal       DECIMAL(18,2) NOT NULL CONSTRAINT df_tarif_wilayah_nominal DEFAULT (0),
        CONSTRAINT uq_tarif_wilayah UNIQUE (id_komponen, wilayah, band, tahun_berlaku),
        CONSTRAINT fk_tarif_wilayah_komponen FOREIGN KEY (id_komponen) REFERENCES gaji.komponen (id_komponen)
    );
    PRINT 'gaji.tarif_wilayah dibuat.';
END
ELSE PRINT 'LEWATI: gaji.tarif_wilayah sudah ada.';
GO

/* Seed nominal awal (tahun 2026) dari tabel Nota Dinas - hanya bila BENAR-BENAR
   kosong (belum pernah diisi admin/skrip ini), supaya re-run tidak menimpa
   perubahan yang sudah dibuat admin SDM lewat panel. */
DECLARE @idTjLuar INT = (SELECT id_komponen FROM gaji.komponen WHERE kode = 'TJ_LUAR');

IF @idTjLuar IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gaji.tarif_wilayah WHERE id_komponen = @idTjLuar)
BEGIN
    INSERT INTO gaji.tarif_wilayah (id_komponen, wilayah, band, tahun_berlaku, nominal) VALUES
    (@idTjLuar, N'Medan',    3, 2026, 1550000),
    (@idTjLuar, N'Medan',    4, 2026, 1400000),
    (@idTjLuar, N'Medan',    5, 2026, 1200000),
    (@idTjLuar, N'Medan',    6, 2026, 1050000),
    (@idTjLuar, N'Lampung',  3, 2026, 1450000),
    (@idTjLuar, N'Lampung',  4, 2026, 1300000),
    (@idTjLuar, N'Lampung',  5, 2026, 1150000),
    (@idTjLuar, N'Lampung',  6, 2026, 1000000),
    (@idTjLuar, N'Makassar', 3, 2026, 1450000),
    (@idTjLuar, N'Makassar', 4, 2026, 1300000),
    (@idTjLuar, N'Makassar', 5, 2026, 1150000),
    (@idTjLuar, N'Makassar', 6, 2026, 1000000);
    PRINT 'Tarif Luar Daerah 2026 (Medan/Lampung/Makassar x Band III-VI) diisi dari Nota Dinas.';
END
ELSE PRINT 'LEWATI: seed tarif wilayah (komponen TJ_LUAR belum ada atau tarif sudah pernah diisi).';
GO

SET NOEXEC OFF;
GO
