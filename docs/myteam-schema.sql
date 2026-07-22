/* ============================================================================
   MyGCS — Modul My Team : tabel tugas (delegasi & tracking)
   Database: db_mygcs  |  schema: myteam  |  RDBMS: SQL Server 2014 (tanpa CREATE OR ALTER)
   Menautkan pemberi & penerima lewat ID_KARYAWAN (sama dgn grading.penempatan &
   GCS.dbo.MST_PEGAWAI). Aplikasi (svc_mygcs) memakainya lewat db_datareader/db_datawriter.
   ============================================================================ */
IF SCHEMA_ID('myteam') IS NULL EXEC('CREATE SCHEMA myteam');
GO

IF OBJECT_ID('myteam.tugas') IS NULL
CREATE TABLE myteam.tugas (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    id_pemberi       NVARCHAR(30)  NOT NULL,     -- ID_KARYAWAN atasan pemberi tugas
    nama_pemberi     NVARCHAR(150) NULL,
    id_penerima      NVARCHAR(30)  NOT NULL,     -- ID_KARYAWAN bawahan penerima
    nama_penerima    NVARCHAR(150) NULL,
    judul            NVARCHAR(200) NOT NULL,
    deskripsi        NVARCHAR(MAX) NULL,
    tenggat          DATE          NULL,
    status           NVARCHAR(20)  NOT NULL CONSTRAINT df_tugas_status DEFAULT 'Baru',  -- Baru|Dikerjakan|Selesai|Batal
    dibuat_pada      DATETIME2     NOT NULL CONSTRAINT df_tugas_dibuat DEFAULT SYSUTCDATETIME(),
    diperbarui_pada  DATETIME2     NOT NULL CONSTRAINT df_tugas_ubah   DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_tugas_status CHECK (status IN ('Baru','Dikerjakan','Selesai','Batal'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_tugas_penerima' AND object_id=OBJECT_ID('myteam.tugas'))
    CREATE INDEX ix_tugas_penerima ON myteam.tugas(id_penerima);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_tugas_pemberi' AND object_id=OBJECT_ID('myteam.tugas'))
    CREATE INDEX ix_tugas_pemberi ON myteam.tugas(id_pemberi);
GO
