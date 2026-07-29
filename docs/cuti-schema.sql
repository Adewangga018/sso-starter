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

-- Aturan (revisi 2026-07-29): hak (net) = hak_dasar(24) - cuti_bersama; saldo = hak - diambil.
-- cuti_bersama = jumlah cuti bersama 2 tahun terakhir, DIINPUT SDM di cuti.setelan
-- (lihat bawah), lalu seluruh cuti.saldo dihitung ulang oleh CutiService.
-- PERIODE BERJALAN: periode = "{tahun}-{tahun+1}" (WIB), berganti tiap 1 Januari.
-- CutiService.ResetJikaPeriodeBaruAsync me-reset saldo (hak kembali penuh, diambil=0)
-- saat karyawan membuka/mengajukan cuti di periode baru — "reset tiap tahun" otomatis.

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

-- Setelan global cuti (satu baris, id=1). hak_dasar - cuti_bersama = hak awal semua
-- karyawan. NON-DESTRUKTIF (jangan di-drop): menyimpan angka cuti bersama dari SDM.
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
END
GO
