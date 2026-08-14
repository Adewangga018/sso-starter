/* ============================================================================
   aset.klasifikasi - status/klasifikasi tambahan per aset ERP (mis. "Tidak
   Bergerak" untuk tanah/bangunan), TANPA mengubah skema dbo.assets. Aug 2026.
   ----------------------------------------------------------------------------
   dbo.assets murni milik ERP/akuntansi - MyGCS TIDAK PERNAH mengubah skemanya
   (tidak tambah/hapus kolom). Kebutuhan klasifikasi tambahan seperti ini masuk
   ke tabel overlay MyGCS sendiri, sama seperti aset.kondisi/aset.pic_assignment/
   aset.nomor_internal - dihubungkan ke dbo.assets lewat OBJECTID (varchar,
   TANPA foreign key lintas database).

   Upsert (1 baris per objectid+status) - bukan historis, karena ini murni
   penanda klasifikasi, bukan riwayat perubahan state.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\12-klasifikasi-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.klasifikasi', 'U') IS NULL
BEGIN
    CREATE TABLE aset.klasifikasi
    (
        id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_klasifikasi PRIMARY KEY,
        objectid     VARCHAR(50)   NOT NULL,
        status       NVARCHAR(50)  NOT NULL,
        catatan      NVARCHAR(300) NULL,
        id_pembuat   NVARCHAR(20)  NOT NULL,
        tgl_dibuat   DATETIME2     NOT NULL CONSTRAINT DF_aset_klasifikasi_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah  NVARCHAR(20)  NULL,
        tgl_diubah   DATETIME2     NULL,
        CONSTRAINT UQ_aset_klasifikasi_objectid_status UNIQUE (objectid, status)
    );
    CREATE INDEX IX_aset_klasifikasi_objectid ON aset.klasifikasi (objectid);
    PRINT 'Tabel aset.klasifikasi dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.klasifikasi sudah ada.';
GO

-- Seed - hasil pencocokan manual "Aset Tidak Bergerak" tingkat kecocokan TINGGI terhadap
-- daftar sertifikat tanah/bangunan (Aug 2026) - lihat catatan perbandingan di riwayat chat.
-- Aman dijalankan ulang (skip kalau sudah pernah, ditandai lewat id_pembuat).
IF NOT EXISTS (SELECT 1 FROM aset.klasifikasi WHERE id_pembuat = 'SEED-2026-08-KLS')
BEGIN
    DECLARE @rows TABLE (objectid VARCHAR(50), catatan NVARCHAR(300));
    INSERT INTO @rows (objectid, catatan) VALUES
        ('2015010003', N'Cocok sertifikat: Ds. Bocek, Karang Ploso, Malang (Sertifikat No.1/2008)'),
        ('2022010871', N'Cocok sertifikat: Komp. Citra Wisata, Medan Johor, Medan (Sertifikat 311/2011)'),
        ('2015010001', N'Cocok sertifikat: Ds. Suci, Manyar, Gresik (Sertifikat 2769 & 2770/2013)'),
        ('2015010050', N'Cocok sertifikat: Ds. Sudiang, Biringkanaya, Makassar (Sertifikat 21969/2009)'),
        ('2022010870', N'Cocok sertifikat: Ds. Sudiang, Biringkanaya, Makassar (Sertifikat 21969/2009)'),
        ('2015010002', N'Cocok sertifikat: Jl. KIG Raya Selatan Blok A-5, Gresik (Sertifikat 00308 & 00309/2009)'),
        ('2015020733', N'Cocok sertifikat: Jl. KIG Raya Selatan Blok A-5, Gresik (Sertifikat 00308 & 00309/2009)'),
        ('2015010006', N'Cocok sertifikat: Ds. Sukajawa, Bumi Ratu Nuban, Lampung Tengah (Sertifikat 20/2009)'),
        ('2015010056', N'Cocok sertifikat: Ds. Sukajawa, Bumi Ratu Nuban, Lampung Tengah (Sertifikat 20/2009)'),
        ('2015010004', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (Sertifikat 1-5)'),
        ('2015010007', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2015010008', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2015010010', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2015010011', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2015010012', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2015010014', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2015010023', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2019060815', N'Cocok sertifikat: Ds. Nagara Padang, Petir, Serang (klaster Pabrik Petroganik Serang)'),
        ('2016120763', N'Cocok sertifikat: Jl. Raya Petarukan, Kebonsari, Pemalang (Sertifikat HGB 00238)'),
        ('2022010872', N'Cocok sertifikat: Jl. Raya Petarukan, Kebonsari, Pemalang (Sertifikat HGB 00238)');

    INSERT INTO aset.klasifikasi (objectid, status, catatan, id_pembuat, tgl_dibuat)
    SELECT objectid, N'Tidak Bergerak', catatan, N'SEED-2026-08-KLS', SYSUTCDATETIME()
    FROM @rows;

    DECLARE @jumlah INT = (SELECT COUNT(*) FROM aset.klasifikasi WHERE id_pembuat = 'SEED-2026-08-KLS');
    PRINT CONCAT(@jumlah, ' baris klasifikasi "Tidak Bergerak" disisipkan.');
END
ELSE
    PRINT 'LEWATI: seed SEED-2026-08-KLS sudah pernah dijalankan.';
GO