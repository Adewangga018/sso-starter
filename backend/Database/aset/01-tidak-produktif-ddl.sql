/* ============================================================================
   aset.tidak_produktif - register aset tidak produktif (idle, menunggu dijual)
   PT GCS, di db_mygcs, schema aset (sama dengan aset.aset & aset.maintenance
   yang dipakai My Asset > Inventaris & Maintenance).
   ----------------------------------------------------------------------------
   LATAR BELAKANG
   Tabel BERDIRI SENDIRI - sengaja TIDAK terhubung (tanpa FK) ke aset.aset.
   aset.aset melacak inventaris aset yang masih dipakai operasional (siklus
   maintenance); tabel ini melacak aset yang sudah tidak produktif dan dalam
   proses/menunggu dijual, sumber datanya legalitas (sertifikat tanah/bangunan)
   bukan siklus perawatan. jenis membedakan kategori aset (Tanah, Bangunan,
   Kendaraan, PC, Server, Perlengkapan Bengkel, dst - daftar akan terus
   bertambah) - kolom sertifikat_* & qty/satuan hanya relevan untuk jenis
   Tanah/Bangunan, NULL untuk jenis lain.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\01-tidak-produktif-ddl.sql

   Idempoten: aman dijalankan ulang - tiap objek dicek dulu sebelum dibuat.
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

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'aset')
BEGIN
    EXEC('CREATE SCHEMA aset AUTHORIZATION dbo');
    PRINT 'Schema aset dibuat.';
END
ELSE
    PRINT 'LEWATI: schema aset sudah ada.';
GO

IF OBJECT_ID('aset.tidak_produktif', 'U') IS NULL
BEGIN
    CREATE TABLE aset.tidak_produktif
    (
        id                        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_tidak_produktif PRIMARY KEY,
        jenis                     NVARCHAR(50)   NOT NULL,   -- 'Tanah' | 'Bangunan' | 'Tanah & Bangunan' | 'Kendaraan' | 'PC' | 'Server' | 'Perlengkapan Bengkel' | 'Lainnya'
        nama                      NVARCHAR(200)  NULL,       -- deskripsi singkat, berguna utk jenis non-tanah (PC/kendaraan/dst)
        sertifikat_hak            NVARCHAR(500)  NULL,       -- mis. 'HGB a.n PT Gresik Cipta Sejahtera' - hanya Tanah/Bangunan; bisa berisi deskripsi legal panjang (mis. riwayat Letter C)
        sertifikat_jangka_waktu   DATE           NULL,
        sertifikat_no             NVARCHAR(100)  NULL,
        sertifikat_tahun          INT            NULL,
        sertifikat_keterangan     NVARCHAR(500)  NULL,
        lokasi                    NVARCHAR(500)  NULL,
        qty                       DECIMAL(18,2)  NULL,
        satuan                    NVARCHAR(20)   NOT NULL CONSTRAINT DF_aset_tidak_produktif_satuan DEFAULT ('M2'),
        status_jaminan            NVARCHAR(200)  NULL,       -- mis. nama bank penjamin, atau NULL bila tidak dijaminkan
        harga_pasar               DECIMAL(18,2)  NULL,
        appraisal_harga           DECIMAL(18,2)  NULL,
        appraisal_kjpp            NVARCHAR(300)  NULL,       -- nama Kantor Jasa Penilai Publik (KJPP)
        appraisal_tahun           INT            NULL,
        appraisal_no              NVARCHAR(300)  NULL,       -- no. laporan appraisal, bisa memuat tgl laporan
        pbb_nop                   NVARCHAR(50)   NULL,       -- Nomor Objek Pajak PBB
        pbb_nominal               DECIMAL(18,2)  NULL,
        pbb_tgl_pembayaran        DATE           NULL,
        catatan_akt               CHAR(1)        NULL,       -- 'Y' | 'T'
        perijinan_pemegang_saham  NVARCHAR(1000) NULL,       -- mis. no./tgl keputusan RUPS terkait penghapusbukuan
        id_pembuat                NVARCHAR(20)   NOT NULL,
        tgl_dibuat                DATETIME2      NOT NULL CONSTRAINT DF_aset_tidak_produktif_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah               NVARCHAR(20)   NULL,
        tgl_diubah                DATETIME2      NULL
    );
    PRINT 'Tabel aset.tidak_produktif dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.tidak_produktif sudah ada.';
GO