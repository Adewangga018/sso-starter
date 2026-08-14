/* ============================================================================
   aset.klasifikasi - tambah kolom detail sertifikat/appraisal/perijinan utk
   aset berklasifikasi "Tidak Bergerak" (disetujui dijual sesuai keputusan
   pemegang saham). Aug 2026. Sumber: tabel daftar sertifikat tanah/bangunan
   yang dibagikan user (lihat riwayat chat) - overlay MyGCS, TIDAK mengubah
   skema dbo.assets.

   2 objectid (2015010002, 2015020733) SENGAJA belum diisi - lokasinya sama2
   cocok ke Jl. KIG Raya Selatan Blok A-5 Gresik yang punya 2 sertifikat
   terpisah (No.00308 & No.00309), user minta cek dokumen asli dulu sebelum
   menentukan pembagiannya.

   8 objectid klaster "Pabrik Petroganik Serang" (2015010007/008/010/011/012/
   014/023, 2019060815) tidak punya baris sertifikat sendiri di sumbernya (
   sertifikat tanahnya ada di 2015010004 gabungan Sertifikat 1-5) - jadi cuma
   diisi status_jaminan & keterangan_pemegang_saham, field sertifikat/appraisal
   dibiarkan NULL.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\14-klasifikasi-detail-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.klasifikasi', 'U') IS NULL
BEGIN
    RAISERROR('BATAL: tabel aset.klasifikasi belum ada - jalankan 12-klasifikasi-ddl.sql dulu.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('aset.klasifikasi', 'sertifikat_hak') IS NULL
    ALTER TABLE aset.klasifikasi ADD sertifikat_hak NVARCHAR(200) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'sertifikat_jangka_waktu') IS NULL
    ALTER TABLE aset.klasifikasi ADD sertifikat_jangka_waktu VARCHAR(20) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'sertifikat_no') IS NULL
    ALTER TABLE aset.klasifikasi ADD sertifikat_no NVARCHAR(150) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'sertifikat_tahun') IS NULL
    ALTER TABLE aset.klasifikasi ADD sertifikat_tahun VARCHAR(10) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'nilai_pasar') IS NULL
    ALTER TABLE aset.klasifikasi ADD nilai_pasar DECIMAL(18,2) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'nilai_appraisal') IS NULL
    ALTER TABLE aset.klasifikasi ADD nilai_appraisal DECIMAL(18,2) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'status_jaminan') IS NULL
    ALTER TABLE aset.klasifikasi ADD status_jaminan NVARCHAR(100) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'kjpp') IS NULL
    ALTER TABLE aset.klasifikasi ADD kjpp NVARCHAR(200) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'kjpp_tahun') IS NULL
    ALTER TABLE aset.klasifikasi ADD kjpp_tahun VARCHAR(10) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'kjpp_no') IS NULL
    ALTER TABLE aset.klasifikasi ADD kjpp_no NVARCHAR(200) NULL;
GO
IF COL_LENGTH('aset.klasifikasi', 'keterangan_pemegang_saham') IS NULL
    ALTER TABLE aset.klasifikasi ADD keterangan_pemegang_saham NVARCHAR(500) NULL;
GO

-- Isi detail - aman dijalankan ulang (skip kalau sudah pernah, ditandai id_pengubah).
IF NOT EXISTS (SELECT 1 FROM aset.klasifikasi WHERE id_pengubah = 'SEED-KLS-DETAIL')
BEGIN
    DECLARE @d TABLE (
        objectid VARCHAR(50), hak NVARCHAR(200), jangka VARCHAR(20), no NVARCHAR(150), thn VARCHAR(10),
        pasar DECIMAL(18,2), appraisal DECIMAL(18,2), jaminan NVARCHAR(100),
        kjpp NVARCHAR(200), kjpp_thn VARCHAR(10), kjpp_no NVARCHAR(200), ket NVARCHAR(500)
    );
    INSERT INTO @d (objectid, hak, jangka, no, thn, pasar, appraisal, jaminan, kjpp, kjpp_thn, kjpp_no, ket) VALUES
        ('2015010003', N'HGB a.n PT Gresik Cipta Sejahtera', '30/03/2039', N'Sertifikat Nomor 1', '2008',
            NULL, 2761200000.00, N'Bank Mandiri', N'Benedictus Darmapuspita & Rekan', '2025',
            N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 30 Maret 2020'),
        ('2022010871', N'HGB a.n PT Gresik Cipta Sejahtera', '04/03/2033', N'Sertifikat Nomor 311', '2011',
            NULL, 689100000.00, N'Bank Mandiri', N'Benedictus Darmapuspita & Rekan', '2025',
            N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025', NULL),
        ('2015010001', N'HGB a.n PT Gresik Cipta Sejahtera', '24/09/2035', N'Sertifikat Nomor 2769 & 2770', '2013',
            NULL, 11074000000.00, N'Bank Mandiri', N'Benedictus Darmapuspita & Rekan', '2025',
            N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 30 Maret 2020'),
        ('2015010050', N'HGB a.n PT Gresik Cipta Sejahtera', '05/09/2038', N'Sertifikat Nomor 21969', '2009',
            NULL, 382500000.00, N'Bank Mandiri', N'Benedictus Darmapuspita & Rekan', '2025',
            N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 23 Februari 2021'),
        ('2022010870', N'HGB a.n PT Gresik Cipta Sejahtera', '05/09/2038', N'Sertifikat Nomor 21969', '2009',
            NULL, 382500000.00, N'Bank Mandiri', N'Benedictus Darmapuspita & Rekan', '2025',
            N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 23 Februari 2021'),
        ('2015010006', N'HGB a.n PT Gresik Cipta Sejahtera', '17/01/2041', N'Sertifikat Nomor 20', '2009',
            NULL, 6140400000.00, N'Tidak Dijaminkan', N'Sudiono Awaludin dan Rekan', '2023', NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010056', N'HGB a.n PT Gresik Cipta Sejahtera', '17/01/2041', N'Sertifikat Nomor 20', '2009',
            NULL, 6140400000.00, N'Tidak Dijaminkan', N'Sudiono Awaludin dan Rekan', '2023', NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010004', N'HGB a.n PT Gresik Cipta Sejahtera', '19/05/2039', N'Sertifikat Nomor 1-5', '2014',
            NULL, 6020300000.00, N'Tidak Dijaminkan', N'KJPP Sarwono, Indriasari dan Rekan', '2024',
            N'0001/2.0156-00/PI/07/0011/1/I/2024 Tgl.03 Januari 2024',
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        -- klaster Pabrik Petroganik Serang - tanpa sertifikat/appraisal sendiri (lihat 2015010004)
        ('2015010007', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010008', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010010', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010011', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010012', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010014', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2015010023', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2019060815', NULL, NULL, NULL, NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL,
            N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023'),
        ('2016120763', N'Sertifikat Hak Guna Bangunan No.00238 a.n PT Gresik Cipta Sejahtera', NULL,
            N'Sertifikat Nomor 00238', NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL, NULL),
        ('2022010872', N'Sertifikat Hak Guna Bangunan No.00238 a.n PT Gresik Cipta Sejahtera', NULL,
            N'Sertifikat Nomor 00238', NULL, NULL, NULL, N'Tidak Dijaminkan', NULL, NULL, NULL, NULL);

    UPDATE k
    SET k.sertifikat_hak = d.hak, k.sertifikat_jangka_waktu = d.jangka, k.sertifikat_no = d.no,
        k.sertifikat_tahun = d.thn, k.nilai_pasar = d.pasar, k.nilai_appraisal = d.appraisal,
        k.status_jaminan = d.jaminan, k.kjpp = d.kjpp, k.kjpp_tahun = d.kjpp_thn, k.kjpp_no = d.kjpp_no,
        k.keterangan_pemegang_saham = d.ket, k.id_pengubah = N'SEED-KLS-DETAIL', k.tgl_diubah = SYSUTCDATETIME()
    FROM aset.klasifikasi k
    JOIN @d d ON d.objectid = k.objectid
    WHERE k.status = N'Tidak Bergerak';

    DECLARE @jumlah INT = (SELECT COUNT(*) FROM aset.klasifikasi WHERE id_pengubah = N'SEED-KLS-DETAIL');
    PRINT CONCAT(@jumlah, ' baris klasifikasi dilengkapi detail sertifikat/appraisal.');
END
ELSE
    PRINT 'LEWATI: seed SEED-KLS-DETAIL sudah pernah dijalankan.';
GO