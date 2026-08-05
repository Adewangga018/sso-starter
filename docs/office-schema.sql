/* ============================================================================
   My Office (persuratan) — schema `office` di db_mygcs.
   Mengikuti fungsi DOF: penciptaan surat -> reviewer -> approver -> distribusi.
   Master List Perusahaan & List Group SENGAJA tidak dibuat (distribusi memakai
   pencarian pegawai dari data SDM yang sudah ada).

   Kompatibel SQL Server 2014: tanpa CREATE OR ALTER / DROP IF EXISTS / AT TIME ZONE.
   Dijalankan pada db_mygcs. Idempoten (drop anak dulu, lalu induk).
   ============================================================================ */

IF SCHEMA_ID('office') IS NULL EXEC('CREATE SCHEMA office');
GO

IF OBJECT_ID('office.surat_dibaca', 'U')     IS NOT NULL DROP TABLE office.surat_dibaca;
IF OBJECT_ID('office.surat_riwayat', 'U')    IS NOT NULL DROP TABLE office.surat_riwayat;
IF OBJECT_ID('office.surat_lampiran', 'U')   IS NOT NULL DROP TABLE office.surat_lampiran;
IF OBJECT_ID('office.surat_distribusi', 'U') IS NOT NULL DROP TABLE office.surat_distribusi;
IF OBJECT_ID('office.surat_pj', 'U')         IS NOT NULL DROP TABLE office.surat_pj;
IF OBJECT_ID('office.surat', 'U')            IS NOT NULL DROP TABLE office.surat;
GO

-- Surat: entitas utama naskah dinas.
CREATE TABLE office.surat (
    id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_surat PRIMARY KEY,
    nomor           NVARCHAR(100)  NULL,
    jenis           NVARCHAR(20)   NOT NULL CONSTRAINT df_surat_jenis  DEFAULT 'Surat',  -- Surat|SP|ASP|Memo
    klasifikasi     NVARCHAR(100)  NULL,
    sifat           NVARCHAR(20)   NOT NULL CONSTRAINT df_surat_sifat  DEFAULT 'Biasa',  -- Rahasia|Terbatas|Biasa
    kecepatan       NVARCHAR(20)   NOT NULL CONSTRAINT df_surat_cepat  DEFAULT 'Biasa',  -- Biasa|Segera|Sangat Segera
    judul           NVARCHAR(500)  NOT NULL,
    keterangan      NVARCHAR(MAX)  NULL,
    isi             NVARCHAR(MAX)  NULL,
    status          NVARCHAR(30)   NOT NULL CONSTRAINT df_surat_status DEFAULT 'Draft',
    pembuat_nik     NVARCHAR(50)   NOT NULL,
    pembuat_nama    NVARCHAR(200)  NULL,
    tanggal_surat   DATE           NULL,
    berlaku_mulai   DATE           NULL,
    berlaku_sampai  DATE           NULL,
    dibuat_pada     DATETIME2      NOT NULL CONSTRAINT df_surat_dibuat DEFAULT SYSUTCDATETIME(),
    diperbarui_pada DATETIME2      NOT NULL CONSTRAINT df_surat_ubah   DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_surat_jenis  CHECK (jenis IN ('Surat','SP','ASP','Memo')),
    CONSTRAINT ck_surat_sifat  CHECK (sifat IN ('Rahasia','Terbatas','Biasa')),
    CONSTRAINT ck_surat_cepat  CHECK (kecepatan IN ('Biasa','Segera','Sangat Segera')),
    CONSTRAINT ck_surat_status CHECK (status IN
        ('Draft','Menunggu Review','Diverifikasi','Menunggu Approval','Disetujui','Revisi','Ditolak','Batal'))
);
GO
CREATE INDEX ix_surat_pembuat ON office.surat (pembuat_nik, status);
GO

