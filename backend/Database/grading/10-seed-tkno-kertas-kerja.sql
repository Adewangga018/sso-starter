/* ============================================================================
   grading - kolom tambahan + seed 134 pegawai TKNO Pemasaran & Gudang
   Sumber: "Kertas_Kerja TKNO Final" (kertas kerja skema penggajian TKNO).
   ----------------------------------------------------------------------------
   MENAMBAH, BUKAN MENGGANTI. Tabel grading.pegawai_tkno sudah berisi 30 baris
   dari "Data Pegawai Organik dan TKNO GCS - 22072026.pdf" (TKNO kantor pusat:
   Driver Pool, Security, Admin, Mekanik, dst). Ke-134 NIK di sini DISJOINT
   dari ke-30 itu (sudah diverifikasi), jadi keduanya hidup berdampingan -
   total 164 baris.

   KENAPA ADA KOLOM `kelompok` BARU
   Kertas kerja ini memakai kolom "Band" BERISI TEKS - "Pemasaran" atau
   "Gudang" - yaitu KELOMPOK skema penggajian, bukan angka jenjang. Itu tidak
   bisa masuk kolom `band` TINYINT yang sudah ada, dan memaksanya jadi angka
   (Pemasaran=1/Gudang=2) akan bertabrakan arti dengan band 2/3/4 pada 30 baris
   lama. Karena itu:
     - kelompok = 'Pemasaran' / 'Gudang'  -> hanya untuk 134 baris ini
     - band     = NULL                    -> 134 baris ini tidak punya band angka
     - 30 baris lama: kelompok = NULL, band tetap 2/3/4 seperti semula

   SKEMA JG PER KELOMPOK (dari kertas kerja sumber)
     Kelompok Pemasaran : JG1 = PPK, JG2 = Admin/Asisten Pemasaran
     Kelompok Gudang    : JG1 = Kepala Gudang, JG2 = Admin Gudang,
                          JG3 = Checker, JG4 = Keamanan Gudang,
                          JG5 = Koordinator Gudang (tambahan)
   JG4/JG5 Gudang berada DI LUAR skema Pemasaran/Gudang yang diberikan - kolom
   catatan menandainya (16 baris). Sama seperti band, JG di sini TIDAK diberi FK
   ke grading.job_grade (yang hanya mengenal JG 7-21 skema organik).

   Populasi TKNO lain yang BELUM masuk tabel ini:
     - Band Kantor Daerah : 13 orang di 3 kantor perwakilan (Medan / Bandar
                            Lampung / Makassar) - skema penggajian sudah ada.
     - Band Kantor Pusat  : TKNO di pusat/departemen - skema penggajian masih
                            menunggu dokumen.

   NAMA UNIT DINORMALISASI ke konvensi grading.unit_organisasi supaya
   09-tkno-unit-id.sql bisa mengisi id_departemen/id_kompartemen/id_direktorat:
     'Komersil'          -> 'Direktorat Komersil'
     'Penjualan Retail'  -> 'Kompartemen Penjualan Retail'
     'Jasa Logistik'     -> 'Departemen Jasa Logistik'
     'Region Makassar' & 'Regional Makassar' -> 'Departemen Region Makassar'
   Kolom `bagian` DIBIARKAN apa adanya sesuai kertas kerja (tidak dipakai untuk
   penautan ID), kecuali 'Pergudangan' yang atas permintaan pengguna diganti
   menjadi 'Staf penjualan logistik, non subsidi, dan pestisida'.

   MDG / masa kerja TIDAK disimpan (derivatif) - dihitung dari tgl_masuk.
   Idempoten: kolom & baris dicek dulu (aman diulang).

   JALANKAN SESUDAHNYA: 09-tkno-unit-id.sql (mengisi id_* unit) dan
   08-view-pegawai-semua.sql bila view perlu dibangun ulang.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\grading\10-seed-tkno-kertas-kerja.sql
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

IF OBJECT_ID('grading.pegawai_tkno', 'U') IS NULL
BEGIN
    RAISERROR('BATAL: grading.pegawai_tkno belum ada - jalankan 07-seed-tkno.sql lebih dulu.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------------------------------------------------------------------
   Kolom tambahan dari kertas kerja (idempoten).
   --------------------------------------------------------------------------- */
