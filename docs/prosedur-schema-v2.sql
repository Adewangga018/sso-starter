/* ============================================================================
   prosedur v2 - tambahan cakupan Kompartemen untuk modul My Prosedur.
   - prosedur.dokumen.semua_kompartemen : dokumen berlaku untuk SEMUA kompartemen.
   - prosedur.dokumen_kompartemen        : bila tidak semua, daftar kompartemen
                                           tertentu yang berlaku (multi).
   Nama kompartemen & departemen (kolom unit) mengacu grading.unit_organisasi
   (tipe='Kompartemen' / 'Departemen'); disimpan sebagai teks nama.

   SQL Server 2014 (compat 120). NON-DESTRUKTIF & idempoten.
   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\prosedur-schema-v2.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Kolom penanda "berlaku untuk semua kompartemen" -------------------------- */
IF COL_LENGTH('prosedur.dokumen', 'semua_kompartemen') IS NULL
BEGIN
    ALTER TABLE prosedur.dokumen
        ADD semua_kompartemen BIT NOT NULL
        CONSTRAINT df_prosedur_dok_semuakomp DEFAULT (0);
    -- Dokumen lama (sebelum fitur ini) dianggap berlaku untuk semua kompartemen
    -- supaya tetap tampil. EXEC agar kolom baru sudah "terlihat" saat UPDATE.
    EXEC('UPDATE prosedur.dokumen SET semua_kompartemen = 1');
    PRINT 'Kolom prosedur.dokumen.semua_kompartemen ditambahkan.';
END
ELSE PRINT 'LEWATI: kolom semua_kompartemen sudah ada.';
GO

/* Daftar kompartemen tertentu per dokumen ---------------------------------- */
IF OBJECT_ID('prosedur.dokumen_kompartemen', 'U') IS NULL
BEGIN
    CREATE TABLE prosedur.dokumen_kompartemen
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_prosedur_dokkomp PRIMARY KEY,
        id_dokumen  BIGINT NOT NULL,
        kompartemen NVARCHAR(150) NOT NULL,
        CONSTRAINT fk_prosedur_dokkomp_dok FOREIGN KEY (id_dokumen) REFERENCES prosedur.dokumen (id),
        CONSTRAINT uq_prosedur_dokkomp UNIQUE (id_dokumen, kompartemen)
    );
    CREATE INDEX ix_prosedur_dokkomp_dok ON prosedur.dokumen_kompartemen (id_dokumen);
    CREATE INDEX ix_prosedur_dokkomp_komp ON prosedur.dokumen_kompartemen (kompartemen);
    PRINT 'Tabel prosedur.dokumen_kompartemen dibuat.';
END
ELSE PRINT 'LEWATI: prosedur.dokumen_kompartemen sudah ada.';
GO

SET NOEXEC OFF;
GO
