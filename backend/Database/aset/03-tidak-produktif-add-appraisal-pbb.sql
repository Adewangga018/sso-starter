/* ============================================================================
   aset.tidak_produktif - tambah kolom Harga Pasar, Appraisal, Pembayaran PBB,
   Catatan Akt (Aug 2026), menyusul rekap Excel versi lebih lengkap dari user.
   Idempoten: tiap ALTER dicek dulu via sys.columns sebelum dijalankan.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('aset.tidak_produktif', 'harga_pasar') IS NULL
    ALTER TABLE aset.tidak_produktif ADD harga_pasar DECIMAL(18,2) NULL;         -- Harga Pasar (Rp)
GO
IF COL_LENGTH('aset.tidak_produktif', 'appraisal_harga') IS NULL
    ALTER TABLE aset.tidak_produktif ADD appraisal_harga DECIMAL(18,2) NULL;    -- Appraisal > Harga (Rp)
GO
IF COL_LENGTH('aset.tidak_produktif', 'appraisal_kjpp') IS NULL
    ALTER TABLE aset.tidak_produktif ADD appraisal_kjpp NVARCHAR(300) NULL;     -- Appraisal > KJPP (nama kantor penilai)
GO
IF COL_LENGTH('aset.tidak_produktif', 'appraisal_tahun') IS NULL
    ALTER TABLE aset.tidak_produktif ADD appraisal_tahun INT NULL;              -- Appraisal > Tahun
GO
IF COL_LENGTH('aset.tidak_produktif', 'appraisal_no') IS NULL
    ALTER TABLE aset.tidak_produktif ADD appraisal_no NVARCHAR(300) NULL;       -- Appraisal > No. (bisa memuat tgl laporan)
GO
IF COL_LENGTH('aset.tidak_produktif', 'pbb_nop') IS NULL
    ALTER TABLE aset.tidak_produktif ADD pbb_nop NVARCHAR(50) NULL;             -- Pembayaran PBB > NOP (Nomor Objek Pajak)
GO
IF COL_LENGTH('aset.tidak_produktif', 'pbb_nominal') IS NULL
    ALTER TABLE aset.tidak_produktif ADD pbb_nominal DECIMAL(18,2) NULL;        -- Pembayaran PBB > Nominal
GO
IF COL_LENGTH('aset.tidak_produktif', 'pbb_tgl_pembayaran') IS NULL
    ALTER TABLE aset.tidak_produktif ADD pbb_tgl_pembayaran DATE NULL;          -- Pembayaran PBB > Tgl. Pembayaran
GO
IF COL_LENGTH('aset.tidak_produktif', 'catatan_akt') IS NULL
    ALTER TABLE aset.tidak_produktif ADD catatan_akt CHAR(1) NULL;              -- Catatan Akt: 'Y' | 'T'
GO

PRINT 'Kolom appraisal/PBB/catatan_akt siap.';
GO