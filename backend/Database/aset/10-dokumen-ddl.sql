/* ============================================================================
   aset.dokumen - lampiran dokumen per aset (sertifikat tanah, IMB, BPKB, STNK,
   polis asuransi, dll) beserta tanggal jatuh tempo untuk reminder. Aug 2026.
   ----------------------------------------------------------------------------
   File fisik disimpan di disk (pola sama seperti modul Inovasi -
   backend/Controllers/InovasiController.cs UploadRoot()), path relatif +
   nama asli disimpan di kolom file_path/file_nama_asli - BUKAN byte[] di DB.
   objectid mengacu ke GCS.dbo.assets.OBJECTID, TANPA FK lintas database
   (konsisten dengan seluruh tabel aset.* lain).

   status 'Nonaktif' dipakai saat dokumen diganti versi baru (mis. perpanjangan
   sertifikat) - baris lama TIDAK dihapus, supaya riwayat dokumen tetap ada.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\10-dokumen-ddl.sql
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

IF OBJECT_ID('aset.dokumen', 'U') IS NULL
BEGIN
    CREATE TABLE aset.dokumen
    (
        id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_dokumen PRIMARY KEY,
        objectid        VARCHAR(50)   NOT NULL,
        jenis_dokumen   NVARCHAR(50)  NOT NULL,
        nomor_dokumen   NVARCHAR(100) NULL,
        tgl_terbit      DATE          NULL,
        tgl_jatuh_tempo DATE          NULL,
        file_path       NVARCHAR(300) NULL,
        file_nama_asli  NVARCHAR(255) NULL,
        catatan         NVARCHAR(500) NULL,
        status          NVARCHAR(20)  NOT NULL CONSTRAINT DF_aset_dokumen_status DEFAULT (N'Aktif'),
        id_pembuat      NVARCHAR(20)  NOT NULL,
        tgl_dibuat      DATETIME2     NOT NULL CONSTRAINT DF_aset_dokumen_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah     NVARCHAR(20)  NULL,
        tgl_diubah      DATETIME2     NULL
    );
    CREATE INDEX IX_aset_dokumen_objectid ON aset.dokumen (objectid);
    PRINT 'Tabel aset.dokumen dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.dokumen sudah ada.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('aset.dokumen') AND name = 'IX_aset_dokumen_jatuh_tempo')
BEGIN
    CREATE INDEX IX_aset_dokumen_jatuh_tempo ON aset.dokumen (tgl_jatuh_tempo) WHERE status = N'Aktif';
    PRINT 'Index IX_aset_dokumen_jatuh_tempo dibuat.';
END
ELSE
    PRINT 'LEWATI: index IX_aset_dokumen_jatuh_tempo sudah ada.';
GO