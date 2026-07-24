/* ============================================================================
   Sistem Cuti MyGCS (baru) — schema `cuti` di db_mygcs.
   Cutoff (Pak A): saldo awal per karyawan diseed dari spreadsheet ORGANIK
   (hak/cutber/cuti tahunan/sisa periode 2024-2025). Riwayat cuti tetap dibaca
   dari SDM lama (vw_web_sdm_cuti). Aturan lanjutan (akrual/potong) menyusul.

   Kompatibel SQL Server 2014. Idempoten.
   ============================================================================ */

IF SCHEMA_ID('cuti') IS NULL EXEC('CREATE SCHEMA cuti');
GO

IF OBJECT_ID('cuti.saldo', 'U') IS NOT NULL DROP TABLE cuti.saldo;
GO

-- Saldo cutoff per karyawan (satu baris per NIK).
CREATE TABLE cuti.saldo (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_saldo PRIMARY KEY,
    id_karyawan     NVARCHAR(50)  NOT NULL,
    nama            NVARCHAR(200) NULL,
    tmt             DATE          NULL,
    periode         NVARCHAR(20)  NOT NULL CONSTRAINT df_saldo_periode DEFAULT '2024-2025',
    hak             INT           NOT NULL CONSTRAINT df_saldo_hak   DEFAULT 0,   -- E
    cuti_bersama    INT           NOT NULL CONSTRAINT df_saldo_cb    DEFAULT 0,   -- F
    diambil         INT           NOT NULL CONSTRAINT df_saldo_amb   DEFAULT 0,   -- G
    saldo           INT           NOT NULL CONSTRAINT df_saldo_sisa  DEFAULT 0,   -- H (sisa)
    tgl_cutoff      DATE          NULL,
    dibuat_pada     DATETIME2     NOT NULL CONSTRAINT df_saldo_dibuat DEFAULT SYSUTCDATETIME(),
    diperbarui_pada DATETIME2     NOT NULL CONSTRAINT df_saldo_ubah   DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_cuti_saldo_karyawan UNIQUE (id_karyawan)
);
GO

-- Catatan (aturan disederhanakan): cuti bersama DIABAIKAN, saldo = hak - diambil.
-- Setelah seed: UPDATE cuti.saldo SET saldo = hak - diambil;

-- Pengajuan cuti tahunan: disetujui atasan -> memotong cuti.saldo.
IF OBJECT_ID('cuti.pengajuan', 'U') IS NOT NULL DROP TABLE cuti.pengajuan;
GO
CREATE TABLE cuti.pengajuan (
    id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_cuti_peng PRIMARY KEY,
    id_karyawan   NVARCHAR(50)  NOT NULL,
    nama          NVARCHAR(200) NULL,
    id_atasan     NVARCHAR(50)  NULL,          -- NIK atasan penyetuju (dari grading)
    tgl_mulai     DATE          NOT NULL,
    tgl_selesai   DATE          NOT NULL,
    jumlah_hari   INT           NOT NULL,       -- hari kerja (Sen-Jum)
    keterangan    NVARCHAR(500) NULL,
    status        NVARCHAR(20)  NOT NULL CONSTRAINT df_peng_status DEFAULT 'Menunggu',
    komentar      NVARCHAR(500) NULL,
    tgl_pengajuan DATETIME2     NOT NULL CONSTRAINT df_peng_tgl DEFAULT SYSUTCDATETIME(),
    tgl_keputusan DATETIME2     NULL,
    CONSTRAINT ck_peng_status CHECK (status IN ('Menunggu','Disetujui','Ditolak','Batal'))
);
GO
