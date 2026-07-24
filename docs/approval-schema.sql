/* ============================================================================
   Layer persetujuan MyGCS terpadu — schema `approval` di db_mygcs.
   Satu tabel untuk semua jenis pengajuan (Izin/Lembur/SPPD/UMDL/Tiket): saat
   pengajuan dibuat, dibuat catatan persetujuan yang dirutekan ke MANAGER terkait.
   Manager meng-acc di satu Kotak Persetujuan. TIDAK menyentuh tabel/status SDM.
   Kompatibel SQL Server 2014. Idempoten.
   ============================================================================ */

IF SCHEMA_ID('approval') IS NULL EXEC('CREATE SCHEMA approval');
GO

IF OBJECT_ID('approval.pengajuan', 'U') IS NOT NULL DROP TABLE approval.pengajuan;
GO

CREATE TABLE approval.pengajuan (
    id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_appr PRIMARY KEY,
    jenis         NVARCHAR(20)  NOT NULL,          -- Izin|Lembur|SPPD|UMDL|Tiket
    ref_id        NVARCHAR(50)  NOT NULL,          -- id record di tabel SDM
    id_karyawan   NVARCHAR(50)  NOT NULL,          -- pemohon
    nama          NVARCHAR(200) NULL,
    id_manager    NVARCHAR(50)  NULL,              -- NIK manager terkait (penyetuju)
    ringkasan     NVARCHAR(500) NULL,
    status        NVARCHAR(20)  NOT NULL CONSTRAINT df_appr_status DEFAULT 'Menunggu',
    komentar      NVARCHAR(500) NULL,
    tgl_pengajuan DATETIME2     NOT NULL CONSTRAINT df_appr_tgl DEFAULT SYSUTCDATETIME(),
    tgl_keputusan DATETIME2     NULL,
    CONSTRAINT ck_appr_status CHECK (status IN ('Menunggu','Disetujui','Ditolak','Batal')),
    CONSTRAINT uq_appr_ref UNIQUE (jenis, ref_id)
);
GO
CREATE INDEX ix_appr_manager ON approval.pengajuan (id_manager, status);
GO
