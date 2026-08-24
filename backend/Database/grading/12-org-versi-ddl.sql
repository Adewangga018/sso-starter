/* ===========================================================================
   grading.org_versi - riwayat versi Struktur Organisasi, terikat dokumen SK
   direksi (diminta 2026-08-24; status Draft/Berlaku ditambahkan 2026-08-24
   sesuai masukan - SK bisa dilampirkan dulu sbg draft sebelum resmi berlaku).
   Struktur Organisasi TIDAK lagi statis: admin melampirkan SK sbg DRAFT dulu
   (nomor versi dicadangkan, belum membekukan apa pun), lalu kapan pun siap
   menekan "Berlakukan" - BARU PADA SAAT ITU sistem MEMBEKUKAN snapshot kondisi
   grading.unit_organisasi/jabatan/penempatan/pejabat_sementara LIVE saat itu ke
   kolom snapshot_json (lihat OrgVersiService.BerlakukanVersiAsync). Berkas SK
   sendiri (varbinary, pola sama dgn prosedur.versi - lihat
   backend/Services/ProsedurService.cs) sudah tersimpan sejak draft dibuat.

   Status:
     - Draft:    SK+metadata sudah tersimpan, snapshot_json MASIH NULL (belum
                 resmi berlaku, belum membekukan apa pun).
     - Berlaku:  versi resmi aktif saat ini (snapshot_json terisi). Hanya SATU
                 baris boleh Berlaku pada satu waktu - Berlakukan versi baru
                 otomatis memindah versi Berlaku lama ke Usang.
     - Usang:    versi resmi yang sudah digantikan versi Berlaku berikutnya.
     - Dibatalkan: draft yang batal dipakai (ditandai, bukan dihapus - jaga jejak).

   Penomoran versi (dicadangkan SAAT DRAFT DIBUAT, bukan saat diberlakukan):
     - MINOR (v1.0 -> v1.1 -> v1.2 ...): perubahan PENEMPATAN saja, struktur
       unit/jabatan tidak berubah.
     - MAJOR (v1.x -> v2.0 -> v3.0 ...): perubahan STRUKTUR (unit/jabatan) -
       otomatis mereset versi_minor ke 0.
   Admin yang memilih Minor/Major saat membuat draft (bukan dideteksi otomatis) -
   SK adalah dokumen legal, harus cocok levelnya dgn keputusan admin.

   Data LIVE (unit_organisasi/jabatan/penempatan/pejabat_sementara) TETAP diedit
   spt biasa via OrgStrukturService - tabel ini hanya lapisan snapshot/riwayat DI
   ATASNYA, tidak mengubah alur CRUD yang sudah ada.

   v1.0 (baris pertama) adalah versi baseline sebelum sistem ini ada - konten_sk
   NULL (tidak ada SK, digrandfather-kan), langsung Berlaku (tanpa lewat Draft).
   Baseline INI TIDAK di-seed di sini: server SQL Server dev (2014, compat level
   120) tidak mendukung FOR JSON (baru ada di 2016/compat 130+), jadi snapshot
   v1.0 dibangun aplikasi sendiri (System.Text.Json, portable di semua versi SQL
   Server) - lihat OrgVersiService.PastikanBaselineAsync, dipanggil lazy sama
   spt pola CutiService.AkrualJikaSiklusBaruAsync /
   OrgStrukturService.NaikkanPgOtomatisJikaSaatnyaAsync (dicek tiap kali daftar
   versi dibaca, insert sekali kalau tabel masih kosong).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\grading\12-org-versi-ddl.sql

   Idempoten: aman dijalankan ulang.
   =========================================================================== */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('Skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('grading.org_versi', 'U') IS NULL
BEGIN
    CREATE TABLE grading.org_versi
    (
        id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_grading_org_versi PRIMARY KEY,
        versi_major       INT NOT NULL,
        versi_minor       INT NOT NULL,
        jenis             NVARCHAR(10) NOT NULL CONSTRAINT CK_org_versi_jenis CHECK (jenis IN ('Minor','Major')),
        nomor_sk          NVARCHAR(100) NULL,
        tanggal_sk        DATE NULL,
        ringkasan         NVARCHAR(500) NULL,
        nama_file_sk      NVARCHAR(255) NULL,
        tipe_file_sk      NVARCHAR(100) NULL,
        konten_sk         VARBINARY(MAX) NULL,     -- NULL hanya utk v1.0 baseline (tanpa SK)
        snapshot_json     NVARCHAR(MAX) NULL,       -- NULL selama status Draft, terisi saat Berlaku
        status            NVARCHAR(20) NOT NULL CONSTRAINT DF_org_versi_status DEFAULT ('Draft')
                              CONSTRAINT CK_org_versi_status CHECK (status IN ('Draft','Berlaku','Usang','Dibatalkan')),
        diterbitkan_oleh  NVARCHAR(20) NULL,
        nama_penerbit     NVARCHAR(150) NULL,
        diterbitkan_pada  DATETIME2 NOT NULL CONSTRAINT DF_org_versi_diterbitkan DEFAULT (SYSDATETIME()),
        CONSTRAINT UQ_grading_org_versi_nomor UNIQUE (versi_major, versi_minor)
    );
    PRINT 'Tabel grading.org_versi dibuat.';
END
ELSE
BEGIN
    PRINT 'LEWATI: grading.org_versi sudah ada - memastikan status Draft & snapshot_json nullable tersedia.';
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_org_versi_status')
        ALTER TABLE grading.org_versi DROP CONSTRAINT CK_org_versi_status;
    ALTER TABLE grading.org_versi ADD CONSTRAINT CK_org_versi_status CHECK (status IN ('Draft','Berlaku','Usang','Dibatalkan'));
    ALTER TABLE grading.org_versi ALTER COLUMN snapshot_json NVARCHAR(MAX) NULL;
END
GO

SET NOEXEC OFF;
GO
