/* ============================================================================
   grading - penempatan + person_grade untuk 28 pegawai Band 1-3
   Sumber: "Data 85 Pegawai Organik GCS.pdf" (data per Juni 2026).
   Jabatan dicocokkan berdasarkan JALUR ORGANISASI ASLI tiap baris pegawai
   (Unit/Staf, Bagian, Departemen, Kompartemen) - BUKAN dari catatan nama
   incumbent di Analisis_Pemetaan_JG, karena ditemukan 2 perbedaan nyata:
     - M. Syamsuddin ternyata di "Bagian Akuntansi dan Verifikasi" (bukan
       Bag. Anggaran & Pelaporan seperti catatan Analisis JG).
     - Wynfried Ardian Didok ternyata di "Bagian Anggaran dan Pelaporan"
       (bukan Bag. Akuntansi & Verifikasi seperti catatan Analisis JG).
   Data 85 Pegawai adalah sumber payroll yang diminta eksplisit oleh user,
   jadi dipakai sebagai kebenaran untuk PENEMPATAN.
   Ari Kuncoro (baris 18) sudah tercatat Band 2/Manager Pengembangan di
   payroll meski kolom Bagian masih menyisakan teks lama "Bag. TI &
   Multimedia" - SESUAI catatan Analisis JG soal proses promosi yang SK-nya
   belum terbit; ditempatkan di Manager Pengembangan (bukan Band 3).
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

IF EXISTS (SELECT 1 FROM grading.penempatan)
BEGIN
    PRINT 'LEWATI: grading.penempatan sudah terisi.';
    SET NOEXEC ON;
END
GO

DECLARE @tahun SMALLINT = 2026;

SELECT * INTO #src FROM (
    SELECT * FROM (VALUES
    -- nik, nama, nama_jabatan, id_band, pg, tgl_masuk, status_sk
    (N'T.980187', N'Widodo',                         N'GM Penjualan Retail',                                        1, 20, '19981002', N'Definitif'),
    (N'T.205232', N'Abdul Rahman, SE',                N'GM Penjualan Korporasi',                                     1, 20, '20030404', N'Definitif'),
    (N'T.208254', N'Ach. Wachyudi',                   N'GM Administrasi Keuangan',                                   1, 19, '20070801', N'Pjs.'),
    (N'T.205220', N'Ahmad Mukhlis K.',                N'Manager Jasa Logistik',                                     2, 18, '20020830', N'Definitif'),
    (N'T.970175', N'Ita Sudarwati',                   N'Manager Penjualan Pupuk & Pestisida Korporasi',              2, 18, '19971103', N'Definitif'),
    (N'T.940152', N'Sri Rahayu',                      N'Manager Keuangan',                                          2, 18, '19901105', N'Definitif'),
    (N'T.206242', N'Nanang Budi D, SE',               N'Manager Kepatuhan',                                         2, 18, '20050501', N'Definitif'),
    (N'T.205221', N'Joko Purwanto, SE',               N'Staf Madya Perencanaan, Pengendalian & Produksi',           2, 18, '20030203', N'Definitif'),
    (N'T.210261', N'I Dewa Putu Candra K., ST',       N'Manager Penjualan Kesuplieran',                             2, 17, '20100501', N'Definitif'),
    (N'T.211271', N'Ridlo Patyodi',                   N'Manager Region Makassar',                                   2, 17, '20111001', N'Definitif'),
    (N'T.208256', N'Choiri, SE',                      N'Manager Audit Internal',                                    2, 17, '20070801', N'Definitif'),
    (N'T.211275', N'Bagus Adita',                     N'Manager Anggaran & Akuntansi',                              2, 17, '20111001', N'Definitif'),
    (N'T.214291', N'Sutan Priatmaja',                 N'Staf Khusus Direktur Komersil',                             2, 17, '20141115', N'Definitif'),
    (N'T.211273', N'Ari Kuncoro',                     N'Manager Pengembangan',                                      2, 17, '20111001', N'Definitif'),
    (N'T.970200', N'Dwi Rini P, SE',                  N'Bag. Pajak & Asuransi',                                     3, 16, '19971103', N'Definitif'),
    (N'T.960203', N'Kusno',                           N'Bag. Penjualan & Adm Pestisida (Jawa)',                     3, 16, '19960705', N'Definitif'),
    (N'T.205219', N'Fifi Emmalia, SE',                N'Bag. Perbendaharaan',                                       3, 16, '20010910', N'Definitif'),
    (N'T.210259', N'M. Syamsuddin, SE',               N'Bag. Akuntansi & Verifikasi',                               3, 16, '20100501', N'Definitif'),
    (N'T.208257', N'Burnama Kusuma DR., SE',          N'Bag. Penjualan & Adm Pupuk Subsidi & Non Subsidi (Jawa)',   3, 16, '20070801', N'Pjs.'),
    (N'T.208255', N'Widya Nanang Suryanto, ST',       N'Bag. Audit Internal',                                       3, 16, '20070801', N'Definitif'),
    (N'T.211270', N'Yudistira Sigit W.',              N'Bag. Tata Kelola, Manajemen Risiko & Sistem Manajemen',    3, 15, '20111001', N'Definitif'),
    (N'T.214289', N'Wynfried Ardian Didok',           N'Bag. Anggaran & Pelaporan',                                 3, 15, '20141115', N'Pjs.'),
    (N'T.211279', N'Ardhi Yunanto',                   N'Bag. Perijinan, Hukum & K3',                                3, 15, '20111001', N'Definitif'),
    (N'T.211277', N'Erly Nurlianti',                  N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset',        3, 15, '20111001', N'Definitif'),
    (N'T.211276', N'Diah Puspitasari',                N'Bag. Administrasi & Pengembangan SDM & Inovasi',           3, 15, '20111001', N'Definitif'),
    (N'T.208253', N'Lilik Munawati',                  N'Bag. Penagihan',                                           3, 15, '20070301', N'Definitif'),
    (N'T.208252', N'Golik',                           N'Bag. Penjualan & Adm Pupuk Subsidi (Lampung)',              3, 15, '20070301', N'Pjs.'),
    (N'T.210269', N'Ari Rahayu',                      N'Bag. Pengadaan & Pengelolaan Pengembangan',                3, 15, '20101101', N'Pjs.')
    ) AS v(nik, nama, nama_jabatan, id_band, pg, tgl_masuk, status_sk)
) AS x;

INSERT INTO grading.penempatan (id_jabatan, id_karyawan, nama, tmt, status, catatan)
SELECT j.id_jabatan, s.nik, s.nama, CONVERT(DATE, s.tgl_masuk, 112), N'Aktif',
       N'Status SK: ' + s.status_sk
FROM #src s
JOIN grading.jabatan j ON j.nama_jabatan = s.nama_jabatan AND j.id_band = s.id_band;

INSERT INTO grading.person_grade (id_karyawan, nama, pg, tahun_berlaku)
SELECT nik, nama, pg, @tahun FROM #src;

DROP TABLE #src;

DECLARE @pc INT = (SELECT COUNT(*) FROM grading.penempatan);
DECLARE @gc INT = (SELECT COUNT(*) FROM grading.person_grade);
PRINT 'grading.penempatan: ' + CAST(@pc AS VARCHAR(10)) + ' baris (Band 1-3).';
PRINT 'grading.person_grade: ' + CAST(@gc AS VARCHAR(10)) + ' baris (Band 1-3).';
GO

SET NOEXEC OFF;
GO
