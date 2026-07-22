/* ============================================================================
   inovasi - Tahap 2: Sumbang Gagasan (alur persetujuan) + dukungan backend GIO.
   ----------------------------------------------------------------------------
   Menambahkan:
     - inovasi.gagasan          : usulan awal (judul + latar belakang) yang
                                   dinilai berjenjang: Fasilitator (Manager) ->
                                   Verifikator (GM) -> VP Dep. Asal -> VP Dep.
                                   Tujuan -> lalu didaftarkan ke SERGIO (jadi gugus).
     - inovasi.gagasan_approval : langkah persetujuan + catatan tiap approver.
     - inovasi.pareto           : P.3 Stratifikasi & Pareto (khusus GIO).
     - kolom baru pada inovasi.gugus: verifikasi_akar (GIO P.8), id_gagasan
       (tautan ke gagasan sumbernya).
     - jenis gugus diperluas: 'SS' | 'GIO' | '5R'.

   Idempoten. Jalankan setelah 01-schema-ddl.sql.
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\inovasi\02-gagasan-gio.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    DECLARE @db SYSNAME = DB_NAME();
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs, bukan %s.', 16, 1, @db);
    SET NOEXEC ON;
END
GO

/* --- gugus: perluas jenis jadi SS|GIO|5R + kolom GIO/gagasan --- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_inovasi_gugus_jenis')
BEGIN
    ALTER TABLE inovasi.gugus DROP CONSTRAINT CK_inovasi_gugus_jenis;
    PRINT 'CK_inovasi_gugus_jenis lama dihapus.';
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_inovasi_gugus_jenis')
BEGIN
    ALTER TABLE inovasi.gugus WITH CHECK ADD CONSTRAINT CK_inovasi_gugus_jenis CHECK (jenis IN ('SS','GIO','5R'));
    PRINT 'CK_inovasi_gugus_jenis (SS/GIO/5R) dibuat.';
END
GO
IF COL_LENGTH('inovasi.gugus', 'verifikasi_akar') IS NULL
BEGIN
    ALTER TABLE inovasi.gugus ADD verifikasi_akar NVARCHAR(MAX) NULL;
    PRINT 'Kolom inovasi.gugus.verifikasi_akar ditambahkan.';
END
GO
IF COL_LENGTH('inovasi.gugus', 'id_gagasan') IS NULL
BEGIN
    ALTER TABLE inovasi.gugus ADD id_gagasan INT NULL;
    PRINT 'Kolom inovasi.gugus.id_gagasan ditambahkan.';
END
GO

/* --- pareto (GIO P.3 Stratifikasi & Diagram Pareto) --- */
IF OBJECT_ID('inovasi.pareto', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.pareto
    (
        id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_pareto PRIMARY KEY,
        id_gugus  INT           NOT NULL,
        kategori  NVARCHAR(300) NULL,
        frekuensi INT           NULL,
        urutan    INT           NOT NULL CONSTRAINT DF_inovasi_pareto_urut DEFAULT (0),
        CONSTRAINT FK_inovasi_pareto_gugus FOREIGN KEY (id_gugus) REFERENCES inovasi.gugus (id) ON DELETE CASCADE
    );
    CREATE INDEX IX_inovasi_pareto_gugus ON inovasi.pareto (id_gugus);
    PRINT 'Tabel inovasi.pareto dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.pareto sudah ada.';
GO

/* --- gagasan (Sumbang Gagasan) --- */
IF OBJECT_ID('inovasi.gagasan', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.gagasan
    (
        id                      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_gagasan PRIMARY KEY,
        no_registrasi           NVARCHAR(60)  NULL,
        judul                   NVARCHAR(500) NOT NULL,
        latar_belakang          NVARCHAR(MAX) NULL,          -- gambaran kondisi awal
        metodologi              NVARCHAR(10)  NULL,          -- SS|GIO|5R (dipilih Verifikator)
        created_by_nik          NVARCHAR(20)  NOT NULL,
        created_by_nama         NVARCHAR(150) NULL,
        id_departemen_asal      INT           NULL,
        nama_departemen_asal    NVARCHAR(150) NULL,
        id_kompartemen_asal     INT           NULL,
        nama_kompartemen_asal   NVARCHAR(150) NULL,
        id_departemen_tujuan    INT           NULL,          -- NULL = sama dengan asal
        nama_departemen_tujuan  NVARCHAR(150) NULL,
        id_kompartemen_tujuan   INT           NULL,
        nama_kompartemen_tujuan NVARCHAR(150) NULL,
        status                  NVARCHAR(40)  NOT NULL CONSTRAINT DF_inovasi_gagasan_status DEFAULT ('Dikirim'),
        id_gugus                INT           NULL,          -- terisi saat sudah "Terdaftar Sergio"
        created_at              DATETIME2     NOT NULL CONSTRAINT DF_inovasi_gagasan_created DEFAULT (SYSDATETIME()),
        updated_at              DATETIME2     NULL,
        submitted_at            DATETIME2     NULL,
        CONSTRAINT CK_inovasi_gagasan_status CHECK (status IN
            ('Dikirim','Ditolak','Revisi Fasilitator','Disetujui Fasilitator',
             'Revisi Verifikator','Disetujui Verifikator','Disetujui VP Departemen Asal',
             'Disetujui VP Departemen Tujuan','Terdaftar Sergio')),
        CONSTRAINT CK_inovasi_gagasan_metodologi CHECK (metodologi IS NULL OR metodologi IN ('SS','GIO','5R'))
    );
    CREATE INDEX IX_inovasi_gagasan_creator ON inovasi.gagasan (created_by_nik);
    CREATE INDEX IX_inovasi_gagasan_status  ON inovasi.gagasan (status);
    PRINT 'Tabel inovasi.gagasan dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.gagasan sudah ada.';
GO

/* --- gagasan_approval (langkah persetujuan + catatan) --- */
IF OBJECT_ID('inovasi.gagasan_approval', 'U') IS NULL
BEGIN
    CREATE TABLE inovasi.gagasan_approval
    (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_inovasi_gagasan_approval PRIMARY KEY,
        id_gagasan  INT           NOT NULL,
        urutan      INT           NOT NULL CONSTRAINT DF_inovasi_gagasan_appr_urut DEFAULT (0),
        peran       NVARCHAR(40)  NOT NULL,   -- Fasilitator | Verifikator | VP Departemen Asal | VP Departemen Tujuan
        nik         NVARCHAR(20)  NULL,
        nama        NVARCHAR(150) NULL,
        status      NVARCHAR(20)  NOT NULL CONSTRAINT DF_inovasi_gagasan_appr_status DEFAULT ('Menunggu'),  -- Menunggu|Disetujui|Revisi|Ditolak
        komentar    NVARCHAR(MAX) NULL,
        metodologi  NVARCHAR(10)  NULL,       -- diisi Verifikator saat menyetujui
        tgl         DATETIME2     NULL,
        CONSTRAINT FK_inovasi_gagasan_appr_gagasan FOREIGN KEY (id_gagasan) REFERENCES inovasi.gagasan (id) ON DELETE CASCADE,
        CONSTRAINT CK_inovasi_gagasan_appr_status CHECK (status IN ('Menunggu','Disetujui','Revisi','Ditolak'))
    );
    CREATE INDEX IX_inovasi_gagasan_appr_gagasan ON inovasi.gagasan_approval (id_gagasan);
    CREATE INDEX IX_inovasi_gagasan_appr_nik     ON inovasi.gagasan_approval (nik);
    PRINT 'Tabel inovasi.gagasan_approval dibuat.';
END
ELSE PRINT 'LEWATI: inovasi.gagasan_approval sudah ada.';
GO

PRINT '=== Skema inovasi Tahap 2 (gagasan + GIO) selesai diproses. ===';
SET NOEXEC OFF;
GO
