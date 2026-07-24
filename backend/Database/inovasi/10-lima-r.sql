/* ============================================================================
   inovasi - kolom khusus Risalah 5R Housekeeping (Form F-5R-02).
   5R memakai struktur berbeda dari SS/GIO (tanpa PLAN/DO/CHECK/ACTION dan hanya
   satu Lembar Pengesahan). Sub-bagian C/D/F disimpan sebagai JSON agar tidak
   menambah banyak tabel; berkas foto/denah tetap lewat endpoint unggah biasa
   (kolom di sini hanya menyimpan path/nama-nya).
     area_lokasi           : A. Area / Lokasi 5R
     profil_denah_*        : E. gambar denah ruang/area
     dampak_positif(*_lain): G. dampak positif pelaksanaan
     lima_r_jadwal         : C. jadwal (JSON { tahap: [indeks bulan] })
     lima_r_catatan        : D. catatan pertemuan (JSON [{ tahap, tanggal, jam, kehadiran }])
     lima_r_dokumentasi    : F. dokumentasi R1-R5 (JSON per tahap: baris + foto)
   Idempoten. Jalankan setelah 01-schema-ddl.sql.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

DECLARE @cols TABLE (nama SYSNAME, tipe NVARCHAR(50));
INSERT INTO @cols (nama, tipe) VALUES
    ('area_lokasi',            'NVARCHAR(200)'),
    ('profil_denah_path',      'NVARCHAR(400)'),
    ('profil_denah_nama',      'NVARCHAR(260)'),
    ('dampak_positif',         'NVARCHAR(MAX)'),
    ('dampak_positif_lainnya', 'NVARCHAR(MAX)'),
    ('lima_r_jadwal',          'NVARCHAR(MAX)'),
    ('lima_r_catatan',         'NVARCHAR(MAX)'),
    ('lima_r_dokumentasi',     'NVARCHAR(MAX)');

DECLARE @nama SYSNAME, @tipe NVARCHAR(50), @sql NVARCHAR(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT nama, tipe FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @nama, @tipe;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH('inovasi.gugus', @nama) IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE inovasi.gugus ADD ' + QUOTENAME(@nama) + N' ' + @tipe + N' NULL;';
        EXEC sp_executesql @sql;
        PRINT 'Kolom inovasi.gugus.' + @nama + ' ditambahkan.';
    END
    ELSE PRINT 'LEWATI: inovasi.gugus.' + @nama + ' sudah ada.';
    FETCH NEXT FROM cur INTO @nama, @tipe;
END
CLOSE cur;
DEALLOCATE cur;
GO

SET NOEXEC OFF;
GO
