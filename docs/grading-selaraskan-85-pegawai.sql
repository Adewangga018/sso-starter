/* ============================================================================
   grading - menyelaraskan penempatan, jabatan & unit_organisasi dengan
   "Data 85 Pegawai Organik GCS" (data per Juni 2026, dari SK Promosi & Mutasi).
   ----------------------------------------------------------------------------
   TEMUAN SEBELUM DIJALANKAN (hasil diff terhadap 85 baris acuan):
     - band, jg, pg, dan tmt: SUDAH cocok untuk seluruh 85 pegawai (0 selisih),
       jadi tidak ada yang diubah di sana.
     - unit_organisasi belum punya level "Bagian" sama sekali, padahal acuan
       memakainya untuk 53 penempatan.
     - 7 pegawai masih memakai jabatan placeholder tanpa unit ("Belum
       Ditentukan ..."), padahal acuan menyebut departemennya.

   YANG DIKERJAKAN
     1. Membuat unit tipe 'Bagian'. Kuncinya (nama + departemen induk), BUKAN
        nama saja: nama bagian yang sama dipakai beberapa departemen (mis.
        "Bagian Penjualan dan Administrasi Pupuk Subsidi" ada di Region
        Lampung, Medan, dan Makassar).
     2. Merelink jabatan ke Bagian, TAPI hanya band >= 3 (Kepala Bagian ke
        bawah). Manager (band <= 2) sengaja tetap menempel di Departemen:
        OrgResolver.ResolveKepalaUnitAsync memilih kepala unit dari jabatan yang
        menempel LANGSUNG di unit tsb, jadi kalau Manager ikut turun ke Bagian,
        "Pembina Tk. Departemen" pada rantai pengesahan inovasi berganti orang.
        Satu jabatan terkena aturan ini: Manager Pengembangan (band 2) yang di
        acuan tercatat pada Bagian Teknologi Informasi dan Multimedia.
     3. Melengkapi 7 penempatan yang jabatannya belum ber-unit. Placeholder
        "Belum Ditentukan" dipakai bersama beberapa orang dari departemen
        berbeda, jadi tidak diubah di tempat - dibuat baris jabatan baru lalu
        penempatannya dialihkan, dan placeholder yang jadi kosong dinonaktifkan
        (aktif = 0, bukan dihapus, karena masih dirujuk riwayat penempatan).

   TIDAK dikerjakan skrip ini (perlu keputusan, lihat catatan di bawah):
     - Gelar akademik pada nama (12 pegawai): DB menyimpan "Abdul Rahman",
       acuan "ABDUL RAHMAN, SE".
     - Status Definitif/Pjs. (11 pegawai Pjs.) dan MDG: tidak ada kolomnya.

   TAHAP 2 (di bagian bawah berkas ini)
     4. Kolom "Unit / Staf" acuan diselaraskan ke jabatan.nama_jabatan.
     5. Tiga jalur Direktorat yang belum tersambung dilengkapi.
     6. Placeholder "Belum Ditentukan" lama dibuang.
     Nama pegawai SENGAJA tidak diubah: acuan memuat gelar akademik
     ("ABDUL RAHMAN, SE") tetapi database yang jadi pegangan untuk kolom nama.

   Idempoten: aman dijalankan ulang - tiap penambahan dicek dulu.
   HASIL VERIFIKASI setelah dijalankan (telusur hierarki seperti OrgResolver):
     departemen 79/79 cocok, kompartemen 80/80 cocok, bagian 52/53 cocok
     (1 selisih = Manager Pengembangan, memang disengaja pada butir 2),
     dan tiap Departemen/Region/Kelompok tetap punya kepala band 2 sedangkan
     tiap Kompartemen tetap band 1 - rantai pengesahan tidak berubah.
   ============================================================================ */

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Acuan: 85 Pegawai Organik GCS (PDF "Data per Juni 2026") ditulis apa adanya.
   Dipakai HANYA untuk membandingkan (read-only). Kolom yang dikosongkan di PDF
   ditulis NULL supaya bisa dibedakan dari "berbeda". */
