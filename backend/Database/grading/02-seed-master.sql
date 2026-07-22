/* ============================================================================
   grading - seed data master: band, job_grade, unit_organisasi, jabatan
   (Direksi + Band 1-3, presisi penuh sesuai Analisis_Pemetaan_JG Revisi 5)
   ----------------------------------------------------------------------------
   Band 4-6 (Staf Pemula/Pelaksana Senior/Pelaksana Junior) SENGAJA tidak di
   sini - lihat 03-seed-band4-6.sql: karena dokumen sumber sendiri menyatakan
   estimasi formasi Band 4-5 belum direkonsiliasi presisi, jabatan Band 4-6
   diturunkan langsung dari "Data 85 Pegawai Organik GCS" (satu baris per
   kombinasi jabatan+band+jg yang benar-benar terisi), bukan dari estimasi
   formasi di Analisis_Pemetaan_JG.

   Idempoten: tiap blok dicek dulu sebelum insert (aman dijalankan ulang).
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------------------------------------------------------------------
   band (Contoh-JobGrade-PG-final.pdf, hlm.2) - termasuk Band 0 = Direksi,
   di luar skala JG 7-21.
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM grading.band)
BEGIN
    INSERT INTO grading.band (id_band, kode, nama, urutan, keterangan) VALUES
    (0, 'DIR', N'Direksi (Direktur Utama & Direktur)', 0, N'Di atas Band I; di luar skala JG 7-21'),
    (1, 'I',   N'General Manager',   1, N'Pemimpin Kompartemen'),
    (2, 'II',  N'Manager',           2, N'Pemimpin Departemen'),
    (3, 'III', N'Kepala Bagian',     3, N'Pemimpin Bagian'),
    (4, 'IV',  N'Staf Pemula',       4, N'Analisis/teknis'),
    (5, 'V',   N'Pelaksana Senior',  5, N'Eksekusi'),
    (6, 'VI',  N'Pelaksana Junior',  6, N'Entry level');
    PRINT 'grading.band: 7 baris disisipkan.';
END
ELSE PRINT 'LEWATI: grading.band sudah terisi.';
GO

/* ---------------------------------------------------------------------------
   job_grade (Contoh-JobGrade-PG-final.pdf, hlm.4)
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM grading.job_grade)
BEGIN
    INSERT INTO grading.job_grade (jg, id_band) VALUES
    (21,1),(20,1),(19,2),(18,2),(17,2),(16,3),(15,3),(14,4),(13,4),(12,4),(11,5),(10,5),(9,5),(8,6),(7,6);
    PRINT 'grading.job_grade: 15 baris disisipkan.';
END
ELSE PRINT 'LEWATI: grading.job_grade sudah terisi.';
GO

/* ---------------------------------------------------------------------------
   unit_organisasi (Lampiran Struktur Organisasi 1 April 2026 + Analisis JG)
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM grading.unit_organisasi)
BEGIN
    INSERT INTO grading.unit_organisasi (nama, tipe, id_unit_induk, wilayah, keterangan) VALUES
    (N'Direktorat Komersil', N'Direktorat', NULL, NULL, NULL),
    (N'Direktorat Keuangan', N'Direktorat', NULL, NULL, NULL);

    INSERT INTO grading.unit_organisasi (nama, tipe, id_unit_induk, wilayah, keterangan)
    SELECT N'Kompartemen Penjualan Korporasi', N'Kompartemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Direktorat Komersil'
    UNION ALL SELECT N'Kompartemen Penjualan Retail', N'Kompartemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Direktorat Komersil'
    UNION ALL SELECT N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Kompartemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Direktorat Keuangan'
    UNION ALL SELECT N'Kompartemen Administrasi Keuangan', N'Kompartemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Direktorat Keuangan'
    UNION ALL SELECT N'Kelompok Perencanaan, Pengendalian & Produksi', N'Kelompok', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Direktorat Komersil';

    INSERT INTO grading.unit_organisasi (nama, tipe, id_unit_induk, wilayah, keterangan)
    SELECT N'Departemen Penjualan Pupuk & Pestisida Korporasi', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Korporasi'
    UNION ALL SELECT N'Departemen Penjualan Bahan Kimia dan Gas', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Korporasi'
    UNION ALL SELECT N'Departemen Penjualan Kesuplieran', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Korporasi'
    UNION ALL SELECT N'Departemen Jasa Logistik', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Retail'
    UNION ALL SELECT N'Departemen Penjualan Pupuk & Pestisida Retail', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Retail'
    UNION ALL SELECT N'Departemen Region Makassar', N'Region', id_unit, N'Makassar', NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Retail'
    UNION ALL SELECT N'Departemen Region Lampung', N'Region', id_unit, N'Lampung', NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Retail'
    UNION ALL SELECT N'Departemen Region Medan', N'Region', id_unit, N'Medan', NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Penjualan Retail'
    UNION ALL SELECT N'Departemen SDM', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen SDM, Kepatuhan dan Pengembangan'
    UNION ALL SELECT N'Departemen Kepatuhan', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen SDM, Kepatuhan dan Pengembangan'
    UNION ALL SELECT N'Departemen Pengembangan', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen SDM, Kepatuhan dan Pengembangan'
    UNION ALL SELECT N'Departemen Anggaran & Akuntansi', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Administrasi Keuangan'
    UNION ALL SELECT N'Departemen Keuangan', N'Departemen', id_unit, NULL, NULL FROM grading.unit_organisasi WHERE nama = N'Kompartemen Administrasi Keuangan'
    UNION ALL SELECT N'Departemen Audit Internal', N'Departemen', NULL, NULL, N'Lapor langsung ke Direktur Utama untuk independensi organisatoris (bukan di bawah GM Administrasi Keuangan meski tergambar sekolom di SK)' FROM grading.unit_organisasi WHERE nama = N'Kompartemen Administrasi Keuangan';

    DECLARE @unit_cnt INT = (SELECT COUNT(*) FROM grading.unit_organisasi);
    PRINT 'grading.unit_organisasi: ' + CAST(@unit_cnt AS VARCHAR(10)) + ' baris disisipkan.';
END
ELSE PRINT 'LEWATI: grading.unit_organisasi sudah terisi.';
GO

/* ---------------------------------------------------------------------------
   jabatan - DIREKSI (Band 0, jg NULL)
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM grading.jabatan WHERE id_band = 0)
BEGIN
    INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, id_atasan, aktif)
    VALUES (N'Direktur Utama', 0, NULL, NULL, NULL, 1);

    INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, id_atasan, aktif)
    SELECT N'Direktur Komersil', 0, NULL, NULL, id_jabatan, 1 FROM grading.jabatan WHERE nama_jabatan = N'Direktur Utama'
    UNION ALL
    SELECT N'Direktur Keuangan', 0, NULL, NULL, id_jabatan, 1 FROM grading.jabatan WHERE nama_jabatan = N'Direktur Utama';

    PRINT 'grading.jabatan (Direksi): 3 baris disisipkan.';
END
ELSE PRINT 'LEWATI: jabatan Direksi sudah terisi.';
GO

/* ---------------------------------------------------------------------------
   jabatan - BAND 1: General Manager (4 posisi, semua terisi)
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM grading.jabatan WHERE id_band = 1)
BEGIN
    INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, id_atasan, inti, kelompok_fungsi, jumlah_formasi, alasan)
    SELECT v.nama_jabatan, 1, v.jg, u.id_unit, a.id_jabatan, v.inti, v.kelompok_fungsi, 1, v.alasan
    FROM (VALUES
        (N'GM Penjualan Korporasi', 21, N'Kompartemen Penjualan Korporasi', N'Direktur Komersil', CAST(1 AS BIT), N'Penjualan Korporasi', N'Kontributor revenue tunggal terbesar (>55% omzet), produk B3 berisiko tinggi.'),
        (N'GM Penjualan Retail',    21, N'Kompartemen Penjualan Retail',    N'Direktur Komersil', CAST(1 AS BIT), N'Penjualan Retail',    N'Struktur & span terbesar (33 orang), produk Subsidi dengan risiko regulasi tertinggi.'),
        (N'GM SDM, Kepatuhan & Pengembangan', 20, N'Kompartemen SDM, Kepatuhan dan Pengembangan', N'Direktur Keuangan', CAST(0 AS BIT), N'Governance/SDM', N'Governance (12%) + SDM (10%) KPI Korporat 2026; menaungi K3, pengadaan, legal.'),
        (N'GM Administrasi Keuangan', 20, N'Kompartemen Administrasi Keuangan', N'Direktur Keuangan', CAST(0 AS BIT), N'Keuangan', N'Fungsi keuangan menopang +-62% bobot KPI Korporat 2026 - menyetarakan dengan GM SKP.')
    ) AS v(nama_jabatan, jg, nama_unit, nama_atasan, inti, kelompok_fungsi, alasan)
    JOIN grading.unit_organisasi u ON u.nama = v.nama_unit
    JOIN grading.jabatan a ON a.nama_jabatan = v.nama_atasan;

    PRINT 'grading.jabatan (Band 1): 4 baris disisipkan.';
END
ELSE PRINT 'LEWATI: jabatan Band 1 sudah terisi.';
GO

/* ---------------------------------------------------------------------------
   jabatan - BAND 2: Manager (15 posisi formal + 1 di luar formasi: Sutan
   Priatmaja/Staf Khusus Direktur Komersil, jg=NULL karena "JG=0" di sumber
   = di luar skala formal, lihat 85-Pegawai baris 13)
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM grading.jabatan WHERE id_band = 2)
BEGIN
    INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, id_atasan, kelompok_fungsi, jumlah_formasi, alasan)
    SELECT v.nama_jabatan, 2, v.jg, u.id_unit, a.id_jabatan, v.kelompok_fungsi, 1, v.alasan
    FROM (VALUES
        (N'Manager Penjualan Pupuk & Pestisida Korporasi', 19, N'Departemen Penjualan Pupuk & Pestisida Korporasi', N'GM Penjualan Korporasi', N'Penjualan Korporasi', N'Kontributor besar lini Non Subsidi; kompleksitas & margin lebih tinggi dari pola subsidi baku musiman.'),
        (N'Manager Region Medan',    19, N'Departemen Region Medan',    N'GM Penjualan Retail',    N'Retail Region', N'Mesin uang B2C daerah - integrasi Subsidi + Gudang + Angkutan + Bahan Kimia, kompleksitas tertinggi antar-region. KOSONG.'),
        (N'Manager Penjualan Bahan Kimia & Gas', 19, N'Departemen Penjualan Bahan Kimia dan Gas', N'GM Penjualan Korporasi', N'Penjualan B3', N'Revenue tunggal terbesar (+-Rp166 M), produk B3 risiko tinggi - Problem Solving & Know-How tertinggi Band 2. KOSONG.'),
        (N'Manager Penjualan Kesuplieran', 18, N'Departemen Penjualan Kesuplieran', N'GM Penjualan Korporasi', N'Penjualan Korporasi', N'Naik dari JG17 (Revisi 4): kontribusi laba kotor tertinggi 2025 di lini Korporasi, revenue juga tinggi.'),
        (N'Manager Keuangan', 18, N'Departemen Keuangan', N'GM Administrasi Keuangan', N'Keuangan', N'Memegang kas & piutang perusahaan - risiko finansial langsung; span organisasi besar (8).'),
        (N'Manager Region Makassar', 18, N'Departemen Region Makassar', N'GM Penjualan Retail', N'Retail Region', N'Mesin uang B2C daerah - integrasi Subsidi + Gudang + Angkutan.'),
        (N'Manager Penjualan Pupuk & Pestisida Retail', 18, N'Departemen Penjualan Pupuk & Pestisida Retail', N'GM Penjualan Retail', N'Penjualan Retail', N'Pemegang produk Subsidi, pola eksekusi mengikuti program subsidi baku musiman. KOSONG.'),
        (N'Manager Region Lampung', 18, N'Departemen Region Lampung', N'GM Penjualan Retail', N'Retail Region', N'Mesin uang B2C daerah - integrasi Subsidi + Gudang + Angkutan. KOSONG.'),
        (N'Manager Jasa Logistik', 18, N'Departemen Jasa Logistik', N'GM Penjualan Retail', N'Logistik', N'Menaungi Gudang & Angkutan, bagian integral mesin uang B2C - setara pola Manager Region.'),
        (N'Manager Pengembangan', 17, N'Departemen Pengembangan', N'GM SDM, Kepatuhan & Pengembangan', N'Pengadaan', N'KOSONG - dalam proses promosi (kandidat: Ari Kuncoro, saat ini Kabag TI & Multimedia). Fungsi pengadaan saat ini hanya non-barang-dagangan.'),
        (N'Manager SDM', 17, N'Departemen SDM', N'GM SDM, Kepatuhan & Pengembangan', N'SDM', N'Non-core, span besar namun dampak contributory. KOSONG.'),
        (N'Manager Kepatuhan', 17, N'Departemen Kepatuhan', N'GM SDM, Kepatuhan & Pengembangan', N'Kepatuhan', N'Turun dari JG18 (Revisi 4): second line of defense - tidak terpapar risiko langsung.'),
        (N'Staf Madya Perencanaan, Pengendalian & Produksi', 17, N'Kelompok Perencanaan, Pengendalian & Produksi', N'Direktur Komersil', N'Perencanaan', N'Level BOD-2, lapor langsung Direktur Komersil (Revisi 2).'),
        (N'Manager Anggaran & Akuntansi', 17, N'Departemen Anggaran & Akuntansi', N'GM Administrasi Keuangan', N'Keuangan', N'Non-core, span organisasi kecil, sifat pekerjaan rutin/pelaporan.'),
        (N'Manager Audit Internal', 17, N'Departemen Audit Internal', N'Direktur Utama', N'Audit', N'Span tim kecil (2 orang) menjadi faktor lebih dominan dibanding independensi organisatoris; lapor langsung Direktur Utama untuk independensi.')
    ) AS v(nama_jabatan, jg, nama_unit, nama_atasan, kelompok_fungsi, alasan)
    JOIN grading.unit_organisasi u ON u.nama = v.nama_unit
    JOIN grading.jabatan a ON a.nama_jabatan = v.nama_atasan;

    -- Sutan Priatmaja: Band 2 di payroll, JG=0 di sumber (di luar 15 formasi formal) -> jg NULL di sini.
    INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, id_atasan, kelompok_fungsi, jumlah_formasi, alasan)
    SELECT N'Staf Khusus Direktur Komersil', 2, NULL, NULL, id_jabatan, N'Khusus', 1,
           N'Di luar 15 formasi Band 2 formal (JG=0 di data payroll); klasifikasi ditinjau ulang setelah masa sanksi kerja selesai.'
    FROM grading.jabatan WHERE nama_jabatan = N'Direktur Komersil';

    PRINT 'grading.jabatan (Band 2): 16 baris disisipkan (15 formal + 1 di luar formasi).';
END
ELSE PRINT 'LEWATI: jabatan Band 2 sudah terisi.';
GO

/* ---------------------------------------------------------------------------
   jabatan - BAND 3: Kepala Bagian (22 posisi: 15 terisi, 7 kosong)
   id_unit disamakan dengan unit_organisasi induknya (Bagian tidak dimodelkan
   sebagai baris unit_organisasi tersendiri).
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM grading.jabatan WHERE id_band = 3)
BEGIN
    INSERT INTO grading.jabatan (nama_jabatan, id_band, jg, id_unit, id_atasan, kelompok_fungsi, jumlah_formasi, alasan)
    SELECT v.nama_jabatan, 3, v.jg, u.id_unit, a.id_jabatan, N'Bagian', 1, v.alasan
    FROM (VALUES
        (N'Bag. Penjualan & Adm Pupuk Subsidi (Medan)', 16, N'Departemen Region Medan', N'Manager Region Medan', N'Subsidi, region dengan span terbesar. KOSONG.'),
        (N'Bag. Penjualan Logistik, B.Kimia, Non Subsidi & Pestisida (Medan)', 16, N'Departemen Region Medan', N'Manager Region Medan', N'Tambahan risiko penanganan bahan kimia regional. KOSONG.'),
        (N'Bag. Penjualan & Adm Pupuk Subsidi (Makassar)', 16, N'Departemen Region Makassar', N'Manager Region Makassar', N'Subsidi, span besar. KOSONG.'),
        (N'Bag. Penjualan & Adm Pupuk Subsidi & Non Subsidi (Jawa)', 16, N'Departemen Penjualan Pupuk & Pestisida Retail', N'Manager Penjualan Pupuk & Pestisida Retail', N'Fungsi Kepala Bagian riil - judul SK: Staf Muda (Revisi 2).'),
        (N'Bag. Penagihan', 16, N'Departemen Keuangan', N'Manager Keuangan', N'Span kecil namun Accountability besar - piutang macet menggerus laba kotor tipis. KPI "Efektivitas Penagihan Piutang" 7%.'),
        (N'Bag. Perbendaharaan', 16, N'Departemen Keuangan', N'Manager Keuangan', N'Cash management langsung - kontributor KPI Cash Flow & Cash Inflow Ratio (masing 8%).'),
        (N'Bag. Pajak & Asuransi', 16, N'Departemen Anggaran & Akuntansi', N'Manager Anggaran & Akuntansi', N'Naik dari JG15 (Revisi 4): risiko utama koreksi pemeriksa pajak bernilai material.'),
        (N'Bag. Transport & Bengkel', 16, N'Departemen Jasa Logistik', N'Manager Jasa Logistik', N'Eksekutor langsung distribusi B2C - bagian mesin uang daerah. KOSONG.'),
        (N'Bag. Jasa Gudang', 16, N'Departemen Jasa Logistik', N'Manager Jasa Logistik', N'Logistik penyimpanan yang menopang penjualan B2C langsung. KOSONG.'),
        (N'Bag. Perijinan, Hukum & K3', 15, N'Departemen Kepatuhan', N'Manager Kepatuhan', N'Turun dari JG16 (Revisi 4): second line.'),
        (N'Bag. Sekretariat, Keamanan, Umum & Manajemen Aset', 15, N'Departemen SDM', N'Manager SDM', N'Turun dari JG16 (Revisi 4): fungsi pendukung.'),
        (N'Bag. Pengadaan & Pengelolaan Pengembangan', 15, N'Departemen Pengembangan', N'Manager Pengembangan', N'Turun dari JG16 (Revisi 4): dikonfirmasi Direksi hanya kebutuhan internal.'),
        (N'Bag. Penjualan & Adm Pupuk Subsidi (Lampung)', 15, N'Departemen Region Lampung', N'Manager Region Lampung', N'Subsidi, span kecil (1 staf).'),
        (N'Bag. Penjualan Logistik, Non Subsidi & Pestisida (Lampung)', 15, N'Departemen Region Lampung', N'Manager Region Lampung', N'Span kecil. KOSONG.'),
        (N'Bag. Penjualan Logistik, Non Subsidi & Pestisida (Makassar)', 15, N'Departemen Region Makassar', N'Manager Region Makassar', N'Span kecil. KOSONG.'),
        (N'Bag. Penjualan & Adm Pestisida (Jawa)', 15, N'Departemen Penjualan Pupuk & Pestisida Retail', N'Manager Penjualan Pupuk & Pestisida Retail', N'Fungsi Kepala Bagian riil - judul SK: Staf Muda (Revisi 2).'),
        (N'Bag. Administrasi & Pengembangan SDM & Inovasi', 15, N'Departemen SDM', N'Manager SDM', N'Non-core, administratif.'),
        (N'Bag. Tata Kelola, Manajemen Risiko & Sistem Manajemen', 15, N'Departemen Kepatuhan', N'Manager Kepatuhan', N'Non-core, span kecil (1 staf).'),
        (N'Bag. Teknologi Informatika & Multimedia', 15, N'Departemen Pengembangan', N'Manager Pengembangan', N'Non-core, span kecil. Incumbent sedang proses promosi ke Manager Pengembangan.'),
        (N'Bag. Akuntansi & Verifikasi', 15, N'Departemen Anggaran & Akuntansi', N'Manager Anggaran & Akuntansi', N'Pelaporan rutin.'),
        (N'Bag. Anggaran & Pelaporan', 15, N'Departemen Anggaran & Akuntansi', N'Manager Anggaran & Akuntansi', N'Pelaporan rutin.'),
        (N'Bag. Audit Internal', 15, N'Departemen Audit Internal', N'Manager Audit Internal', N'Fungsi Kepala Bagian riil - judul SK: Staf Muda (Revisi 2).')
    ) AS v(nama_jabatan, jg, nama_unit, nama_atasan, alasan)
    JOIN grading.unit_organisasi u ON u.nama = v.nama_unit
    JOIN grading.jabatan a ON a.nama_jabatan = v.nama_atasan AND a.id_band = 2;

    PRINT 'grading.jabatan (Band 3): 22 baris disisipkan.';
END
ELSE PRINT 'LEWATI: jabatan Band 3 sudah terisi.';
GO

SET NOEXEC OFF;
GO
