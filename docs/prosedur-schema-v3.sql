/* ============================================================================
   prosedur v3 - dokumen terpusat (Umum) + dokumen privasi unit (Unit).
   - lingkup 'Umum'  : dikelola Admin Kepatuhan, dibaca semua karyawan (default).
   - lingkup 'Unit'  : privasi satu Departemen. Dibaca anggota departemen +
                       Admin Kepatuhan; diunggah/dikelola PIMPINAN unit
                       (Kepala Bagian ke atas, band urutan <= 3) di departemen itu.
   id_unit_pemilik = id_unit Departemen pemilik (grading.unit_organisasi), utk
   dokumen lingkup 'Unit'. Dokumen lama -> 'Umum'.

   SQL Server 2014. NON-DESTRUKTIF & idempoten.
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

IF COL_LENGTH('prosedur.dokumen', 'lingkup') IS NULL
BEGIN
    ALTER TABLE prosedur.dokumen ADD lingkup NVARCHAR(10) NOT NULL
        CONSTRAINT df_prosedur_dok_lingkup DEFAULT ('Umum');
    -- dokumen lama = terpusat/umum
    EXEC('UPDATE prosedur.dokumen SET lingkup = ''Umum''');
    PRINT 'Kolom prosedur.dokumen.lingkup ditambahkan.';
END
ELSE PRINT 'LEWATI: kolom lingkup sudah ada.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_prosedur_dok_lingkup')
    ALTER TABLE prosedur.dokumen ADD CONSTRAINT ck_prosedur_dok_lingkup
        CHECK (lingkup IN ('Umum','Unit'));
GO

IF COL_LENGTH('prosedur.dokumen', 'id_unit_pemilik') IS NULL
BEGIN
    ALTER TABLE prosedur.dokumen ADD id_unit_pemilik INT NULL;
    CREATE INDEX ix_prosedur_dok_unit ON prosedur.dokumen (id_unit_pemilik);
    PRINT 'Kolom prosedur.dokumen.id_unit_pemilik ditambahkan.';
END
ELSE PRINT 'LEWATI: kolom id_unit_pemilik sudah ada.';
GO

SET NOEXEC OFF;
GO