IF OBJECT_ID('tempdb..#ref') IS NOT NULL DROP TABLE #ref;
CREATE TABLE #ref (
  no INT, nama NVARCHAR(80), nik NVARCHAR(20), band TINYINT, jg TINYINT, pg TINYINT,
  mdg DECIMAL(4,1), tingkatan NVARCHAR(30), status_sk NVARCHAR(10), tgl_masuk DATE,
  bagian NVARCHAR(120), departemen NVARCHAR(120), kompartemen NVARCHAR(120)
);
INSERT INTO #ref VALUES
(1,'WIDODO','T.980187',1,21,20,1.2,'General Manager','Definitif','1998-10-02',NULL,NULL,'Kompartemen Penjualan Retail'),
(2,'ABDUL RAHMAN, SE','T.205232',1,21,20,1.6,'General Manager','Definitif','2003-04-04',NULL,NULL,'Kompartemen Penjualan Korporasi'),
(3,'ACH. WACHYUDI','T.208254',1,20,19,0.3,'General Manager','Pjs.','2007-08-01',NULL,NULL,'Kompartemen Administrasi Keuangan'),
(4,'AHMAD MUKHLIS K.','T.205220',2,18,18,5.3,'Manager','Definitif','2002-08-30',NULL,'Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(5,'ITA SUDARWATI','T.970175',2,19,18,0.9,'Manager','Definitif','1997-11-03',NULL,'Departemen Penjualan Pupuk & Pestisida Korporasi','Kompartemen Penjualan Korporasi'),
(6,'SRI RAHAYU','T.940152',2,18,18,11.5,'Manager','Definitif','1990-11-05',NULL,'Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(7,'NANANG BUDI D, SE','T.206242',2,17,18,6.5,'Manager','Definitif','2005-05-01',NULL,'Departemen Kepatuhan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(8,'JOKO PURWANTO,SE','T.205221',2,17,18,13.5,'Manager','Definitif','2003-02-03',NULL,NULL,NULL),
(9,'I DEWA PUTU CANDRA K., ST','T.210261',2,18,17,1.9,'Manager','Definitif','2010-05-01',NULL,'Departemen Penjualan Kesuplieran','Kompartemen Penjualan Korporasi'),
(10,'RIDLO PATYODI','T.211271',2,18,17,2.4,'Manager','Definitif','2011-10-01',NULL,'Departemen Region Makassar','Kompartemen Penjualan Retail'),
(11,'CHOIRI,SE','T.208256',2,17,17,0.9,'Manager','Definitif','2007-08-01',NULL,'Departemen Audit Internal',NULL),
(12,'BAGUS ADITA','T.211275',2,17,17,2.6,'Manager','Definitif','2011-10-01',NULL,'Departemen Anggaran & Akuntansi','Kompartemen Administrasi Keuangan'),
(13,'SUTAN PRIATMAJA','T.214291',2,NULL,17,1.6,'Manager','Definitif','2014-11-15',NULL,NULL,NULL),
(14,'DWI RINI P, SE','T.970200',3,16,16,9.3,'Kepala Bagian','Definitif','1997-11-03','Bagian Pajak dan Asuransi','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(15,'KUSNO','T.960203',3,15,16,10.5,'Kepala Bagian','Definitif','1996-07-05',NULL,'Departemen Penjualan Pupuk & Pestisida Retail','Kompartemen Penjualan Retail'),
(16,'FIFI EMMALIA,SE','T.205219',3,16,16,5.8,'Kepala Bagian','Definitif','2001-09-10','Bagian Perbendaharaan','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(17,'M. SYAMSUDDIN, SE','T.210259',3,15,16,2.1,'Kepala Bagian','Definitif','2010-05-01','Bagian Akuntansi dan Verifikasi','Departemen Anggaran & Akuntansi','Kompartemen Administrasi Keuangan'),
(18,'ARI KUNCORO','T.211273',2,17,17,0.1,'Manager','Definitif','2011-10-01','Bagian Teknologi Informasi dan Multimedia','Departemen Pengembangan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(19,'BURNAMA KUSUMA DR.,SE','T.208257',3,16,16,0.3,'Kepala Bagian','Pjs.','2007-08-01',NULL,'Departemen Penjualan Pupuk & Pestisida Retail','Kompartemen Penjualan Retail'),
(20,'WIDYA NANANG SURYANTO, ST','T.208255',3,15,16,9.3,'Kepala Bagian','Definitif','2007-08-01',NULL,'Departemen Audit Internal',NULL),
(21,'YUDISTIRA SIGIT W.','T.211270',3,15,15,0.9,'Kepala Bagian','Definitif','2011-10-01','Bagian Tata Kelola, Manajemen Risiko dan Sistem Manajemen','Departemen Kepatuhan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(22,'WYNFRIED ARDIAN DIDOK','T.214289',3,15,15,0.3,'Kepala Bagian','Pjs.','2014-11-15','Bagian Anggaran dan Pelaporan','Departemen Anggaran & Akuntansi','Kompartemen Administrasi Keuangan'),
(23,'ARDHI YUNANTO','T.211279',3,15,15,1.6,'Kepala Bagian','Definitif','2011-10-01','Bagian Perijinan, Hukum & K3','Departemen Kepatuhan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(24,'ERLY NURLIANTI','T.211277',3,15,15,1.6,'Kepala Bagian','Definitif','2011-10-01','Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(25,'DIAH PUSPITASARI','T.211276',3,15,15,0.9,'Kepala Bagian','Definitif','2011-10-01','Bagian Administrasi & Pengembangan SDM dan Inovasi','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(26,'LILIK MUNAWATI','T.208253',3,16,15,0.9,'Kepala Bagian','Definitif','2007-03-01','Bagian Penagihan dan Pembukuan','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(27,'GOLIK','T.208252',3,15,15,0.3,'Kepala Bagian','Pjs.','2007-03-01','Bagian Penjualan dan Administrasi Pupuk Subsidi','Departemen Region Lampung','Kompartemen Penjualan Retail'),
(28,'ARI RAHAYU','T.210269',3,15,15,0.3,'Kepala Bagian','Pjs.','2010-11-01','Bagian Pengadaan dan Pengelolaan Pengembangan','Departemen Pengembangan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(29,'LISTYO HARTONO','T.970174',4,14,14,11.5,'Staf Pemula','Definitif','1997-11-03','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(30,'SUWANDI','T.940159',4,14,14,8.5,'Staf Pemula','Definitif','1997-09-01',NULL,'Departemen Penjualan Bahan Kimia dan Gas','Kompartemen Penjualan Korporasi'),
(31,'SUGENG HARIANTO','T.205237',4,14,14,0.9,'Staf Pemula','Definitif','2002-08-15','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(32,'SLAMET RYADI','T.202206',4,14,14,9.3,'Staf Pemula','Definitif','2000-08-01','Bagian Jasa Gudang','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(33,'HANDOKO TEJO SAPUTRO, STp.','T.210265',4,14,14,9.3,'Staf Pemula','Definitif','2010-11-01',NULL,'Departemen Penjualan Kesuplieran','Kompartemen Penjualan Korporasi'),
(34,'M. CHASIM','T.205238',4,14,14,7.7,'Staf Pemula','Definitif','2002-08-15','Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(35,'RIZKY VILIYANT ISMARYONO','T.221309',4,13,13,2.5,'Staf Pemula','Definitif','2021-01-04','Bagian Perijinan, Hukum & K3','Departemen Kepatuhan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(36,'JAFRINDA REZA ELTRICO','T.221310',4,13,13,2.5,'Staf Pemula','Definitif','2021-01-04','Bagian Teknologi Informasi dan Multimedia','Departemen Pengembangan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(37,'SYAMSUL HUDA','T.207246',4,13,13,0.3,'Staf Pemula','Pjs.','2005-05-01','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(38,'ADY PURNOMO','T.213284',4,13,13,0.3,'Staf Pemula','Pjs.','2013-08-12',NULL,'Departemen Penjualan Pupuk & Pestisida Korporasi','Kompartemen Penjualan Korporasi'),
(39,'MUHARI RIZKITA','T.213286',4,13,13,0.3,'Staf Pemula','Pjs.','2013-08-12','Bagian Penjualan dan Administrasi Pupuk Subsidi','Departemen Region Lampung','Kompartemen Penjualan Retail'),
(40,'LUBANA NAZMA SIMBOLON','T.213288',4,13,13,1.9,'Staf Pemula','Definitif','2013-08-12','Bagian Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida','Departemen Region Medan','Kompartemen Penjualan Retail'),
(41,'MUHAMMAD ARIF SURACHMAN','T.215299',4,12,12,1.6,'Staf Pemula','Definitif','2015-11-16','Bagian Penjualan Logistik Non Subsidi dan Pestisida','Departemen Region Makassar','Kompartemen Penjualan Retail'),
(42,'YUDI ISFANDIYARI','T.215301',4,12,12,1.6,'Staf Pemula','Definitif','2015-11-16','Bagian Anggaran dan Pelaporan','Departemen Anggaran & Akuntansi','Kompartemen Administrasi Keuangan'),
(43,'LAKSANA MUS ARDHIANTO','T.215303',4,12,12,0.9,'Staf Pemula','Definitif','2015-11-16',NULL,'Departemen Penjualan Pupuk & Pestisida Korporasi','Kompartemen Penjualan Korporasi'),
(44,'RIADHO KURNIAWAN','T.221312',4,12,12,0.3,'Staf Pemula','Pjs.','2021-01-04',NULL,'Departemen Region Makassar','Kompartemen Penjualan Retail'),
(45,'MONDA MORINA HARAHAP','T.217308',4,12,12,0.3,'Staf Pemula','Pjs.','2017-09-01',NULL,'Departemen Region Medan','Kompartemen Penjualan Retail'),
(46,'AENAL DARWIS','T.217305',4,12,12,0.3,'Staf Pemula','Pjs.','2017-03-01','Bagian Penjualan dan Administrasi Pupuk Subsidi','Departemen Region Makassar','Kompartemen Penjualan Retail'),
(47,'FABIAN ABDUL GAFFAR','T.205213',4,12,12,7.7,'Staf Pemula','Definitif','2000-10-01',NULL,NULL,NULL),
(48,'DEWI FATMAWATI','T.940161',5,11,11,32.2,'Pelaksana Senior','Definitif','1994-05-05','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(49,'TEDJO WAHYONO','T.980186',5,11,11,27.8,'Pelaksana Senior','Definitif','1998-10-01','Bagian Jasa Gudang','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(50,'HERMANTO','T.990196',5,11,11,27.2,'Pelaksana Senior','Definitif','1999-05-01','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(51,'ISFA''','T.205218',5,11,11,24.9,'Pelaksana Senior','Definitif','2001-08-06','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(52,'SAFI''I','T.940138',5,11,11,28.8,'Pelaksana Senior','Definitif','1997-09-01','Bagian Sekretariat, Keamanan, Umum Dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(53,'SOEYANTO','T.205240',5,11,11,23.9,'Pelaksana Senior','Definitif','2002-08-15',NULL,'Departemen Penjualan Pupuk & Pestisida Korporasi','Kompartemen Penjualan Korporasi'),
(54,'YODI ERMANTO','T.206247',5,11,11,21.8,'Pelaksana Senior','Definitif','2004-09-01','Bagian Penjualan dan Administrasi Pupuk Subsidi','Departemen Region Medan','Kompartemen Penjualan Retail'),
(55,'SUMARSONO','T.980185',5,11,11,27.7,'Pelaksana Senior','Definitif','1998-10-02','Bagian Sekretariat, Keamanan, Umum Dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(56,'BAMBANG SYAMADJI','T.205239',5,10,10,23.9,'Pelaksana Senior','Definitif','2002-08-15','Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(57,'FADELAN CHADARIANTO','T.202203',5,10,10,25.9,'Pelaksana Senior','Definitif','2000-08-01','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(58,'DARWANTO','T.202207',5,10,10,26.5,'Pelaksana Senior','Definitif','2000-01-02','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(59,'HARI EKO SUSANTO, SE','T.210258',5,10,10,16.2,'Pelaksana Senior','Definitif','2010-05-01','Bagian Perbendaharaan','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(60,'SUWADI','T.205241',5,10,10,23.8,'Pelaksana Senior','Definitif','2002-09-03','Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(61,'NURUDIN','T.205225',5,10,10,25.6,'Pelaksana Senior','Definitif','2000-12-05','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(62,'IWAN RANGGA KUSUMA','T.211272',5,10,10,14.8,'Pelaksana Senior','Definitif','2011-10-01','Bagian Pengadaan dan Pengelolaan Pengembangan','Departemen Pengembangan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(63,'HERY PURNOMO','T.207247',5,9,9,21.2,'Pelaksana Senior','Definitif','2005-05-01','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(64,'SUBAGIO JUNAEDI','T.205235',4,12,11,0.1,'Staf Pemula','Definitif','2003-06-02',NULL,'Departemen Penjualan Bahan Kimia dan Gas','Kompartemen Penjualan Korporasi'),
(65,'DANDUNG KASIATNO','T.205234',5,9,9,23.1,'Pelaksana Senior','Definitif','2003-06-02','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(66,'AGHNIA PUTRI RUSIANTO','T.221311',5,9,9,5.5,'Pelaksana Senior','Definitif','2021-01-04','Bagian Perijinan, Hukum & K3','Departemen Kepatuhan','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(67,'AGA FIRMANSYAH','T.225315',5,9,9,1.8,'Pelaksana Senior','Definitif','2024-09-01','Bagian Pajak dan Asuransi','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(68,'RISMA FITRI AMALINA','BP.226318',5,9,9,0.8,'Pelaksana Senior','Definitif','2025-10-01',NULL,'Departemen Penjualan Bahan Kimia dan Gas','Kompartemen Penjualan Korporasi'),
(69,'T. SAFRIZALUDDIN','T.213287',5,9,9,12.9,'Pelaksana Senior','Definitif','2013-08-12','Bagian Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida','Departemen Region Medan','Kompartemen Penjualan Retail'),
(70,'MUH. ALI S.','T.213285',5,9,9,12.9,'Pelaksana Senior','Definitif','2013-08-12','Bagian Penagihan','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(71,'M. RAZALI NASUTION','T.224314',6,8,8,2.1,'Pelaksana Junior','Definitif','2024-06-01','Bagian Penjualan dan Administrasi Pupuk Subsidi','Departemen Region Medan','Kompartemen Penjualan Retail'),
(72,'SETYO HARYONO','T.207248',6,8,8,21.2,'Pelaksana Junior','Definitif','2005-05-01','Bagian Transport dan Bengkel','Departemen Jasa Logistik','Kompartemen Penjualan Retail'),
(73,'TEGUH PRIYONO','T.215300',6,8,8,10.6,'Pelaksana Junior','Definitif','2015-11-16','Bagian Penagihan','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(74,'DICKY SUSANTHO','T.223313',6,8,8,3.8,'Pelaksana Junior','Definitif','2022-10-01','Bagian Administrasi & Pengembangan SDM dan Inovasi','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(75,'SOLICHIN','T.940160',6,8,8,28.8,'Pelaksana Junior','Definitif','1997-09-01','Bagian Sekretariat, Keamanan, Umum Dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(76,'NIKO FREDIKA','BP.226320',6,8,8,1.1,'Pelaksana Junior','Definitif','2025-06-01','Bagian Penagihan','Departemen Keuangan','Kompartemen Administrasi Keuangan'),
(77,'TAUFIK HIDAYAT','BP.226321',6,8,8,1.1,'Pelaksana Junior','Definitif','2025-06-01','Bagian Penjualan dan Administrasi Pupuk Subsidi','Departemen Region Lampung','Kompartemen Penjualan Retail'),
(78,'FARID FAHRUDIN','T.225317',6,7,7,1.9,'Pelaksana Junior','Definitif','2024-08-01','Bagian Akuntansi dan Verifikasi','Departemen Anggaran & Akuntansi','Kompartemen Administrasi Keuangan'),
(79,'ARFANDI NAHSAR','T.225318',6,7,7,1.9,'Pelaksana Junior','Definitif','2024-08-01',NULL,'Departemen Region Makassar','Kompartemen Penjualan Retail'),
(80,'DEWA HENTYARSA UTOMO','T.225316',6,7,7,1.9,'Pelaksana Junior','Definitif','2024-08-01',NULL,'Departemen Penjualan Pupuk & Pestisida Retail','Kompartemen Penjualan Retail'),
(81,'EKA PUTRI RAHMAWATI','BP.226319',6,7,7,0.8,'Pelaksana Junior','Definitif','2025-10-01','Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset','Departemen SDM','Kompartemen SDM, Kepatuhan dan Pengembangan'),
(82,'ARBINDA ACHADDI','T.225322',6,7,7,1.1,'Pelaksana Junior','Definitif','2025-06-01',NULL,'Departemen Penjualan Pupuk & Pestisida Retail','Kompartemen Penjualan Retail'),
(83,'WAHONO','T.225321',6,7,7,1.1,'Pelaksana Junior','Definitif','2025-06-01',NULL,'Departemen Penjualan Pupuk & Pestisida Retail','Kompartemen Penjualan Retail'),
(84,'MUHAMMAD ARI WIBOWO','T.225320',6,7,7,1.8,'Pelaksana Junior','Definitif','2024-09-01',NULL,'Departemen Penjualan Kesuplieran','Kompartemen Penjualan Korporasi'),
(85,'DWI TEGUH ARIWIBOWO','T.225319',6,7,7,1.8,'Pelaksana Junior','Definitif','2024-09-01',NULL,'Departemen Penjualan Pupuk & Pestisida Retail','Kompartemen Penjualan Retail');

SELECT 'Baris acuan dimuat' AS info, COUNT(*) AS jml FROM #ref;
GO

SET XACT_ABORT ON;

/* ============================ 0. CADANGAN ============================
   Server ini belum pernah punya backup, jadi salinan tabel dibuat lebih dulu
   agar seluruh perubahan di bawah bisa dikembalikan. */
IF OBJECT_ID('grading.bak_unit_organisasi_20260728') IS NULL
  SELECT * INTO grading.bak_unit_organisasi_20260728 FROM grading.unit_organisasi;
IF OBJECT_ID('grading.bak_jabatan_20260728') IS NULL
  SELECT * INTO grading.bak_jabatan_20260728 FROM grading.jabatan;
IF OBJECT_ID('grading.bak_penempatan_20260728') IS NULL
  SELECT * INTO grading.bak_penempatan_20260728 FROM grading.penempatan;
PRINT 'Cadangan siap: grading.bak_*_20260728';
GO

BEGIN TRANSACTION;

/* ==================== 1. LEVEL BAGIAN pada unit_organisasi ====================
   PDF punya kolom Bagian yang belum ada sama sekali di unit_organisasi. Nama
   bagian bisa sama di beberapa departemen (mis. "Bagian Penjualan dan
   Administrasi Pupuk Subsidi" ada di Region Lampung, Medan, dan Makassar), jadi
   kuncinya (nama + departemen induk), bukan nama saja. */
IF OBJECT_ID('tempdb..#bag') IS NOT NULL DROP TABLE #bag;
SELECT DISTINCT r.bagian AS nama, u.id_unit AS id_induk, u.nama AS induk
INTO #bag
FROM #ref r
JOIN grading.unit_organisasi u ON u.nama = r.departemen
WHERE r.bagian IS NOT NULL;

INSERT INTO grading.unit_organisasi (nama, tipe, id_unit_induk)
SELECT b.nama, 'Bagian', b.id_induk
FROM #bag b
WHERE NOT EXISTS (SELECT 1 FROM grading.unit_organisasi u
                  WHERE u.nama = b.nama AND u.id_unit_induk = b.id_induk AND u.tipe = 'Bagian');
PRINT CONCAT('Bagian dibuat: ', @@ROWCOUNT);
GO

/* ==================== 2. RELINK jabatan band >= 3 ke Bagian ====================
   Hanya band >= 3 (Kepala Bagian ke bawah). Manager (band <= 2) tetap menempel
   di Departemen supaya OrgResolver.ResolveKepalaUnitAsync mengembalikan orang
   yang sama - kalau Manager ikut dipindah, "Pembina Tk. Departemen" pada rantai
   pengesahan inovasi bisa berganti orang. */
UPDATE j SET j.id_unit = bag.id_unit, j.diubah_pada = SYSUTCDATETIME()
FROM grading.jabatan j
JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
JOIN #ref r ON r.nik = p.id_karyawan
JOIN grading.unit_organisasi dep ON dep.nama = r.departemen
JOIN grading.unit_organisasi bag ON bag.nama = r.bagian AND bag.tipe = 'Bagian' AND bag.id_unit_induk = dep.id_unit
WHERE r.bagian IS NOT NULL AND j.id_band >= 3 AND j.id_unit <> bag.id_unit;
PRINT CONCAT('Jabatan direlink ke Bagian: ', @@ROWCOUNT);
GO

/* ============ 3. Tujuh penempatan yang jabatannya belum ber-unit ============
   Placeholder "Belum Ditentukan" dipakai bersama beberapa orang dari departemen
   berbeda, jadi tidak boleh diubah di tempat - dibuat baris jabatan baru per
   (peran, jg, unit) lalu penempatannya dialihkan. */
IF OBJECT_ID('tempdb..#target') IS NOT NULL DROP TABLE #target;
CREATE TABLE #target (nik NVARCHAR(20), nama_jabatan NVARCHAR(150), band TINYINT, jg TINYINT, unit_nama NVARCHAR(150), unit_tipe NVARCHAR(30), induk NVARCHAR(150));
INSERT INTO #target VALUES
 ('BP.226318','Staf Penjualan Bahan Kimia, Legal dan Gas',5,9,'Departemen Penjualan Bahan Kimia dan Gas','Departemen',NULL),
 ('BP.226320','Staf Penagihan',6,8,'Bagian Penagihan','Bagian','Departemen Keuangan'),
 ('BP.226321','Staf Penjualan dan Administrasi Pupuk Subsidi (Lampung)',6,8,'Bagian Penjualan dan Administrasi Pupuk Subsidi','Bagian','Departemen Region Lampung'),
 ('BP.226319','Staf Sekretariat, Keamanan, Umum & Manajemen Aset',6,7,'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset','Bagian','Departemen SDM'),
 ('T.225322','Belum Ditentukan (Pelaksana Junior - JG7)',6,7,'Departemen Penjualan Pupuk & Pestisida Retail','Departemen',NULL),
 ('T.225321','Belum Ditentukan (Pelaksana Junior - JG7)',6,7,'Departemen Penjualan Pupuk & Pestisida Retail','Departemen',NULL);

-- id unit tujuan
IF OBJECT_ID('tempdb..#t2') IS NOT NULL DROP TABLE #t2;
SELECT t.*, u.id_unit
INTO #t2
FROM #target t
JOIN grading.unit_organisasi u ON u.nama = t.unit_nama AND u.tipe = t.unit_tipe
 AND (t.induk IS NULL OR u.id_unit_induk = (SELECT id_unit FROM grading.unit_organisasi WHERE nama = t.induk));

-- buat jabatan yang belum ada
INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, jumlah_formasi, aktif)
SELECT DISTINCT t.nama_jabatan, t.band, t.jg, t.id_unit, 1, 1
FROM #t2 t
WHERE NOT EXISTS (SELECT 1 FROM grading.jabatan j
                  WHERE j.nama_jabatan = t.nama_jabatan AND j.id_band = t.band AND j.jg = t.jg AND j.id_unit = t.id_unit);
PRINT CONCAT('Jabatan baru dibuat: ', @@ROWCOUNT);

-- alihkan penempatan ke jabatan yang benar
UPDATE p SET p.id_jabatan = j.id_jabatan
FROM grading.penempatan p
JOIN #t2 t ON t.nik = p.id_karyawan
JOIN grading.jabatan j ON j.nama_jabatan = t.nama_jabatan AND j.id_band = t.band AND j.jg = t.jg AND j.id_unit = t.id_unit
WHERE p.status = 'Aktif' AND p.id_jabatan <> j.id_jabatan;
PRINT CONCAT('Penempatan dialihkan: ', @@ROWCOUNT);

-- DEWA: jabatannya sudah unik miliknya sendiri, cukup diberi unit
UPDATE grading.jabatan
SET id_unit = (SELECT id_unit FROM grading.unit_organisasi WHERE nama = 'Departemen Penjualan Pupuk & Pestisida Retail' AND tipe = 'Departemen'),
    diubah_pada = SYSUTCDATETIME()
WHERE nama_jabatan = 'Staf Region Jawa Tengah dan Jawa Timur' AND id_unit IS NULL;
PRINT CONCAT('Jabatan DEWA diberi unit: ', @@ROWCOUNT);
GO

/* Placeholder yang sudah tidak dipakai dinonaktifkan (bukan dihapus - masih
   direferensikan riwayat penempatan). */
UPDATE grading.jabatan SET aktif = 0, diubah_pada = SYSUTCDATETIME()
WHERE nama_jabatan LIKE 'Belum Ditentukan%' AND id_unit IS NULL
  AND NOT EXISTS (SELECT 1 FROM grading.penempatan p WHERE p.id_jabatan = grading.jabatan.id_jabatan AND p.status = 'Aktif');
PRINT CONCAT('Placeholder tanpa unit dinonaktifkan: ', @@ROWCOUNT);

COMMIT TRANSACTION;
PRINT 'SELESAI - transaksi di-commit.';
GO


/* ############################ TAHAP 2 ############################
   Hasil verifikasi setelah tahap 2 dijalankan:
     Unit/Staf 56/56 cocok, Bagian 52/53 (1 disengaja), Departemen 79/79,
     Kompartemen 80/80, dan seluruh pegawai kini punya jalur Direktorat
     (48 Komersil + 38 Keuangan). Kepala tiap unit tidak berubah.
   ################################################################# */

/* Acuan kolom "Unit / Staf" + gelar pada Nama, dari PDF 85 Pegawai Organik.
   unit_staf NULL = memang dikosongkan di PDF (identitasnya diwakili Bagian). */
IF OBJECT_ID('tempdb..#us') IS NOT NULL DROP TABLE #us;
CREATE TABLE #us (nik NVARCHAR(20), unit_staf NVARCHAR(150), gelar NVARCHAR(12));
INSERT INTO #us VALUES
('T.980187',NULL,NULL),('T.205232',NULL,'SE'),('T.208254',NULL,NULL),('T.205220',NULL,NULL),
('T.970175',NULL,NULL),('T.940152',NULL,NULL),('T.206242',NULL,'SE'),
('T.205221','Staf Perencanaan, Pengendalian dan Produksi','SE'),
('T.210261',NULL,'ST'),('T.211271',NULL,NULL),('T.208256',NULL,'SE'),('T.211275',NULL,NULL),
('T.214291','Staf Khusus Direktur Komersil',NULL),
('T.970200',NULL,'SE'),
('T.960203','Muda Staf Penjualan dan Administrasi Pestisida',NULL),
('T.205219',NULL,'SE'),('T.210259',NULL,'SE'),('T.211273',NULL,NULL),
('T.208257','Muda Staf Penjualan dan Administrasi Pupuk Subsidi & Non Subsidi','SE'),
('T.208255','Muda Staf Audit Internal','ST'),
('T.211270',NULL,NULL),('T.214289',NULL,NULL),('T.211279',NULL,NULL),('T.211277',NULL,NULL),
('T.211276',NULL,NULL),('T.208253',NULL,NULL),('T.208252',NULL,NULL),('T.210269',NULL,NULL),
('T.970174','Staf Transport dan Bengkel',NULL),
('T.940159','Staf Penjualan Bahan Kimia, Legal dan Gas',NULL),
('T.205237','Staf Transport dan Bengkel',NULL),
('T.202206',NULL,NULL),
('T.210265','Staf Penjualan Kesuplieran','STp.'),
('T.205238','Staf Sekretariat, Keamanan, Umum Dan Manajemen Aset',NULL),
('T.221309','Staf Perijinan, Hukum & K3',NULL),
('T.221310','Staf Teknologi Informasi dan Multimedia',NULL),
('T.207246','Staf Transport dan Bengkel',NULL),
('T.213284','Staf Penjualan Pupuk & Pestisida Korporasi',NULL),
('T.213286','Staf Penjualan dan Administrasi Pupuk Subsidi',NULL),
('T.213288','Staf Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida',NULL),
('T.215299','Staf Penjualan Logistik Non Subsidi dan Pestisida',NULL),
('T.215301','Staf Anggaran dan Pelaporan',NULL),
('T.215303','Staf Penjualan Pupuk & Pestisida Korporasi',NULL),
('T.221312','Staf Administrasi Keuangan',NULL),
('T.217308','Staf Administrasi Keuangan',NULL),
('T.217305','Staf Penjualan dan Administrasi Pupuk Subsidi',NULL),
('T.205213','Staf Khusus Direktur Keuangan',NULL),
('T.940161','Staf Transport dan Bengkel',NULL),
('T.980186',NULL,NULL),
('T.990196','Staf Transport dan Bengkel',NULL),
('T.205218','Staf Transport dan Bengkel',NULL),
('T.940138','Staf Sekretariat, Keamanan, Umum Dan Manajemen Aset',NULL),
('T.205240','Staf Penjualan Pupuk & Pestisida Korporasi',NULL),
('T.206247','Staf Penjualan dan Administrasi Pupuk Subsidi',NULL),
('T.980185','Staf Sekretariat, Keamanan, Umum Dan Manajemen Aset',NULL),
('T.205239','Staf Sekretariat, Keamanan, Umum Dan Manajemen Aset',NULL),
('T.202203','Staf Transport dan Bengkel',NULL),
('T.202207','Staf Transport dan Bengkel',NULL),
('T.210258','Staf Perbendaharaan','SE'),
('T.205241','Staf Sekretariat, Keamanan, Umum Dan Manajemen Aset',NULL),
('T.205225','Staf Transport dan Bengkel',NULL),
('T.211272','Staf Pengadaan dan Pengelolaan Pengembangan',NULL),
('T.207247','Staf Transport dan Bengkel',NULL),
('T.205235','Staf Penjualan Bahan Kimia, Legal dan Gas',NULL),
('T.205234','Staf Transport dan Bengkel',NULL),
('T.221311','Staf Perijinan, Hukum & K3',NULL),
('T.225315','Staf Pajak dan Asuransi',NULL),
('BP.226318','Staf Penjualan Bahan Kimia, Legal dan Gas',NULL),
('T.213287','Staf Penjualan Logistik, Bahan Kimia, Non Subsidi dan Pestisida',NULL),
('T.213285','Staf Penagihan',NULL),
('T.224314','Staf Penjualan dan Administrasi Pupuk Subsidi',NULL),
('T.207248','Staf Transport dan Bengkel',NULL),
('T.215300','Staf Pembukuan',NULL),
('T.223313','Staf Administrasi & Pengembangan SDM dan Inovasi',NULL),
('T.940160','Staf Sekretariat, Keamanan, Umum Dan Manajemen Aset',NULL),
('BP.226320','Staf Penagihan',NULL),
('BP.226321','Staf Penjualan dan Administrasi Pupuk Subsidi',NULL),
('T.225317','Staf Akuntansi dan Verifikasi',NULL),
('T.225318','Staf Administrasi Keuangan',NULL),
('T.225316',NULL,NULL),
('BP.226319',NULL,NULL),
('T.225322',NULL,NULL),
('T.225321',NULL,NULL),
('T.225320','Staf Penjualan Kesuplieran',NULL),
('T.225319','Staf Penjualan dan Administrasi Pupuk Subsidi & Non Subsidi',NULL);
GO

SET XACT_ABORT ON;

/* Cadangan tahap ke-2 (yang tahap-1 sudah ada dan tidak ditimpa). */
IF OBJECT_ID('grading.bak2_jabatan_20260728') IS NULL
  SELECT * INTO grading.bak2_jabatan_20260728 FROM grading.jabatan;
IF OBJECT_ID('grading.bak2_penempatan_20260728') IS NULL
  SELECT * INTO grading.bak2_penempatan_20260728 FROM grading.penempatan;
IF OBJECT_ID('grading.bak2_person_grade_20260728') IS NULL
  SELECT * INTO grading.bak2_person_grade_20260728 FROM grading.person_grade;
IF OBJECT_ID('grading.bak2_unit_organisasi_20260728') IS NULL
  SELECT * INTO grading.bak2_unit_organisasi_20260728 FROM grading.unit_organisasi;
PRINT 'Cadangan tahap-2 siap: grading.bak2_*_20260728';
GO

BEGIN TRANSACTION;

/* ---- 1. NAMA: TIDAK diubah ----
   Nama pegawai sengaja dibiarkan seperti tersimpan di database (Title Case
   tanpa gelar akademik). Acuan PDF memuat gelar (mis. "ABDUL RAHMAN, SE"),
   tetapi penyelarasan itu dibatalkan atas permintaan: database yang jadi
   pegangan untuk kolom nama, bukan berkas acuan. */

/* ---- 2. UNIT / STAF -> jabatan.nama_jabatan ----
   Hanya bila seluruh pemegang jabatan itu punya Unit/Staf yang sama (sudah
   dipastikan tidak ada konflik). Akhiran wilayah pada nama lama (mis.
   "(Makassar)") sengaja hilang: wilayah kini dibawa hierarki unit, dan acuan
   tidak mencantumkannya di kolom Unit/Staf. */
UPDATE j SET j.nama_jabatan = x.nama_baru, j.diubah_pada = SYSUTCDATETIME()
FROM grading.jabatan j
JOIN (
  SELECT j2.id_jabatan, MIN(s.unit_staf) AS nama_baru
  FROM grading.jabatan j2
  JOIN grading.penempatan p ON p.id_jabatan = j2.id_jabatan AND p.status = 'Aktif'
  JOIN #us s ON s.nik = p.id_karyawan
  WHERE s.unit_staf IS NOT NULL
  GROUP BY j2.id_jabatan
  HAVING COUNT(DISTINCT s.unit_staf) = 1
) x ON x.id_jabatan = j.id_jabatan
WHERE j.nama_jabatan <> x.nama_baru;
PRINT CONCAT('jabatan.nama_jabatan diselaraskan: ', @@ROWCOUNT);
GO

/* ---- 3. DIREKTORAT yang belum tersambung ----
   Acuan mencantumkan Direktorat untuk tiga hal yang di DB belum punya jalur:
     - Departemen Audit Internal (Choiri & Widya Nanang) -> Direktorat Keuangan.
       Kompartemen-nya memang dikosongkan di acuan, dan itu konsisten: Audit
       Internal melapor langsung ke Direktorat.
     - Staf Khusus Direktur Komersil (Sutan)  -> Direktorat Komersil
     - Staf Khusus Direktur Keuangan (Fabian) -> Direktorat Keuangan
   Aman untuk OrgResolver: tipe 'Direktorat' tidak dicocokkan ResolveFromUnits,
   jadi departemen/kompartemen mereka tetap kosong - sama seperti di acuan. */
UPDATE grading.unit_organisasi
SET id_unit_induk = (SELECT id_unit FROM grading.unit_organisasi WHERE nama = 'Direktorat Keuangan' AND tipe = 'Direktorat')
WHERE nama = 'Departemen Audit Internal' AND tipe = 'Departemen' AND id_unit_induk IS NULL;
PRINT CONCAT('Departemen Audit Internal disambungkan ke Direktorat: ', @@ROWCOUNT);

UPDATE grading.jabatan
SET id_unit = (SELECT id_unit FROM grading.unit_organisasi WHERE nama = 'Direktorat Komersil' AND tipe = 'Direktorat'),
    diubah_pada = SYSUTCDATETIME()
WHERE nama_jabatan = 'Staf Khusus Direktur Komersil' AND id_unit IS NULL;
PRINT CONCAT('Staf Khusus Direktur Komersil diberi unit: ', @@ROWCOUNT);

UPDATE grading.jabatan
SET id_unit = (SELECT id_unit FROM grading.unit_organisasi WHERE nama = 'Direktorat Keuangan' AND tipe = 'Direktorat'),
    diubah_pada = SYSUTCDATETIME()
WHERE nama_jabatan = 'Staf Khusus Direktur Keuangan' AND id_unit IS NULL;
PRINT CONCAT('Staf Khusus Direktur Keuangan diberi unit: ', @@ROWCOUNT);
GO

/* ---- 4. Placeholder lama (50/51/52) dibuang bila benar-benar tak dirujuk ----
   jabatan_hirarki adalah tabel TURUNAN (closure atasan-bawahan yang dibangun
   dari jabatan.id_atasan), jadi barisnya ikut dibuang lebih dulu - kalau tidak,
   FK_jabatan_hirarki_atasan menolak penghapusan. */
DELETE FROM grading.jabatan_hirarki
WHERE (id_jabatan_atasan IN (50,51,52) OR id_jabatan_bawahan IN (50,51,52))
  AND EXISTS (SELECT 1 FROM grading.jabatan j WHERE j.id_jabatan IN (50,51,52) AND j.aktif = 0
              AND NOT EXISTS (SELECT 1 FROM grading.penempatan p WHERE p.id_jabatan = j.id_jabatan));
PRINT CONCAT('Baris jabatan_hirarki dibersihkan: ', @@ROWCOUNT);

DELETE FROM grading.jabatan
WHERE id_jabatan IN (50,51,52) AND aktif = 0
  AND NOT EXISTS (SELECT 1 FROM grading.penempatan p WHERE p.id_jabatan = grading.jabatan.id_jabatan)
  AND NOT EXISTS (SELECT 1 FROM grading.jabatan a WHERE a.id_atasan = grading.jabatan.id_jabatan);
PRINT CONCAT('Placeholder lama dihapus: ', @@ROWCOUNT);

/* jabatan 96 (Arbinda & Wahono): acuan mengosongkan Unit/Staf DAN Bagian untuk
   keduanya - mereka termasuk pegawai yang belum masuk SK. Namanya dibuat
   menyebut unitnya supaya tidak lagi ambigu, tetapi tetap ditandai belum
   ditentukan; menyalin tugas rekan se-departemen akan jadi karangan. */
UPDATE grading.jabatan
SET nama_jabatan = 'Belum Ditentukan - Penjualan Pupuk & Pestisida Retail (JG7)',
    diubah_pada = SYSUTCDATETIME()
WHERE id_jabatan = 96 AND nama_jabatan LIKE 'Belum Ditentukan%';
PRINT CONCAT('jabatan 96 dinamai ulang: ', @@ROWCOUNT);

COMMIT TRANSACTION;
PRINT 'SELESAI - transaksi di-commit.';
GO

SET NOEXEC OFF;
GO