IF COL_LENGTH('grading.pegawai_tkno', 'kelompok') IS NULL
    ALTER TABLE grading.pegawai_tkno ADD kelompok NVARCHAR(30) NULL;   -- 'Pemasaran' / 'Gudang' (NULL utk TKNO kantor pusat)
GO
IF COL_LENGTH('grading.pegawai_tkno', 'wilayah') IS NULL
    ALTER TABLE grading.pegawai_tkno ADD wilayah NVARCHAR(200) NULL;   -- wilayah kerja / penempatan
GO
IF COL_LENGTH('grading.pegawai_tkno', 'catatan') IS NULL
    ALTER TABLE grading.pegawai_tkno ADD catatan NVARCHAR(300) NULL;   -- catatan kertas kerja
GO

/* ---------------------------------------------------------------------------
   Seed 134 baris. Dilewati bila kelompok Pemasaran/Gudang sudah terisi.
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM grading.pegawai_tkno WHERE kelompok IN (N'Pemasaran', N'Gudang'))
BEGIN
    PRINT 'LEWATI: baris TKNO Pemasaran/Gudang sudah ada.';
    SET NOEXEC ON;
END
GO

INSERT INTO grading.pegawai_tkno
    (id_karyawan, urutan, nama, kelompok, band, jg, tgl_masuk, unit_staf,
     bagian, departemen, kompartemen, direktorat, wilayah, catatan)
VALUES
-- Pemasaran JG1 - PPK
(N'P.217124',   1, N'A. IZZAZUDDIN', N'Pemasaran', NULL, 1, '2008-01-06', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Penjualan Pupuk & Pestisida Retail', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Purbalingga', NULL),
(N'P.219333',   2, N'ABDUL HARIS', N'Pemasaran', NULL, 1, '2019-02-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Sigi Sulawesi Tengah', NULL),
(N'P.219327',   3, N'ADI WINDORO', N'Pemasaran', NULL, 1, '2011-04-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'kab. Poso & Kab. Donggala', NULL),
(N'P.217157',   4, N'ANDI ALFIAN', N'Pemasaran', NULL, 1, '2012-09-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Lampung', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Pesawaran & Lampung Tengah', NULL),
(N'P.218181',   5, N'ANDRE PRANATA H.', N'Pemasaran', NULL, 1, '2017-07-27', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kota Padangsidimpuan, Kab. Tapanuli Selatan, Dan Kab. Mandailing Natal', NULL),
(N'P.219332',   6, N'BAMBANG SUPRIADI', N'Pemasaran', NULL, 1, '2014-02-02', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab.Luwu Utara', NULL),
(N'P.218178',   7, N'COSVINTARA', N'Pemasaran', NULL, 1, '2014-06-16', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab Labuhanbatu dan Labuhanbatu Selatan', NULL),
(N'P.218182',   8, N'DEWI SARTIKA S.', N'Pemasaran', NULL, 1, '2014-09-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Tapanuli Tengah', NULL),
(N'P.217154',   9, N'DWI KURNIADI', N'Pemasaran', NULL, 1, '2006-09-01', N'PPK', N'Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida', N'Departemen Region Lampung', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Lampung', N'Pemasar Non-Subsidi (skema PPK)'),
(N'P.218235',  10, N'HARDIYANTO', N'Pemasaran', NULL, 1, '2018-09-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Lampung', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Takalar', NULL),
(N'P.218202',  11, N'HARI SAPUTRA SIAHAAN', N'Pemasaran', NULL, 1, '2018-03-01', N'PPK', N'Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', N'Pemasar Non-Subsidi (skema PPK)'),
(N'P.218300',  12, N'HERLAMBANG ADI IRAWAN', N'Pemasaran', NULL, 1, '2018-01-09', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tegal', NULL),
(N'P.217123',  13, N'HIDIN RIYATNO', N'Pemasaran', NULL, 1, '2007-01-11', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Wonosobo', NULL),
(N'P.219329',  14, N'IRSAN', N'Pemasaran', NULL, 1, '2014-01-03', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Gowa', NULL),
(N'P.225508',  15, N'JASWAN', N'Pemasaran', NULL, 1, '2025-07-30', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bombana, Sulawesi Tenggara', NULL),
(N'P.222430',  16, N'M. RIDHO FIKRI', N'Pemasaran', NULL, 1, '2022-09-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Lampung', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Lampung Barat & Lampung Tengah', NULL),
(N'P.217147',  17, N'MURSALIN', N'Pemasaran', NULL, 1, '2017-10-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab Maros', NULL),
(N'P.219334',  18, N'RIDHO ILAHI', N'Pemasaran', NULL, 1, '2017-02-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Sidenreng Rappang', NULL),
(N'P.217126',  19, N'SATRIYA DENNY IRAWAN', N'Pemasaran', NULL, 1, '2013-01-03', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Banjarnegara', NULL),
(N'P.217089',  20, N'SEPTIAN HANDY LUKMANA', N'Pemasaran', NULL, 1, '2018-10-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kota Medan, Deli Serdang dan Langkat', NULL),
(N'P.223435',  21, N'SUCI RAMADANI', N'Pemasaran', NULL, 1, '2022-11-29', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Konawe Selatan, Sultra', NULL),
(N'P.219330',  22, N'SUDIRMAN', N'Pemasaran', NULL, 1, '1999-01-12', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Gowa', NULL),
(N'P.217080',  23, N'SURYA RAMADHAN', N'Pemasaran', NULL, 1, '2018-10-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Lawas dan Padang lawas Utara', NULL),
(N'P.217116',  24, N'SUSILO SANTOSO', N'Pemasaran', NULL, 1, '2004-01-12', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Pekalongan', NULL),
(N'P.217162',  25, N'SUTRIONO', N'Pemasaran', NULL, 1, '2014-09-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Lampung', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Lampung Tengah', NULL),
(N'P.217120',  26, N'SYA''BAN JAUHARI', N'Pemasaran', NULL, 1, '2005-01-07', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Brebes', NULL),
(N'P.217117',  27, N'TEGAS WITJAKSONO', N'Pemasaran', NULL, 1, '2004-01-12', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Banyumas', NULL),
(N'P.220368',  28, N'WAHYUDIN', N'Pemasaran', NULL, 1, '2020-10-01', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bulukumba', NULL),
(N'P.217119',  29, N'YOGI BUDIARSO', N'Pemasaran', NULL, 1, '2005-01-07', N'PPK', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Pemalang', NULL),
(N'P.221393',  30, N'YUDI TRIAGA PUTRA', N'Pemasaran', NULL, 1, '2012-01-03', N'PPK', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tapanuli Utara', NULL),
-- Pemasaran JG2 - Admin/Asisten Pemasaran
(N'P.219309',  31, N'AHYAR SAIF', N'Pemasaran', NULL, 2, '2017-10-11', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Sindereng Rappang', NULL),
(N'P.220367',  32, N'AMRY ARIFIN', N'Pemasaran', NULL, 2, '2019-01-05', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Gowa', NULL),
(N'P.218299',  33, N'DINI EROWATI', N'Pemasaran', NULL, 2, '2018-01-09', N'Admin/Asisten Pemasaran', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Penjualan Pupuk & Pestisida Retail', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Jateng Utara', NULL),
(N'P.225477',  34, N'ETIK WIDIY SETYOWATI', N'Pemasaran', NULL, 2, '2025-01-05', N'Admin/Asisten Pemasaran', N'Staf Penjualan dan Adminstrasi Pupuk Subsidi & Non Subsidi', N'Departemen Region Jawa Tengah', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Jateng Selatan', NULL),
(N'P.217097',  35, N'FAJAR HANDOKO', N'Pemasaran', NULL, 2, '2012-10-01', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.219353',  36, N'HERYAN SYAHPUTRA SIAGIAN', N'Pemasaran', NULL, 2, '2019-01-01', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.223442',  37, N'LATIFAH HIKMATUL ASLAMIYAH', N'Pemasaran', NULL, 2, '2023-01-02', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Penjualan Pupuk & Pestisida Retail', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Malang', NULL),
(N'P.221400',  38, N'PRIKO ANDRIAN', N'Pemasaran', NULL, 2, '2020-10-07', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Medan', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kab. Labuhanbatu dan Kab. Labuhanbatu Selatan', NULL),
(N'P.225521',  39, N'RANA AFSANA', N'Pemasaran', NULL, 2, '2026-02-20', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Sulawesi Tengah', NULL),
(N'P.226535',  40, N'SITTI KHADIJAH', N'Pemasaran', NULL, 2, '2026-04-01', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Maros, Sulawesi Selatan', NULL),
(N'P.220369',  41, N'SULKIPLI', N'Pemasaran', NULL, 2, '2020-03-03', N'Admin/Asisten Pemasaran', N'Penjualan dan Administrasi Pupuk Subsidi', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', NULL, NULL),
-- Gudang JG1 - Kepala Gudang
(N'P.219308',  42, N'AHMAD NIZAR FAHMI', N'Gudang', NULL, 1, '2010-04-04', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parepare Sulawesi Selatan', NULL),
(N'P.218225',  43, N'AMIRUL MUKMININ', N'Gudang', NULL, 1, '2018-03-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tanah Karo', NULL),
(N'P.225502',  44, N'ASWAR', N'Gudang', NULL, 1, '2025-08-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Palu, Sulawesi Tengah', NULL),
(N'P.226536',  45, N'DJOKO CAHWONO', N'Gudang', NULL, 1, '2026-05-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Mamuju Tengah', NULL),
(N'P.218189',  46, N'EKA MAULANA PUTRA', N'Gudang', NULL, 1, '2018-03-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Lawas', NULL),
(N'P.225472',  47, N'ERWIN KASIM', N'Gudang', NULL, 1, '2025-04-09', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Gorontalo', NULL),
(N'P.217094',  48, N'FACHRIZAL ANDI ARTHA', N'Gudang', NULL, 1, '2017-10-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.217077',  49, N'FACHRUF AFDALA', N'Gudang', NULL, 1, '2017-10-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Serdang Bedagai', NULL),
(N'P.217166',  50, N'HELMI', N'Gudang', NULL, 1, '2008-10-15', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Lampung Tengah', NULL),
(N'P.225512',  51, N'HENDRA SAPUTRA', N'Gudang', NULL, 1, '2025-09-11', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bengkulu', NULL),
(N'P.219303',  52, N'IBRAHIM', N'Gudang', NULL, 1, '2009-04-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Barru Sulawesi Selatan', NULL),
(N'P.218167',  54, N'M. IRFAN YANI SIREGAR', N'Gudang', NULL, 1, '2018-03-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tapanuli Utara', NULL),
(N'P.217151',  55, N'M. TAKWIN YUNUS', N'Gudang', NULL, 1, '2008-06-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Palu, Sulawesi Tengah', NULL),
(N'P.217105',  56, N'MHD. SYALEH ARIFIN S.', N'Gudang', NULL, 1, '2018-10-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Sibolga, Tapteng', NULL),
(N'P.218191',  57, N'MUHAMMAD PRASETIO', N'Gudang', NULL, 1, '2018-03-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Asahan', NULL),
(N'P.219365',  58, N'MULYADI N.', N'Gudang', NULL, 1, '2019-12-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Takalar', NULL),
(N'P.217079',  59, N'NUR AZIZAH', N'Gudang', NULL, 1, '2018-10-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Sidempuan', NULL),
(N'P.220373',  60, N'RICHMAT', N'Gudang', NULL, 1, '2019-12-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parigi Moutong, Sulawesi Tengah', NULL),
(N'P.219306',  61, N'RISMAN', N'Gudang', NULL, 1, '2015-01-06', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'kendari sulawesi tenggara', NULL),
(N'P.221419',  62, N'RIZKI DARMA S.', N'Gudang', NULL, 1, '2021-01-11', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kota Bumi', NULL),
(N'P.221420',  63, N'RIZKI TRIWIBOWO', N'Gudang', NULL, 1, '2021-12-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Gpp Bengkulu', NULL),
(N'P.218224',  64, N'TANTAWI YAHYA', N'Gudang', NULL, 1, '2018-03-01', N'Kepala Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Simalungun', NULL),
-- Gudang JG2 - Admin Gudang
(N'P.224454',  65, N'AGUNG WINOTO', N'Gudang', NULL, 2, '2024-07-20', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kota Bumi', NULL),
(N'P.225479',  66, N'ARIF TANJUNG', N'Gudang', NULL, 2, '2025-04-07', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bengkulu', NULL),
(N'P.225473',  67, N'BELLA YUSUF', N'Gudang', NULL, 2, '2025-04-09', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Gorontalo', NULL),
(N'P.217086',  68, N'CHATERINA CHRISTINE NS', N'Gudang', NULL, 2, '2018-10-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Simalungun', NULL),
(N'P.226537',  69, N'HARDIYANTI', N'Gudang', NULL, 2, '2026-05-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Mamuju Tengah', NULL),
(N'P.220372',  70, N'HARDIYANTO', N'Gudang', NULL, 2, '2018-09-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Takalar', NULL),
(N'P.225499',  71, N'KARMILA', N'Gudang', NULL, 2, '2025-08-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Palu, Sulawesi Tengah', NULL),
(N'P.224467',  72, N'LATIFAH NISA', N'Gudang', NULL, 2, '2025-01-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Serdang Bedagai', NULL),
(N'P.221391',  73, N'MAHMUD ALAMSYAH H', N'Gudang', NULL, 2, '2021-01-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.217152',  74, N'MUHAMMAD ABDU', N'Gudang', NULL, 2, '2003-01-07', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Barru Sulawesi Selatan', NULL),
(N'P.225503',  75, N'NUR AISYAH APRILIAH L.', N'Gudang', NULL, 2, '2025-08-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Luwuk Banggai', NULL),
(N'P.218174',  76, N'NURAISYAH SIMATUPANG', N'Gudang', NULL, 2, '2018-03-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Sibolga Tapteng', NULL),
(N'P.225497',  77, N'RAHKMADI', N'Gudang', NULL, 2, '2025-04-01', N'Admin Gudang', N'Staf penjualan logistik, non subsidi, dan pestisida', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parepare Sulawesi Selatan', NULL),
(N'P.218168',  79, N'RIKA IRAWAN LUBIS', N'Gudang', NULL, 2, '2018-03-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Asahan', NULL),
(N'P.218226',  80, N'RIKY FADLI', N'Gudang', NULL, 2, '2018-03-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tanah Karo', NULL),
(N'P.219351',  81, N'RINI MULIANI RITONGA', N'Gudang', NULL, 2, '2019-01-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.218241',  82, N'RITA RAHMAWATI', N'Gudang', NULL, 2, '2010-11-23', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bandar Jaya', NULL),
(N'P.222421',  84, N'ZULFITRA RAMADHANI', N'Gudang', NULL, 2, '2021-12-01', N'Admin Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parigi Moutong, Sulawesi Tengah', NULL),
-- Gudang JG3 - Checker
(N'P.226527',  85, N'AHFIN FAHREZI', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tanah Karo', NULL),
(N'P.225492',  86, N'AHMAD FADLI', N'Gudang', NULL, 3, '2025-08-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tanah Karo', NULL),
(N'P.224455',  87, N'AHMAD RIFA''I', N'Gudang', NULL, 3, '2024-07-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kota Bumi', NULL),
(N'P.225511',  88, N'ALDO JULIANSYAH', N'Gudang', NULL, 3, '2026-09-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Kota Bumi', NULL),
(N'P.225495',  89, N'ALLA DG NGESA', N'Gudang', NULL, 3, '2025-08-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Takalar', NULL),
(N'P.220371',  90, N'AMSIR', N'Gudang', NULL, 3, '2019-04-15', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'kendari sulawesi tenggara', NULL),
(N'P.218195',  92, N'ANGGI WIRANDA', N'Gudang', NULL, 3, '2018-03-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.219348',  94, N'ARVI SYAHRIN', N'Gudang', NULL, 3, '2019-01-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.225510',  95, N'BAYU RAHMAT HERMANTO', N'Gudang', NULL, 3, '2025-11-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Gpp Bengkulu', NULL),
(N'P.218240',  96, N'BUDIMAN', N'Gudang', NULL, 3, '2008-09-20', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bandar Jaya Lampung Tengah', NULL),
(N'P.218223',  97, N'CHAIRUL RAHMAN M.', N'Gudang', NULL, 3, '2018-03-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Sibolga Tapteng', NULL),
(N'P.223448',  98, N'DESY RAMADANY', N'Gudang', NULL, 3, '2023-08-28', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'kendari sulawesi tenggara', NULL),
(N'P.218172',  99, N'EKO PRANATA POHAN', N'Gudang', NULL, 3, '2018-03-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Sidempuan', NULL),
(N'P.225478', 100, N'FADELLA PRATAMA', N'Gudang', NULL, 3, '2025-05-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Gpp Bengkulu', NULL),
(N'P.225481', 101, N'FAJAR ASHARI TANJUNG', N'Gudang', NULL, 3, '2025-05-05', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Asahan', NULL),
(N'P.225519', 103, N'GASSING', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Takalar', NULL),
(N'P.226528', 105, N'HERIYANTO', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Sidempuan', NULL),
(N'P.226526', 106, N'ISMA DAMAYANTI', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Serdang Bedagai', NULL),
(N'P.221398', 107, N'JAMES NABABAN', N'Gudang', NULL, 3, '2021-01-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tapanuli Utara', NULL),
(N'P.225494', 108, N'KURNIA PENDAWA', N'Gudang', NULL, 3, '2025-08-13', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Simalungun', NULL),
(N'P.226538', 109, N'KURNIAWAN', N'Gudang', NULL, 3, '2026-05-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Mamuju Tengah', NULL),
(N'P.225480', 110, N'M. RANDY YUSUF', N'Gudang', NULL, 3, '2025-04-07', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bengkulu', NULL),
(N'P.222428', 111, N'MHD. AFANSULUKI NASUTION', N'Gudang', NULL, 3, '2022-09-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Lawas', NULL),
(N'P.225520', 112, N'MUH AMMAR', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Staf penjualan logistik, non subsidi, dan pestisida', N'Departemen Region Makassar', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parepare Sulawesi Selatan', NULL),
(N'P.226529', 113, N'MUHAMMAD AL FARES', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Lawas', NULL),
(N'P.225493', 114, N'MUHAMMAD ALIF SUKMA JAYA', N'Gudang', NULL, 3, '2025-08-11', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Serdang Bedagai', NULL),
(N'P.225496', 116, N'MUHAMMAD ASRUL', N'Gudang', NULL, 3, '2025-01-05', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Barru Sulawesi Selatan', NULL),
(N'P.226523', 117, N'MUHAMMAD RIZKI ANWAR', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Simalungun', NULL),
(N'P.226530', 118, N'NURUL EKA RAMADHANI', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Asahan', NULL),
(N'P.225484', 119, N'PRADHIKSA ABDHI NEGARA', N'Gudang', NULL, 3, '2025-05-23', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bandar Jaya', NULL),
(N'P.225475', 120, N'RAHMAT GOBEL', N'Gudang', NULL, 3, '2025-04-09', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Gorontalo', NULL),
(N'P.225506', 121, N'RAHMAT KURNIA MAUN MOH. AMIN', N'Gudang', NULL, 3, '2025-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parigi Moutong, Sulawesi tengah', NULL),
(N'P.225501', 123, N'RONAL', N'Gudang', NULL, 3, '2025-08-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Palu, Sulawesi Tengah', NULL),
(N'P.219310', 124, N'SUNAWI', N'Gudang', NULL, 3, '2009-04-11', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parepare Sulawesi Selatan', NULL),
(N'P.218239', 125, N'USMAN HASANI A.', N'Gudang', NULL, 3, '2010-10-26', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Bandar Jaya', NULL),
(N'P.222424', 126, N'VAN BASTEN SITOMPUL', N'Gudang', NULL, 3, '2022-09-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', NULL),
(N'P.226524', 127, N'WALDY AZAN NUDDIN', N'Gudang', NULL, 3, '2026-04-01', N'Checker', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tapanuli Utara', NULL),
-- Gudang JG4 - Keamanan Gudang
(N'P.224451', 130, N'AMRIS NASUTION', N'Gudang', NULL, 4, '2024-04-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Lawas', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.223439', 131, N'APERLIN WARUWU', N'Gudang', NULL, 4, '2023-04-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.218215', 133, N'EDI SUKAMTO', N'Gudang', NULL, 4, '2018-03-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Asahan', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.226525', 134, N'GOPAL MINI RIANTO', N'Gudang', NULL, 4, '2026-04-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Sibolga Tapteng', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.226539', 135, N'HAMZA', N'Gudang', NULL, 4, '2026-05-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Mamuju Tengah', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.219311', 137, N'MUH. NASIR', N'Gudang', NULL, 4, '2011-03-10', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parepare Sulawesi Selatan', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.226522', 138, N'MUHAMMAD IQBAL PURWADI', N'Gudang', NULL, 4, '2026-04-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Simalungun', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.222426', 139, N'PETRUS PANTUN SILABAN', N'Gudang', NULL, 4, '2022-09-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Tapanuli Utara', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.224464', 140, N'RICKI SETIAWAN', N'Gudang', NULL, 4, '2025-01-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Serdang Bedagai', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.225476', 141, N'RISKI UMAR', N'Gudang', NULL, 4, '2025-04-09', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Gorontalo', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.219320', 142, N'SOFYAN L. LADO', N'Gudang', NULL, 4, '2013-10-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Palu, Sulawesi Tengah', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.218205', 143, N'SUKLAN LUBIS', N'Gudang', NULL, 4, '2018-03-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Padang Sidempuan', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.223447', 144, N'SYARIFUDDIN DG BANTANG', N'Gudang', NULL, 4, '2023-10-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Takalar', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.225507', 146, N'TASMIN', N'Gudang', NULL, 4, '2025-04-01', N'Keamanan Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Parigi Moutong, Sulawesi Tengah', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
(N'P.224463', 148, N'TASWIN', N'Gudang', NULL, 4, '2024-01-05', N'Keamanan Gudang', N'Jasa Gudang', NULL, N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Barru Sulawesi Selatan', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan'),
-- Gudang JG5 - Koordinator Gudang
(N'P.224458', 150, N'SYAHARUDIN', N'Gudang', NULL, 5, '2024-09-01', N'Koordinator Gudang', N'Jasa Gudang', N'Departemen Jasa Logistik', N'Kompartemen Penjualan Retail', N'Direktorat Komersil', N'Medan', N'JG di luar skema Pemasaran/Gudang yg diberikan — tambahan');

DECLARE @baru INT = (SELECT COUNT(*) FROM grading.pegawai_tkno WHERE kelompok IN (N'Pemasaran', N'Gudang'));
DECLARE @all  INT = (SELECT COUNT(*) FROM grading.pegawai_tkno);
PRINT CONCAT('grading.pegawai_tkno: ', @baru, ' baris Pemasaran/Gudang disisipkan; total ', @all, ' baris.');
GO

SET NOEXEC OFF;
GO
