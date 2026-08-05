/* ============================================================================
   PROD-MIGRASI.SQL  -  Bundel migrasi PRODUKSI db_mygcs (satu berkas, aman).
   ----------------------------------------------------------------------------
   Menerapkan seluruh objek skema modul yang ditambahkan di sesi ini. AMAN:
   setiap blok NON-DESTRUKTIF & idempoten (IF ... IS NULL CREATE / ALTER ADD),
   dijaga agar hanya jalan di db_mygcs, dan TIDAK men-drop tabel apa pun.
   Boleh dijalankan berulang. Versi cuti & approval di sini adalah versi AMAN
   (bukan *-schema.sql asli yang memakai DROP TABLE).

   CATATAN: reset saldo cuti v2 (cuti-v2-reset-saldo.sql) TIDAK termasuk di sini
   karena bersifat sekali-jalan (mengubah data). Jalankan terpisah bila perlu.

   CARA PAKAI (di server DB PRODUKSI):
     sqlcmd -S <server-prod> -U sa -P <password> -d db_mygcs -C -i docs\prod-migrasi.sql
   JANGAN jalankan docs\cuti-schema.sql atau docs\approval-schema.sql di produksi
   (keduanya DROP TABLE -> menghapus data). Cukup berkas ini.
   ============================================================================ */
GO

PRINT '################ [1] CUTI (tabel dasar) ################';
GO
/* ============================================================================
   PATCH PRODUKSI - Cuti My Personal (error 500 "Terjadi kesalahan").
   Penyebab: DB produksi belum punya objek/kolom cuti terbaru (dibuat di dev).

   AMAN & NON-DESTRUKTIF: TIDAK men-drop cuti.saldo / cuti.pengajuan, jadi data
   saldo & pengajuan yang sudah ada TIDAK hilang. Hanya membuat yang belum ada
   dan menambah kolom yang belum ada. Idempoten (boleh dijalankan berulang).

   JANGAN memakai docs\cuti-schema.sql di produksi: skrip itu DROP TABLE saldo &
   pengajuan (menghapus data). Pakai skrip ini.

   CARA PAKAI (di server DB PRODUKSI):
     sqlcmd -S <server-prod> -U sa -P <password> -d db_mygcs -C -i docs\prod-fix-cuti.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: jalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('cuti') IS NULL EXEC('CREATE SCHEMA cuti');
GO

/* 1) cuti.saldo -------------------------------------------------------------
   Bila belum ada, buat lengkap. Bila sudah ada (versi lama), tambah kolom yang
   belum ada saja - data lama tetap. */
IF OBJECT_ID('cuti.saldo', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.saldo (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_saldo PRIMARY KEY,
        id_karyawan     NVARCHAR(50)  NOT NULL,
        nama            NVARCHAR(200) NULL,
        tmt             DATE          NULL,
        periode         NVARCHAR(20)  NOT NULL CONSTRAINT df_saldo_periode DEFAULT '2024-2025',
        hak             INT           NOT NULL CONSTRAINT df_saldo_hak   DEFAULT 0,
        cuti_bersama    INT           NOT NULL CONSTRAINT df_saldo_cb    DEFAULT 0,
        diambil         INT           NOT NULL CONSTRAINT df_saldo_amb   DEFAULT 0,
        saldo           INT           NOT NULL CONSTRAINT df_saldo_sisa  DEFAULT 0,
        tgl_cutoff      DATE          NULL,
        dibuat_pada     DATETIME2     NOT NULL CONSTRAINT df_saldo_dibuat DEFAULT SYSUTCDATETIME(),
        diperbarui_pada DATETIME2     NOT NULL CONSTRAINT df_saldo_ubah   DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uq_cuti_saldo_karyawan UNIQUE (id_karyawan)
    );
    PRINT 'cuti.saldo dibuat.';
END
ELSE
BEGIN
    IF COL_LENGTH('cuti.saldo','periode')      IS NULL ALTER TABLE cuti.saldo ADD periode      NVARCHAR(20) NOT NULL CONSTRAINT df_saldo_periode DEFAULT '2024-2025';
    IF COL_LENGTH('cuti.saldo','hak')          IS NULL ALTER TABLE cuti.saldo ADD hak          INT NOT NULL CONSTRAINT df_saldo_hak  DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','cuti_bersama') IS NULL ALTER TABLE cuti.saldo ADD cuti_bersama INT NOT NULL CONSTRAINT df_saldo_cb   DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','diambil')      IS NULL ALTER TABLE cuti.saldo ADD diambil      INT NOT NULL CONSTRAINT df_saldo_amb  DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','saldo')        IS NULL ALTER TABLE cuti.saldo ADD saldo        INT NOT NULL CONSTRAINT df_saldo_sisa DEFAULT 0;
    IF COL_LENGTH('cuti.saldo','tmt')          IS NULL ALTER TABLE cuti.saldo ADD tmt          DATE NULL;
    IF COL_LENGTH('cuti.saldo','nama')         IS NULL ALTER TABLE cuti.saldo ADD nama         NVARCHAR(200) NULL;
    IF COL_LENGTH('cuti.saldo','tgl_cutoff')   IS NULL ALTER TABLE cuti.saldo ADD tgl_cutoff   DATE NULL;
    IF COL_LENGTH('cuti.saldo','dibuat_pada')  IS NULL ALTER TABLE cuti.saldo ADD dibuat_pada  DATETIME2 NOT NULL CONSTRAINT df_saldo_dibuat DEFAULT SYSUTCDATETIME();
    IF COL_LENGTH('cuti.saldo','diperbarui_pada') IS NULL ALTER TABLE cuti.saldo ADD diperbarui_pada DATETIME2 NOT NULL CONSTRAINT df_saldo_ubah DEFAULT SYSUTCDATETIME();
    PRINT 'cuti.saldo diperiksa/ditambal (kolom yang belum ada ditambahkan).';
END
GO

