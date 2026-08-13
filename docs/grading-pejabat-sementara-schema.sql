/* ============================================================================
   grading.pejabat_sementara - penandaan PTS (Pemangku Tugas Sementara): karyawan yang
   MENGGANTIKAN SEMENTARA formasi atasannya yang kosong, ditandai admin lewat
   panel Struktur Organisasi. Dipakai GajiService.HitungTunjanganPtsAsync
   (formula TJ_PTS = Tunjangan Jabatan awal + 80% x selisih Tunjangan Jabatan
   thd jabatan pengganti, HANYA berlaku bila jabatan pengganti persis 1 band di
   atas jabatan asli karyawan).

   id_karyawan = jabatan ASLI karyawan (dibaca dari grading.penempatan aktif
   saat hitung formula, TIDAK disimpan redundan di sini). id_jabatan_pengganti
   = jabatan atasan yang kosong yang sedang digantikan sementara.

   NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO
IF SCHEMA_ID('grading') IS NULL
BEGIN RAISERROR('schema grading belum ada.',16,1); SET NOEXEC ON; END
GO

IF OBJECT_ID('grading.pejabat_sementara', 'U') IS NULL
BEGIN
    CREATE TABLE grading.pejabat_sementara (
        id                    INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_pejabat_sementara PRIMARY KEY,
        id_karyawan           NVARCHAR(20)  NOT NULL,
        id_jabatan_pengganti  INT           NOT NULL,
        tmt                   DATE          NULL,
        tanggal_selesai       DATE          NULL,
        status                NVARCHAR(20)  NOT NULL CONSTRAINT df_pejabat_sementara_status DEFAULT ('Aktif'),
        catatan               NVARCHAR(400) NULL,
        dibuat_pada           DATETIME2     NOT NULL CONSTRAINT df_pejabat_sementara_dibuat DEFAULT (SYSDATETIME()),
        CONSTRAINT fk_pejabat_sementara_jabatan FOREIGN KEY (id_jabatan_pengganti) REFERENCES grading.jabatan (id_jabatan),
        CONSTRAINT ck_pejabat_sementara_status CHECK (status IN ('Aktif','Selesai'))
    );
    -- Satu karyawan hanya boleh punya SATU penandaan PTS aktif pada satu waktu.
    CREATE UNIQUE INDEX uq_pejabat_sementara_karyawan_aktif
        ON grading.pejabat_sementara (id_karyawan)
        WHERE status = 'Aktif';
    CREATE INDEX ix_pejabat_sementara_jabatan ON grading.pejabat_sementara (id_jabatan_pengganti);
    PRINT 'grading.pejabat_sementara dibuat.';
END
ELSE PRINT 'LEWATI: grading.pejabat_sementara sudah ada.';
GO

SET NOEXEC OFF;
GO
