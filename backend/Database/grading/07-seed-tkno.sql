/* ============================================================================
   grading - tabel + seed 30 pegawai NON ORGANIK (TKNO) PT GCS
   Sumber: "Data Pegawai Organik dan TKNO GCS - 22072026.pdf" (data per Juni 2026).
   ----------------------------------------------------------------------------
   KENAPA TABEL TERPISAH (grading.pegawai_tkno), BUKAN dimasukkan ke
   jabatan/penempatan/person_grade organik:
     - Pegawai TKNO memakai SKEMA GRADING SENDIRI. Kolom Band & JG di dokumen
       ini (mis. Driver Pool = Band 3/JG 6, Cleaning Service = Band 4/JG 2,
       Admin = Band 2/JG 8) TIDAK sama artinya dengan skema organik:
         * grading.job_grade hanya mengenal JG 7-21 -> JG 6/5/4/2 di sini akan
           melanggar FK kalau dipaksa masuk grading.jabatan.
         * grading.band 0-6 dipakai untuk jenjang struktural organik (Band 3 =
           Kepala Bagian); seorang Driver jelas bukan "Kepala Bagian".
     - Karena itu Band/JG di tabel ini DISENGAJA tidak diberi FK ke
       grading.band / grading.job_grade - keduanya angka skema TKNO apa adanya
       dari dokumen sumber. Tabel organik & view rekap band tetap bersih.

   REFERENSI LINTAS DATABASE (TANPA FK)
   pegawai_tkno.id_karyawan berisi nilai yang SECARA LOGIS sama dengan
   GCS.dbo.MST_PEGAWAI.ID_KARYAWAN (mis. 'P.217002'). Seperti tabel penempatan/
   person_grade organik, relasi lintas-DB ini TIDAK diberi FK. Ke-30 NIK di sini
   sudah diverifikasi ADA di GCS.dbo.MST_PEGAWAI sebelum seeding.

   Masa Kerja TIDAK disimpan (derivatif) - dihitung dari tgl_masuk.
   Idempoten: tabel & isi dicek dulu sebelum dibuat/diisi (aman diulang).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\grading\07-seed-tkno.sql
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

/* ---------------------------------------------------------------------------
   grading.pegawai_tkno - satu baris per pegawai TKNO.
   band & jg = skema TKNO (BUKAN grading.band / grading.job_grade), tanpa FK.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('grading.pegawai_tkno', 'U') IS NULL
BEGIN
    CREATE TABLE grading.pegawai_tkno
    (
        id_karyawan   NVARCHAR(20)  NOT NULL CONSTRAINT PK_grading_pegawai_tkno PRIMARY KEY,  -- = GCS.dbo.MST_PEGAWAI.ID_KARYAWAN (tanpa FK, lintas-DB)
        urutan        TINYINT       NULL,          -- No. urut di dokumen sumber
        nama          NVARCHAR(150) NOT NULL,
        band          TINYINT       NULL,          -- Band skema TKNO (bukan grading.band organik)
        jg            TINYINT       NULL,          -- JG skema TKNO (bukan grading.job_grade 7-21)
        tgl_masuk     DATE          NULL,          -- Tanggal Masuk Kerja
        unit_staf     NVARCHAR(150) NULL,          -- Unit / Staf (peran)
        bagian        NVARCHAR(200) NULL,
        departemen    NVARCHAR(150) NULL,
        kompartemen   NVARCHAR(150) NULL,
        direktorat    NVARCHAR(100) NULL,
        dibuat_pada   DATETIME2     NOT NULL CONSTRAINT DF_grading_pegawai_tkno_dibuat DEFAULT (SYSDATETIME())
    );
    PRINT 'Tabel grading.pegawai_tkno dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.pegawai_tkno sudah ada.';
GO

/* ---------------------------------------------------------------------------
   Seed 30 pegawai TKNO
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM grading.pegawai_tkno)
BEGIN
    PRINT 'LEWATI: grading.pegawai_tkno sudah terisi.';
    SET NOEXEC ON;
END
GO

INSERT INTO grading.pegawai_tkno
    (id_karyawan, urutan, nama, band, jg, tgl_masuk, unit_staf, bagian, departemen, kompartemen, direktorat)
VALUES
-- No.1-4 Driver Pool (Departemen SDM)
(N'P.217002',  1, N'MOCH. AGUS SUPRIYONO',          3, 6, '2017-08-01', N'Driver Pool', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.225482',  2, N'BAGUS PERWIRA ANGGORO',         3, 5, '2025-05-26', N'Driver Pool', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.226531',  3, N'FANKY SETYA AGUSTI',            3, 4, '2026-05-06', N'Driver Pool', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.226532',  4, N'MUHAMMAD IVADHO FIRMANSYAH',    3, 4, '2026-05-06', N'Driver Pool', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
-- No.5-6 Mekanik (Jasa Logistik)
(N'P.224468',  5, N'HAN''S ZAMRONI ADI P.',         2, 7, '2025-03-24', N'Mekanik', N'Bagian Jasa Transport dan Bengkel', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
(N'P.225491',  6, N'MUHAMMAD ARYAN ILHAM',          2, 7, '2025-07-28', N'Mekanik', N'Bagian Jasa Transport dan Bengkel', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
-- No.7-9 Admin
(N'P.217009',  7, N'DWI SETIAWAN',                  2, 9, '2017-08-01', N'Admin Penjualan Bahan Kimia', NULL, N'Departemen Penjualan Bahan Kimia dan Gas', N'Kompartemen Penjualan Korporasi', N'Direktorat Komersil'),
(N'P.217016',  8, N'M. SHODIQ',                      2, 8, '2017-08-01', N'Admin Penjualan Kesuplieran', NULL, N'Departemen Penjualan Kesuplieran', N'Kompartemen Penjualan Korporasi', N'Direktorat Komersil'),
(N'P.218250',  9, N'JEMMY RINTY',                    2, 9, '2018-03-01', N'Admin Jasa Transport', N'Bagian Jasa Transport dan Bengkel', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
-- No.10 Admin Penagihan (Keuangan)
(N'P.224457', 10, N'TANTRI RAHMADYA LOLITA',        3, 5, '2024-08-19', N'Admin Penagihan', N'Bagian Penagihan', N'Departemen Keuangan', N'Kompartemen Administrasi Keuangan', N'Direktorat Keuangan'),
-- No.11 Sekretaris (SDM)
(N'P.224462', 11, N'FARCHA MAULIDATUL MUHAMMADIY',  2, 6, '2024-11-11', N'Sekretaris', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
-- No.12 Multimedia (Pengembangan)
(N'P.225470', 12, N'MUHAMMAD FERRI FIRMANSYAH',     2, 7, '2025-04-28', N'Multimedia', N'Bagian Multimedia dan TI', N'Departemen Pengembangan', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
-- No.13-17 Admin
(N'P.225486', 13, N'MUHAMMAD KAHFI ARYA PRATAMA',   2, 8, '2025-07-28', N'Admin Penjualan Pupuk Retail', NULL, N'Departemen Penjualan Pupuk & Pestisida Retail', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
(N'P.225487', 14, N'MUHAMMAD ASRUR SANI',           2, 8, '2025-07-28', N'Admin Penjualan Bahan Kimia', NULL, N'Departemen Penjualan Bahan Kimia dan Gas', N'Kompartemen Penjualan Korporasi', N'Direktorat Komersil'),
(N'P.225488', 15, N'YANUAR SETIAWAN',               2, 8, '2025-07-28', N'Admin Jasa Logistik', N'Bagian Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
(N'P.225489', 16, N'NEVY RAHMASARI',                2, 8, '2025-07-28', N'Admin Penjualan Pupuk Korporasi', NULL, N'Departemen Penjualan Pupuk & Pestisida Korporasi', N'Kompartemen Penjualan Korporasi', N'Direktorat Komersil'),
(N'P.225490', 17, N'SHAVIRA ARINDA DAMAYANTI',      2, 8, '2025-07-28', N'Admin Penjualan Bahan Kimia', NULL, N'Departemen Penjualan Bahan Kimia dan Gas', N'Kompartemen Penjualan Korporasi', N'Direktorat Komersil'),
-- No.18 Cleaning Service (SDM)
(N'P.225515', 18, N'MUHAMAD FAROUK UBAIDILLAH',     4, 2, '2026-02-24', N'Cleaning Service', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
-- No.19-22 Driver B3 / Asisten (Jasa Logistik)
(N'P.217018', 19, N'LIZAL MAMIR DIAN',              2, 7, '2017-08-01', N'Asisten Driver B3', N'Bagian Jasa Transport dan Bengkel', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
(N'P.217037', 20, N'FERDI ALISKA',                  2, 8, '2017-08-01', N'Driver B3', N'Bagian Jasa Transport dan Bengkel', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
(N'P.217068', 21, N'MARJUKI',                        2, 8, '2017-08-01', N'Driver B3', N'Bagian Jasa Transport dan Bengkel', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
(N'P.217069', 22, N'BUKHORI',                        2, 8, '2017-08-01', N'Driver B3', N'Bagian Jasa Transport dan Bengkel', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil'),
-- No.23-29 Security (SDM)
(N'P.219341', 23, N'MOHAMAD MULDANSARI W.',         2, 6, '2019-04-01', N'Security', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.223449', 24, N'MUHAMMAD RAMADHAN ARSYILHAKIM', 2, 7, '2023-12-01', N'Security', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.225471', 25, N'FIRDO GALANG DWI CHAKTY',       3, 4, '2025-04-28', N'Security', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.225513', 26, N'ACHMAD ZAINUL SOBIRIN',         3, 4, '2025-11-11', N'Security', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.225514', 27, N'MUHAMMAD FARREL SHOLAHUDDIN',   3, 4, '2025-11-14', N'Security', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.226533', 28, N'RISQI KURNIAWAN',               3, 4, '2026-05-17', N'Security', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
(N'P.226534', 29, N'M. RIDWAN FAJRIYANTO',          3, 4, '2026-05-25', N'Security', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan'),
-- No.30 Umum (SDM)
(N'P.217022', 30, N'SUNTORO',                        3, 4, '2017-08-01', N'Umum', N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'Departemen SDM', N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktorat Keuangan');

DECLARE @cnt INT = (SELECT COUNT(*) FROM grading.pegawai_tkno);
PRINT 'grading.pegawai_tkno: ' + CAST(@cnt AS VARCHAR(10)) + ' baris disisipkan.';
GO

SET NOEXEC OFF;
GO
