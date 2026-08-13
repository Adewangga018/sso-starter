/* ============================================================================
   aset.kondisi, aset.pic_assignment, aset.aktivitas - lapisan operasional My
   Asset di atas master ERP (GCS.dbo.assets), Aug 2026.
   ----------------------------------------------------------------------------
   PRINSIP: dbo.assets TETAP satu-satunya sumber identitas/master aset (kode,
   nama, kategori, nilai). Tabel di sini HANYA menyimpan hal yang TIDAK ada di
   ERP (kondisi fisik, PIC, log aktivitas operasional) - direferensikan lewat
   objectid (varchar, = dbo.assets.OBJECTID). TIDAK ada FK lintas database ke
   GCS (SQL Server tidak mendukungnya dengan baik & GCS dikelola sistem lain) -
   konsisten dengan pola referensi tanpa-FK yang sudah dipakai di grading/inovasi.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\06-overlay-ddl.sql

   Idempoten: aman dijalankan ulang.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

-- Kondisi fisik operasional aset - 1 baris per objectid (upsert), karena
-- dbo.assets tidak melacak kondisi (baik/rusak).
IF OBJECT_ID('aset.kondisi', 'U') IS NULL
BEGIN
    CREATE TABLE aset.kondisi
    (
        objectid     VARCHAR(20)   NOT NULL CONSTRAINT PK_aset_kondisi PRIMARY KEY,
        kondisi      NVARCHAR(20)  NOT NULL CONSTRAINT DF_aset_kondisi_kondisi DEFAULT ('Baik'), -- 'Baik' | 'Rusak Ringan' | 'Rusak Berat' | 'Hilang'
        catatan      NVARCHAR(500) NULL,
        id_pengubah  NVARCHAR(20)  NOT NULL,
        tgl_diubah   DATETIME2     NOT NULL CONSTRAINT DF_aset_kondisi_tgl DEFAULT (SYSUTCDATETIME())
    );
    PRINT 'Tabel aset.kondisi dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.kondisi sudah ada.';
GO

-- PIC (penanggung jawab) per aset + histori lengkap (baris lama ditutup lewat
-- tgl_selesai, tidak pernah ditimpa) - basis untuk clearance sheet SDM.
IF OBJECT_ID('aset.pic_assignment', 'U') IS NULL
BEGIN
    CREATE TABLE aset.pic_assignment
    (
        id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_pic PRIMARY KEY,
        objectid     VARCHAR(20)   NOT NULL,
        nik          NVARCHAR(20)  NOT NULL,
        nama_pic     NVARCHAR(150) NOT NULL,   -- snapshot nama saat assignment dibuat
        departemen   NVARCHAR(150) NULL,       -- snapshot
        tgl_mulai    DATE          NOT NULL,
        tgl_selesai  DATE          NULL,        -- NULL = masih aktif jadi PIC
        status       NVARCHAR(20)  NOT NULL CONSTRAINT DF_aset_pic_status DEFAULT ('Aktif'), -- 'Aktif' | 'Dikembalikan' | 'Dipindahkan'
        catatan      NVARCHAR(500) NULL,
        id_pembuat   NVARCHAR(20)  NOT NULL,
        tgl_dibuat   DATETIME2     NOT NULL CONSTRAINT DF_aset_pic_tgldibuat DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_aset_pic_objectid ON aset.pic_assignment (objectid, status);
    CREATE INDEX IX_aset_pic_nik ON aset.pic_assignment (nik, status);
    PRINT 'Tabel aset.pic_assignment dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.pic_assignment sudah ada.';
GO

-- Log aktivitas umum SEMUA aset (bukan cuma tidak produktif): pemeliharaan,
-- mutasi lokasi, penghapusan/write-off, appraisal ulang, klaim asuransi,
-- perpanjangan pajak/STNK/sertifikat, dst. Beda dgn aset.tidak_produktif_aktivitas
-- yang tetap khusus kunjungan calon pembeli & negosiasi harga aset tidak produktif.
IF OBJECT_ID('aset.aktivitas', 'U') IS NULL
BEGIN
    CREATE TABLE aset.aktivitas
    (
        id                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_aktivitas PRIMARY KEY,
        objectid          VARCHAR(20)    NOT NULL,
        jenis             NVARCHAR(50)   NOT NULL,   -- 'Pemeliharaan' | 'Mutasi Lokasi' | 'Penghapusan' | 'Appraisal Ulang' | 'Klaim Asuransi' | 'Perpanjangan Pajak/STNK' | 'Perpanjangan Sertifikat' | 'Lainnya' (bebas)
        tgl_aktivitas     DATE           NOT NULL,
        deskripsi         NVARCHAR(1000) NULL,
        vendor_pelaksana  NVARCHAR(200)  NULL,
        biaya             DECIMAL(18,2)  NULL,
        status            NVARCHAR(30)   NOT NULL CONSTRAINT DF_aset_aktivitas_status DEFAULT ('Selesai'), -- 'Dijadwalkan' | 'Proses' | 'Selesai' | 'Batal'
        id_pembuat        NVARCHAR(20)   NOT NULL,
        tgl_dibuat        DATETIME2      NOT NULL CONSTRAINT DF_aset_aktivitas_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah       NVARCHAR(20)   NULL,
        tgl_diubah        DATETIME2      NULL
    );
    CREATE INDEX IX_aset_aktivitas_objectid ON aset.aktivitas (objectid, tgl_aktivitas DESC);
    PRINT 'Tabel aset.aktivitas dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.aktivitas sudah ada.';
GO