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
