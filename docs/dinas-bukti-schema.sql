/* ============================================================================
   dinas.bukti - schema `dinas` di db_mygcs. Bukti perjalanan dinas (rentang km +
   foto lokasi bertimestamp) untuk pengajuan UMDL dan SPPD (My Personal). Layer
   PARALEL: TIDAK menyentuh tabel legacy GCS (web_sdm_umdl / web_sdm_sppd), yang
   dipakai bersama EASy - jadi tidak aman ditambah kolom. ref_id merujuk ke baris
   legacy terkait (WebSdmUmdl.ID / WebSdmSppd.id), dipasangkan lewat (jenis, ref_id)
   sama pola dgn approval.pengajuan.

   rentang_km sekaligus jadi aturan pemilihan form (dikonfirmasi user):
     UMDL : '<75' atau '75-150' (keduanya Pulang-Pergi)
     SPPD : '>150' (Pulang-Pergi)
   Foto disimpan sbg FILE di disk (path relatif dicatat di kolom foto), sama pola
   dgn db_mygcs.attendances (foto absensi kamera) - BUKAN base64 di database.

   SQL Server 2014 (compat 120). NON-DESTRUKTIF (pola IF OBJECT_ID ... IS NULL
   CREATE). Idempoten.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

IF SCHEMA_ID('dinas') IS NULL EXEC('CREATE SCHEMA dinas');
GO

IF OBJECT_ID('dinas.bukti', 'U') IS NULL
BEGIN
    CREATE TABLE dinas.bukti (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_dinas_bukti PRIMARY KEY,
        jenis        NVARCHAR(10)   NOT NULL,   -- UMDL | SPPD
        ref_id       NVARCHAR(50)   NOT NULL,   -- id baris legacy (WebSdmUmdl.ID / WebSdmSppd.id)
        id_karyawan  NVARCHAR(50)   NOT NULL,
        rentang_km   NVARCHAR(20)   NOT NULL,   -- <75 | 75-150 | >150 (PP)
        foto         NVARCHAR(255)  NOT NULL,   -- path relatif file (spt attendances.Foto)
        lat          DECIMAL(9,6)   NOT NULL,
        lng          DECIMAL(9,6)   NOT NULL,
        accuracy     DECIMAL(9,2)   NULL,       -- meter, akurasi GPS device saat foto diambil
        dibuat_pada  DATETIME2      NOT NULL CONSTRAINT df_dinas_bukti_tgl DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_dinas_bukti_jenis CHECK (jenis IN ('UMDL','SPPD')),
        CONSTRAINT ck_dinas_bukti_km CHECK (rentang_km IN ('<75','75-150','>150')),
        CONSTRAINT uq_dinas_bukti_ref UNIQUE (jenis, ref_id)
    );
    CREATE INDEX ix_dinas_bukti_karyawan ON dinas.bukti (id_karyawan);
    PRINT 'dinas.bukti dibuat.';
END
ELSE PRINT 'LEWATI: dinas.bukti sudah ada.';
GO

SET NOEXEC OFF;
GO
