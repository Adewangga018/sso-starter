/* ============================================================================
   Tambah 1 baris ke aset.jenis_aktivitas: "Negosiasi dengan Customer" (Umum,
   tanpa relasi kategori - tampil untuk semua GROUP_ASSET, sama seperti aset
   yang diklasifikasikan "Tidak Bergerak" bisa dari kategori apa saja). Aug 2026.
   Aman dijalankan ulang - skip kalau namanya sudah ada (constraint UNIQUE nama).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\13-negosiasi-customer-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.jenis_aktivitas', 'U') IS NULL
BEGIN
    RAISERROR('BATAL: tabel aset.jenis_aktivitas belum ada - jalankan 09-jenis-aktivitas-ddl.sql dulu.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM aset.jenis_aktivitas WHERE nama = N'Negosiasi dengan Customer')
BEGIN
    INSERT INTO aset.jenis_aktivitas (nama, urutan, id_pembuat, tgl_dibuat)
    VALUES (N'Negosiasi dengan Customer', 25, N'SEED-2026-08-2', SYSUTCDATETIME());
    PRINT 'Jenis aktivitas "Negosiasi dengan Customer" disisipkan.';
END
ELSE
    PRINT 'LEWATI: "Negosiasi dengan Customer" sudah ada.';
GO