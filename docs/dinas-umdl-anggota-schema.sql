/* ============================================================================
   dinas.umdl_anggota - schema `dinas` di db_mygcs (diminta 2026-08-24). Ketua/anggota
   UMDL, mirror dari web_sdm_sppd_detail (SPPD) TAPI lebih ringkas: UMDL tidak pernah
   dicetak sbg surat multi-orang, jadi tanpa snapshot golongan/jabatan/struktur/tugas -
   murni penanda "siapa saja yang ikut dinas ini" supaya anggota (bukan cuma pengaju)
   ikut melihat baris UMDL ini di halaman UMDL mereka sendiri.

   Layer PARALEL: TIDAK menyentuh tabel legacy GCS (web_sdm_umdl), yang dipakai
   bersama EASy - jadi tidak aman ditambah kolom. ref_id merujuk ke WebSdmUmdl.ID
   (dikonversi ToString()), dipasangkan lewat ref_id sama pola dgn dinas.bukti &
   approval.pengajuan.

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

IF OBJECT_ID('dinas.umdl_anggota', 'U') IS NULL
BEGIN
    CREATE TABLE dinas.umdl_anggota (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_dinas_umdl_anggota PRIMARY KEY,
        ref_id       NVARCHAR(50)   NOT NULL,   -- WebSdmUmdl.ID.ToString()
        id_karyawan  NVARCHAR(50)   NOT NULL,
        posisi       NVARCHAR(10)   NOT NULL,   -- Ketua | Anggota
        dibuat_pada  DATETIME2      NOT NULL CONSTRAINT df_dinas_umdl_anggota_tgl DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_dinas_umdl_anggota_posisi CHECK (posisi IN ('Ketua','Anggota')),
        CONSTRAINT uq_dinas_umdl_anggota UNIQUE (ref_id, id_karyawan)
    );
    CREATE INDEX ix_dinas_umdl_anggota_karyawan ON dinas.umdl_anggota (id_karyawan);
    PRINT 'dinas.umdl_anggota dibuat.';
END
ELSE PRINT 'LEWATI: dinas.umdl_anggota sudah ada.';
GO

SET NOEXEC OFF;
GO
