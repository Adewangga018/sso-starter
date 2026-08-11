/* ============================================================================
   gaji.tanggungan_lebih - pendaftaran mandiri karyawan (My Personal > Profil)
   utk anggota keluarga lain yang diikutsertakan BPJS Kesehatan (di luar diri
   sendiri). jumlah_tanggungan = JUMLAH ANGGOTA KELUARGA LAIN yang didaftarkan
   (bukan lagi "total tanggungan >3" - dikoreksi user 2026-08-11).

   Formula terbaru (GajiService.HitungBpjsKesPotonganAsync):
     POT_BPJS_KES = (1% + 1%/anggota keluarga lain) x MIN(Pendapatan Dasar, batas
     yg sama dgn TJ_BPJS_KES) - base 1% SELALU dibebankan, tanpa batas gratis lagi.

   TIDAK butuh persetujuan atasan (self-declared, dampaknya menambah potongan
   milik sendiri - tidak ada insentif klaim berlebihan).

   NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO
IF SCHEMA_ID('gaji') IS NULL
BEGIN RAISERROR('schema gaji belum ada - jalankan gaji-schema.sql dulu.',16,1); SET NOEXEC ON; END
GO

IF OBJECT_ID('gaji.tanggungan_lebih', 'U') IS NULL
BEGIN
    CREATE TABLE gaji.tanggungan_lebih (
        id                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_tanggungan_lebih PRIMARY KEY,
        id_karyawan       NVARCHAR(50)  NOT NULL,
        jumlah_tanggungan INT           NOT NULL,
        keterangan        NVARCHAR(500) NULL,
        dibuat_pada       DATETIME2     NOT NULL CONSTRAINT df_tanggungan_lebih_dibuat DEFAULT SYSUTCDATETIME(),
        diubah_pada       DATETIME2     NULL,
        CONSTRAINT uq_tanggungan_lebih_karyawan UNIQUE (id_karyawan),
        CONSTRAINT ck_tanggungan_lebih_jumlah CHECK (jumlah_tanggungan > 0)
    );
    PRINT 'gaji.tanggungan_lebih dibuat.';
END
ELSE PRINT 'LEWATI: gaji.tanggungan_lebih sudah ada.';
GO

-- Longgarkan CHECK lama (jumlah_tanggungan > 3) jadi (jumlah_tanggungan > 0) - formula
-- baru tidak ada lagi batas gratis 3, setiap anggota keluarga lain yang didaftarkan
-- (mulai dari 1) kena tambahan 1%.
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'ck_tanggungan_lebih_jumlah'
      AND parent_object_id = OBJECT_ID('gaji.tanggungan_lebih')
      AND definition NOT LIKE '%>(0)%'
)
BEGIN
    ALTER TABLE gaji.tanggungan_lebih DROP CONSTRAINT ck_tanggungan_lebih_jumlah;
    ALTER TABLE gaji.tanggungan_lebih ADD CONSTRAINT ck_tanggungan_lebih_jumlah CHECK (jumlah_tanggungan > 0);
    PRINT 'ck_tanggungan_lebih_jumlah dilonggarkan jadi > 0.';
END
ELSE PRINT 'LEWATI: ck_tanggungan_lebih_jumlah sudah > 0.';
GO

SET NOEXEC OFF;
GO
