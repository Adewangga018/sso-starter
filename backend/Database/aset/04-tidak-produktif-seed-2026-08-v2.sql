/* ============================================================================
   Seed aset.tidak_produktif v2 (Aug 2026) - 24 baris, ditranskrip dari rekap
   Excel versi lengkap (menambah kolom Harga Pasar, Appraisal, PBB, Catatan
   Akt). Tabel sudah dikosongkan sebelum skrip ini dijalankan (lihat riwayat
   percakapan). Ditandai id_pembuat = 'IMPORT-2026-08-07' - aman dijalankan
   ulang (skip kalau tag ini sudah ada).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\04-tidak-produktif-seed-2026-08-v2.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF EXISTS (SELECT 1 FROM aset.tidak_produktif WHERE id_pembuat = 'IMPORT-2026-08-07')
BEGIN
    PRINT 'LEWATI: seed IMPORT-2026-08-07 sudah pernah dijalankan.';
    SET NOEXEC ON;
END
GO

INSERT INTO aset.tidak_produktif
    (jenis, sertifikat_hak, sertifikat_jangka_waktu, sertifikat_no, sertifikat_tahun, sertifikat_keterangan,
     lokasi, qty, satuan, status_jaminan, harga_pasar, appraisal_harga, appraisal_kjpp, appraisal_tahun, appraisal_no,
     pbb_nop, pbb_nominal, pbb_tgl_pembayaran, catatan_akt, perijinan_pemegang_saham, id_pembuat, tgl_dibuat)
VALUES
(N'Tanah', N'HGB a.n PT Gresik Cipta Sejahtera', '2039-03-30', N'Sertifikat Nomor 1', 2008, NULL,
 N'Desa Bocek, Kecamatan Karang Ploso, Kabupaten Malang', 6103, N'M2', N'Bank Mandiri', NULL,
 2761200000, N'Benedictus Darmapuspita & Rekan', 2025, N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 30 Maret 2020', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2033-03-04', N'Sertifikat Nomor 311', 2011, NULL,
 N'Komplek Citra Wisata Blok IX No.46 Kel.Pangkalan Masyhur Kec.Medan Johor Kota Medan', 162, N'M2', N'Bank Mandiri', NULL,
 689100000, N'Benedictus Darmapuspita & Rekan', 2025, N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah', N'HGB a.n PT Gresik Cipta Sejahtera', '2035-09-24', N'Sertifikat Nomor 2769', 2013, NULL,
 N'Desa Suci Kecamatan Manyar, Kabupaten Gresik', 5130, N'M2', N'Bank Mandiri', NULL,
 11074000000, N'Benedictus Darmapuspita & Rekan', 2025, N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 30 Maret 2020', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah', N'HGB a.n PT Gresik Cipta Sejahtera', '2035-09-24', N'Sertifikat Nomor 2770', 2013, NULL,
 N'Desa Suci Kecamatan Manyar, Kabupaten Gresik', 407, N'M2', N'Bank Mandiri', NULL,
 11074000000, N'Benedictus Darmapuspita & Rekan', 2025, N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 30 Maret 2020', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2035-03-01', N'Sertifikat Nomor 20223', 2013, NULL,
 N'Kelurahan Buakana, Kecamatan Rappocini, Kota Makassar', 24, N'M2', N'Bank Mandiri', 1101000000,
 1101000000, N'Benedictus Darmapuspita & Rekan', 2025, N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2038-08-20', N'Sertifikat Nomor 20310', 2008, NULL,
 N'Kelurahan Buakana, Kecamatan Rappocini, Kota Makassar', 24, N'M2', N'Bank Mandiri', NULL,
 1101000000, N'Benedictus Darmapuspita & Rekan', 2025, N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2038-09-05', N'Sertifikat Nomor 21969', 2009, NULL,
 N'Desa Sudiang, Kecamatan Biringkanaya, Kabupaten Ujung Pandang', 119, N'M2', N'Bank Mandiri', NULL,
 382500000, N'Benedictus Darmapuspita & Rekan', 2025, N'00008/2.0103-01/PI/05/0411/1/II/2025 Tgl.20 Februari 2025',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset 23 Februari 2021', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2033-03-30', N'Sertifikat Nomor 00308', 2009, NULL,
 N'Jalan KIG Raya Selatan Blok A-5 Gresik', 3287, N'M2', N'Bank BNI', NULL,
 13545248830, N'KJPP Munir, Wisnu, Heru & Rekan', 2024, N'00092/2.0129-02/PI/07/0569/1/II/2024. Tgl.16 Feb.2024',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2033-03-30', N'Sertifikat Nomor 00309', 2009, NULL,
 N'Jalan KIG Raya Selatan Blok A-5 Gresik', 6543, N'M2', N'Bank BNI', NULL,
 26962751170, N'KJPP Munir, Wisnu, Heru & Rekan', 2024, N'00092/2.0129-02/PI/07/0569/1/II/2024. Tgl.16 Feb.2024',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Pabrik', N'HGB a.n PT Gresik Cipta Sejahtera', '2041-01-17', N'Sertifikat Nomor 20', 2009, N'Asli di Gresik',
 N'Desa Sukajawa, Kecamatan Bumi Ratu Nuban, Kabupaten Lampung Tengah', 10914, N'M2', N'Tidak Dijaminkan', NULL,
 6140400000, N'Sudiono Awaludin dan Rekan', 2023, NULL,
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Filling Station', N'HGB a.n PT Gresik Cipta Sejahtera', '2046-04-16', N'SHGB No. 02.04.000016579.4, SK.No. 01', 2025, NULL,
 N'Desa Saentis, Kec. Percut Sei Tuan, Kab. Deli Serdang, Sumatera Utara', 1000, N'M2', N'PT Petrokimia Gresik', NULL,
 2961700000, N'Muttaqin Bambang Purwanto Rozak Uswatun dan Rekan', 2020, N'00017/2.0027-06/PI/05/0303/1/I/2020 Tgl.29 Januari 2020',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Filling Station', N'HGB a.n PT Gresik Cipta Sejahtera', '2046-04-16', N'SHGB No. 02.04.000012172.4, SK. No.428', 2024, N'Asli di Gresik',
 N'Desa Saentis, Kec. Percut Sei Tuan, Kab. Deli Serdang, Sumatera Utara', 1000, N'M2', N'Tidak Dijaminkan', NULL,
 2961700000, N'Muttaqin Bambang Purwanto Rozak Uswatun dan Rekan', 2020, N'00017/2.0027-06/PI/05/0303/1/I/2020 Tgl.29 Januari 2020',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Filling Station', N'HGB a.n PT Gresik Cipta Sejahtera', '2046-04-16', N'SHGB No.02.04.000017183.4, SK. No..02', 2025, N'Asli di Gresik',
 N'Desa Saentis, Kec. Percut Sei Tuan, Kab. Deli Serdang, Sumatera Utara', 1000, N'M2', N'Tidak Dijaminkan', NULL,
 2961700000, N'Muttaqin Bambang Purwanto Rozak Uswatun dan Rekan', 2020, N'00017/2.0027-06/PI/05/0303/1/I/2020 Tgl.29 Januari 2020',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Pabrik', N'HGB a.n PT Gresik Cipta Sejahtera', '2039-05-19', N'Sertifikat Nomor 1', 2014, N'Asli di Gresik',
 N'Desa Nagara Padang Kecamatan Petir Kabupaten Serang', 1107, N'M2', N'Tidak Dijaminkan', NULL,
 6020300000, N'KJPP SARWONO, INDRIASARI DAN REKAN', 2024, N'0001/2.0156-00/PI/07/0011/1/I/2024 03 Januari 2024',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Pabrik', N'HGB a.n PT Gresik Cipta Sejahtera', '2039-05-19', N'Sertifikat Nomor 2', NULL, N'Asli di Gresik',
 N'Desa Nagara Padang Kecamatan Petir Kabupaten Serang', 1100, N'M2', N'Tidak Dijaminkan', NULL,
 6020300000, N'KJPP SARWONO, INDRIASARI DAN REKAN', 2024, N'0001/2.0156-00/PI/07/0011/1/I/2024 03 Januari 2024',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2039-05-19', N'Sertifikat Nomor 3', NULL, N'Asli di Gresik',
 N'Desa Nagara Padang Kecamatan Petir Kabupaten Serang', 1745, N'M2', N'Tidak Dijaminkan', NULL,
 6020300000, N'KJPP SARWONO, INDRIASARI DAN REKAN', 2024, N'0001/2.0156-00/PI/07/0011/1/I/2024 03 Januari 2024',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Pabrik', N'HGB a.n PT Gresik Cipta Sejahtera', '2039-05-19', N'Sertifikat Nomor 4', 2004, N'Asli di Gresik',
 N'Desa Nagara Padang Kecamatan Petir Kabupaten Serang', 2248, N'M2', N'Tidak Dijaminkan', NULL,
 6020300000, N'KJPP SARWONO, INDRIASARI DAN REKAN', 2024, N'0001/2.0156-00/PI/07/0011/1/I/2024 03 Januari 2024',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan Pabrik', N'HGB a.n PT Gresik Cipta Sejahtera', '2039-05-19', N'Sertifikat Nomor 5', 2004, N'Asli di Gresik',
 N'Desa Nagara Padang Kecamatan Petir Kabupaten Serang', 3743, N'M2', N'Tidak Dijaminkan', NULL,
 6020300000, N'KJPP SARWONO, INDRIASARI DAN REKAN', 2024, N'0001/2.0156-00/PI/07/0011/1/I/2024 03 Januari 2024',
 NULL, NULL, NULL, N'Y',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Persetujuan Pelepasan Aset 9 Januari 2023', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'HGB a.n PT Gresik Cipta Sejahtera', '2031-12-19', N'Sertifikat Nomor 746', 1994, N'Asli di Gresik',
 N'Jalan Hayam Wuruk Ruko Kedemean Indah No 6 Desa Kedamaian, Kecamatan Tanjungkarang Timur, Kota Bandar Lampung, Provinsi Lampung', 124, N'M2', N'Tidak Dijaminkan', NULL,
 1060000000, N'KJPP Mutataqin Bambang Purwanto Rozak Uswatun dan Rekan', 2023, N'00659/2.0027-05/PI/07/0278/1/XII/2023. Tgl.22 Des.2023',
 NULL, NULL, NULL, N'Y',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah', N'SHM a.n Kikit Satoto, S.H. ; Surat Pernyataan tanggal 20 Mei 2019 ; Akta Kuasa Menjual Nomor 4 tanggal 17 Juni 2019 Notaris Sarah Chandra, S.H., M.Kn.', NULL, N'Sertikat Nomor 472', NULL, N'Asli di Gresik',
 N'Desa Tebluru, Kecamatan Solokuro, Kabupaten Lamongan', 5728, N'M2', N'Tidak Dijaminkan', 300000000,
 630100000, N'KJPP Munir, Wisnu, Heru & Rekan', 2023, N'00544/2.0129-02/PI/07/0569/1/XI/2023. Tgl.27 Des.2023',
 NULL, NULL, NULL, N'T',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan/Pelepasan Aset 26 November 2020', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah', N'Tanah Hak Milik Letter C Nomor 869, Persil 61 Kelas III, seluas 1230 M2, atas nama Ersadul Ibad; dan Ikatan Jual Beli dan Kuasa Jual Nomor 01 Tanggal 03 Nopember 2015 Notaris CH. Anggia Ika HDKW., S.H., M.Hum. - Mojokerto', NULL, NULL, NULL,
 N'Letter C (proses minta ganti jaminan atau pembayaran langsung krn diduga Letter C nya aspal)',
 N'Dusun Balongkenongo, Desa Tanjung Kenongo, Kecamatan Pacet, Kabupaten Mojokerto', 1230, N'M2', N'Tidak Dijaminkan', NULL,
 NULL, NULL, NULL, NULL,
 NULL, NULL, NULL, N'T',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan/Pelepasan Aset 26 November 2020', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah', N'Tanah Hak Milik Letter C Nomor 626, Persil 33 d Kelas I a, seluas 55 M2 dari luas keseluruhan 930 M2, atas nama Sariah b Asemah; dan Ikatan Jual Beli dan Kuasa Jual Nomor 03 Tanggal 12 Nopember 2015 Notaris CH. Anggia Ika HDKW., S.H., M.Hum. - Mojokerto', NULL, NULL, NULL,
 N'Letter C (Rencana pembuatan sertifikat)',
 N'Desa Sedenganmijen, Kecamatan Krian, Kabupaten Sidoarjo', 55, N'M2', N'Tidak Dijaminkan', NULL,
 NULL, NULL, NULL, NULL,
 NULL, NULL, NULL, N'T',
 N'Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan/Pelepasan Aset 26 November 2020', N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah (Asset Sitaan)', N'Akta Peralihan Hak Ganti Rugi Kecamatan Padang Hulu Kota Tebing Tinggi, atas nama Sulihan Sahab alamat Jl Gugur No. 31 / 32 Medan', NULL, N'Surat Nomor 593.83/PHU/2004', NULL, N'Surat Keterangan Tanah (SKT) di Medan',
 N'Jl. Danau Maninjau / IV Keluirahan Pabatu, Kecamatan Padang Hulu, Kota Tebing Tinggi, Provinsi Sumatera Utara', 539, N'M2', N'Tidak Dijaminkan', NULL,
 NULL, NULL, NULL, NULL,
 NULL, NULL, NULL, N'T',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME()),

(N'Tanah & Bangunan', N'Sertifikat Hak Guna Bangunan No. 00238 atas nama PT Gresik Cipta Sejahtera', NULL, N'Sertifikat Nomor 00238', NULL, N'Asli di Gresik',
 N'Jalan Raya Petarukan RT.003 / RW.016, Dusun Kebonsari, Desa Petarukan, Kecamatan Petarukan, Kabupaten Pemalang.', 72, N'M2', N'Tidak Dijaminkan', NULL,
 NULL, NULL, NULL, NULL,
 NULL, NULL, NULL, N'T',
 NULL, N'IMPORT-2026-08-07', SYSUTCDATETIME());

PRINT CONCAT(@@ROWCOUNT, ' baris disisipkan ke aset.tidak_produktif.');
GO