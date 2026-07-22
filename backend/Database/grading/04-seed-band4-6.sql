/* ============================================================================
   grading - jabatan (Band 4-6) + penempatan + person_grade untuk 57 pegawai
   Sumber: "Data 85 Pegawai Organik GCS.pdf".

   BEDA PENDEKATAN dari Band 1-3: Analisis_Pemetaan_JG sendiri menyatakan
   estimasi formasi Band 4 ("~10 kosong") dan Band 5 (formasi ~20 vs
   incumbent riil 23) BELUM direkonsiliasi presisi - jadi jabatan Band 4-6
   TIDAK diambil dari daftar formasi Analisis_Pemetaan_JG, melainkan
   diturunkan langsung dari jalur organisasi tiap pegawai di Data 85 Pegawai
   (Unit/Staf -> Bagian -> Departemen -> Kompartemen). Satu baris jabatan
   dibuat per kombinasi (judul, band, jg) yang benar-benar terisi; kalau ada
   >1 pegawai dengan kombinasi identik, mereka berbagi satu baris jabatan
   (jumlah_formasi = jumlah pegawai).

   Ditemukan pola nyata "satu judul jabatan tersebar di beberapa band/jg
   sekaligus" (mis. "Staf Transport dan Bengkel" muncul di Band4/JG13-14,
   Band5/JG9-11, Band6/JG8) - persis seperti dicatat di Analisis_Pemetaan_JG
   Revisi 3. Karena JG melekat di jabatan (bukan band), tiap kombinasi
   (judul, band, jg) berbeda memang harus jadi baris jabatan terpisah -
   itulah maksud "Terverifikasi (contoh Pak A terpenuhi)" di diagram.

   6 karyawan baru (Niko Fredika, Taufik Hidayat, Eka Putri Rahmawati,
   Arbinda Achaddi, Wahono, Risma Fitri Amalina) belum py jabatan definitif
   di sumber manapun -> diberi jabatan placeholder "Belum Ditentukan (...)"
   per band/jg supaya tetap tercatat di grading.penempatan tanpa
   memalsukan judul jabatan.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF EXISTS (SELECT 1 FROM grading.jabatan WHERE id_band IN (4,5,6))
BEGIN
    PRINT 'LEWATI: jabatan Band 4-6 sudah terisi.';
    SET NOEXEC ON;
END
GO

SELECT * INTO #stg FROM (
    SELECT * FROM (VALUES
    -- nik, nama, id_band, jg, pg, tgl_masuk(yyyymmdd), status_sk, nama_jabatan, parent_jabatan, unit_nama, golongan_lama
    -- ===== BAND 4 (20 pegawai) =====
    (N'T.970174', N'Listyo Hartono',            4, 14, 14, '19971103', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.940159', N'Suwandi',                   4, 14, 14, '19970901', N'Definitif', N'Staf Penjualan Bahan Kimia, Legal dan Gas', N'Manager Penjualan Bahan Kimia & Gas', N'Departemen Penjualan Bahan Kimia dan Gas', NULL),
    (N'T.205237', N'Sugeng Harianto',           4, 14, 14, '20020815', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.202206', N'Slamet Ryadi',              4, 14, 14, '20000801', N'Definitif', N'Staf Jasa Gudang', N'Bag. Jasa Gudang', N'Departemen Jasa Logistik', NULL),
    (N'T.210265', N'Handoko Tejo Saputro, STp.',4, 14, 14, '20101101', N'Definitif', N'Staf Penjualan Kesuplieran', N'Manager Penjualan Kesuplieran', N'Departemen Penjualan Kesuplieran', NULL),
    (N'T.205238', N'M. Chasim',                 4, 14, 14, '20020815', N'Definitif', N'Staf Sekretariat, Keamanan, Umum & Manajemen Aset', N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', N'Departemen SDM', NULL),
    (N'T.221309', N'Rizky Viliyant Ismaryono',  4, 13, 13, '20210104', N'Definitif', N'Staf Perijinan, Hukum & K3', N'Bag. Perijinan, Hukum & K3', N'Departemen Kepatuhan', NULL),
    (N'T.221310', N'Jafrinda Reza Eltrico',     4, 13, 13, '20210104', N'Definitif', N'Staf Teknologi Informasi dan Multimedia', N'Bag. Teknologi Informatika & Multimedia', N'Departemen Pengembangan', NULL),
    (N'T.207246', N'Syamsul Huda',              4, 13, 13, '20050501', N'Pjs.', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.213284', N'Ady Purnomo',               4, 13, 13, '20130812', N'Pjs.', N'Staf Penjualan Pupuk & Pestisida Korporasi', N'Manager Penjualan Pupuk & Pestisida Korporasi', N'Departemen Penjualan Pupuk & Pestisida Korporasi', NULL),
    (N'T.213286', N'Muhari Rizkita',            4, 13, 13, '20130812', N'Pjs.', N'Staf Penjualan dan Administrasi Pupuk Subsidi (Lampung)', N'Bag. Penjualan & Adm Pupuk Subsidi (Lampung)', N'Departemen Region Lampung', NULL),
    (N'T.213288', N'Lubana Nazma Simbolon',     4, 13, 13, '20130812', N'Definitif', N'Staf Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida (Medan)', N'Bag. Penjualan Logistik, B.Kimia, Non Subsidi & Pestisida (Medan)', N'Departemen Region Medan', NULL),
    (N'T.215299', N'Muhammad Arif Surachman',   4, 12, 12, '20151116', N'Definitif', N'Staf Penjualan Logistik Non Subsidi dan Pestisida (Makassar)', N'Bag. Penjualan Logistik, Non Subsidi & Pestisida (Makassar)', N'Departemen Region Makassar', NULL),
    (N'T.215301', N'Yudi Isfandiyari',          4, 12, 12, '20151116', N'Definitif', N'Staf Anggaran dan Pelaporan', N'Bag. Anggaran & Pelaporan', N'Departemen Anggaran & Akuntansi', NULL),
    (N'T.215303', N'Laksana Mus Ardhianto',     4, 12, 12, '20151116', N'Definitif', N'Staf Penjualan Pupuk & Pestisida Korporasi', N'Manager Penjualan Pupuk & Pestisida Korporasi', N'Departemen Penjualan Pupuk & Pestisida Korporasi', NULL),
    (N'T.221312', N'Riadho Kurniawan',          4, 12, 12, '20210104', N'Pjs.', N'Staf Administrasi Keuangan (Makassar)', N'Manager Region Makassar', N'Departemen Region Makassar', NULL),
    (N'T.217308', N'Monda Morina Harahap',      4, 12, 12, '20170901', N'Pjs.', N'Staf Administrasi Keuangan (Medan)', N'Manager Region Medan', N'Departemen Region Medan', NULL),
    (N'T.217305', N'Aenal Darwis',              4, 12, 12, '20170301', N'Pjs.', N'Staf Penjualan dan Administrasi Pupuk Subsidi (Makassar)', N'Bag. Penjualan & Adm Pupuk Subsidi (Makassar)', N'Departemen Region Makassar', NULL),
    (N'T.205213', N'Fabian Abdul Gaffar',       4, 12, 12, '20001001', N'Definitif', N'Staf Khusus Direktur Keuangan', N'Direktur Keuangan', NULL, NULL),
    (N'T.205235', N'Subagio Junaedi',           4, 12, 11, '20030602', N'Definitif', N'Staf Penjualan Bahan Kimia, Legal dan Gas', N'Manager Penjualan Bahan Kimia & Gas', N'Departemen Penjualan Bahan Kimia dan Gas', NULL),
    -- ===== BAND 5 (22 pegawai) =====
    (N'T.940161', N'Dewi Fatmawati',            5, 11, 11, '19940505', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.980186', N'Tedjo Wahyono',             5, 11, 11, '19981001', N'Definitif', N'Staf Jasa Gudang', N'Bag. Jasa Gudang', N'Departemen Jasa Logistik', NULL),
    (N'T.990196', N'Hermanto',                  5, 11, 11, '19990501', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.205218', N'Isfa''',                    5, 11, 11, '20010806', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.940138', N'Safi''i',                   5, 11, 11, '19970901', N'Definitif', N'Staf Sekretariat, Keamanan, Umum & Manajemen Aset', N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', N'Departemen SDM', NULL),
    (N'T.205240', N'Soeyanto',                  5, 11, 11, '20020815', N'Definitif', N'Staf Penjualan Pupuk & Pestisida Korporasi', N'Manager Penjualan Pupuk & Pestisida Korporasi', N'Departemen Penjualan Pupuk & Pestisida Korporasi', NULL),
    (N'T.206247', N'Yodi Ermanto',              5, 11, 11, '20040901', N'Definitif', N'Staf Penjualan dan Administrasi Pupuk Subsidi (Medan)', N'Bag. Penjualan & Adm Pupuk Subsidi (Medan)', N'Departemen Region Medan', NULL),
    (N'T.980185', N'Sumarsono',                 5, 11, 11, '19981002', N'Definitif', N'Staf Sekretariat, Keamanan, Umum & Manajemen Aset', N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', N'Departemen SDM', NULL),
    (N'T.205239', N'Bambang Syamadji',          5, 10, 10, '20020815', N'Definitif', N'Staf Sekretariat, Keamanan, Umum & Manajemen Aset', N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', N'Departemen SDM', NULL),
    (N'T.202203', N'Fadelan Chadarianto',       5, 10, 10, '20000801', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.202207', N'Darwanto',                  5, 10, 10, '20000102', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.210258', N'Hari Eko Susanto, SE',      5, 10, 10, '20100501', N'Definitif', N'Staf Perbendaharaan', N'Bag. Perbendaharaan', N'Departemen Keuangan', NULL),
    (N'T.205241', N'Suwadi',                    5, 10, 10, '20020903', N'Definitif', N'Staf Sekretariat, Keamanan, Umum & Manajemen Aset', N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', N'Departemen SDM', NULL),
    (N'T.205225', N'Nurudin',                   5, 10, 10, '20001205', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.211272', N'Iwan Rangga Kusuma',        5, 10, 10, '20111001', N'Definitif', N'Staf Pengadaan dan Pengelolaan Pengembangan', N'Bag. Pengadaan & Pengelolaan Pengembangan', N'Departemen Pengembangan', NULL),
    (N'T.207247', N'Hery Purnomo',              5, 9, 9, '20050501', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.205234', N'Dandung Kasiatno',          5, 9, 9, '20030602', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', NULL),
    (N'T.221311', N'Aghnia Putri Rusianto',     5, 9, 9, '20210104', N'Definitif', N'Staf Perijinan, Hukum & K3', N'Bag. Perijinan, Hukum & K3', N'Departemen Kepatuhan', NULL),
    (N'T.225315', N'Aga Firmansyah',            5, 9, 9, '20240901', N'Definitif', N'Staf Pajak dan Asuransi', N'Bag. Pajak & Asuransi', N'Departemen Keuangan', NULL),
    (N'BP.226318',N'Risma Fitri Amalina',       5, 9, 9, '20251001', N'Definitif', N'Belum Ditentukan (Pelaksana Senior - JG9)', NULL, NULL, NULL),
    (N'T.213287', N'T. Safrizaluddin',          5, 9, 9, '20130812', N'Definitif', N'Staf Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida (Medan)', N'Bag. Penjualan Logistik, B.Kimia, Non Subsidi & Pestisida (Medan)', N'Departemen Region Medan', NULL),
    (N'T.213285', N'Muh. Ali S.',               5, 9, 9, '20130812', N'Definitif', N'Staf Penagihan', N'Bag. Penagihan', N'Departemen Keuangan', NULL),
    -- ===== BAND 6 (15 pegawai) =====
    (N'T.224314', N'M. Razali Nasution',        6, 8, 8, '20240601', N'Definitif', N'Staf Penjualan dan Administrasi Pupuk Subsidi (Medan)', N'Bag. Penjualan & Adm Pupuk Subsidi (Medan)', N'Departemen Region Medan', N'D'),
    (N'T.207248', N'Setyo Haryono',             6, 8, 8, '20050501', N'Definitif', N'Staf Transport dan Bengkel', N'Bag. Transport & Bengkel', N'Departemen Jasa Logistik', N'D'),
    (N'T.215300', N'Teguh Priyono',             6, 8, 8, '20151116', N'Definitif', N'Staf Pembukuan', N'Bag. Penagihan', N'Departemen Keuangan', N'D'),
    (N'T.223313', N'Dicky Susantho',            6, 8, 8, '20221001', N'Definitif', N'Staf Administrasi & Pengembangan SDM dan Inovasi', N'Bag. Administrasi & Pengembangan SDM & Inovasi', N'Departemen SDM', N'D'),
    (N'T.940160', N'Solichin',                  6, 8, 8, '19970901', N'Definitif', N'Staf Sekretariat, Keamanan, Umum & Manajemen Aset', N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', N'Departemen SDM', N'D'),
    (N'BP.226320',N'Niko Fredika',              6, 8, 8, '20250601', N'Definitif', N'Belum Ditentukan (Pelaksana Junior - JG8)', NULL, NULL, NULL),
    (N'BP.226321',N'Taufik Hidayat',            6, 8, 8, '20250601', N'Definitif', N'Belum Ditentukan (Pelaksana Junior - JG8)', NULL, NULL, NULL),
    (N'T.225317', N'Farid Fahrudin',            6, 7, 7, '20240801', N'Definitif', N'Staf Akuntansi dan Verifikasi', N'Bag. Akuntansi & Verifikasi', N'Departemen Anggaran & Akuntansi', N'D'),
    (N'T.225318', N'Arfandi Nahsar',            6, 7, 7, '20240801', N'Definitif', N'Staf Administrasi Keuangan (Makassar)', N'Manager Region Makassar', N'Departemen Region Makassar', N'D'),
    (N'T.225316', N'Dewa Hentyarsa Utomo',      6, 7, 7, '20240801', N'Definitif', N'Staf Region Jawa Tengah dan Jawa Timur', NULL, NULL, N'D'),
    (N'BP.226319',N'Eka Putri Rahmawati',       6, 7, 7, '20251001', N'Definitif', N'Belum Ditentukan (Pelaksana Junior - JG7)', NULL, NULL, NULL),
    (N'T.225322', N'Arbinda Achaddi',           6, 7, 7, '20250601', N'Definitif', N'Belum Ditentukan (Pelaksana Junior - JG7)', NULL, NULL, NULL),
    (N'T.225321', N'Wahono',                    6, 7, 7, '20250601', N'Definitif', N'Belum Ditentukan (Pelaksana Junior - JG7)', NULL, NULL, NULL),
    (N'T.225320', N'Muhammad Ari Wibowo',       6, 7, 7, '20240901', N'Definitif', N'Staf Penjualan Kesuplieran', N'Manager Penjualan Kesuplieran', N'Departemen Penjualan Kesuplieran', N'D'),
    (N'T.225319', N'Dwi Teguh Ariwibowo',       6, 7, 7, '20240901', N'Definitif', N'Staf Penjualan dan Administrasi Pupuk Subsidi & Non Subsidi (Jawa)', N'Bag. Penjualan & Adm Pupuk Subsidi & Non Subsidi (Jawa)', N'Departemen Penjualan Pupuk & Pestisida Retail', N'D')
    ) AS v(nik, nama, id_band, jg, pg, tgl_masuk, status_sk, nama_jabatan, parent_jabatan, unit_nama, golongan_lama)
) AS x;

DECLARE @stg_cnt INT = (SELECT COUNT(*) FROM #stg);
PRINT 'Staging: ' + CAST(@stg_cnt AS VARCHAR(10)) + ' baris pegawai Band 4-6 dimuat.';

-- 1) satu baris jabatan per kombinasi (nama_jabatan, id_band, jg)
INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, id_atasan, jumlah_formasi, alasan)
SELECT g.nama_jabatan, g.id_band, g.jg, u.id_unit, a.id_jabatan, g.jumlah,
       N'Diturunkan dari Data 85 Pegawai Organik GCS (bukan estimasi formasi Analisis_Pemetaan_JG - Band 4-5 dinyatakan belum direkonsiliasi presisi di dokumen sumber).'
FROM (
    SELECT nama_jabatan, id_band, jg,
           MIN(parent_jabatan) AS parent_jabatan,   -- konsisten per grup by konstruksi
           MIN(unit_nama) AS unit_nama,
           COUNT(*) AS jumlah
    FROM #stg
    GROUP BY nama_jabatan, id_band, jg
) g
LEFT JOIN grading.unit_organisasi u ON u.nama = g.unit_nama
LEFT JOIN grading.jabatan a ON a.nama_jabatan = g.parent_jabatan AND a.id_band < g.id_band;

DECLARE @jab_cnt INT = (SELECT COUNT(*) FROM grading.jabatan WHERE id_band IN (4,5,6));
PRINT 'grading.jabatan (Band 4-6): ' + CAST(@jab_cnt AS VARCHAR(10)) + ' baris disisipkan.';

-- 2) penempatan: satu baris per pegawai
INSERT INTO grading.penempatan (id_jabatan, id_karyawan, nama, tmt, status, catatan)
SELECT j.id_jabatan, s.nik, s.nama, CONVERT(DATE, s.tgl_masuk, 112), N'Aktif',
       N'Status SK: ' + s.status_sk
FROM #stg s
JOIN grading.jabatan j ON j.nama_jabatan = s.nama_jabatan AND j.id_band = s.id_band AND j.jg = s.jg;

-- 3) person_grade: satu baris per pegawai, tahun 2026
INSERT INTO grading.person_grade (id_karyawan, nama, pg, golongan_lama, tahun_berlaku)
SELECT nik, nama, pg, golongan_lama, 2026 FROM #stg;

DECLARE @pc INT = (SELECT COUNT(*) FROM grading.penempatan WHERE id_karyawan IN (SELECT nik FROM #stg));
DECLARE @gc INT = (SELECT COUNT(*) FROM grading.person_grade WHERE id_karyawan IN (SELECT nik FROM #stg));
PRINT 'grading.penempatan (Band 4-6): ' + CAST(@pc AS VARCHAR(10)) + ' baris.';
PRINT 'grading.person_grade (Band 4-6): ' + CAST(@gc AS VARCHAR(10)) + ' baris.';

DROP TABLE #stg;
GO

SET NOEXEC OFF;
GO
