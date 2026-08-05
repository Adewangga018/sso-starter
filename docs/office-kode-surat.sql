/* ============================================================================
   My Office — master kode surat GCS + generator nomor surat.

   Susunan nomor surat yang dipakai (ditetapkan pemilik proses):

       {urut}/{bagian}/{klasifikasi}/{jenis}/{tahun}
       00123/GCS.01/NK.01.03/MI/2026

   - urut        : nomor urut 5 digit, SATU DERET untuk seluruh perusahaan,
                   reset setiap 1 Januari (waktu WIB).
   - bagian      : office.ref_bagian  (GCS.01 .. GCS.12)
   - klasifikasi : office.ref_klasifikasi (kode klasifikasi masalah)
   - jenis       : office.ref_jenis_surat (DR/MI/BA/RR)
   - tahun       : tahun terbit (WIB)

   Kode bagian pembuat diturunkan dari data organisasi di schema `grading`
   (penempatan -> jabatan -> unit_organisasi, dan pegawai_tkno) lewat tabel
   pemetaan office.ref_bagian_unit di bawah.

   Kompatibel SQL Server 2014 (tanpa CREATE OR ALTER / DROP IF EXISTS).
   Idempoten — aman dijalankan berulang. Jalankan pada db_mygcs SETELAH
   docs/office-schema.sql.

   CARA PAKAI
     sqlcmd -S <server> -U sa -P <password> -d db_mygcs -C ^
            -i docs\office-kode-surat.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID('office') IS NULL EXEC('CREATE SCHEMA office');
GO

/* ---------------------------------------------------------------------------
   1. Jenis surat — segmen ke-4 nomor surat.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('office.ref_jenis_surat', 'U') IS NULL
BEGIN
    CREATE TABLE office.ref_jenis_surat (
        kode   NVARCHAR(10)  NOT NULL CONSTRAINT pk_ref_jenis PRIMARY KEY,
        nama   NVARCHAR(100) NOT NULL,
        urutan INT           NOT NULL CONSTRAINT df_ref_jenis_urut DEFAULT 0,
        aktif  BIT           NOT NULL CONSTRAINT df_ref_jenis_aktif DEFAULT 1
    );
END
GO

MERGE office.ref_jenis_surat AS t
USING (VALUES
    (N'DR', N'Surat keluar',  1),
    (N'MI', N'Memo',          2),
    (N'BA', N'Berita Acara',  3),
    (N'RR', N'Risalah Rapat', 4)
) AS s (kode, nama, urutan)
   ON t.kode = s.kode
 WHEN MATCHED THEN UPDATE SET t.nama = s.nama, t.urutan = s.urutan
 WHEN NOT MATCHED BY TARGET THEN INSERT (kode, nama, urutan) VALUES (s.kode, s.nama, s.urutan);
GO

/* ---------------------------------------------------------------------------
   2. Bagian — segmen ke-2 nomor surat.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('office.ref_bagian', 'U') IS NULL
BEGIN
    CREATE TABLE office.ref_bagian (
        kode   NVARCHAR(10)  NOT NULL CONSTRAINT pk_ref_bagian PRIMARY KEY,
        nama   NVARCHAR(200) NOT NULL,
        urutan INT           NOT NULL CONSTRAINT df_ref_bagian_urut DEFAULT 0,
        aktif  BIT           NOT NULL CONSTRAINT df_ref_bagian_aktif DEFAULT 1
    );
END
GO

MERGE office.ref_bagian AS t
USING (VALUES
    (N'GCS.01', N'SDM dan Sekretariat',                        1),
    (N'GCS.02', N'Akuntansi, Keuangan, dan Penagihan',          2),
    (N'GCS.03', N'Perdagangan Jasa',                            3),
    (N'GCS.04', N'Bahan Kimia',                                 4),
    (N'GCS.05', N'GCS Medan',                                   5),
    (N'GCS.06', N'Pengendalian Intern, dan IT',                 6),
    (N'GCS.07', N'Hukum dan Perizinan',                         7),
    (N'GCS.08', N'Retail, Korporasi',                           8),
    (N'GCS.09', N'GCS Makassar',                                9),
    (N'GCS.10', N'GCS Lampung',                                10),
    (N'GCS.11', N'Bangha, dan Kelompok Produksi',              11),
    (N'GCS.12', N'Keselamatan, Kesehatan Kerja dan Keamanan',  12)
) AS s (kode, nama, urutan)
   ON t.kode = s.kode
 WHEN MATCHED THEN UPDATE SET t.nama = s.nama, t.urutan = s.urutan
 WHEN NOT MATCHED BY TARGET THEN INSERT (kode, nama, urutan) VALUES (s.kode, s.nama, s.urutan);
GO

/* ---------------------------------------------------------------------------
   3. Pemetaan unit organisasi (schema grading) -> kode bagian.

   Nama unit dicocokkan berjenjang oleh OfficeService: BAGIAN dulu (paling
   spesifik), lalu DEPARTEMEN, lalu KOMPARTEMEN. Karena itu satu tabel datar
   cukup — kolom `tingkat` hanya keterangan bagi pembaca.

   Nama diambil apa adanya dari dua sumber yang formatnya berbeda:
     - grading.jabatan.nama_jabatan  -> "Bag. Penagihan"        (pegawai organik)
     - grading.pegawai_tkno.bagian   -> "Bagian Penagihan"      (pegawai TKNO)
   sehingga kedua ejaan didaftarkan.

   CATATAN: GCS.12 (K3 & Keamanan) sengaja TIDAK dipetakan otomatis — pada
   struktur sekarang fungsi K3 menempel di "Bag. Perijinan, Hukum & K3"
   (dipetakan ke GCS.07) dan fungsi keamanan menempel di bagian sekretariat
   (GCS.01). Pembuat surat K3 memilih GCS.12 secara manual di form.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('office.ref_bagian_unit', 'U') IS NULL
BEGIN
    CREATE TABLE office.ref_bagian_unit (
        nama_unit   NVARCHAR(200) NOT NULL CONSTRAINT pk_ref_bagian_unit PRIMARY KEY,
        kode_bagian NVARCHAR(10)  NOT NULL,
        tingkat     NVARCHAR(20)  NOT NULL CONSTRAINT df_ref_bunit_tingkat DEFAULT 'Departemen',
        CONSTRAINT fk_ref_bunit_bagian FOREIGN KEY (kode_bagian) REFERENCES office.ref_bagian (kode)
    );
END
GO

MERGE office.ref_bagian_unit AS t
USING (VALUES
    -- Departemen / kelompok (grading.unit_organisasi.nama)
    (N'Departemen SDM',                                    N'GCS.01', N'Departemen'),
    (N'Departemen Keuangan',                               N'GCS.02', N'Departemen'),
    (N'Departemen Anggaran & Akuntansi',                   N'GCS.02', N'Departemen'),
    (N'Departemen Jasa Logistik',                          N'GCS.03', N'Departemen'),
    (N'Departemen Penjualan Bahan Kimia dan Gas',          N'GCS.04', N'Departemen'),
    (N'Departemen Region Medan',                           N'GCS.05', N'Departemen'),
    (N'Departemen Audit Internal',                         N'GCS.06', N'Departemen'),
    (N'Departemen Pengembangan',                           N'GCS.06', N'Departemen'),
    (N'Departemen Kepatuhan',                              N'GCS.07', N'Departemen'),
    (N'Departemen Penjualan Pupuk & Pestisida Korporasi',  N'GCS.08', N'Departemen'),
    (N'Departemen Penjualan Pupuk & Pestisida Retail',     N'GCS.08', N'Departemen'),
    (N'Departemen Penjualan Kesuplieran',                  N'GCS.08', N'Departemen'),
    (N'Departemen Region Makassar',                        N'GCS.09', N'Departemen'),
    (N'Departemen Region Lampung',                         N'GCS.10', N'Departemen'),
    (N'Kelompok Perencanaan, Pengendalian & Produksi',     N'GCS.11', N'Departemen'),

    -- Bagian, ejaan grading.jabatan.nama_jabatan (pegawai organik)
    (N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', N'GCS.01', N'Bagian'),
    (N'Bag. Administrasi & Pengembangan SDM & Inovasi',    N'GCS.01', N'Bagian'),
    (N'Bag. Penagihan',                                    N'GCS.02', N'Bagian'),
    (N'Bag. Perbendaharaan',                               N'GCS.02', N'Bagian'),
    (N'Bag. Pajak & Asuransi',                             N'GCS.02', N'Bagian'),
    (N'Bag. Akuntansi & Verifikasi',                       N'GCS.02', N'Bagian'),
    (N'Bag. Anggaran & Pelaporan',                         N'GCS.02', N'Bagian'),
    (N'Bag. Jasa Gudang',                                  N'GCS.03', N'Bagian'),
    (N'Bag. Transport & Bengkel',                          N'GCS.03', N'Bagian'),
    (N'Bag. Audit Internal',                               N'GCS.06', N'Bagian'),
    (N'Bag. Teknologi Informatika & Multimedia',           N'GCS.06', N'Bagian'),
    (N'Bag. Tata Kelola, Manajemen Risiko & Sistem Manajemen', N'GCS.06', N'Bagian'),
    (N'Bag. Perijinan, Hukum & K3',                        N'GCS.07', N'Bagian'),
    (N'Bag. Pengadaan & Pengelolaan Pengembangan',         N'GCS.06', N'Bagian'),
    (N'Bag. Penjualan & Adm Pupuk Subsidi (Medan)',        N'GCS.05', N'Bagian'),
    (N'Bag. Penjualan Logistik, B.Kimia, Non Subsidi & Pestisida (Medan)', N'GCS.05', N'Bagian'),
    (N'Bag. Penjualan & Adm Pupuk Subsidi (Makassar)',     N'GCS.09', N'Bagian'),
    (N'Bag. Penjualan Logistik, Non Subsidi & Pestisida (Makassar)', N'GCS.09', N'Bagian'),
    (N'Bag. Penjualan & Adm Pupuk Subsidi (Lampung)',      N'GCS.10', N'Bagian'),
    (N'Bag. Penjualan Logistik, Non Subsidi & Pestisida (Lampung)',  N'GCS.10', N'Bagian'),
    (N'Bag. Penjualan & Adm Pupuk Subsidi & Non Subsidi (Jawa)',     N'GCS.08', N'Bagian'),
    (N'Bag. Penjualan & Adm Pestisida (Jawa)',             N'GCS.08', N'Bagian'),

    -- Bagian, ejaan grading.pegawai_tkno.bagian (pegawai TKNO)
    (N'Bagian Sekretariat, Keamanan, Umum dan Manajemen Aset', N'GCS.01', N'Bagian'),
    (N'Bagian Penagihan',                                  N'GCS.02', N'Bagian'),
    (N'Bagian Jasa Gudang',                                N'GCS.03', N'Bagian'),
    (N'Bagian Jasa Transport dan Bengkel',                 N'GCS.03', N'Bagian'),
    (N'Bagian Multimedia dan TI',                          N'GCS.06', N'Bagian'),

    -- Kompartemen (cadangan bila bagian & departemen tidak ketemu)
    (N'Kompartemen SDM, Kepatuhan dan Pengembangan',       N'GCS.01', N'Kompartemen'),
    (N'Kompartemen Administrasi Keuangan',                 N'GCS.02', N'Kompartemen'),
    (N'Kompartemen Penjualan Retail',                      N'GCS.08', N'Kompartemen'),
    (N'Kompartemen Penjualan Korporasi',                   N'GCS.08', N'Kompartemen')
) AS s (nama_unit, kode_bagian, tingkat)
   ON t.nama_unit = s.nama_unit
 WHEN MATCHED THEN UPDATE SET t.kode_bagian = s.kode_bagian, t.tingkat = s.tingkat
 WHEN NOT MATCHED BY TARGET THEN INSERT (nama_unit, kode_bagian, tingkat)
      VALUES (s.nama_unit, s.kode_bagian, s.tingkat);
GO

/* ---------------------------------------------------------------------------
   4. Klasifikasi masalah — segmen ke-3 nomor surat. 171 kode.
   `kelompok` = 2-3 huruf pertama kode (PR/SA/LI/KEU/NK/TU/WA/LG/TK), dipakai
   untuk mengelompokkan pilihan pada form Buat Surat.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('office.ref_klasifikasi', 'U') IS NULL
BEGIN
    CREATE TABLE office.ref_klasifikasi (
        kode     NVARCHAR(20)   NOT NULL CONSTRAINT pk_ref_klasifikasi PRIMARY KEY,
        kelompok NVARCHAR(10)   NOT NULL,
        masalah  NVARCHAR(1000) NOT NULL,
        aktif    BIT            NOT NULL CONSTRAINT df_ref_klas_aktif DEFAULT 1
    );
    CREATE INDEX ix_ref_klas_kelompok ON office.ref_klasifikasi (kelompok);
END
GO

MERGE office.ref_klasifikasi AS t
USING (VALUES
(N'PR.00.01', N'Bahan Baku : Naskah tentang kebutuhan bahan baku kegiatan produksi'),
    (N'PR.00.02', N'Bahan Penunjang : Naskah tentang kebutuhan bahan Penunjang kegiatan produksi'),
    (N'PR.01.01', N'Analisa / Spesifikasi Produk utama atau produk samping dan laporannya'),
    (N'PR.01.02', N'Analisa Bahan Baku, Bahan Penunjang dan Laporannya, serta pemeriksaan lapangan dan pengambilan contoh'),
    (N'PR.01.03', N'Analisa Mutu'),
    (N'PR.01.04', N'Proses Produksi antara lain : evaluasi hambatan produksi, lap. Evaluasi produksi, Lap. Jam kerja orang dan Mesin, Lap Pengantongan dll'),
    (N'PR.01.05', N'Utilitas / services unit antara lain tenaga penmbangkit, water treatment / water intake'),
    (N'PR.02.01', N'Pemeliharaan, modifikasi, perbaikan peralatan produksi meliputi schedule pemeliharaan, pelaksanaan pekertajan dan laporan'),
    (N'PR.02.02', N'Pemeliharaan, modifikasi, perbaikan Alat penunjang (alat berat, alat Laboratorium, alat listrik) meliputi schedule pemeliharaan, pelaksanaan pekertajan dan laporan'),
    (N'PR.02.03', N'Revisi Pabrik / Shut Down Periodik antara lain revisi bulanan, revisi tahunan termasuk crash program'),
    (N'PR.02.04', N'Prasarana : pemeliharaan , perbaikan fasilitas perusahaan antara lain jalan, pagar selokan, sarana penerangan, gardu, meliputi schedule pemeliharaan, pelaksanaan, dan laporan'),
    (N'SA.00.01', N'Analisa permintaan dan penawaran  Pasar Dalam Negeri, analisa harga, kebijaksanaan perusahaan dalam pengeluaran produk'),
    (N'SA.00.02', N'Analisa permintaan dan penawaran  Pasar luar Negeri, analisa harga, kebijaksanaan perusahaan dalam pengeluaran produk'),
    (N'SA.01.01', N'Usulan dan penetapan harga jual produk untuk wilayah tertentu meliputi HPP dan hrg produk yg mendapat subsidi dari pemerintah'),
    (N'SA.01.02', N'Penentuan harga pokok produksi yang ditentukan oleh perusahaan sendiri'),
    (N'SA.01.03', N'Penentuan harga jual produk dengan subsidi dari pemerintah'),
    (N'SA.02.01', N'Jalur Distribusi / penyaluran produk ke seluruh wilayah sesuai ketentuan yang ada'),
    (N'SA.02.02', N'Distributor / Sub Distributor antara lain : persyaratan, pengangkatan, penilaian,insentif,teguran, dan pemberhentian distributor'),
    (N'SA.02.03', N'Pelaksanaan / penjualan prosuk ke seluruh wilayah penjualan dalam Negeri meliputi : Permohonan pembelian produk, kontrak,bukti pengeluaran produk,dan klaim mutu'),
    (N'SA.02.04', N'Pelaksanaan / penjualan Penjualan Luar Negeri (Ekspor Impor)'),
    (N'SA.02.05', N'Pelaksanaan pengeluaran Penjualan Non  Pupuk/ Hasil Samping ke seluruh wilayah'),
    (N'SA.02.06', N'Pengaduan,keluhan, klaim dari Konsumen atau pihak lain'),
    (N'SA.03.01', N'Demplot (Kegiatan Demonstrasi/peragaan pemakaian produk pada tanaman tertentu dan hal hal yang terkait'),
    (N'SA.03.02', N'Penyuluhan (penjelasan pemakaian dan manfaat pupuk kepada masyarakat)'),
    (N'SA.03.03', N'Keikutsertaan perusahaan dalam kegiatan pameran'),
    (N'SA.04.01', N'Pelaksanaan penjualan Jasa Penelitian dan pengujian dengan pihak luar dan anper'),
    (N'SA.04.02', N'Penjualan Jasa Perancangan dan Perekayasaan dengan pihak luar dan anak perusahaan yang meliputi permohonan penawaran,persetujuan,pelaksanaandan laporan'),
    (N'SA.04.03', N'PenjualanJasa Fasilitas dan Utilitas kepada pihak luar antara lain penjualan tenaga listrik dan air Industri'),
    (N'SA.04.04', N'Penjualan Jasa Tenaga Ahli kepada pihak luar dan anak perusahaan'),
    (N'SA.04.05', N'Penjualan Jasa  persewaan peralatan produksi,tanah gedung dan peralatan lainnya'),
    (N'LI.00.01', N'Litbang Organisasi,meliputi perencanaan,pengusulan dan pengesahan antara lain: perubahan struktur,pembentukan/perubahan struktur organisansi fungsional,uraian tugas unit kerja'),
    (N'LI.00.02', N'Litbang Sistem dan Prosedur kerja bagi seluruh kegiatan organisasi meliputi penyusunan,ujicoba,pembakuan dan pengesahan'),
    (N'LI.01.01', N'Penelitian Produk dan pengujian guna meningkatkan kualitas produk'),
    (N'LI.01.02', N'Penelitian dan pengujian Bahan Baku dan Penunjang guna meningkatkan kualits produk'),
    (N'LI.01.03', N'Penelitian analisa / dampak Lingkungan,pemeriksaan limbah industri,study evaluasi lingkungan'),
    (N'LI.01.04', N'Penelitian analisa Perangkat / sarana produksi guna meningkatkan kualitas peralatan pabrik'),
    (N'LI.01.05', N'Penelitian analisa Pangsa pasar'),
    (N'LI.02.01', N'Pengembangan / Perluasan Pabrik ,pembangunan pabrik baru,prasarana/utilitas,diversifikasi produk dan iptek'),
    (N'LI.02.02', N'Pengembangan / Perluasan Anak Perusahaan'),
    (N'LI.02.03', N'Pengembangan Prasarana dan Utilitas'),
    (N'LI.02.04', N'Pengembangan / Diversifikasi Produk - upaya menciptakan produk baru'),
    (N'LI.02.05', N'IPTEK/ penemuan dan pengembangan karya karya Ilmiah dan Teknologi'),
    (N'KEU.00.01', N'Penyusunan anggaran Cash Flow Perusahaan Jangka pendek dan jangka panjang'),
    (N'KEU.00.02', N'Penyusunan rencana kerja dan anggaran : RJP,RKA,Risalah rapat anggaran bulanan dan tahunan'),
    (N'KEU.00.03', N'Realisasi penggunaan anggaran untuk biaya dan investasi serta penyimpangan yg terjadi : Realisasi anggaran bulanan dan tahunan'),
    (N'KEU.01.01', N'Pemilikan surat berharga : obligasi dan saham'),
    (N'KEU.01.02', N'Pemilikan tanah / gedung : Akte pembelian tanah/gedung, Sertifikat tanah, Petok D, Ganti rugi tanah'),
    (N'KEU.01.03', N'Kebijakan penghapusan kekayaan : kendaraan, alat berat,peralatan pabrik, dan perabotan kantor'),
    (N'KEU.01.04', N'Penjualan saham perusahaan'),
    (N'KEU.02.01', N'Fungsi perbankan : rekening bank,pinjaman,transfer,deposito,garansi bank,valuta asing'),
    (N'KEU.02.02', N'Hutang piutang : surat penagihan,piutang/tunggakan,uang jaminan,letter of credit (L/C)'),
    (N'KEU.02.03', N'Perpajakan dan retribusi : PPN,Pph,pajak motor,pajak bumi dan bangunan,iuran pembangunan,SPT ,SSP'),
    (N'KEU.02.04', N'Asuransi,meliputi perencanaan,pola asuransi,premi,klaim : asuransi jiwa dan asuransi kerugian,asuransi kendaraan'),
    (N'KEU.03.01', N'Laporan keuangan bulanan/tahunan : analisis ratio,neraca rugi laba,Summary Trial Balance'),
    (N'KEU.03.02', N'Penyusunan buku besar hutang dagang dan tambahan : General Ledger'),
    (N'KEU.03.03', N'Jurnal transaksi : jurnal memory,buku penjualan,jurnal pengeluaran kas dan penerimaan kas'),
    (N'KEU.03.04', N'Perhitungan biaya produksi : buku posisi persediaan'),
    (N'KEU.03.05', N'Pembayaran transaksi perusahaan : bukti penerimaan dan pengeluaran kas/bank'),
    (N'KEU.03.06', N'Rekap transaksi secara kronologis : buku kas/bank'),
    (N'KEU.03.07', N'Kebijakan : CERE (Capital Expenditure and Revenue Expenditure), Penyisihan piutang,masa manfaat /umumr ekonomis asset,penyajian laporan Keuangan'),
    (N'NK.00.01', N'Rencana pengadaan tenaga kerja mulai dari pengusulan formasi,rencana pengadaan / penerimaan dg pengisian formasi'),
    (N'NK.00.02', N'Penyusunan formasi jabatan : promosi jabatan,mutasi,kenaikan pangkat & golongan'),
    (N'NK.00.03', N'Penerimaan tenaga kerja / recruitment'),
    (N'NK.00.04', N'Proses pengadaan tenaga kerja kontrak : celaning service,paramedis,driver,konsultan,perpanjang masa dinas'),
    (N'NK.01.01', N'administrasi kepegawaian meliputi Keterangan karyawan dan/ atau keluarga, perizinan, penugasan  dan data personil'),
    (N'NK.01.02', N'Presensi dan absensi : daftar hadir pertemuan, upacara,senam, jadwal shift, time card,pemberitahuan senam, dan upacara'),
    (N'NK.01.03', N'Izin karyawan : izin tidak masuk, menikah/talak/rujuk,usaha,keluar/masuk pabrik'),
    (N'NK.01.04', N'Penugasan karyawan : surat tugas,perpanjangan penugasan,dispensi,tugas rangkap sbg dewan komisaris dan pengurus organisasi'),
    (N'NK.01.05', N'Data Personil: berisi seluruh keterangan kerja dari diterima sampai pensiun/meninggal dunia'),
    (N'NK.02.01', N'Pelatihan SDM : diklat jenjang jabatan, diklat penunjang'),
    (N'NK.02.02', N'pelatihan non pegawai : lolapil,PKL siswa/mahasiswa'),
    (N'NK.02.03', N'Penilaian conduite dan prestasi karyawan dalam periode tertentu'),
    (N'NK.02.04', N'Sanksi karyawan : teguran lisan, teguran tertulis,dan surat peringatan A/B/C'),
    (N'NK.02.05', N'Penghargaan karyawan : prestasi kerja, dari pemerintah,penyelamatan asset, dan piagam'),
    (N'NK.03.01', N'Pembayaran gaji karyawan dan lembur dan penerimaan hak hak lainnya serta potongan potngan penghasilan rutin'),
    (N'NK.03.02', N'Pemberian bonus / gratifikasi/Jasa Produksi, dan Insentif kepada karyawan'),
    (N'NK.04.01', N'Pemberian bantuan dana : sumbangan nikah, ganti rugi kecelakaan, pindah rumah,duka'),
    (N'NK.04.02', N'Pemberian pakaian dinas beserta perlengkapannya'),
    (N'NK.04.03', N'Kebijaksanaan dan pelaksanaan hak cuti karyawan'),
    (N'NK.04.04', N'Program paket pensiun, paket asuransi sosial tenaga kerja/jamsostek bagi karyawan dan keluarga'),
    (N'NK.04.05', N'Mengatur pelaksanaan hak rekreasi'),
    (N'NK.04.06', N'Kebijakan dan pelaksanaan pemberian makan/minum & Extra fooding'),
    (N'NK.04.07', N'Kebijaksanaan dan pelaksanaan penempatan rumah dinas'),
    (N'NK.05.01', N'Penelitian khusus dari segi mental : recruiting, pra jabatan,dinas keluar negeri'),
    (N'NK.05.02', N'Penelitian dari segi mental selain karyawan : siswa/mahasiswa kerja praktek,tenaga borongan'),
    (N'NK.06.01', N'Perawatan kesehatan : rawat jalan (umum,gigi,lanjutan),rawat nginap (umum,persalinan,operasi)'),
    (N'NK.06.02', N'Medical Check up (Pemeriksaan kesehatan) : pemeriksaan dokter, laboratorium, telinga, mata,gigi, dan kesegaran jasmani'),
    (N'NK.06.03', N'Pelayanan UGD : perawatan luka, keadaan darurat medik'),
    (N'NK.06.04', N'Program keluarga berencana : kontrasepsi, operasi steril, infertilitas, dan pelayanan kesehatan ibu dan anak'),
    (N'NK.06.05', N'Pemerikaan laboraturium : pemeriksaan darah, pemeriksaan falces, pemeriksaan radiologi'),
    (N'NK.06.06', N'Keselamatan dan kesehatan kerja (K3) : pemeriksaan lingkungan kerja, keselamatan personil dan peralatan'),
    (N'NK.06.07', N'Tentang donor darah keluarga dan karyawan'),
    (N'NK.06.08', N'Kegiatan penyuluhan kesehatan : UKS, ceramah kesehatan, pemeriksaan kesehatan masyarakat'),
    (N'NK.06.09', N'Pemberian imunisasi/vaksinasi : BCG,hepatitis,TFT untuk ibu hamil'),
    (N'NK.07.01', N'Kegiatan kerohanian : ceramah agama,Pengumpulan zakat,perpustakan masjid'),
    (N'NK.07.02', N'Kegiatan kepemudaan oleh karyawan'),
    (N'NK.07.03', N'Kegiatan kesenian'),
    (N'NK.07.04', N'Kegiatan olahraga : sepak bola,senam,bola volley,tenis lapangan,badminton,karate,golf'),
    (N'NK.07.05', N'Kegiatan penyaluran aspirasi politik karyawan'),
    (N'NK.07.06', N'Kegiatan organisasi Dharma Wanita'),
    (N'NK.08.01', N'Kebijaksanaan masa persiapan pensiun, purna tugas, meninggal'),
    (N'NK.08.02', N'Pemberhentian karyawan dengan hormat'),
    (N'NK.08.03', N'Pemberhentian karyawan dengan tidak hormat'),
    (N'TU.00.01', N'Rapat umum pemegang sahammeliputi persiapan,notulen persetujuan dan laporan laporannya'),
    (N'TU.00.02', N'Holding CO : kegiatan penggabungan modal'),
    (N'TU.00.03', N'kegiatan Dewan Komisaris dengan Direksi : persiapan bahan rapat, risalah tanggapan ,notulen,personel Dekom'),
    (N'TU.01.01', N'Penggandaan : Kegiatan penyiapan dan penggandaan dokumen kerja'),
    (N'TU.01.02', N'kearsipan : persiapan konsep surat, pengiriman/penerimaan distribusi,pencatatan dokumen,perawatan arsip,penyusutan/pemindahan arsip'),
    (N'TU.01.03', N'Pemberitahuan identitas perusahan'),
    (N'TU.02.01', N'Kegiatan pelayanan bagi tamu : persiapan pertemuan, akomodasi, pengurusan paspor/visa/ticket'),
    (N'TU.02.02', N'Penggunaan/peminjaman fasilitas : rumah dinas,kendaraan,telepon'),
    (N'TU.02.03', N'Pengelolaan kebersihan ruang kerja : peralatan, kegiat cleaning service, kegiat house keeping'),
    (N'TU.03.01', N'Kegiatan alat tulis menulis dan perlengkapan komputer'),
    (N'TU.03.02', N'Kegiatan peralatan kantor : mesin kantor, alata kesehatan, pemadam kebakaran,mebelair keperluan kantor'),
    (N'TU.03.03', N'Pengelolaan peralatan komunikasi : mesin telex,faximile, telephone, internet'),
    (N'TU.04.01', N'Kebijakan lembaga tinggi negara : tap MPR,INPRES,KEPRES,PERDA,SK Menteri, SK Drijen'),
    (N'TU.04.02', N'Peraturan-perturan oleh Direksi : SKPTS Direksi, sistem dan prosedur, prosedur tetap, juklak,juknis'),
    (N'TU.04.03', N'Penyusunan anggaran Dasar dan anggaran rumah tangga'),
    (N'TU.04.04', N'Fungsi / kegiatan hukum : gugatan,klaim'),
    (N'TU.04.05', N'Permintaan / pemberian izin : SIUP, IMB,akte pendirian perusahaan,izin kendaraan, SIM,legalitas dokumen'),
    (N'TU.04.06', N'Perjanjian-perjanjian : perjanjian kerja perorangan, jual beli barang/jasa,kontrak kerja sama,amandemen,side letter,MOU'),
    (N'TU.05.01', N'Struktur organisasi : perencanaan, pengesahan, pengesahan struktur organisasi'),
    (N'TU.05.02', N'Penyusunan dan pembakuan sistem dan prosedur kerja'),
    (N'TU.05.03', N'Uraian kerja/ job discrption dari organisasi'),
    (N'TU.05.04', N'Penyusunan, penerapan dan pembakuan Quality Control : penerapan QCC, PMT, GKM, ISO 9002 / 14001'),
    (N'TU.06.01', N'Kegiatan kepanitian dan keikutsertaan : APINDO, IFA, PATI Fk.SPI, KADIN,PMMI'),
    (N'TU.06.02', N'Kegiatan kepanitian / membentuk tim Intern'),
    (N'TU.07.01', N'Pelaporan fungsi dan kegiatan rutin : laporaan kegiatan (harian, mingguan, bulanan, tahunan), laporan rutin keuangan, laporan pengawasan'),
    (N'TU.07.02', N'Pelaporan manajemen : laporan akuntan negara, khusus keuangan'),
    (N'TU.08.01', N'Pembinaan opini : pemasangan iklan sponsor, penyebaran leaflet/brosur promosi, kerjasama (MOU)'),
    (N'TU.08.02', N'Pembinaan Sosial / opini publik : bantuan kepada desa-desa, intansi-intansi terkait, sarana ibadah dan pendidikan'),
    (N'TU.09.01', N'Citra perusahaan secara lisan dan tulisan : pengolahan data, Questionaire, penjelasan pada tamu (Informasi Perusahaan)'),
    (N'TU.09.02', N'Mass Media dan kegiatan pers : konperensi pers, pers release'),
    (N'TU.09.03', N'Kunjungan tamu perusahaan : kunjungan presiden, tamu/pejabat negara, rombongan DPR/MPR, tokoh masyarakat, kunjungan pelajar, organisasi'),
    (N'TU.09.04', N'Peliputan dan pendokumentasikan kegiatan : liputan TVRI, adui visual,foto-foto, prastati'),
    (N'TU.09.05', N'Kegiatan pengumpulan data,gambar guna penerbitan Media Cetak : majalah GEMA, kalender, agenda, broser, clipping koran, poster/spanduk'),
    (N'TU.10.01', N'Penyelenggaraan upacara : presmian pabrik, upacara lapangan, HUT perusahaan'),
    (N'TU.10.02', N'Penyelenggaraan lomba : lomba penerapan K3, pembinan matrik Hansip, pengijauan, drumband'),
    (N'TU.10.03', N'Penyelenggaraan rapat : rapat kerja/koordinasi, rapat pimpinan, rapat pimpinan dengan pihak luar'),
    (N'TU.10.04', N'Penyelenggaraan akomodasi bagi tamu : penginapan/mess perusahaan, penginapan diluar lingkungan kerja'),
    (N'TU.11.01', N'Pembinaan hubungan baik dengan lembaga/badan/instansi : pembinaan pengembangan dengan POLRI, hubungan dengan lembaga keuangan, MUSPIDA'),
    (N'TU.11.02', N'Pembinaan hubungan baik dengan perorangan : hubungan baik dengan sesepuh perusahaan, cindera mata/souvenir'),
    (N'TU.11.03', N'Pembinaan industri kecil sebagai mitra kerja, bapak angkat,anak angkat perusahaan'),
    (N'TU.12.01', N'Penyelenggaraan dan pengumpulan bahan pustaka yang bersifat teknik pembinaan'),
    (N'TU.12.02', N'Penyelanggaraan / pengumpulan daftar pustaka yang bersifat non teknik'),
    (N'WA.00.01', N'Pengawasan dan pemeriksaan oleh BPKP, BPK,MENPAN : pemeriksaan prosedur kerja, administrasi , dan operasional'),
    (N'WA.01.01', N'Pengawasan dan pemeriksaan oleh intern bidang keuangan dan administrasi: pengawasan keuangan dan anggaran, akuntansi,logistik dan pergudangan, personalia dan diklat'),
    (N'WA.01.02', N'Pengawasan dan pemeriksaan intern terhadap pengoperasian dan pemeliharaan intalasi : pengawasan produksi, penggunaan bahan / peralatan'),
    (N'WA.01.03', N'Pengawasan proyek meliputi pembangunan instalasi/kontruksi dari sarana produksi : pengawasan pembangunan gedung, pemasangaan instalasi air, listrik,pompa'),
    (N'WA.01.04', N'Kegiatan pengawasan sebagai fungsi pokok dalam manajemen : penetapan , penyiapan laporan waskat'),
    (N'WA.02.01', N'Pengamanan dilingkungan perusahaan : keamanan dilingkungan Pabrik dan pelabuhan, perumahan, sarana ibadah/olahraga,perlindungan dan pencegahan kebakaran'),
    (N'WA.02.02', N'Pengawasan Keamananan Kamtibmas dan hubungan dengan aparat setempat : pengamanan dari PORLI, pengamanan dari desa-desa, pencegaha kebakaran'),
    (N'WA.02.03', N'Pengamanan instalasi pabrik dan lingkungannya : keamanan instalasi air Gunungsari, instalasi air Babat'),
    (N'WA.03.01', N'Penertiban dan pemeriksaan terhadap pelanggan : kelalaian tugas, penyalahgunaan wewenang, pelanggaran PP 10'),
    (N'WA.03.02', N'Naskah naskah yg berkaitan Tata tertib berlalu lintas dikawasan perusahaan : penempatan rambu-rambu, kerusakan akibat pelanggaran, kecelakaan akibat pelanggaran lalu lintas, penertiban parkir'),
    (N'WA.03.03', N'Penertiban dan persyaratan bagi tamu : penertiban kendaraan tamu, persyaratan/perizinan masuk parkir'),
    (N'LG.00.01', N'Perencanaan dan evaluasi kebutuhan barang dan atau jasa : DRM RK dan Dep/Ro, Prive List, Referensi, Lelang Umum, Jaminan Supply'),
    (N'LG.00.02', N'Kegiatan barang/jasa secara umum dari dalam negeri atau luar negeri : permintaan pembelian, PO LN, PO lokal, order kerja, Denda keterlambatan,BA, TB,'),
    (N'LG.00.03', N'Penyelenggaraan tender barang dan jasa : pra kwalifikasi, proses tender/lelang, undangan lelang,anwijzing, pembukaan penawaran, BA evaluasi, negosiasi, penetapan pemenang'),
    (N'LG.01.01', N'Persediaan barang di Gudang dan perencanaan sampai penyiapan persediaan barang : bahan baku, equipment pabrik, spare parts'),
    (N'LG.01.02', N'Kegiatan administrasi gudang dan inventory : Distribusi barang (BM), kodefikasi/indexing barang, TB'),
    (N'LG.01.03', N'Naskah Naskah yg berkaitan dg Kebijakan dibidang angkutan : kebijakan angkutan pupuk, alokasi kendaraan angkutan produk, karyawan, dan non karyawan'),
    (N'LG.01.04', N'Pelaksanaan angkutan : angkutan produk oleh ekspeditur, angkutan produk dalam pabrik, kebutuhan bahan bakar, dan perawatan'),
    (N'LG.02.01', N'Kegiatan bongkar muat barang hasil produksi dari dermaga sendiri : bongkar barang, muat hasil produk, laporan kegiatan operasional pelabuhan'),
    (N'LG.02.02', N'Pembebasan barang melalui pelabuhan luar : paket melalui angkutan darat, pembebasan barang melalui pelabuhan laut dan udara'),
    (N'LG.02.03', N'Pemakaian sarana pelabuhan : pelayanan fasilitas pelabuhan, peralatan bongkar muat, shifting kapal'),
    (N'TK.00.01', N'Kegiatan perencanaan Basic Design Enginnering'),
    (N'TK.00.02', N'Perencanan detail design bidang sipil arsitek dan konstruksi proyek pengembangan fasilitas produksi dan fasilitas perusahaan'),
    (N'TK.00.03', N'Perencanaan detail design bidang peralatan, mesin,plan & piping proyek pembangunan fasilitas produksi dan perusahaan lain serta proyek komersial'),
    (N'TK.00.04', N'Kegiatan perencanaan detail design engineering bidang listrik dan instrument proyek'),
    (N'TK.00.05', N'Perhitungan biaya estimasi dan penjadwalan proyek pembangunan fasilitas produksi')
) AS s (kode, masalah)
   ON t.kode = s.kode
 WHEN MATCHED THEN UPDATE SET t.masalah = s.masalah, t.kelompok = LEFT(s.kode, CHARINDEX('.', s.kode) - 1)
 WHEN NOT MATCHED BY TARGET THEN INSERT (kode, kelompok, masalah)
      VALUES (s.kode, LEFT(s.kode, CHARINDEX('.', s.kode) - 1), s.masalah);
GO

/* ---------------------------------------------------------------------------
   5. Penghitung nomor urut — satu deret perusahaan per tahun.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('office.surat_nomor', 'U') IS NULL
BEGIN
    CREATE TABLE office.surat_nomor (
        tahun    INT NOT NULL CONSTRAINT pk_surat_nomor PRIMARY KEY,
        terakhir INT NOT NULL CONSTRAINT df_surat_nomor_akhir DEFAULT 0
    );
END
GO

/* Ambil satu nomor urut berikutnya secara atomik. Dipanggil aplikasi tepat saat
   surat berstatus Disetujui. UPDLOCK/HOLDLOCK mencegah dua surat memperoleh
   nomor yang sama saat dua approver menekan Setujui bersamaan. */
