/* ============================================================================
   My Office — tindak lanjut surat (disposisi).

   Menopang tab "Tindak Lanjut" pada halaman detail surat: penerima surat
   meneruskan / mendisposisikan surat ke pegawai lain dengan catatan, opsional
   dengan berkas lampiran. Kolomnya mengikuti tabel DOF: Tanggal, Keterangan,
   Dari, Untuk, Catatan, Lampiran.

   Kompatibel SQL Server 2014. Idempoten. Jalankan pada db_mygcs SETELAH
   docs/office-schema.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID('office.surat_tindak_lanjut', 'U') IS NULL
BEGIN
    CREATE TABLE office.surat_tindak_lanjut (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_surat_tl PRIMARY KEY,
        id_surat      BIGINT        NOT NULL,
        keterangan    NVARCHAR(100) NOT NULL,   -- Diteruskan|Disposisi|Tanggapan|Selesai
        dari_nik      NVARCHAR(50)  NOT NULL,
        dari_nama     NVARCHAR(200) NULL,
        untuk_nik     NVARCHAR(50)  NULL,       -- NULL bila hanya catatan tanpa penerima
        untuk_nama    NVARCHAR(200) NULL,
        catatan       NVARCHAR(MAX) NULL,
        nama_lampiran NVARCHAR(300) NULL,
        path_lampiran NVARCHAR(500) NULL,       -- relatif terhadap folder unggahan office
        ukuran        BIGINT        NULL,
        tipe          NVARCHAR(100) NULL,
        tgl           DATETIME2     NOT NULL CONSTRAINT df_surat_tl_tgl DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_tl_surat FOREIGN KEY (id_surat) REFERENCES office.surat (id) ON DELETE CASCADE,
        CONSTRAINT ck_tl_keterangan CHECK (keterangan IN (N'Diteruskan', N'Disposisi', N'Tanggapan', N'Selesai'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_tl_surat' AND object_id = OBJECT_ID('office.surat_tindak_lanjut'))
    CREATE INDEX ix_tl_surat ON office.surat_tindak_lanjut (id_surat, tgl);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_tl_untuk' AND object_id = OBJECT_ID('office.surat_tindak_lanjut'))
    CREATE INDEX ix_tl_untuk ON office.surat_tindak_lanjut (untuk_nik);
GO

PRINT 'office.surat_tindak_lanjut siap.';
GO
