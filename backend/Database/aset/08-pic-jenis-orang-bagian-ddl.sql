/* ============================================================================
   aset.pic_assignment: dukung PIC berupa Bagian (unit organisasi), bukan cuma
   orang (NIK). Aug 2026.
   ----------------------------------------------------------------------------
   1 baris = 1 penanggung jawab (Orang ATAU Bagian, ditandai jenis_pic), tetap
   1 riwayat/1 kartu "PIC Saat Ini" di UI. nik/nama_pic dilonggarkan jadi
   NULLable (baris Bagian tidak mengisinya); id_unit/nama_unit ditambah untuk
   baris Bagian. ALTER (bukan drop/recreate) karena tabel sudah berisi data uji.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\08-pic-jenis-orang-bagian-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('aset.pic_assignment', 'jenis_pic') IS NULL
BEGIN
    ALTER TABLE aset.pic_assignment ADD jenis_pic NVARCHAR(10) NOT NULL CONSTRAINT DF_aset_pic_jenis DEFAULT ('Orang'); -- 'Orang' | 'Bagian'
    PRINT 'Kolom jenis_pic ditambahkan (baris lama otomatis jadi Orang).';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('aset.pic_assignment') AND name = 'nik' AND is_nullable = 0)
BEGIN
    ALTER TABLE aset.pic_assignment ALTER COLUMN nik NVARCHAR(20) NULL;
    PRINT 'Kolom nik dilonggarkan jadi NULLable.';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('aset.pic_assignment') AND name = 'nama_pic' AND is_nullable = 0)
BEGIN
    ALTER TABLE aset.pic_assignment ALTER COLUMN nama_pic NVARCHAR(150) NULL;
    PRINT 'Kolom nama_pic dilonggarkan jadi NULLable.';
END
GO

IF COL_LENGTH('aset.pic_assignment', 'id_unit') IS NULL
BEGIN
    ALTER TABLE aset.pic_assignment ADD id_unit INT NULL;             -- grading.unit_organisasi.id_unit (Bagian), tanpa FK lintas skema
    PRINT 'Kolom id_unit ditambahkan.';
END
GO

IF COL_LENGTH('aset.pic_assignment', 'nama_unit') IS NULL
BEGIN
    ALTER TABLE aset.pic_assignment ADD nama_unit NVARCHAR(150) NULL; -- snapshot nama Bagian
    PRINT 'Kolom nama_unit ditambahkan.';
END
GO