/* ============================================================================
   My Office — notifikasi persuratan (menu "Notifikasi").

   Satu baris = satu pemberitahuan untuk SATU pegawai. Notifikasi dibuat aplikasi
   pada titik-titik alur surat: dikirim ke reviewer, naik ke approval, disetujui
   final (ke tujuan & tembusan), ditolak/diminta revisi (ke pembuat), dan saat
   surat didisposisikan.

   Berbeda dengan office.surat_riwayat yang merekam JEJAK pada satu surat,
   tabel ini adalah KOTAK PEMBERITAHUAN milik pegawai — punya status baca
   sendiri, terpisah dari status baca surat di office.surat_dibaca.

   Kompatibel SQL Server 2014. Idempoten. Jalankan pada db_mygcs SETELAH
   docs/office-schema.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID('office.notifikasi', 'U') IS NULL
BEGIN
    CREATE TABLE office.notifikasi (
        id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_notifikasi PRIMARY KEY,
        nik          NVARCHAR(50)  NOT NULL,   -- penerima pemberitahuan
        judul        NVARCHAR(300) NOT NULL,   -- mis. "Ada surat baru untuk anda"
        id_surat     BIGINT        NULL,       -- surat yang dirujuk (bila ada)
        oleh_nik     NVARCHAR(50)  NULL,       -- pemicu: pembuat / approver / pendisposisi
        oleh_nama    NVARCHAR(200) NULL,
        oleh_jabatan NVARCHAR(200) NULL,
        dibaca_pada  DATETIME2     NULL,       -- NULL = belum dibaca
        dibuat_pada  DATETIME2     NOT NULL CONSTRAINT df_notif_dibuat DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_notif_surat FOREIGN KEY (id_surat) REFERENCES office.surat (id) ON DELETE CASCADE
    );
END
GO

/* Kueri utamanya "notifikasi saya, terbaru dulu" — indeks ini melayaninya
   sekaligus penghitungan tab Read/Unread lewat kolom dibaca_pada. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_notif_nik' AND object_id = OBJECT_ID('office.notifikasi'))
    CREATE INDEX ix_notif_nik ON office.notifikasi (nik, dibuat_pada DESC) INCLUDE (dibaca_pada);
GO

PRINT 'office.notifikasi siap.';
GO
