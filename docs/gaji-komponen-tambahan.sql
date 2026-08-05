/* ============================================================================
   Tambahan komponen gaji - Tunjangan Tidak Tetap: Lembur, Uang Makan Dinas, RIT.
   Komponen basis Karyawan_Periode (nominal diinput per orang/periode via slip),
   tipe Pendapatan. NON-DESTRUKTIF & idempoten: hanya menambah bila kode belum ada.
   Aman dijalankan berulang. Tidak menyentuh tarif/slip yang sudah terisi.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\gaji-komponen-tambahan.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: jalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('gaji.komponen', 'U') IS NULL
BEGIN
    RAISERROR('gaji.komponen belum ada - jalankan gaji-schema.sql lebih dulu.', 16, 1);
    SET NOEXEC ON;
END
GO

/* Kolom: kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan.
   'LEMBUR' agregat TIDAK disisipkan bila sudah dipecah jadi sub-komponen oleh
   gaji-komponen-v2.sql (ditandai keberadaan 'LEMBUR_BIASA') - mencegah skrip ini
   membangkitkan kembali baris yang sengaja dihapus saat dipecah. */
IF NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'LEMBUR')
   AND NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'LEMBUR_BIASA')
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
    VALUES ('LEMBUR', N'Lembur', 'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 0, 32, N'Upah lembur; sesuai jam lembur per periode');
GO

IF NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'MAKAN_DINAS')
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
    VALUES ('MAKAN_DINAS', N'Uang Makan Dinas', 'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 0, 33, N'Uang makan saat dinas; per karyawan & periode');
GO

IF NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'RIT')
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
    VALUES ('RIT', N'RIT', 'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 0, 34, N'Uang rit/ritase; per karyawan & periode');
GO

PRINT 'Komponen Lembur / Uang Makan Dinas / RIT dipastikan ada di Tunjangan Tidak Tetap.';
GO

SET NOEXEC OFF;
GO
