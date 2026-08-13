/* ============================================================================
   aset.opname_sesi + aset.opname_scan - stock opname digital berbasis scan QR.
   Aug 2026.
   ----------------------------------------------------------------------------
   opname_sesi   : header/batch satu putaran opname (mis. "Opname Q3 2026 -
                   Pabrik Lampung"), opsional dibatasi ke kategori tertentu
                   lewat lingkup_kategori (comma-separated GROUP_ASSET, NULL =
                   semua aset).
   opname_scan   : event tiap kali aset di-scan dalam satu sesi - APPEND ONLY,
                   bukan upsert (aset yang discan >1x dalam sesi yang sama
                   boleh, baris terakhir = data terbaru). Laporan selisih
                   (aset tercatat tapi belum discan) dihitung lewat query, tidak
                   perlu tabel tambahan.
   Foto discan disimpan di disk (pola sama seperti Inovasi), path relatif di
   foto_path. objectid mengacu ke GCS.dbo.assets.OBJECTID, tanpa FK lintas DB.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\11-opname-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.opname_sesi', 'U') IS NULL
BEGIN
    CREATE TABLE aset.opname_sesi
    (
        id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_opname_sesi PRIMARY KEY,
        nama_sesi        NVARCHAR(150) NOT NULL,
        tgl_mulai        DATE          NOT NULL,
        tgl_selesai      DATE          NULL,
        status           NVARCHAR(20)  NOT NULL CONSTRAINT DF_aset_opname_sesi_status DEFAULT (N'Berjalan'),
        lingkup_kategori NVARCHAR(500) NULL,
        catatan          NVARCHAR(500) NULL,
        id_pembuat       NVARCHAR(20)  NOT NULL,
        tgl_dibuat       DATETIME2     NOT NULL CONSTRAINT DF_aset_opname_sesi_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah      NVARCHAR(20)  NULL,
        tgl_diubah       DATETIME2     NULL
    );
    PRINT 'Tabel aset.opname_sesi dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.opname_sesi sudah ada.';
GO

IF OBJECT_ID('aset.opname_scan', 'U') IS NULL
BEGIN
    CREATE TABLE aset.opname_scan
    (
        id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_opname_scan PRIMARY KEY,
        id_sesi        INT           NOT NULL CONSTRAINT FK_aset_opname_scan_sesi
                            REFERENCES aset.opname_sesi (id),
        objectid       VARCHAR(50)   NOT NULL,
        lokasi_aktual  NVARCHAR(200) NULL,
        kondisi_aktual NVARCHAR(30)  NULL,
        foto_path      NVARCHAR(300) NULL,
        foto_nama_asli NVARCHAR(255) NULL,
        catatan        NVARCHAR(500) NULL,
        nik_pemindai   VARCHAR(20)   NOT NULL,
        tgl_scan       DATETIME2     NOT NULL CONSTRAINT DF_aset_opname_scan_tglscan DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_aset_opname_scan_sesi_objectid ON aset.opname_scan (id_sesi, objectid);
    PRINT 'Tabel aset.opname_scan dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.opname_scan sudah ada.';
GO