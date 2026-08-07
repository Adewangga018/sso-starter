/* ============================================================================
   Komponen gaji baru: SPPD (Tunjangan Perjalanan Dinas), Tunjangan Tidak Tetap,
   basis Karyawan_Periode - nominal = tarif per Band (dikonfigurasi admin lewat
   endpoint terpisah admin/tarif-sppd) x jumlah SPPD disetujui dalam periode.
   Dipakai jg sbg basis formula Uang Makan Dinas (MAKAN_DINAS) utk rentang
   75-150km (20% dari tarif SPPD Band pegawai) - lihat GajiService.

   NON-DESTRUKTIF & idempoten: hanya menambah bila kode belum ada.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO
IF OBJECT_ID('gaji.komponen','U') IS NULL
BEGIN RAISERROR('gaji.komponen belum ada - jalankan gaji-schema.sql dulu.',16,1); SET NOEXEC ON; END
GO

IF NOT EXISTS (SELECT 1 FROM gaji.komponen WHERE kode = 'TJ_SPPD')
    INSERT INTO gaji.komponen (kode, nama, tipe, kategori, basis, opsional, kena_potongan_terlambat, urutan, keterangan)
    VALUES ('TJ_SPPD', N'SPPD', 'Pendapatan', N'Tunjangan Tidak Tetap', 'Karyawan_Periode', 1, 0, 37,
            N'Tunjangan perjalanan dinas; tarif per Band x jumlah SPPD disetujui per periode');

PRINT 'Komponen SPPD (Tunjangan Perjalanan Dinas) dipastikan ada di Tunjangan Tidak Tetap.';
GO
SET NOEXEC OFF;
GO
