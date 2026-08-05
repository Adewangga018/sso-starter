/* ============================================================================
   My Office — pindahkan master jenis surat ke schema `office` (db_mygcs),
   lepas dari database DBSMP.

   LATAR BELAKANG: sejak kode jenis surat diambil dari DBSMP.dbo.TB_SURAT_JENIS
   lintas-database, login aplikasi (svc_mygcs) butuh izin SELECT terpisah di
   DBSMP (lihat DEPLOY-IIS.md). Izin itu belum pernah diberikan di server
   produksi, sehingga SETIAP pembacaan jenis surat (Inbox, Inbox CC Otomatis,
   Daftar Surat, Detail Surat, Buat Surat) gagal dengan error permission dan
   tampil sebagai "Terjadi kesalahan (500)" di halaman.

   PERBAIKAN: master jenis surat disalin apa adanya (kode & status per hari
   penyalinan) ke office.ref_jenis_surat — tabel yang sudah ada dan sudah
   dipakai OfficeService, sama seperti office.ref_bagian & office.ref_klasifikasi.
   Aplikasi tidak lagi menyeberang database untuk data ini, sehingga menu-menu
   itu tidak lagi bergantung pada izin lintas-database.

   Kompatibel SQL Server 2014. Idempoten — aman dijalankan berulang.
   Jalankan pada db_mygcs SETELAH docs/office-kode-surat.sql.

   CARA PAKAI
     sqlcmd -S <server> -U sa -P <password> -d db_mygcs -C ^
            -i docs\office-jenis-surat-lokal.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID('office') IS NULL EXEC('CREATE SCHEMA office');
GO

IF OBJECT_ID('office.ref_jenis_surat', 'U') IS NULL
BEGIN
    CREATE TABLE office.ref_jenis_surat (
        kode   NVARCHAR(10)  NOT NULL CONSTRAINT pk_ref_jenis PRIMARY KEY,
        nama   NVARCHAR(100) NOT NULL,
        urutan INT           NOT NULL CONSTRAINT df_ref_jenis_urut DEFAULT 0,
        aktif  BIT           NOT NULL CONSTRAINT df_ref_jenis_aktif DEFAULT 1
    );
END
GO

/* Salinan DBSMP.dbo.TB_SURAT_JENIS per 2026-08-05. Kolom `kode` di sini SAMA
   dengan kolom KD di DBSMP (bukan kolom KODE-nya, yang tidak unik) — kunci ini
   yang tersimpan di office.surat.jenis, jadi harus persis sama supaya surat
   lama & baru tetap konsisten. */
MERGE office.ref_jenis_surat AS t
USING (VALUES
    (N'SD',  N'Surat Dinas',       1, 0),
    (N'SE',  N'Surat Edaran',      2, 0),
    (N'MI',  N'Surat Memo Intern', 3, 1),
    (N'SK',  N'Surat Keputusan',   4, 0),
    (N'ND',  N'Nota Dinas',        5, 0),
    (N'BA',  N'Berita Acara',      6, 0),
    (N'SP',  N'Surat Perjanjian',  7, 1),
    (N'OK',  N'Surat Order Kerja', 8, 0),
    (N'SPK', N'Surat Perintah Kerja', 9, 0),
    (N'AD',  N'Addendum',          10, 1),
    (N'RR',  N'Risalah Rapat',     11, 0),
    (N'DR',  N'Direksi',           12, 1)
) AS s (kode, nama, urutan, aktif)
   ON t.kode = s.kode
 WHEN MATCHED THEN UPDATE SET t.nama = s.nama, t.urutan = s.urutan, t.aktif = s.aktif
 WHEN NOT MATCHED BY TARGET THEN INSERT (kode, nama, urutan, aktif)
      VALUES (s.kode, s.nama, s.urutan, s.aktif);
GO

/* ck_surat_jenis membatasi jenis ke ('DR','MI','BA','RR') dari migrasi lama —
   sudah tidak sesuai (SP & AD kini aktif di master, BA & RR sudah Pasif).
   Kode bagian & klasifikasi tidak dijaga CHECK constraint seperti ini
   (divalidasi di aplikasi lewat JenisAktif/RefBagian/RefKlasifikasi saja) —
   jenis surat disamakan polanya supaya master boleh berubah tanpa migrasi DDL. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_surat_jenis')
    ALTER TABLE office.surat DROP CONSTRAINT ck_surat_jenis;
GO

DECLARE @jenis INT = (SELECT COUNT(*) FROM office.ref_jenis_surat);
DECLARE @aktif INT = (SELECT COUNT(*) FROM office.ref_jenis_surat WHERE aktif = 1);
PRINT CONCAT('ref_jenis_surat : ', @jenis, ' baris (', @aktif, ' aktif)');
GO
