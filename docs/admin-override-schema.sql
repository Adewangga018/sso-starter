-- dbo.admin_override - toggle manual "Admin SDM"/"Admin Kepatuhan" per karyawan, terlepas
-- dari jabatan Struktur Organisasi - HANYA bisa dikelola dari Panel Admin IT. Non-destruktif
-- & idempoten.
IF OBJECT_ID('dbo.admin_override', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.admin_override
    (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_admin_override PRIMARY KEY,
        id_karyawan     NVARCHAR(20)  NOT NULL,
        nama_karyawan   NVARCHAR(150) NULL,
        modul           NVARCHAR(20)  NOT NULL,
        aktif           BIT NOT NULL CONSTRAINT df_admin_override_aktif DEFAULT (1),
        diberikan_oleh  NVARCHAR(20)  NOT NULL,
        diberikan_pada  DATETIME2 NOT NULL CONSTRAINT df_admin_override_diberikan DEFAULT (SYSUTCDATETIME()),
        diperbarui_pada DATETIME2 NOT NULL CONSTRAINT df_admin_override_ubah DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT uq_admin_override UNIQUE (id_karyawan, modul),
        CONSTRAINT ck_admin_override_modul CHECK (modul IN ('SDM','Kepatuhan'))
    );
    PRINT 'Tabel dbo.admin_override dibuat.';
END
ELSE PRINT 'LEWATI: dbo.admin_override sudah ada.';
GO