IF OBJECT_ID('office.sp_ambil_nomor_urut', 'P') IS NOT NULL
    DROP PROCEDURE office.sp_ambil_nomor_urut;
GO
CREATE PROCEDURE office.sp_ambil_nomor_urut
    @tahun INT,
    @urut  INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;

    UPDATE office.surat_nomor WITH (UPDLOCK, HOLDLOCK)
       SET @urut = terakhir = terakhir + 1
     WHERE tahun = @tahun;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO office.surat_nomor (tahun, terakhir) VALUES (@tahun, 1);
        SET @urut = 1;
    END

    COMMIT;
END
GO

/* ---------------------------------------------------------------------------
   6. Kolom kode pada office.surat.

   `klasifikasi` (kolom lama, teks bebas) tetap dipakai — mulai sekarang diisi
   URAIAN masalah hasil pilihan, dibekukan saat surat dibuat. Polanya sama
   dengan pembuat_nama / distribusi.nama yang juga disimpan sebagai salinan
   agar arsip tetap terbaca meski master berubah.
   --------------------------------------------------------------------------- */
IF COL_LENGTH('office.surat', 'kode_bagian') IS NULL
    ALTER TABLE office.surat ADD kode_bagian NVARCHAR(10) NULL;
GO
IF COL_LENGTH('office.surat', 'kode_klasifikasi') IS NULL
    ALTER TABLE office.surat ADD kode_klasifikasi NVARCHAR(20) NULL;