/* 2) cuti.pengajuan --------------------------------------------------------- */
IF OBJECT_ID('cuti.pengajuan', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.pengajuan (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_peng PRIMARY KEY,
        id_karyawan   NVARCHAR(50)  NOT NULL,
        nama          NVARCHAR(200) NULL,
        id_atasan     NVARCHAR(50)  NULL,
        tgl_mulai     DATE          NOT NULL,
        tgl_selesai   DATE          NOT NULL,
        jumlah_hari   INT           NOT NULL,
        keterangan    NVARCHAR(500) NULL,
        status        NVARCHAR(20)  NOT NULL CONSTRAINT df_peng_status DEFAULT 'Menunggu',
        komentar      NVARCHAR(500) NULL,
        tgl_pengajuan DATETIME2     NOT NULL CONSTRAINT df_peng_tgl DEFAULT SYSUTCDATETIME(),
        tgl_keputusan DATETIME2     NULL,
        CONSTRAINT ck_peng_status CHECK (status IN ('Menunggu','Disetujui','Ditolak','Batal'))
    );
    PRINT 'cuti.pengajuan dibuat.';
END
ELSE PRINT 'cuti.pengajuan sudah ada (dilewati).';
GO

/* 3) cuti.setelan (penyebab paling mungkin dari 500) ------------------------ */
IF OBJECT_ID('cuti.setelan', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.setelan (
        id              TINYINT NOT NULL CONSTRAINT pk_cuti_setelan PRIMARY KEY,
        hak_dasar       INT NOT NULL CONSTRAINT df_cuti_setelan_hak DEFAULT (24),
        cuti_bersama    INT NOT NULL CONSTRAINT df_cuti_setelan_cb  DEFAULT (0),
        diperbarui_pada DATETIME2 NULL,
        diperbarui_oleh NVARCHAR(150) NULL,
        CONSTRAINT ck_cuti_setelan_single CHECK (id = 1)
    );
    INSERT INTO cuti.setelan (id, hak_dasar, cuti_bersama) VALUES (1, 24, 0);
    PRINT 'cuti.setelan dibuat + baris id=1 diisi.';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cuti.setelan WHERE id = 1)
        INSERT INTO cuti.setelan (id, hak_dasar, cuti_bersama) VALUES (1, 24, 0);
    PRINT 'cuti.setelan sudah ada (baris id=1 dipastikan ada).';
END
GO

PRINT '=== SELESAI. Muat ulang halaman Cuti. ===';
GO

SET NOEXEC OFF;
GO

PRINT '################ [1b] CUTI v2 (akrual + cuti bersama/nasional) ################';
GO
/* ============================================================================
   cuti v2 - aturan akrual & cuti bersama/nasional (schema cuti, db_mygcs).
   Perubahan aturan (permintaan atasan SDM):
   - Akrual 12 hari/tahun DI MUKA; saldo awal tahun = min(batas_akumulasi, sisa + 12).
   - batas_akumulasi = 24 (maks 2 tahun).
   - Cuti Bersama = CRUD (rentang tanggal + keterangan + flag mengurangi_hak).
     Yang 'mengurangi hak' memotong saldo SEMUA karyawan sebanyak jumlah harinya.
   - Cuti Nasional = CRUD (rentang tanggal + keterangan), TIDAK pernah memotong hak.

   SQL Server 2014. NON-DESTRUKTIF & idempoten (reset saldo dilakukan terpisah
   di cuti-v2-reset-saldo.sql, sekali jalan). Tidak menyentuh SDM.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: jalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('cuti') IS NULL EXEC('CREATE SCHEMA cuti');
GO

/* setelan: parameter akrual & batas ---------------------------------------- */
IF COL_LENGTH('cuti.setelan', 'hak_per_tahun') IS NULL
    ALTER TABLE cuti.setelan ADD hak_per_tahun INT NOT NULL CONSTRAINT df_cuti_setelan_hpt DEFAULT (12);
GO
IF COL_LENGTH('cuti.setelan', 'batas_akumulasi') IS NULL
    ALTER TABLE cuti.setelan ADD batas_akumulasi INT NOT NULL CONSTRAINT df_cuti_setelan_batas DEFAULT (24);
GO
-- pastikan baris id=1 ada & nilai default terisi
IF EXISTS (SELECT 1 FROM cuti.setelan WHERE id = 1)
    UPDATE cuti.setelan SET hak_per_tahun = ISNULL(NULLIF(hak_per_tahun,0),12),
                            batas_akumulasi = ISNULL(NULLIF(batas_akumulasi,0),24)
    WHERE id = 1;
ELSE
    INSERT INTO cuti.setelan (id, hak_dasar, cuti_bersama, hak_per_tahun, batas_akumulasi)
    VALUES (1, 24, 0, 12, 24);
GO

/* saldo: kolom akrual (basis sebelum dikurangi cuti bersama) ---------------- */
IF COL_LENGTH('cuti.saldo', 'akrual') IS NULL
    ALTER TABLE cuti.saldo ADD akrual INT NOT NULL CONSTRAINT df_cuti_saldo_akrual DEFAULT (0);
GO

/* cuti_bersama - CRUD Admin SDM. mengurangi_hak=1 memotong saldo semua ------ */
IF OBJECT_ID('cuti.cuti_bersama', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.cuti_bersama
    (
        id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_bersama PRIMARY KEY,
        tgl_mulai      DATE NOT NULL,
        tgl_selesai    DATE NOT NULL,
        jumlah_hari    INT NOT NULL,                 -- hari kerja (Sen-Jum) dalam rentang
        keterangan     NVARCHAR(200) NOT NULL,
        mengurangi_hak BIT NOT NULL CONSTRAINT df_cutiber_kurang DEFAULT (0),
        tahun          INT NOT NULL,                 -- tahun (dari tgl_mulai) utk periode
        id_pembuat     NVARCHAR(50)  NULL,
        nama_pembuat   NVARCHAR(150) NULL,
        dibuat_pada    DATETIME2 NOT NULL CONSTRAINT df_cutiber_dibuat DEFAULT (SYSUTCDATETIME()),
        diubah_pada    DATETIME2 NULL
    );
    CREATE INDEX ix_cuti_bersama_tahun ON cuti.cuti_bersama (tahun);
    PRINT 'Tabel cuti.cuti_bersama dibuat.';
END
ELSE PRINT 'LEWATI: cuti.cuti_bersama sudah ada.';
GO

/* cuti_nasional - CRUD Admin SDM. TIDAK pernah memotong hak ----------------- */
IF OBJECT_ID('cuti.cuti_nasional', 'U') IS NULL
BEGIN
    CREATE TABLE cuti.cuti_nasional
    (
        id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_nasional PRIMARY KEY,
        tgl_mulai    DATE NOT NULL,
        tgl_selesai  DATE NOT NULL,
        jumlah_hari  INT NOT NULL,
        keterangan   NVARCHAR(200) NOT NULL,
        tahun        INT NOT NULL,
        id_pembuat   NVARCHAR(50)  NULL,
        nama_pembuat NVARCHAR(150) NULL,
        dibuat_pada  DATETIME2 NOT NULL CONSTRAINT df_cutinas_dibuat DEFAULT (SYSUTCDATETIME()),
        diubah_pada  DATETIME2 NULL
    );
    CREATE INDEX ix_cuti_nasional_tahun ON cuti.cuti_nasional (tahun);
    PRINT 'Tabel cuti.cuti_nasional dibuat.';
END
ELSE PRINT 'LEWATI: cuti.cuti_nasional sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [2] APPROVAL ################';
GO
/* ============================================================================
   PATCH PRODUKSI - Layer persetujuan terpadu (schema approval).
   Versi AMAN dari approval-schema.sql: TIDAK men-drop approval.pengajuan, jadi
   data persetujuan yang sudah ada TIDAK hilang. Idempoten.
   (approval-schema.sql asli memakai DROP TABLE - JANGAN dipakai di produksi.)
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: jalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('approval') IS NULL EXEC('CREATE SCHEMA approval');
GO

IF OBJECT_ID('approval.pengajuan', 'U') IS NULL
BEGIN
    CREATE TABLE approval.pengajuan (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_appr PRIMARY KEY,
        jenis         NVARCHAR(20)  NOT NULL,
        ref_id        NVARCHAR(50)  NOT NULL,
        id_karyawan   NVARCHAR(50)  NOT NULL,
        nama          NVARCHAR(200) NULL,
        id_manager    NVARCHAR(50)  NULL,
        ringkasan     NVARCHAR(500) NULL,
        status        NVARCHAR(20)  NOT NULL CONSTRAINT df_appr_status DEFAULT 'Menunggu',
        komentar      NVARCHAR(500) NULL,
        tgl_pengajuan DATETIME2     NOT NULL CONSTRAINT df_appr_tgl DEFAULT SYSUTCDATETIME(),
        tgl_keputusan DATETIME2     NULL,
        CONSTRAINT ck_appr_status CHECK (status IN ('Menunggu','Disetujui','Ditolak','Batal')),
        CONSTRAINT uq_appr_ref UNIQUE (jenis, ref_id)
    );
    CREATE INDEX ix_appr_manager ON approval.pengajuan (id_manager, status);
    PRINT 'approval.pengajuan dibuat.';
END
ELSE PRINT 'LEWATI: approval.pengajuan sudah ada (data dipertahankan).';
GO

SET NOEXEC OFF;
GO

PRINT '################ [3] GAJI ################';
GO
/* ============================================================================
   gaji - skema Slip Gaji MyGCS (di db_mygcs). Layer PARALEL: tidak menyentuh
   tabel/status SDM sama sekali. Nominal ditentukan oleh JG (Job Grade) & PG
   (Person Grade) dari schema grading; PG naik per periode (tahunan) dan JG naik
   mengikuti jabatan -> keduanya menaikkan gaji. Tarif per (komponen, JG, PG,
   tahun) disimpan di gaji.tarif dan SENGAJA dibiarkan kosong dulu (dikonfigurasi
   admin modul SDM belakangan).

   Komponen mengikuti "komponen_gaji.xlsx":
     Pendapatan : Gaji Pokok; Tunjangan Tetap (Jabatan, Perumahan);
                  Tunjangan Tidak Tetap (Angkutan, Pangan, Lembur, Uang Makan
                                         Dinas, RIT);
                  Tunjangan Lain (BPJS Kesehatan, BPJS Ketenagakerjaan, Pajak, Shift,
                                  Luar Daerah) *opsional
     Potongan Tetap      : BPJS Kes, BPJS TK, Premi Asuransi, Pajak, Iuran IKGCS,
                           Simpanan Wajib K3PG, Simpanan Wajib KKCS, DPLK, PIKGCS
     Potongan Tidak Tetap: Potongan Presensi, K3PG, KKCS, BMT, Angsuran, KSPPS K3PG
   Potongan Presensi kini komponen BERDIRI SENDIRI (bukan lagi memotong Tunjangan
   Pangan/Angkutan). Kolom kena_potongan_terlambat tidak lagi dipakai (semua 0).

   SQL Server 2014 (compat 120): tanpa CREATE OR ALTER / DROP IF EXISTS / AT TIME
   ZONE. NON-DESTRUKTIF (pola IF OBJECT_ID ... IS NULL CREATE) supaya tarif/slip
   yang sudah terisi tidak terhapus saat skrip dijalankan ulang. Idempoten.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\gaji-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('gaji') IS NULL
    EXEC('CREATE SCHEMA gaji AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   komponen - master komponen gaji & potongan
   --------------------------------------------------------------------------- */
IF OBJECT_ID('gaji.komponen', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.komponen
    (
        id_komponen             INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gaji_komponen PRIMARY KEY,
        kode                    NVARCHAR(30)  NOT NULL,
        nama                    NVARCHAR(100) NOT NULL,
        tipe                    NVARCHAR(15)  NOT NULL,   -- Pendapatan | Potongan
        kategori                NVARCHAR(40)  NOT NULL,   -- Gaji Pokok / Tunjangan Tetap / Tunjangan Tidak Tetap / Tunjangan Lain / Potongan Tetap / Potongan Tidak Tetap
        basis                   NVARCHAR(20)  NOT NULL,   -- JG_PG (tarif dari matriks JG/PG) | Karyawan_Periode (input manual per orang/periode)
        opsional                BIT NOT NULL CONSTRAINT df_gaji_komponen_opsional DEFAULT (0),  -- 1 = tidak semua pegawai menerima
        kena_potongan_terlambat BIT NOT NULL CONSTRAINT df_gaji_komponen_terlambat DEFAULT (0), -- 1 = dipotong keterlambatan presensi
        urutan                  INT NOT NULL CONSTRAINT df_gaji_komponen_urutan DEFAULT (0),
        aktif                   BIT NOT NULL CONSTRAINT df_gaji_komponen_aktif DEFAULT (1),
        keterangan              NVARCHAR(200) NULL,
        CONSTRAINT uq_gaji_komponen_kode UNIQUE (kode),
        CONSTRAINT ck_gaji_komponen_tipe  CHECK (tipe  IN ('Pendapatan','Potongan')),
        CONSTRAINT ck_gaji_komponen_basis CHECK (basis IN ('JG_PG','Karyawan_Periode'))
    );
    PRINT 'Tabel gaji.komponen dibuat.';
END
ELSE PRINT 'LEWATI: gaji.komponen sudah ada.';
GO

/* ---------------------------------------------------------------------------
   tarif - nominal komponen basis JG_PG, per (JG, PG, tahun). KOSONG dulu.
   PG naik tahunan & JG naik dgn jabatan -> naik ke sel tarif yang lebih tinggi.
   tahun_berlaku memungkinkan skala tarif direvisi tiap tahun.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('gaji.tarif', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.tarif
    (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gaji_tarif PRIMARY KEY,
        id_komponen   INT      NOT NULL,
        jg            TINYINT  NOT NULL,
        pg            TINYINT  NOT NULL,
        tahun_berlaku SMALLINT NOT NULL,
        nominal       DECIMAL(18,2) NOT NULL CONSTRAINT df_gaji_tarif_nominal DEFAULT (0),
        CONSTRAINT fk_gaji_tarif_komponen FOREIGN KEY (id_komponen) REFERENCES gaji.komponen (id_komponen),
        CONSTRAINT uq_gaji_tarif UNIQUE (id_komponen, jg, pg, tahun_berlaku)
    );
    PRINT 'Tabel gaji.tarif dibuat.';
END
ELSE PRINT 'LEWATI: gaji.tarif sudah ada.';
GO

/* ---------------------------------------------------------------------------
   periode - bulan gaji
   --------------------------------------------------------------------------- */
IF OBJECT_ID('gaji.periode', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.periode
    (
        id_periode   INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gaji_periode PRIMARY KEY,
        tahun        SMALLINT NOT NULL,
        bulan        TINYINT  NOT NULL,
        status       NVARCHAR(15) NOT NULL CONSTRAINT df_gaji_periode_status DEFAULT ('Draft'),
        dibuat_pada  DATETIME2 NOT NULL CONSTRAINT df_gaji_periode_dibuat DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT uq_gaji_periode UNIQUE (tahun, bulan),
        CONSTRAINT ck_gaji_periode_bulan  CHECK (bulan BETWEEN 1 AND 12),
        CONSTRAINT ck_gaji_periode_status CHECK (status IN ('Draft','Final'))
    );
    PRINT 'Tabel gaji.periode dibuat.';
END
ELSE PRINT 'LEWATI: gaji.periode sudah ada.';
GO

/* ---------------------------------------------------------------------------
   slip - header slip gaji per pegawai per periode. JG/PG/band/jabatan disnapshot
   supaya slip historis tetap konsisten meski grading berubah.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('gaji.slip', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.slip
    (
        id_slip             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gaji_slip PRIMARY KEY,
        id_periode          INT NOT NULL,
        id_karyawan         NVARCHAR(20)  NOT NULL,   -- = GCS.dbo.MST_PEGAWAI.ID_KARYAWAN (lintas-DB, tanpa FK)
        nama                NVARCHAR(150) NOT NULL,
        jg                  TINYINT NULL,
        pg                  TINYINT NULL,
        id_band             TINYINT NULL,
        tingkatan           NVARCHAR(50)  NULL,
        jabatan             NVARCHAR(150) NULL,
        potongan_terlambat  DECIMAL(18,2) NOT NULL CONSTRAINT df_gaji_slip_terlambat DEFAULT (0),
        status              NVARCHAR(15)  NOT NULL CONSTRAINT df_gaji_slip_status DEFAULT ('Draft'),
        dibuat_pada         DATETIME2 NOT NULL CONSTRAINT df_gaji_slip_dibuat DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_gaji_slip_periode FOREIGN KEY (id_periode) REFERENCES gaji.periode (id_periode),
        CONSTRAINT uq_gaji_slip UNIQUE (id_periode, id_karyawan),
        CONSTRAINT ck_gaji_slip_status CHECK (status IN ('Draft','Final'))
    );
    CREATE INDEX ix_gaji_slip_karyawan ON gaji.slip (id_karyawan);
    PRINT 'Tabel gaji.slip dibuat.';
END
ELSE PRINT 'LEWATI: gaji.slip sudah ada.';
GO

/* ---------------------------------------------------------------------------
   slip_detail - baris nominal per komponen pada sebuah slip
   --------------------------------------------------------------------------- */
IF OBJECT_ID('gaji.slip_detail', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.slip_detail
    (
        id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gaji_slip_detail PRIMARY KEY,
        id_slip      BIGINT NOT NULL,
        id_komponen  INT NOT NULL,
        nominal      DECIMAL(18,2) NOT NULL CONSTRAINT df_gaji_slip_detail_nominal DEFAULT (0),
        CONSTRAINT fk_gaji_slip_detail_slip     FOREIGN KEY (id_slip)     REFERENCES gaji.slip (id_slip),
        CONSTRAINT fk_gaji_slip_detail_komponen FOREIGN KEY (id_komponen) REFERENCES gaji.komponen (id_komponen),
        CONSTRAINT uq_gaji_slip_detail UNIQUE (id_slip, id_komponen)
    );
    PRINT 'Tabel gaji.slip_detail dibuat.';
END
ELSE PRINT 'LEWATI: gaji.slip_detail sudah ada.';
GO

/* ---------------------------------------------------------------------------
   SEED komponen (idempoten). Nominal tidak diseed - itu urusan gaji.tarif.
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM gaji.komponen)
BEGIN
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan) VALUES
    -- Pendapatan
    ('GAPOK',        N'Gaji Pokok',                'Pendapatan', N'Gaji Pokok',            'JG_PG',            0, 0, 10, N'Sesuai JG & PG'),
    ('TJ_JABATAN',   N'Tunjangan Jabatan',         'Pendapatan', N'Tunjangan Tetap',      'JG_PG',            0, 0, 20, N'Sesuai jabatan (JG & PG)'),
    ('TJ_PERUMAHAN', N'Tunjangan Perumahan',       'Pendapatan', N'Tunjangan Tetap',      'JG_PG',            0, 0, 21, N'Sesuai jabatan (JG & PG)'),
    ('TJ_ANGKUTAN',  N'Tunjangan Angkutan',        'Pendapatan', N'Tunjangan Tidak Tetap','JG_PG',            0, 0, 30, N'Tunjangan tidak tetap'),
    ('TJ_PANGAN',    N'Tunjangan Pangan',          'Pendapatan', N'Tunjangan Tidak Tetap','JG_PG',            0, 0, 31, N'Tunjangan tidak tetap'),
    ('LEMBUR',       N'Lembur',                    'Pendapatan', N'Tunjangan Tidak Tetap','Karyawan_Periode', 1, 0, 32, N'Upah lembur; sesuai jam lembur per periode'),
    ('MAKAN_DINAS',  N'Uang Makan Dinas',          'Pendapatan', N'Tunjangan Tidak Tetap','Karyawan_Periode', 1, 0, 33, N'Uang makan saat dinas; per karyawan & periode'),
    ('RIT',          N'RIT',                       'Pendapatan', N'Tunjangan Tidak Tetap','Karyawan_Periode', 1, 0, 34, N'Uang rit/ritase; per karyawan & periode'),
    ('TJ_BPJS_KES',  N'Tunjangan BPJS Kesehatan',       'Pendapatan', N'Tunjangan Lain',  'JG_PG',            1, 0, 40, N'Hanya sebagian karyawan'),
    ('TJ_BPJS_TK',   N'Tunjangan BPJS Ketenagakerjaan', 'Pendapatan', N'Tunjangan Lain',  'JG_PG',            1, 0, 41, N'Hanya sebagian karyawan'),
    ('TJ_PAJAK',     N'Tunjangan Pajak',           'Pendapatan', N'Tunjangan Lain',       'JG_PG',            1, 0, 42, N'Hanya sebagian karyawan'),
    ('TJ_SHIFT',     N'Tunjangan Shift',           'Pendapatan', N'Tunjangan Lain',       'JG_PG',            1, 0, 43, N'Hanya security'),
    ('TJ_LUAR',      N'Tunjangan Luar Daerah',     'Pendapatan', N'Tunjangan Lain',       'Karyawan_Periode', 1, 0, 44, N'Sesuai karyawan & perjanjian'),
    -- Potongan Tetap
    ('POT_BPJS_KES', N'BPJS Kesehatan',            'Potongan',   N'Potongan Tetap',       'JG_PG',            0, 0, 50, N'Sesuai jabatan'),
    ('POT_BPJS_TK',  N'BPJS Ketenagakerjaan',      'Potongan',   N'Potongan Tetap',       'JG_PG',            0, 0, 51, N'Sesuai jabatan'),
    ('POT_PREMI',    N'Premi Asuransi',            'Potongan',   N'Potongan Tetap',       'JG_PG',            0, 0, 52, N'Sesuai jabatan'),
    ('POT_PAJAK',    N'Pajak',                     'Potongan',   N'Potongan Tetap',       'JG_PG',            0, 0, 53, N'Sesuai jabatan'),
    ('POT_IKGCS',    N'Iuran IKGCS',               'Potongan',   N'Potongan Tetap',       'Karyawan_Periode', 0, 0, 54, N'Sesuai karyawan & periode'),
    ('POT_SW_K3PG',  N'Simpanan Wajib K3PG',       'Potongan',   N'Potongan Tetap',       'Karyawan_Periode', 0, 0, 55, N'Sesuai karyawan & periode'),
    ('POT_SW_KKCS',  N'Simpanan Wajib KKCS',       'Potongan',   N'Potongan Tetap',       'Karyawan_Periode', 0, 0, 56, N'Sesuai karyawan & periode'),
    ('POT_DPLK',     N'DPLK',                      'Potongan',   N'Potongan Tetap',       'JG_PG',            0, 0, 57, N'Sesuai jabatan'),
    ('POT_PIKGCS',   N'PIKGCS',                    'Potongan',   N'Potongan Tetap',       'Karyawan_Periode', 0, 0, 58, N'Sesuai karyawan & periode'),
    -- Potongan Tidak Tetap
    ('POT_PRESENSI', N'Potongan Presensi',         'Potongan',   N'Potongan Tidak Tetap', 'Karyawan_Periode', 0, 0, 59, N'Potongan keterlambatan/kehadiran presensi (berdiri sendiri)'),
    ('POT_K3PG',     N'K3PG',                      'Potongan',   N'Potongan Tidak Tetap', 'Karyawan_Periode', 0, 0, 60, N'Sesuai karyawan & periode'),
    ('POT_KKCS',     N'KKCS',                      'Potongan',   N'Potongan Tidak Tetap', 'Karyawan_Periode', 0, 0, 61, N'Sesuai karyawan & periode'),
    ('POT_BMT',      N'BMT',                       'Potongan',   N'Potongan Tidak Tetap', 'Karyawan_Periode', 0, 0, 62, N'Sesuai karyawan & periode'),
    ('POT_ANGSURAN', N'Angsuran',                  'Potongan',   N'Potongan Tidak Tetap', 'Karyawan_Periode', 0, 0, 63, N'Sesuai karyawan & periode'),
    ('POT_KSPPS',    N'KSPPS K3PG',                'Potongan',   N'Potongan Tidak Tetap', 'Karyawan_Periode', 0, 0, 64, N'Sesuai karyawan & periode');
    PRINT 'gaji.komponen: 28 baris diseed.';
END
ELSE PRINT 'LEWATI: gaji.komponen sudah terisi.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [3b] GAJI KOMPONEN TAMBAHAN (Lembur/Uang Makan Dinas/RIT) ################';
GO
/* ============================================================================
   Tambahan komponen gaji - Tunjangan Tidak Tetap: Lembur, Uang Makan Dinas, RIT.
   Komponen basis Karyawan_Periode (nominal diinput per orang/periode via slip),
   tipe Pendapatan. NON-DESTRUKTIF & idempoten: hanya menambah bila kode belum ada.
   Aman dijalankan berulang. Tidak menyentuh tarif/slip yang sudah terisi.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\gaji-komponen-tambahan.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: jalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('gaji.komponen', 'U') IS NULL
BEGIN
    RAISERROR('gaji.komponen belum ada - jalankan gaji-schema.sql lebih dulu.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Kolom: kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan.
   'LEMBUR' agregat TIDAK disisipkan bila sudah dipecah jadi sub-komponen oleh
   gaji-komponen-v2.sql (ditandai keberadaan 'LEMBUR_BIASA') - mencegah skrip ini
   membangkitkan kembali baris yang sengaja dihapus saat dipecah. */
IF NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'LEMBUR')
   AND NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'LEMBUR_BIASA')
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
    VALUES ('LEMBUR', N'Lembur', 'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 0, 32, N'Upah lembur; sesuai jam lembur per periode');
GO

IF NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'MAKAN_DINAS')
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
    VALUES ('MAKAN_DINAS', N'Uang Makan Dinas', 'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 0, 33, N'Uang makan saat dinas; per karyawan & periode');
GO

IF NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'RIT')
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
    VALUES ('RIT', N'RIT', 'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 0, 34, N'Uang rit/ritase; per karyawan & periode');
GO

PRINT 'Komponen Lembur / Uang Makan Dinas / RIT dipastikan ada di Tunjangan Tidak Tetap.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [3c] GAJI KOMPONEN v2 (BPJS TK 4/2, Lembur 3, +Tunjangan) ################';
GO
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

PRINT '################ [3d] GAJI KOMPONEN GRUP (dropdown Lembur/BPJS TK) ################';
GO
/* ============================================================================
   Pengelompokan tampilan (dropdown/accordion) untuk komponen yang punya
   sub-komponen: Lembur (3), Tunjangan BPJS Ketenagakerjaan (4), Potongan BPJS
   Ketenagakerjaan (2). Kolom baru grup_kode/grup_label di gaji.komponen -
   NULL berarti komponen berdiri sendiri (tampil baris biasa seperti sekarang).
   NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO
IF OBJECT_ID('gaji.komponen','U') IS NULL
BEGIN RAISERROR('gaji.komponen belum ada - jalankan gaji-schema.sql dulu.',16,1); SET NOEXEC ON; END
GO

IF COL_LENGTH('gaji.komponen', 'grup_kode') IS NULL
    ALTER TABLE gaji.komponen ADD grup_kode NVARCHAR(40) NULL;
GO
IF COL_LENGTH('gaji.komponen', 'grup_label') IS NULL
    ALTER TABLE gaji.komponen ADD grup_label NVARCHAR(80) NULL;
GO

UPDATE gaji.komponen SET grup_kode = 'LEMBUR', grup_label = N'Lembur'
    WHERE kode IN ('LEMBUR_BIASA','LEMBUR_CRASH','LEMBUR_PENGGANTI');

UPDATE gaji.komponen SET grup_kode = 'TJ_BPJS_TK', grup_label = N'Tunjangan BPJS Ketenagakerjaan'
    WHERE kode IN ('TJ_BPJS_JHT','TJ_BPJS_JKK','TJ_BPJS_JKM','TJ_BPJS_JP');

UPDATE gaji.komponen SET grup_kode = 'POT_BPJS_TK', grup_label = N'Potongan BPJS Ketenagakerjaan'
    WHERE kode IN ('POT_BPJS_JHT','POT_BPJS_JP');

PRINT 'Pengelompokan dropdown Lembur / BPJS TK (tunjangan & potongan) diterapkan.';
GO
SET NOEXEC OFF;
GO

PRINT '################ [3e] GAJI TARIF TUNGGAL (Pendapatan Dasar per Band/JG/PG) ################';
GO
/* ============================================================================
   Tarif SATU DIMENSI (Band / JG / PG saja) untuk komponen "Pendapatan Dasar":
   - Gaji Pokok          -> per Band  (0=Direksi .. 6=Pelaksana Junior)
   - Tunjangan Jabatan   -> per JG    (7..21)
   - Tunjangan Perumahan -> per PG    (7..21)
   - Tunjangan Pangan    -> per Band
   - Tunjangan Angkutan  -> per Band
   Menggantikan matriks JG x PG (gaji.tarif) UNTUK KELIMA komponen ini saja -
   komponen JG_PG lain (BPJS, DPLK, dst) TIDAK terpengaruh, tetap di gaji.tarif.
   Admin SDM cukup input satu nominal per nilai Band/JG/PG, bukan per sel JG x PG.

   "Band" di sini = grading.band.urutan (identik dgn grading.band.id_band di
   dataset ini - 0..6), sama dgn nilai Band yang sudah tampil di slip gaji.

   NON-DESTRUKTIF & idempoten. gaji.tarif untuk kelima komponen ini kosong saat
   skrip ini ditulis (basis-nya baru dipindah dari JG_PG), jadi aman dibersihkan.
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

/* 1) Tabel tarif satu-dimensi ------------------------------------------------ */
IF OBJECT_ID('gaji.tarif_tunggal', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.tarif_tunggal
    (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gaji_tarif_tunggal PRIMARY KEY,
        id_komponen   INT      NOT NULL,
        nilai         SMALLINT NOT NULL,             -- nilai Band (0-6) / JG / PG tergantung komponen.basis
        tahun_berlaku SMALLINT NOT NULL,
        nominal       DECIMAL(18,2) NOT NULL CONSTRAINT df_gaji_tarif_tunggal_nominal DEFAULT (0),
        CONSTRAINT fk_gaji_tarif_tunggal_komponen FOREIGN KEY (id_komponen) REFERENCES gaji.komponen (id_komponen),
        CONSTRAINT uq_gaji_tarif_tunggal UNIQUE (id_komponen, nilai, tahun_berlaku)
    );
    PRINT 'Tabel gaji.tarif_tunggal dibuat.';
END
ELSE PRINT 'LEWATI: gaji.tarif_tunggal sudah ada.';
GO

/* 2) Perluas CHECK basis. Daftar SELALU superset final (termasuk 'PendapatanDasar'
      dari gaji-formula-bpjs-kes.sql & 'Flat' dari gaji-potongan-flat.sql) supaya
      skrip ini idempoten & aman dijalankan dalam urutan apa pun relatif skrip
      basis lain - tidak pernah menyempitkan constraint di bawah nilai yang
      sudah dipakai data. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_gaji_komponen_basis')
    ALTER TABLE gaji.komponen DROP CONSTRAINT ck_gaji_komponen_basis;
GO
ALTER TABLE gaji.komponen ADD CONSTRAINT ck_gaji_komponen_basis
    CHECK (basis IN ('Karyawan_Periode','JG_PG','Band','JG','PG','PendapatanDasar','Flat'));
GO

/* 3) Pindahkan basis 5 komponen "Pendapatan Dasar" dari JG_PG -> dimensi tunggal */
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'GAPOK';
UPDATE gaji.komponen SET basis = 'JG'   WHERE kode = 'TJ_JABATAN';
UPDATE gaji.komponen SET basis = 'PG'   WHERE kode = 'TJ_PERUMAHAN';
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'TJ_PANGAN';
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'TJ_ANGKUTAN';

/* 4) Bersihkan sisa tarif JG x PG kelima komponen itu (kosong saat ditulis,
      dijaga agar skrip ini aman diulang / dijalankan setelah ada isian salah). */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode IN ('GAPOK','TJ_JABATAN','TJ_PERUMAHAN','TJ_PANGAN','TJ_ANGKUTAN');

PRINT 'Pendapatan Dasar (Gaji Pokok/Tunjangan Jabatan/Perumahan/Pangan/Angkutan) kini bertarif satu dimensi (Band/JG/PG).';
GO
SET NOEXEC OFF;
GO

PRINT '################ [3f] GAJI FORMULA BPJS KESEHATAN (rumus Pendapatan Dasar) ################';
GO
/* ============================================================================
   Tunjangan BPJS Kesehatan (TJ_BPJS_KES) dihitung dari RUMUS, bukan diinput
   manual per JG x PG:
     Pendapatan Dasar = Gaji Pokok + Tj. Jabatan + Tj. Perumahan + Tj. Pangan
                         + Tj. Angkutan (jumlah seluruh komponen basis Band/JG/PG)
     Tunjangan BPJS Kesehatan = persen% x MIN(Pendapatan Dasar, batas_atas)
   Default: persen=4, batas_atas=12.000.000 (aturan BPJS Kesehatan standar).
   Kolom formula_persen/formula_batas di gaji.komponen dibuat GENERIK - basis
   'PendapatanDasar' bisa dipakai komponen lain nanti tanpa migrasi baru.

   NON-DESTRUKTIF & idempoten. gaji.tarif utk TJ_BPJS_KES kosong (basisnya
   pindah dari JG_PG), aman dibersihkan.
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

/* 1) Kolom parameter rumus (generik, dipakai basis 'PendapatanDasar') --------- */
IF COL_LENGTH('gaji.komponen', 'formula_persen') IS NULL
    ALTER TABLE gaji.komponen ADD formula_persen DECIMAL(7,4) NULL;
GO
IF COL_LENGTH('gaji.komponen', 'formula_batas') IS NULL
    ALTER TABLE gaji.komponen ADD formula_batas DECIMAL(18,2) NULL;
GO

/* 2) Perluas CHECK basis. Daftar SELALU superset final (termasuk 'Flat' dari
      gaji-potongan-flat.sql) - lihat catatan idempotensi di gaji-tarif-tunggal-schema.sql. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_gaji_komponen_basis')
    ALTER TABLE gaji.komponen DROP CONSTRAINT ck_gaji_komponen_basis;
GO
ALTER TABLE gaji.komponen ADD CONSTRAINT ck_gaji_komponen_basis
    CHECK (basis IN ('Karyawan_Periode','JG_PG','Band','JG','PG','PendapatanDasar','Flat'));
GO

/* 3) Pindahkan TJ_BPJS_KES ke basis rumus ------------------------------------ */
UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 4, formula_batas = 12000000,
    keterangan = N'4% dari Pendapatan Dasar (Gaji Pokok + Tj. Jabatan + Tj. Perumahan + Tj. Pangan + Tj. Angkutan), maksimum 4% x Rp12.000.000'
WHERE kode = 'TJ_BPJS_KES';

/* 4) Bersihkan sisa tarif JG x PG-nya (kosong saat ditulis) ------------------ */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode = 'TJ_BPJS_KES';

PRINT 'Tunjangan BPJS Kesehatan kini dihitung otomatis dari rumus Pendapatan Dasar.';
GO
SET NOEXEC OFF;
GO

PRINT '################ [3g] GAJI POTONGAN FLAT (DPLK per Band, IKGCS/KKCS/K3PG flat) ################';
GO
/* ============================================================================
   Aturan potongan (2026-08-04):
   - POT_DPLK              -> per Band (mekanisme sama dgn Pendapatan Dasar,
                              tapi ini POTONGAN - lihat catatan penting di bawah).
   - POT_IKGCS, POT_SW_KKCS, POT_SW_K3PG -> 'Flat': SATU nominal, sama untuk
     SEMUA karyawan (bukan per Band/JG/PG, bukan per Karyawan_Periode).
   - K3PG (POT_K3PG), PIKGCS, KSPPS, BMT, Angsuran, RIT: SUDAH 'Karyawan_Periode'
     (manual per orang) sebelum skrip ini - tidak diubah.

   Basis baru 'Flat': nilai tunggal di kolom gaji.komponen.nilai_flat (TIDAK
   per-tahun, TIDAK per Band/JG/PG - satu angka berlaku untuk semua slip sampai
   diubah admin lagi). Sama pola dgn formula_persen/formula_batas (basis
   'PendapatanDasar') yang sudah ada.

   PENTING: POT_DPLK ber-basis 'Band' tapi TIPE-nya 'Potongan'. Perhitungan
   "Pendapatan Dasar" (dasar rumus Tunjangan BPJS Kesehatan) HARUS hanya
   menjumlah komponen TIPE='Pendapatan' - diperbaiki di kode C# (GajiService),
   bukan di skrip ini.

   NON-DESTRUKTIF & idempoten. Keempat komponen kosong di gaji.tarif/slip_detail.
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

/* 1) Kolom nilai flat (generik, dipakai basis 'Flat') ------------------------ */
IF COL_LENGTH('gaji.komponen', 'nilai_flat') IS NULL
    ALTER TABLE gaji.komponen ADD nilai_flat DECIMAL(18,2) NULL;
GO

/* 2) Perluas CHECK basis. SELALU superset final (7 nilai) - lihat catatan di
      gaji-tarif-tunggal-schema.sql & gaji-formula-bpjs-kes.sql: skrip mana pun
      yang drop+recreate constraint ini harus pakai daftar yang SAMA supaya
      idempoten & tak tergantung urutan run relatif skrip basis lain. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_gaji_komponen_basis')
    ALTER TABLE gaji.komponen DROP CONSTRAINT ck_gaji_komponen_basis;
GO
ALTER TABLE gaji.komponen ADD CONSTRAINT ck_gaji_komponen_basis
    CHECK (basis IN ('Karyawan_Periode','JG_PG','Band','JG','PG','PendapatanDasar','Flat'));
GO

/* 3) Pindahkan basis komponen terkait ---------------------------------------- */
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'POT_DPLK';
UPDATE gaji.komponen SET basis = 'Flat' WHERE kode IN ('POT_IKGCS','POT_SW_KKCS','POT_SW_K3PG');

/* 4) Bersihkan sisa tarif/slip_detail lama (kosong saat ditulis) ------------- */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode = 'POT_DPLK';
DELETE d FROM gaji.slip_detail d
    JOIN gaji.komponen k ON k.id_komponen = d.id_komponen
    WHERE k.kode IN ('POT_IKGCS','POT_SW_KKCS','POT_SW_K3PG');

PRINT 'POT_DPLK kini per Band; IKGCS/Simpanan Wajib KKCS/K3PG kini flat (sama semua karyawan).';
GO
SET NOEXEC OFF;
GO

PRINT '################ [3h] GAJI BPJS KETENAGAKERJAAN (JHT/JKK/JKM/JP) FORMULA ################';
GO
/* ============================================================================
   Tunjangan BPJS Ketenagakerjaan (JHT/JKK/JKM/JP) dihitung dari RUMUS, sama
   pola dgn TJ_BPJS_KES di blok [3f], basis 'PendapatanDasar':
     TJ_BPJS_JHT = 3,7%  x Pendapatan Dasar (tanpa batas)
     TJ_BPJS_JKK = 0,24% x Pendapatan Dasar (tanpa batas)
     TJ_BPJS_JKM = 0,3%  x Pendapatan Dasar (tanpa batas)
     TJ_BPJS_JP  = 2%    x MIN(Pendapatan Dasar, Rp11.086.300)

   BEDA dari TJ_BPJS_KES: keempat komponen ini kontribusi PERUSAHAAN ke BPJS
   TK, "dibayarkan" langsung ke BPJS - bukan diterima karyawan. Jadi HARUS
   tetap tampil di slip (informasi), tapi TIDAK menambah Total Pendapatan /
   Gaji Bersih. Kolom baru gaji.komponen.masuk_total (bit, default 1) menandai
   ini; hanya keempat komponen ini yg di-set 0 - semua komponen lain (termasuk
   TJ_BPJS_KES) tetap masuk_total=1 (default), TIDAK berubah perilakunya.

   Potongan BPJS TK sisi karyawan (POT_BPJS_JHT/POT_BPJS_JP) SENGAJA TIDAK
   disentuh blok ini (belum diminta) - tetap basis JG_PG kosong.

   NON-DESTRUKTIF & idempoten. gaji.tarif utk keempat komponen ini kosong
   (basisnya pindah dari JG_PG), aman dibersihkan.
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

/* 1) Kolom flag "masuk ke Total Pendapatan / Gaji Bersih" --------------------- */
IF COL_LENGTH('gaji.komponen', 'masuk_total') IS NULL
    ALTER TABLE gaji.komponen ADD masuk_total BIT NOT NULL CONSTRAINT df_gaji_komponen_masuk_total DEFAULT (1);
GO

/* 2) Pindahkan TJ_BPJS_JHT/JKK/JKM/JP ke basis rumus, kecualikan dari total --- */
UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 3.7, formula_batas = NULL, masuk_total = 0,
    keterangan = N'3,7% dari Pendapatan Dasar - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JHT';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 0.24, formula_batas = NULL, masuk_total = 0,
    keterangan = N'0,24% dari Pendapatan Dasar - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JKK';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 0.3, formula_batas = NULL, masuk_total = 0,
    keterangan = N'0,3% dari Pendapatan Dasar - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JKM';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 2, formula_batas = 11086300, masuk_total = 0,
    keterangan = N'2% dari Pendapatan Dasar, maksimum 2% x Rp11.086.300 - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JP';

/* 3) Bersihkan sisa tarif JG x PG-nya (kosong saat ditulis) ------------------- */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode IN ('TJ_BPJS_JHT','TJ_BPJS_JKK','TJ_BPJS_JKM','TJ_BPJS_JP');

PRINT 'Tunjangan BPJS Ketenagakerjaan (JHT/JKK/JKM/JP) kini dihitung otomatis dari rumus, dikecualikan dari Total Pendapatan/Gaji Bersih.';
GO
SET NOEXEC OFF;
GO

PRINT '################ [3i] GAJI POTONGAN BPJS KETENAGAKERJAAN (JHT/JP) FORMULA ################';
GO
/* ============================================================================
   Potongan BPJS Ketenagakerjaan sisi karyawan (JHT/JP) dihitung dari RUMUS,
   sama pola dgn blok [3f]/[3h], basis 'PendapatanDasar':
     POT_BPJS_JHT = 2% x Pendapatan Dasar (tanpa batas)
     POT_BPJS_JP  = 1% x Pendapatan Dasar (tanpa batas)

   BEDA dari TJ_BPJS_JHT/JKK/JKM/JP di blok [3h] (kontribusi PERUSAHAAN,
   masuk_total=0): ini POTONGAN GAJI KARYAWAN sungguhan (dipotong dari gaji,
   mengurangi Gaji Bersih) - jadi masuk_total TETAP default true (1).

   NON-DESTRUKTIF & idempoten. gaji.tarif utk kedua komponen ini kosong
   (basisnya pindah dari JG_PG), aman dibersihkan.
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

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 2, formula_batas = NULL,
    keterangan = N'2% dari Pendapatan Dasar - potongan gaji karyawan (iuran BPJS TK)'
WHERE kode = 'POT_BPJS_JHT';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 1, formula_batas = NULL,
    keterangan = N'1% dari Pendapatan Dasar - potongan gaji karyawan (iuran BPJS TK)'
WHERE kode = 'POT_BPJS_JP';

DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode IN ('POT_BPJS_JHT','POT_BPJS_JP');

PRINT 'Potongan BPJS Ketenagakerjaan (JHT/JP) kini dihitung otomatis dari rumus Pendapatan Dasar.';
GO
SET NOEXEC OFF;
GO

PRINT '################ [4] KPI (My Progress) ################';
GO
/* ============================================================================
   kpi - skema My Progress (KPI) MyGCS, di db_mygcs. Layer paralel; tidak
   menyentuh tabel/status SDM. Hirarki atasan-bawahan dibaca dari schema grading
   (grading.jabatan_hirarki) tanpa FK lintas-skema.

   Model:
   - KPI level 'Perusahaan' (top-level): id_pemilik NULL, dikelola Admin Modul SDM.
   - KPI level 'Individu'   : id_pemilik = NIK karyawan, diberikan/diturunkan oleh
                              atasan (jenjang mana pun di atasnya). Realisasi
                              dinilai oleh atasan; bawahan hanya melihat.
   - id_parent (opsional): kaitan cascade ke KPI induk (perusahaan/atasan).

   SQL Server 2014 (compat 120): tanpa CREATE OR ALTER / DROP IF EXISTS / AT TIME
   ZONE. NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE) agar data tidak hilang
   saat dijalankan ulang. Idempoten.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\kpi-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('kpi') IS NULL
    EXEC('CREATE SCHEMA kpi AUTHORIZATION dbo');
GO

IF OBJECT_ID('kpi.kpi', 'U') IS NULL
BEGIN
    CREATE TABLE kpi.kpi
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_kpi PRIMARY KEY,
        periode       NVARCHAR(20)  NOT NULL,                 -- mis. "2026" / "2026-Q3"
        judul         NVARCHAR(200) NOT NULL,
        deskripsi     NVARCHAR(500) NULL,
        satuan        NVARCHAR(30)  NULL,                     -- %, Rp, unit, hari, dsb
        target        DECIMAL(18,2) NOT NULL CONSTRAINT df_kpi_target DEFAULT (0),
        realisasi     DECIMAL(18,2) NOT NULL CONSTRAINT df_kpi_realisasi DEFAULT (0),
        bobot         DECIMAL(5,2)  NULL,                     -- bobot % (opsional)
        level         NVARCHAR(20)  NOT NULL,                 -- Perusahaan | Individu
        id_pemilik    NVARCHAR(20)  NULL,                     -- NIK (NULL utk Perusahaan)
        nama_pemilik  NVARCHAR(150) NULL,
        id_parent     BIGINT        NULL,                     -- cascade ke KPI induk (opsional)
        id_pembuat    NVARCHAR(20)  NOT NULL,                 -- NIK pembuat
        nama_pembuat  NVARCHAR(150) NULL,
        status        NVARCHAR(20)  NOT NULL CONSTRAINT df_kpi_status DEFAULT ('Berjalan'),
        catatan       NVARCHAR(500) NULL,                     -- catatan penilaian
        tgl_dibuat    DATETIME2     NOT NULL CONSTRAINT df_kpi_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah    DATETIME2     NULL,
        CONSTRAINT ck_kpi_level  CHECK (level  IN ('Perusahaan','Individu')),
        CONSTRAINT ck_kpi_status CHECK (status IN ('Berjalan','Tercapai','Tidak Tercapai','Dibatalkan')),
        CONSTRAINT ck_kpi_pemilik CHECK ((level = 'Perusahaan' AND id_pemilik IS NULL) OR (level = 'Individu' AND id_pemilik IS NOT NULL)),
        CONSTRAINT fk_kpi_parent FOREIGN KEY (id_parent) REFERENCES kpi.kpi (id)
    );
    CREATE INDEX ix_kpi_pemilik ON kpi.kpi (id_pemilik);
    CREATE INDEX ix_kpi_level   ON kpi.kpi (level);
    CREATE INDEX ix_kpi_periode ON kpi.kpi (periode);
    PRINT 'Tabel kpi.kpi dibuat.';
END
ELSE PRINT 'LEWATI: kpi.kpi sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [5] ASET (My Asset) ################';
GO
/* ============================================================================
   aset - skema My Asset MyGCS, di db_mygcs. Layer paralel; tidak menyentuh SDM.
   Tahap inisiasi: Inventaris aset (inti) + Jadwal maintenance. Peminjaman & QR
   menyusul. Pengelola = "Admin Aset" (jajaran Departemen Kepatuhan Kabag ke atas
   s/d GM SKP) - lihat ModuleAccessService.IsAsetAdminAsync.

   SQL Server 2014 (compat 120): tanpa CREATE OR ALTER / DROP IF EXISTS.
   NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE). Idempoten.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\aset-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('aset') IS NULL
    EXEC('CREATE SCHEMA aset AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   aset - master inventaris aset
   --------------------------------------------------------------------------- */
IF OBJECT_ID('aset.aset', 'U') IS NULL
BEGIN
    CREATE TABLE aset.aset
    (
        id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_aset PRIMARY KEY,
        kode           NVARCHAR(40)  NOT NULL,                 -- tag/kode aset (utk QR nanti)
        nama           NVARCHAR(200) NOT NULL,
        kategori       NVARCHAR(60)  NULL,                     -- Elektronik/Kendaraan/Furnitur/...
        merk           NVARCHAR(100) NULL,
        nomor_seri     NVARCHAR(100) NULL,
        lokasi         NVARCHAR(150) NULL,
        id_pic         NVARCHAR(20)  NULL,                     -- penanggung jawab (NIK), lintas-DB tanpa FK
        nama_pic       NVARCHAR(150) NULL,
        kondisi        NVARCHAR(20)  NOT NULL CONSTRAINT df_aset_kondisi DEFAULT ('Baik'),
        status         NVARCHAR(20)  NOT NULL CONSTRAINT df_aset_status DEFAULT ('Aktif'),
        nilai          DECIMAL(18,2) NULL,                     -- nilai/harga perolehan
        tgl_perolehan  DATE NULL,
        catatan        NVARCHAR(500) NULL,
        id_pembuat     NVARCHAR(20)  NOT NULL,
        tgl_dibuat     DATETIME2 NOT NULL CONSTRAINT df_aset_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah     DATETIME2 NULL,
        CONSTRAINT uq_aset_kode UNIQUE (kode),
        CONSTRAINT ck_aset_kondisi CHECK (kondisi IN ('Baik','Rusak Ringan','Rusak Berat','Hilang')),
        CONSTRAINT ck_aset_status  CHECK (status  IN ('Aktif','Dipinjam','Perbaikan','Dihapus'))
    );
    CREATE INDEX ix_aset_kategori ON aset.aset (kategori);
    CREATE INDEX ix_aset_pic ON aset.aset (id_pic);
    PRINT 'Tabel aset.aset dibuat.';
END
ELSE PRINT 'LEWATI: aset.aset sudah ada.';
GO

/* ---------------------------------------------------------------------------
   maintenance - jadwal & riwayat pemeliharaan aset
   --------------------------------------------------------------------------- */
IF OBJECT_ID('aset.maintenance', 'U') IS NULL
BEGIN
    CREATE TABLE aset.maintenance
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_aset_maintenance PRIMARY KEY,
        id_aset     BIGINT NOT NULL,
        jenis       NVARCHAR(30)  NOT NULL CONSTRAINT df_maint_jenis DEFAULT ('Rutin'),   -- Rutin/Perbaikan/Inspeksi
        tgl_jadwal  DATE NOT NULL,
        tgl_selesai DATE NULL,
        status      NVARCHAR(20)  NOT NULL CONSTRAINT df_maint_status DEFAULT ('Terjadwal'),
        pelaksana   NVARCHAR(150) NULL,                        -- teknisi/vendor
        biaya       DECIMAL(18,2) NULL,
        catatan     NVARCHAR(500) NULL,
        id_pembuat  NVARCHAR(20)  NOT NULL,
        tgl_dibuat  DATETIME2 NOT NULL CONSTRAINT df_maint_dibuat DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_maint_aset FOREIGN KEY (id_aset) REFERENCES aset.aset (id),
        CONSTRAINT ck_maint_jenis  CHECK (jenis  IN ('Rutin','Perbaikan','Inspeksi')),
        CONSTRAINT ck_maint_status CHECK (status IN ('Terjadwal','Selesai','Batal'))
    );
    CREATE INDEX ix_maint_aset ON aset.maintenance (id_aset);
    CREATE INDEX ix_maint_jadwal ON aset.maintenance (tgl_jadwal);
    PRINT 'Tabel aset.maintenance dibuat.';
END
ELSE PRINT 'LEWATI: aset.maintenance sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [6] COACHING ################';
GO
/* ============================================================================
   coaching - fitur Coaching & Diskusi Tim (My Team), di db_mygcs. Layer paralel;
   tidak menyentuh SDM. Hirarki atasan-bawahan dibaca dari grading. Percakapan
   ASINKRON berbasis thread (bukan real-time).

   Dua bentuk percakapan:
   - SESI 1-on-1 (privat 2 orang di garis vertikal atasan<->bawahan): punya topik,
     thread pesan, dan tindak lanjut (action item).
   - RUANG TIM (grup): pesan diberi ruang_nik = NIK atasan pemilik ruang; anggota =
     atasan itu + bawahan langsung efektifnya.

   SQL Server 2014 (compat 120): tanpa CREATE OR ALTER / DROP IF EXISTS.
   NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE). Idempoten.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\coaching-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('coaching') IS NULL
    EXEC('CREATE SCHEMA coaching AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   sesi - sesi coaching 1-on-1 (privat: id_atasan + id_bawahan)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('coaching.sesi', 'U') IS NULL
BEGIN
    CREATE TABLE coaching.sesi
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_coaching_sesi PRIMARY KEY,
        id_atasan     NVARCHAR(20)  NOT NULL,          -- peserta yang lebih tinggi (ancestor)
        nama_atasan   NVARCHAR(150) NULL,
        id_bawahan    NVARCHAR(20)  NOT NULL,          -- peserta yang lebih rendah (descendant)
        nama_bawahan  NVARCHAR(150) NULL,
        topik         NVARCHAR(200) NOT NULL,
        status        NVARCHAR(20)  NOT NULL CONSTRAINT df_coaching_sesi_status DEFAULT ('Berjalan'),
        id_pembuat    NVARCHAR(20)  NOT NULL,
        tgl_dibuat    DATETIME2 NOT NULL CONSTRAINT df_coaching_sesi_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_terakhir  DATETIME2 NULL,                  -- aktivitas terakhir (utk urutan)
        CONSTRAINT ck_coaching_sesi_status CHECK (status IN ('Berjalan','Selesai'))
    );
    CREATE INDEX ix_coaching_sesi_atasan ON coaching.sesi (id_atasan);
    CREATE INDEX ix_coaching_sesi_bawahan ON coaching.sesi (id_bawahan);
    PRINT 'Tabel coaching.sesi dibuat.';
END
ELSE PRINT 'LEWATI: coaching.sesi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   pesan - pesan untuk SESI (id_sesi) ATAU RUANG TIM (ruang_nik). Tepat satu terisi.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('coaching.pesan', 'U') IS NULL
BEGIN
    CREATE TABLE coaching.pesan
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_coaching_pesan PRIMARY KEY,
        id_sesi       BIGINT       NULL,               -- FK ke coaching.sesi (percakapan 1-on-1)
        ruang_nik     NVARCHAR(20) NULL,               -- NIK atasan pemilik ruang tim
        id_pengirim   NVARCHAR(20)  NOT NULL,
        nama_pengirim NVARCHAR(150) NULL,
        isi           NVARCHAR(2000) NOT NULL,
        tgl_kirim     DATETIME2 NOT NULL CONSTRAINT df_coaching_pesan_kirim DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_coaching_pesan_sesi FOREIGN KEY (id_sesi) REFERENCES coaching.sesi (id),
        CONSTRAINT ck_coaching_pesan_kanal CHECK (
            (id_sesi IS NOT NULL AND ruang_nik IS NULL) OR
            (id_sesi IS NULL AND ruang_nik IS NOT NULL))
    );
    CREATE INDEX ix_coaching_pesan_sesi ON coaching.pesan (id_sesi);
    CREATE INDEX ix_coaching_pesan_ruang ON coaching.pesan (ruang_nik);
    PRINT 'Tabel coaching.pesan dibuat.';
END
ELSE PRINT 'LEWATI: coaching.pesan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   tindak_lanjut - action item hasil sesi coaching
   --------------------------------------------------------------------------- */
IF OBJECT_ID('coaching.tindak_lanjut', 'U') IS NULL
BEGIN
    CREATE TABLE coaching.tindak_lanjut
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_coaching_tl PRIMARY KEY,
        id_sesi     BIGINT NOT NULL,
        isi         NVARCHAR(500) NOT NULL,
        status      NVARCHAR(20)  NOT NULL CONSTRAINT df_coaching_tl_status DEFAULT ('Terbuka'),
        id_pembuat  NVARCHAR(20)  NOT NULL,
        tgl_dibuat  DATETIME2 NOT NULL CONSTRAINT df_coaching_tl_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_selesai DATETIME2 NULL,
        CONSTRAINT fk_coaching_tl_sesi FOREIGN KEY (id_sesi) REFERENCES coaching.sesi (id),
        CONSTRAINT ck_coaching_tl_status CHECK (status IN ('Terbuka','Selesai'))
    );
    CREATE INDEX ix_coaching_tl_sesi ON coaching.tindak_lanjut (id_sesi);
    PRINT 'Tabel coaching.tindak_lanjut dibuat.';
END
ELSE PRINT 'LEWATI: coaching.tindak_lanjut sudah ada.';
GO

/* ---------------------------------------------------------------------------
   baca - status "sudah dibaca" per pengguna per kanal (utk badge belum-dibaca).
   kanal = 'sesi:{id}' atau 'ruang:{nik pemilik}'. Diperbarui otomatis saat
   pengguna membuka percakapan.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('coaching.baca', 'U') IS NULL
BEGIN
    CREATE TABLE coaching.baca
    (
        nik      NVARCHAR(20) NOT NULL,
        kanal    NVARCHAR(40) NOT NULL,
        tgl_baca DATETIME2 NOT NULL CONSTRAINT df_coaching_baca DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT pk_coaching_baca PRIMARY KEY (nik, kanal)
    );
    PRINT 'Tabel coaching.baca dibuat.';
END
ELSE PRINT 'LEWATI: coaching.baca sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [7] PROSEDUR ################';
GO
/* ============================================================================
   prosedur - modul My Prosedur (SOP & Kebijakan) MyGCS, di db_mygcs. Layer paralel.
   Repository dokumen terpusat + kontrol versi + pencarian + acknowledgement.
   Pengelola = "Admin Kepatuhan" (Departemen Kepatuhan / fungsi Tata Kelola) -
   lihat ModuleAccessService.IsProsedurAdminAsync. Semua karyawan dapat membaca
   dokumen berlaku & menyatakan sudah baca (acknowledgement, dipantau).

   Kontrol versi: satu dokumen (prosedur.dokumen) punya banyak versi
   (prosedur.versi). Hanya SATU versi berstatus 'Berlaku'; versi lama jadi 'Usang'.
   Acknowledgement terikat ke VERSI (versi baru → perlu baca ulang).

   SQL Server 2014 (compat 120). NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE).
   Idempoten. File dokumen disimpan sebagai VARBINARY(MAX) di prosedur.versi.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\prosedur-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('prosedur') IS NULL
    EXEC('CREATE SCHEMA prosedur AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   dokumen - identitas dokumen (lintas versi)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('prosedur.dokumen', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.dokumen
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_dokumen PRIMARY KEY,
        kode        NVARCHAR(50)  NOT NULL,                 -- nomor dokumen (mis. SOP-SDM-001)
        judul       NVARCHAR(250) NOT NULL,
        jenis       NVARCHAR(30)  NOT NULL,                 -- SOP | Kebijakan | Instruksi Kerja | Formulir
        unit        NVARCHAR(150) NULL,                     -- unit/departemen pemilik
        kategori    NVARCHAR(100) NULL,                     -- tag utk pencarian
        deskripsi   NVARCHAR(1000) NULL,
        id_pembuat  NVARCHAR(20)  NOT NULL,
        tgl_dibuat  DATETIME2 NOT NULL CONSTRAINT df_prosedur_dok_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah  DATETIME2 NULL,
        CONSTRAINT uq_prosedur_dokumen_kode UNIQUE (kode),
        CONSTRAINT ck_prosedur_dokumen_jenis CHECK (jenis IN ('SOP','Kebijakan','Instruksi Kerja','Formulir'))
    );
    CREATE INDEX ix_prosedur_dokumen_jenis ON prosedur.dokumen (jenis);
    PRINT 'Tabel prosedur.dokumen dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.dokumen sudah ada.';
GO

/* ---------------------------------------------------------------------------
   versi - tiap versi dokumen + berkasnya. Berlaku = versi aktif (maks 1/dokumen).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('prosedur.versi', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.versi
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_versi PRIMARY KEY,
        id_dokumen    BIGINT NOT NULL,
        versi         INT NOT NULL,                         -- 1,2,3,...
        ringkasan     NVARCHAR(500) NULL,                   -- ringkasan perubahan
        nama_file     NVARCHAR(255) NOT NULL,
        tipe_file     NVARCHAR(120) NULL,
        konten        VARBINARY(MAX) NOT NULL,
        status        NVARCHAR(20) NOT NULL CONSTRAINT df_prosedur_versi_status DEFAULT ('Berlaku'),
        tgl_berlaku   DATE NULL,
        id_penerbit   NVARCHAR(20)  NOT NULL,
        nama_penerbit NVARCHAR(150) NULL,
        tgl_unggah    DATETIME2 NOT NULL CONSTRAINT df_prosedur_versi_unggah DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_prosedur_versi_dokumen FOREIGN KEY (id_dokumen) REFERENCES prosedur.dokumen (id),
        CONSTRAINT uq_prosedur_versi UNIQUE (id_dokumen, versi),
        CONSTRAINT ck_prosedur_versi_status CHECK (status IN ('Berlaku','Usang','Ditarik'))
    );
    CREATE INDEX ix_prosedur_versi_dokumen ON prosedur.versi (id_dokumen);
    CREATE INDEX ix_prosedur_versi_status ON prosedur.versi (status);
    PRINT 'Tabel prosedur.versi dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.versi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   acknowledgement - pernyataan "sudah baca & paham" per (versi, karyawan)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('prosedur.acknowledgement', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.acknowledgement
    (
        id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_ack PRIMARY KEY,
        id_versi   BIGINT NOT NULL,
        id_dokumen BIGINT NOT NULL,
        nik        NVARCHAR(20)  NOT NULL,
        nama       NVARCHAR(150) NULL,
        tgl        DATETIME2 NOT NULL CONSTRAINT df_prosedur_ack_tgl DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_prosedur_ack_versi FOREIGN KEY (id_versi) REFERENCES prosedur.versi (id),
        CONSTRAINT uq_prosedur_ack UNIQUE (id_versi, nik)
    );
    CREATE INDEX ix_prosedur_ack_nik ON prosedur.acknowledgement (nik);
    CREATE INDEX ix_prosedur_ack_dokumen ON prosedur.acknowledgement (id_dokumen);
    PRINT 'Tabel prosedur.acknowledgement dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.acknowledgement sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [7b] PROSEDUR v2 (Kompartemen) ################';
GO
/* ============================================================================
   prosedur v2 - tambahan cakupan Kompartemen untuk modul My Prosedur.
   - prosedur.dokumen.semua_kompartemen : dokumen berlaku untuk SEMUA kompartemen.
   - prosedur.dokumen_kompartemen        : bila tidak semua, daftar kompartemen
                                           tertentu yang berlaku (multi).
   Nama kompartemen & departemen (kolom unit) mengacu grading.unit_organisasi
   (tipe='Kompartemen' / 'Departemen'); disimpan sebagai teks nama.

   SQL Server 2014 (compat 120). NON-DESTRUKTIF & idempoten.
   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\prosedur-schema-v2.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Kolom penanda "berlaku untuk semua kompartemen" -------------------------- */
IF COL_LENGTH('prosedur.dokumen', 'semua_kompartemen') IS NULL
BEGIN
    ALTER TABLE prosedur.dokumen
        ADD semua_kompartemen BIT NOT NULL
        CONSTRAINT df_prosedur_dok_semuakomp DEFAULT (0);
    -- Dokumen lama (sebelum fitur ini) dianggap berlaku untuk semua kompartemen
    -- supaya tetap tampil. EXEC agar kolom baru sudah "terlihat" saat UPDATE.
    EXEC('UPDATE prosedur.dokumen SET semua_kompartemen = 1');
    PRINT 'Kolom prosedur.dokumen.semua_kompartemen ditambahkan.';
END
ELSE PRINT 'LEWATI: kolom semua_kompartemen sudah ada.';
GO

/* Daftar kompartemen tertentu per dokumen ---------------------------------- */
IF OBJECT_ID('prosedur.dokumen_kompartemen', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.dokumen_kompartemen
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_dokkomp PRIMARY KEY,
        id_dokumen  BIGINT NOT NULL,
        kompartemen NVARCHAR(150) NOT NULL,
        CONSTRAINT fk_prosedur_dokkomp_dok FOREIGN KEY (id_dokumen) REFERENCES prosedur.dokumen (id),
        CONSTRAINT uq_prosedur_dokkomp UNIQUE (id_dokumen, kompartemen)
    );
    CREATE INDEX ix_prosedur_dokkomp_dok ON prosedur.dokumen_kompartemen (id_dokumen);
    CREATE INDEX ix_prosedur_dokkomp_komp ON prosedur.dokumen_kompartemen (kompartemen);
    PRINT 'Tabel prosedur.dokumen_kompartemen dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.dokumen_kompartemen sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [7c] PROSEDUR v3 (Umum/Unit privasi) ################';
GO
/* ============================================================================
   prosedur v3 - dokumen terpusat (Umum) + dokumen privasi unit (Unit).
   - lingkup 'Umum'  : dikelola Admin Kepatuhan, dibaca semua karyawan (default).
   - lingkup 'Unit'  : privasi satu Departemen. Dibaca anggota departemen +
                       Admin Kepatuhan; diunggah/dikelola PIMPINAN unit
                       (Kepala Bagian ke atas, band urutan <= 3) di departemen itu.
   id_unit_pemilik = id_unit Departemen pemilik (grading.unit_organisasi), utk
   dokumen lingkup 'Unit'. Dokumen lama -> 'Umum'.

   SQL Server 2014. NON-DESTRUKTIF & idempoten.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: jalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('prosedur.dokumen', 'lingkup') IS NULL
BEGIN
    ALTER TABLE prosedur.dokumen ADD lingkup NVARCHAR(10) NOT NULL
        CONSTRAINT df_prosedur_dok_lingkup DEFAULT ('Umum');
    -- dokumen lama = terpusat/umum
    EXEC('UPDATE prosedur.dokumen SET lingkup = ''Umum''');
    PRINT 'Kolom prosedur.dokumen.lingkup ditambahkan.';
END
ELSE PRINT 'LEWATI: kolom lingkup sudah ada.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_prosedur_dok_lingkup')
    ALTER TABLE prosedur.dokumen ADD CONSTRAINT ck_prosedur_dok_lingkup
        CHECK (lingkup IN ('Umum','Unit'));
GO

IF COL_LENGTH('prosedur.dokumen', 'id_unit_pemilik') IS NULL
BEGIN
    ALTER TABLE prosedur.dokumen ADD id_unit_pemilik INT NULL;
    CREATE INDEX ix_prosedur_dok_unit ON prosedur.dokumen (id_unit_pemilik);
    PRINT 'Kolom prosedur.dokumen.id_unit_pemilik ditambahkan.';
END
ELSE PRINT 'LEWATI: kolom id_unit_pemilik sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [8] HEALTH (MCU) ################';
GO
/* ============================================================================
   health - modul My Health (Kesehatan) MyGCS, di db_mygcs. Layer paralel.
   Inisiasi awal: Medical Check-Up (MCU). Arsip terpusat jadwal & hasil MCU
   karyawan + status tindak lanjut. TIDAK menyentuh tabel SDM (GCS).

   Pengelola = "Admin Kepatuhan" (Departemen Kepatuhan / Tata Kelola) - lihat
   ModuleAccessService.IsHealthAdminAsync. Data hasil MCU bersifat sensitif:
   karyawan hanya melihat hasil DIRINYA sendiri; admin melihat semua.

   Model: satu periode MCU (health.periode) punya banyak hasil per karyawan
   (health.hasil, maks 1 per (periode, nik)).

   SQL Server 2014 (compat 120). NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE).
   Idempoten. Lampiran laporan MCU disimpan VARBINARY(MAX) di health.hasil.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\health-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('health') IS NULL
    EXEC('CREATE SCHEMA health AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   periode - kampanye/batch MCU (mis. "MCU Tahunan 2026")
   --------------------------------------------------------------------------- */
IF OBJECT_ID('health.periode', 'U') IS NULL
BEGIN
    CREATE TABLE health.periode
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_health_periode PRIMARY KEY,
        judul         NVARCHAR(200) NOT NULL,
        tahun         INT NOT NULL,
        penyelenggara NVARCHAR(200) NULL,                    -- vendor/klinik/RS pelaksana
        lokasi        NVARCHAR(200) NULL,
        tgl_mulai     DATE NULL,
        tgl_selesai   DATE NULL,
        catatan       NVARCHAR(1000) NULL,
        status        NVARCHAR(20) NOT NULL CONSTRAINT df_health_periode_status DEFAULT ('Direncanakan'),
        id_pembuat    NVARCHAR(20)  NOT NULL,
        tgl_dibuat    DATETIME2 NOT NULL CONSTRAINT df_health_periode_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah    DATETIME2 NULL,
        CONSTRAINT ck_health_periode_status CHECK (status IN ('Direncanakan','Berlangsung','Selesai'))
    );
    CREATE INDEX ix_health_periode_tahun ON health.periode (tahun);
    PRINT 'Tabel health.periode dibuat.';
END
ELSE PRINT 'LEWATI: health.periode sudah ada.';
GO

/* ---------------------------------------------------------------------------
   hasil - hasil MCU per karyawan dalam satu periode (maks 1 per periode+nik)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('health.hasil', 'U') IS NULL
BEGIN
    CREATE TABLE health.hasil
    (
        id                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_health_hasil PRIMARY KEY,
        id_periode           BIGINT NOT NULL,
        nik                  NVARCHAR(20)  NOT NULL,
        nama                 NVARCHAR(150) NULL,
        tgl_pemeriksaan      DATE NULL,
        tinggi               DECIMAL(5,1) NULL,               -- cm
        berat                DECIMAL(5,1) NULL,               -- kg
        tekanan_darah        NVARCHAR(20) NULL,               -- mis. "120/80"
        status_umum          NVARCHAR(30) NOT NULL CONSTRAINT df_health_hasil_status DEFAULT ('Sehat'),
        ringkasan            NVARCHAR(2000) NULL,             -- kesimpulan pemeriksaan
        rekomendasi          NVARCHAR(2000) NULL,
        status_tindak_lanjut NVARCHAR(20) NOT NULL CONSTRAINT df_health_hasil_tl DEFAULT ('Tidak Perlu'),
        nama_file            NVARCHAR(255) NULL,              -- lampiran laporan MCU (opsional)
        tipe_file            NVARCHAR(120) NULL,
        konten               VARBINARY(MAX) NULL,
        id_pencatat          NVARCHAR(20)  NOT NULL,
        nama_pencatat        NVARCHAR(150) NULL,
        tgl_dicatat          DATETIME2 NOT NULL CONSTRAINT df_health_hasil_dicatat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah           DATETIME2 NULL,
        CONSTRAINT fk_health_hasil_periode FOREIGN KEY (id_periode) REFERENCES health.periode (id),
        CONSTRAINT uq_health_hasil UNIQUE (id_periode, nik),
        CONSTRAINT ck_health_hasil_status CHECK (status_umum IN ('Sehat','Perlu Perhatian','Tindak Lanjut')),
        CONSTRAINT ck_health_hasil_tl CHECK (status_tindak_lanjut IN ('Tidak Perlu','Belum','Dijadwalkan','Selesai'))
    );
    CREATE INDEX ix_health_hasil_periode ON health.hasil (id_periode);
    CREATE INDEX ix_health_hasil_nik ON health.hasil (nik);
    PRINT 'Tabel health.hasil dibuat.';
END
ELSE PRINT 'LEWATI: health.hasil sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '################ [8b] FEATURE ACCESS (lock/unlock fitur) ################';
GO
/* ============================================================================
   dbo.feature_access - lock/unlock per FITUR (item menu sidebar) tiap modul.
   Override seperti dbo.module_access, tapi granular ke fitur. Baris hanya ada
   bila Admin IT pernah mengubah; fitur tanpa baris = default aktif (terbuka).
   NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

IF OBJECT_ID('dbo.feature_access', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.feature_access
    (
        FeatureKey NVARCHAR(80)  NOT NULL CONSTRAINT pk_feature_access PRIMARY KEY,
        Enabled    BIT           NOT NULL CONSTRAINT df_feature_access_enabled DEFAULT (1),
        UpdatedAt  DATETIME2     NULL,
        UpdatedBy  NVARCHAR(256) NULL
    );
    PRINT 'Tabel dbo.feature_access dibuat.';
END
ELSE PRINT 'LEWATI: dbo.feature_access sudah ada.';
GO

SET NOEXEC OFF;
GO

PRINT '=== BUNDEL MIGRASI SELESAI ==='
GO
