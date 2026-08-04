/* ============================================================================
   Komponen gaji v2 - pecah sub-komponen + tambahan Tunjangan Lain.
   - Tunjangan BPJS Ketenagakerjaan -> 4: JHT, JKK, JKM, JP (Tunjangan Lain).
   - Potongan BPJS Ketenagakerjaan  -> 2: JHT, JP (Potongan Tetap).
   - Lembur -> 3: Biasa, Crash Program, Pengganti (Tunjangan Tidak Tetap).
   - Tunjangan Lain + : Tunjangan PTS (Pejabat Sementara), Premi Asuransi.
     (Tunjangan Luar Daerah = TJ_LUAR sudah ada.)
   NON-DESTRUKTIF utk data tarif/slip komponen LAIN; hanya menghapus 3 komponen
   agregat yang dipecah (aman: data tarif/slip mereka kosong). Idempoten.
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

BEGIN TRAN;

/* 1) Hapus komponen agregat yang dipecah (beserta child tarif/slip bila ada). */
DELETE d FROM gaji.slip_detail d
    JOIN gaji.komponen k ON k.id_komponen = d.id_komponen
    WHERE k.kode IN ('TJ_BPJS_TK','POT_BPJS_TK','LEMBUR');
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode IN ('TJ_BPJS_TK','POT_BPJS_TK','LEMBUR');
DELETE FROM gaji.komponen WHERE kode IN ('TJ_BPJS_TK','POT_BPJS_TK','LEMBUR');

/* 2) Geser urutan komponen lama agar sub-komponen baru masuk berurutan. */
UPDATE gaji.komponen SET urutan = 35 WHERE kode = 'MAKAN_DINAS';
UPDATE gaji.komponen SET urutan = 36 WHERE kode = 'RIT';
UPDATE gaji.komponen SET urutan = 45 WHERE kode = 'TJ_PAJAK';
UPDATE gaji.komponen SET urutan = 46 WHERE kode = 'TJ_SHIFT';
UPDATE gaji.komponen SET urutan = 47 WHERE kode = 'TJ_LUAR';
UPDATE gaji.komponen SET urutan = 53 WHERE kode = 'POT_PREMI';
UPDATE gaji.komponen SET urutan = 54 WHERE kode = 'POT_PAJAK';
UPDATE gaji.komponen SET urutan = 55 WHERE kode = 'POT_IKGCS';
UPDATE gaji.komponen SET urutan = 56 WHERE kode = 'POT_SW_K3PG';
UPDATE gaji.komponen SET urutan = 57 WHERE kode = 'POT_SW_KKCS';
UPDATE gaji.komponen SET urutan = 58 WHERE kode = 'POT_DPLK';
UPDATE gaji.komponen SET urutan = 59 WHERE kode = 'POT_PIKGCS';
-- Potongan Tidak Tetap digeser (+10) supaya tak bentrok dgn urutan Potongan Tetap di atas.
UPDATE gaji.komponen SET urutan = 69 WHERE kode = 'POT_PRESENSI';
UPDATE gaji.komponen SET urutan = 70 WHERE kode = 'POT_K3PG';
UPDATE gaji.komponen SET urutan = 71 WHERE kode = 'POT_KKCS';
UPDATE gaji.komponen SET urutan = 72 WHERE kode = 'POT_BMT';
UPDATE gaji.komponen SET urutan = 73 WHERE kode = 'POT_ANGSURAN';
UPDATE gaji.komponen SET urutan = 74 WHERE kode = 'POT_KSPPS';

/* 3) Sisipkan komponen baru (idempoten per kode).
   kolom: kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan */
DECLARE @ins TABLE (kode NVARCHAR(30), nama NVARCHAR(100), tipe NVARCHAR(15), kategori NVARCHAR(40),
                    basis NVARCHAR(20), opsional BIT, urutan INT, keterangan NVARCHAR(200));
INSERT INTO @ins VALUES
  -- Lembur (Tunjangan Tidak Tetap, per orang/periode)
  ('LEMBUR_BIASA',     N'Lembur Biasa',              'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 32, N'Upah lembur biasa'),
  ('LEMBUR_CRASH',     N'Lembur Crash Program',      'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 33, N'Upah lembur crash program'),
  ('LEMBUR_PENGGANTI', N'Lembur Pengganti',          'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 34, N'Upah lembur pengganti'),
  -- Tunjangan BPJS Ketenagakerjaan (Tunjangan Lain, JG x PG)
  ('TJ_BPJS_JHT',      N'Tunjangan BPJS TK - JHT',   'Pendapatan', N'Tunjangan Lain', 'JG_PG', 1, 41, N'Jaminan Hari Tua'),
  ('TJ_BPJS_JKK',      N'Tunjangan BPJS TK - JKK',   'Pendapatan', N'Tunjangan Lain', 'JG_PG', 1, 42, N'Jaminan Kecelakaan Kerja'),
  ('TJ_BPJS_JKM',      N'Tunjangan BPJS TK - JKM',   'Pendapatan', N'Tunjangan Lain', 'JG_PG', 1, 43, N'Jaminan Kematian'),
  ('TJ_BPJS_JP',       N'Tunjangan BPJS TK - JP',    'Pendapatan', N'Tunjangan Lain', 'JG_PG', 1, 44, N'Jaminan Pensiun'),
  -- Tunjangan Lain tambahan
  ('TJ_PTS',           N'Tunjangan PTS (Pejabat Sementara)', 'Pendapatan', N'Tunjangan Lain', 'Karyawan_Periode', 1, 48, N'Untuk pejabat sementara; per karyawan & periode'),
  ('TJ_PREMI',         N'Premi Asuransi',            'Pendapatan', N'Tunjangan Lain', 'JG_PG', 1, 49, N'Premi asuransi (tunjangan)'),
  -- Potongan BPJS Ketenagakerjaan (Potongan Tetap, JG x PG)
  ('POT_BPJS_JHT',     N'BPJS TK - JHT',             'Potongan',   N'Potongan Tetap', 'JG_PG', 0, 51, N'Jaminan Hari Tua'),
  ('POT_BPJS_JP',      N'BPJS TK - JP',              'Potongan',   N'Potongan Tetap', 'JG_PG', 0, 52, N'Jaminan Pensiun');

INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
SELECT i.kode, i.nama, i.tipe, i.kategori, i.basis, i.opsional, 0, i.urutan, i.keterangan
FROM @ins i
WHERE NOT EXISTS (SELECT 1 FROM gaji.komponen k WHERE k.kode = i.kode);

COMMIT;
PRINT 'Komponen gaji v2 diterapkan (BPJS TK 4/2, Lembur 3, +Tunjangan PTS & Premi).';
GO
SET NOEXEC OFF;
GO
