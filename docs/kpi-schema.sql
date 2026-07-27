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