GO

/* ---------------------------------------------------------------------------
   7. Kosakata `jenis` mengikuti master: DR/MI/BA/RR.
   Data lama dipetakan: Surat/SP/ASP/Sirkuler -> DR, Memo -> MI.
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_surat_jenis')
    ALTER TABLE office.surat DROP CONSTRAINT ck_surat_jenis;
GO

UPDATE office.surat SET jenis = N'MI' WHERE jenis = N'Memo';
UPDATE office.surat SET jenis = N'DR' WHERE jenis IN (N'Surat', N'SP', N'ASP', N'Sirkuler');
GO

/* Default kolom ikut berubah dari 'Surat' ke 'DR'. */
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'df_surat_jenis')
    ALTER TABLE office.surat DROP CONSTRAINT df_surat_jenis;
GO
ALTER TABLE office.surat ADD CONSTRAINT df_surat_jenis DEFAULT N'DR' FOR jenis;
GO

ALTER TABLE office.surat WITH CHECK
    ADD CONSTRAINT ck_surat_jenis CHECK (jenis IN (N'DR', N'MI', N'BA', N'RR'));
GO

/* ---------------------------------------------------------------------------
   Laporan singkat.
   --------------------------------------------------------------------------- */
-- PRINT tidak menerima subquery, jadi hitungannya ditampung variabel dulu.
DECLARE @jenis INT     = (SELECT COUNT(*) FROM office.ref_jenis_surat);
DECLARE @bagian INT    = (SELECT COUNT(*) FROM office.ref_bagian);
DECLARE @bagianUnit INT= (SELECT COUNT(*) FROM office.ref_bagian_unit);
DECLARE @klas INT      = (SELECT COUNT(*) FROM office.ref_klasifikasi);
PRINT CONCAT('ref_jenis_surat  : ', @jenis,      ' baris');
PRINT CONCAT('ref_bagian       : ', @bagian,     ' baris');
PRINT CONCAT('ref_bagian_unit  : ', @bagianUnit, ' baris');
PRINT CONCAT('ref_klasifikasi  : ', @klas,       ' baris');
GO
