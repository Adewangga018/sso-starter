/* ============================================================================
   Potongan BPJS Ketenagakerjaan sisi karyawan (JHT/JP) dihitung dari RUMUS,
   sama pola dgn TJ_BPJS_KES/TJ_BPJS_JHT/dst (gaji-formula-bpjs-kes.sql,
   gaji-bpjs-tk-formula.sql), basis 'PendapatanDasar':
     POT_BPJS_JHT = 2% x Pendapatan Dasar (tanpa batas)
     POT_BPJS_JP  = 1% x Pendapatan Dasar (tanpa batas)

   BEDA dari TJ_BPJS_JHT/JKK/JKM/JP (kontribusi PERUSAHAAN, masuk_total=0):
   ini POTONGAN GAJI KARYAWAN sungguhan (dipotong dari gaji, mengurangi Gaji
   Bersih) - jadi masuk_total TETAP default true (1), TIDAK diubah. Perhitungan
   "Pendapatan Dasar" aman dipakai (basis 'PendapatanDasar' tidak ikut jadi
   komponen penyusun Pendapatan Dasar itu sendiri - hanya komponen Tipe=
   'Pendapatan' & basis Band/JG/PG yang dihitung, lihat GajiService).

   NON-DESTRUKTIF & idempoten. gaji.tarif utk kedua komponen ini kosong
   (basisnya pindah dari JG_PG), aman dibersihkan.
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

/* 1) Pindahkan POT_BPJS_JHT/POT_BPJS_JP ke basis rumus ------------------------ */
UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 2, formula_batas = NULL,
    keterangan = N'2% dari Pendapatan Dasar - potongan gaji karyawan (iuran BPJS TK)'
WHERE kode = 'POT_BPJS_JHT';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 1, formula_batas = NULL,
    keterangan = N'1% dari Pendapatan Dasar - potongan gaji karyawan (iuran BPJS TK)'
WHERE kode = 'POT_BPJS_JP';

/* 2) Bersihkan sisa tarif JG x PG-nya (kosong saat ditulis) ------------------- */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode IN ('POT_BPJS_JHT','POT_BPJS_JP');

PRINT 'Potongan BPJS Ketenagakerjaan (JHT/JP) kini dihitung otomatis dari rumus Pendapatan Dasar.';
GO
SET NOEXEC OFF;
GO
