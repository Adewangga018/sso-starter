/* ============================================================================
   Tunjangan BPJS Ketenagakerjaan (JHT/JKK/JKM/JP) dihitung dari RUMUS, sama
   pola dgn TJ_BPJS_KES (gaji-formula-bpjs-kes.sql), basis 'PendapatanDasar':
     TJ_BPJS_JHT = 3,7%  x Pendapatan Dasar (tanpa batas)
     TJ_BPJS_JKK = 0,24% x Pendapatan Dasar (tanpa batas)
     TJ_BPJS_JKM = 0,3%  x Pendapatan Dasar (tanpa batas)
     TJ_BPJS_JP  = 2%    x MIN(Pendapatan Dasar, Rp11.086.300)

   BEDA dari TJ_BPJS_KES: keempat komponen ini kontribusi PERUSAHAAN ke BPJS
   TK, "dibayarkan" langsung ke BPJS - bukan diterima karyawan. Jadi HARUS
   tetap tampil di slip (informasi), tapi TIDAK menambah Total Pendapatan /
   Gaji Bersih. Kolom baru gaji.komponen.masuk_total (bit, default 1) menandai
   ini; hanya keempat komponen ini yg di-set 0 - semua komponen lain (termasuk
   TJ_BPJS_KES) tetap masuk_total=1 (default), TIDAK berubah perilakunya.

   Potongan BPJS TK sisi karyawan (POT_BPJS_JHT/POT_BPJS_JP) SENGAJA TIDAK
   disentuh skrip ini (belum diminta) - tetap basis JG_PG kosong.

   NON-DESTRUKTIF & idempoten. gaji.tarif utk keempat komponen ini kosong
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

/* 1) Kolom flag "masuk ke Total Pendapatan / Gaji Bersih" --------------------- */
IF COL_LENGTH('gaji.komponen', 'masuk_total') IS NULL
    ALTER TABLE gaji.komponen ADD masuk_total BIT NOT NULL CONSTRAINT df_gaji_komponen_masuk_total DEFAULT (1);
GO

/* 2) Pindahkan TJ_BPJS_JHT/JKK/JKM/JP ke basis rumus, kecualikan dari total --- */
UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 3.7, formula_batas = NULL, masuk_total = 0,
    keterangan = N'3,7% dari Pendapatan Dasar - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JHT';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 0.24, formula_batas = NULL, masuk_total = 0,
    keterangan = N'0,24% dari Pendapatan Dasar - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JKK';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 0.3, formula_batas = NULL, masuk_total = 0,
    keterangan = N'0,3% dari Pendapatan Dasar - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JKM';

UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 2, formula_batas = 11086300, masuk_total = 0,
    keterangan = N'2% dari Pendapatan Dasar, maksimum 2% x Rp11.086.300 - kontribusi perusahaan, dibayarkan ke BPJS TK, tidak menambah Gaji Bersih'
WHERE kode = 'TJ_BPJS_JP';

/* 3) Bersihkan sisa tarif JG x PG-nya (kosong saat ditulis) ------------------- */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode IN ('TJ_BPJS_JHT','TJ_BPJS_JKK','TJ_BPJS_JKM','TJ_BPJS_JP');

PRINT 'Tunjangan BPJS Ketenagakerjaan (JHT/JKK/JKM/JP) kini dihitung otomatis dari rumus, dikecualikan dari Total Pendapatan/Gaji Bersih.';
GO
SET NOEXEC OFF;
GO
