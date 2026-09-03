/* ============================================================================
   tiket.progres - schema `tiket` di db_mygcs. Progres tindak lanjut staf
   Sekretariat atas pemesanan tiket yang SUDAH disetujui atasan (approval.pengajuan,
   Jenis='Tiket'). Layer PARALEL: TIDAK menyentuh tabel legacy GCS
   (intranet.web_sdm_pesan_tiket), yang dipakai bersama EASy - jadi tidak aman
   ditambah kolom. ref_id merujuk ke WebSdmPesanTiket.id, satu baris per tiket
   (dibuat on-demand saat staf Sekretariat pertama kali mengubah statusnya -
   sebelum itu dianggap "Belum Diproses" tanpa baris tersendiri).

   SQL Server 2014 (compat 120). NON-DESTRUKTIF (pola IF OBJECT_ID ... IS NULL
   CREATE). Idempoten.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

IF SCHEMA_ID('tiket') IS NULL EXEC('CREATE SCHEMA tiket');
GO

IF OBJECT_ID('tiket.progres', 'U') IS NULL
BEGIN
    CREATE TABLE tiket.progres (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_tiket_progres PRIMARY KEY,
        ref_id         NVARCHAR(50)   NOT NULL,   -- WebSdmPesanTiket.id
        status         NVARCHAR(20)   NOT NULL CONSTRAINT df_tiket_progres_status DEFAULT ('Belum Diproses'),
        catatan        NVARCHAR(400)  NULL,
        diproses_oleh  NVARCHAR(50)   NULL,       -- NIK staf Sekretariat
        diproses_pada  DATETIME2      NULL,
        CONSTRAINT ck_tiket_progres_status CHECK (status IN ('Belum Diproses','Sedang Diproses','Selesai')),
        CONSTRAINT uq_tiket_progres_ref UNIQUE (ref_id)
    );
    PRINT 'tiket.progres dibuat.';
END
ELSE PRINT 'LEWATI: tiket.progres sudah ada.';
GO

SET NOEXEC OFF;
GO
