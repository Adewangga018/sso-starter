/* ============================================================================
   My Office — tambahan tabel penanda baca untuk kotak masuk.
   Dipakai tab "Belum Dibaca" / "Dibaca" pada menu Inbox (meniru DOF).

   Jalankan file ini pada db_mygcs yang schema `office`-nya SUDAH dibuat lewat
   docs/office-schema.sql. Aman dijalankan berulang (idempoten) dan tidak
   menyentuh tabel lain. Kompatibel SQL Server 2014.
   ============================================================================ */

IF OBJECT_ID('office.surat_dibaca', 'U') IS NULL
BEGIN
    CREATE TABLE office.surat_dibaca (
        id_surat    BIGINT       NOT NULL,
        nik         NVARCHAR(50) NOT NULL,
        dibaca_pada DATETIME2    NOT NULL CONSTRAINT df_dibaca_tgl DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_surat_dibaca PRIMARY KEY (id_surat, nik),
        CONSTRAINT fk_dibaca_surat FOREIGN KEY (id_surat) REFERENCES office.surat(id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_dibaca_nik' AND object_id = OBJECT_ID('office.surat_dibaca'))
    CREATE INDEX ix_dibaca_nik ON office.surat_dibaca (nik);
GO