-- Penanggung jawab surat: reviewer / approver / signer, berjenjang lewat `urutan`.
CREATE TABLE office.surat_pj (
    id        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_surat_pj PRIMARY KEY,
    id_surat  BIGINT        NOT NULL,
    peran     NVARCHAR(20)  NOT NULL,   -- Reviewer|Approver|Signer
    urutan    INT           NOT NULL CONSTRAINT df_pj_urutan DEFAULT 0,
    nik       NVARCHAR(50)  NOT NULL,
    nama      NVARCHAR(200) NULL,
    jabatan   NVARCHAR(200) NULL,
    status    NVARCHAR(20)  NOT NULL CONSTRAINT df_pj_status DEFAULT 'Menunggu',  -- Menunggu|Disetujui|Ditolak|Revisi
    komentar  NVARCHAR(MAX) NULL,
    tgl       DATETIME2     NULL,
    CONSTRAINT fk_pj_surat FOREIGN KEY (id_surat) REFERENCES office.surat(id) ON DELETE CASCADE,
    CONSTRAINT ck_pj_peran  CHECK (peran IN ('Reviewer','Approver','Signer')),
    CONSTRAINT ck_pj_status CHECK (status IN ('Menunggu','Disetujui','Ditolak','Revisi'))
);
GO
CREATE INDEX ix_pj_nik ON office.surat_pj (nik, status);
GO

-- Distribusi surat: tujuan & tembusan (CC), mentarget pegawai (id_karyawan).
CREATE TABLE office.surat_distribusi (
    id        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_surat_dist PRIMARY KEY,
    id_surat  BIGINT        NOT NULL,
    tipe      NVARCHAR(10)  NOT NULL CONSTRAINT df_dist_tipe DEFAULT 'Tujuan',  -- Tujuan|CC
    nik       NVARCHAR(50)  NOT NULL,
    nama      NVARCHAR(200) NULL,
    jabatan   NVARCHAR(200) NULL,
    CONSTRAINT fk_dist_surat FOREIGN KEY (id_surat) REFERENCES office.surat(id) ON DELETE CASCADE,
    CONSTRAINT ck_dist_tipe  CHECK (tipe IN ('Tujuan','CC'))
);
GO
CREATE INDEX ix_dist_nik ON office.surat_distribusi (nik);
GO

-- Lampiran surat (berkas fisik disimpan di folder, path relatif dicatat di sini).
CREATE TABLE office.surat_lampiran (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_surat_lamp PRIMARY KEY,
    id_surat    BIGINT        NOT NULL,
    nama_file   NVARCHAR(300) NOT NULL,
    path        NVARCHAR(500) NOT NULL,
    ukuran      BIGINT        NULL,
    tipe        NVARCHAR(100) NULL,
    dibuat_pada DATETIME2     NOT NULL CONSTRAINT df_lamp_dibuat DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_lamp_surat FOREIGN KEY (id_surat) REFERENCES office.surat(id) ON DELETE CASCADE
);
GO

-- Riwayat aksi surat (audit alur: dibuat, dikirim, disetujui, revisi, dst).
CREATE TABLE office.surat_riwayat (
    id        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_surat_riw PRIMARY KEY,
    id_surat  BIGINT        NOT NULL,
    aksi      NVARCHAR(60)  NOT NULL,
    oleh_nik  NVARCHAR(50)  NULL,
    oleh_nama NVARCHAR(200) NULL,
    catatan   NVARCHAR(MAX) NULL,
    tgl       DATETIME2     NOT NULL CONSTRAINT df_riw_tgl DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_riw_surat FOREIGN KEY (id_surat) REFERENCES office.surat(id) ON DELETE CASCADE
);
GO

-- Penanda baca kotak masuk (tab "Belum Dibaca"/"Dibaca" seperti DOF). Satu baris per
-- (surat, pegawai); tidak adanya baris berarti belum dibaca.
CREATE TABLE office.surat_dibaca (
    id_surat    BIGINT       NOT NULL,
    nik         NVARCHAR(50) NOT NULL,
    dibaca_pada DATETIME2    NOT NULL CONSTRAINT df_dibaca_tgl DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_surat_dibaca PRIMARY KEY (id_surat, nik),
    CONSTRAINT fk_dibaca_surat FOREIGN KEY (id_surat) REFERENCES office.surat(id) ON DELETE CASCADE
);
GO
CREATE INDEX ix_dibaca_nik ON office.surat_dibaca (nik);
GO
