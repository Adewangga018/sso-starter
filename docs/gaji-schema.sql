/* ============================================================================
   gaji - skema Slip Gaji MyGCS (di db_mygcs). Layer PARALEL: tidak menyentuh
   tabel/status SDM sama sekali. Nominal ditentukan oleh JG (Job Grade) & PG
   (Person Grade) dari schema grading; PG naik per periode (tahunan) dan JG naik
   mengikuti jabatan -> keduanya menaikkan gaji. Tarif per (komponen, JG, PG,
   tahun) disimpan di gaji.tarif dan SENGAJA dibiarkan kosong dulu (dikonfigurasi
   admin modul SDM belakangan).

   Komponen mengikuti "komponen_gaji.xlsx":
     Pendapatan : Gaji Pokok; Tunjangan Tetap (Jabatan, Perumahan);
                  Tunjangan Tidak Tetap (Angkutan, Pangan);
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
    PRINT 'gaji.komponen: 25 baris diseed.';
END
ELSE PRINT 'LEWATI: gaji.komponen sudah terisi.';
GO

SET NOEXEC OFF;
GO
