/* ============================================================================
   Aturan potongan (2026-08-04):
   - POT_DPLK              -> per Band (mekanisme sama dgn Pendapatan Dasar,
                              tapi ini POTONGAN - lihat catatan penting di bawah).
   - POT_IKGCS, POT_SW_KKCS, POT_SW_K3PG -> 'Flat': SATU nominal, sama untuk
     SEMUA karyawan (bukan per Band/JG/PG, bukan per Karyawan_Periode).
   - K3PG (POT_K3PG), PIKGCS, KSPPS, BMT, Angsuran, RIT: SUDAH 'Karyawan_Periode'
     (manual per orang) sebelum skrip ini - tidak diubah.

   Basis baru 'Flat': nilai tunggal di kolom gaji.komponen.nilai_flat (TIDAK
   per-tahun, TIDAK per Band/JG/PG - satu angka berlaku untuk semua slip sampai
   diubah admin lagi). Sama pola dgn formula_persen/formula_batas (basis
   'PendapatanDasar') yang sudah ada.

   PENTING: POT_DPLK ber-basis 'Band' tapi TIPE-nya 'Potongan'. Perhitungan
   "Pendapatan Dasar" (dasar rumus Tunjangan BPJS Kesehatan) HARUS hanya
   menjumlah komponen TIPE='Pendapatan' - diperbaiki di kode C# (GajiService),
   bukan di skrip ini.

   NON-DESTRUKTIF & idempoten. Keempat komponen kosong di gaji.tarif/slip_detail.
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

/* 1) Kolom nilai flat (generik, dipakai basis 'Flat') ------------------------ */
IF COL_LENGTH('gaji.komponen', 'nilai_flat') IS NULL
    ALTER TABLE gaji.komponen ADD nilai_flat DECIMAL(18,2) NULL;
GO

/* 2) Perluas CHECK basis. SELALU superset final (7 nilai) - lihat catatan di
      gaji-tarif-tunggal-schema.sql & gaji-formula-bpjs-kes.sql: skrip mana pun
      yang drop+recreate constraint ini harus pakai daftar yang SAMA supaya
      idempoten & tak tergantung urutan run relatif skrip basis lain. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_gaji_komponen_basis')
    ALTER TABLE gaji.komponen DROP CONSTRAINT ck_gaji_komponen_basis;
GO
ALTER TABLE gaji.komponen ADD CONSTRAINT ck_gaji_komponen_basis
    CHECK (basis IN ('Karyawan_Periode','JG_PG','Band','JG','PG','PendapatanDasar','Flat'));
GO

/* 3) Pindahkan basis komponen terkait ---------------------------------------- */
UPDATE gaji.komponen SET basis = 'Band' WHERE kode = 'POT_DPLK';
UPDATE gaji.komponen SET basis = 'Flat' WHERE kode IN ('POT_IKGCS','POT_SW_KKCS','POT_SW_K3PG');

/* 4) Bersihkan sisa tarif/slip_detail lama (kosong saat ditulis) ------------- */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode = 'POT_DPLK';
DELETE d FROM gaji.slip_detail d
    JOIN gaji.komponen k ON k.id_komponen = d.id_komponen
    WHERE k.kode IN ('POT_IKGCS','POT_SW_KKCS','POT_SW_K3PG');

PRINT 'POT_DPLK kini per Band; IKGCS/Simpanan Wajib KKCS/K3PG kini flat (sama semua karyawan).';
GO
SET NOEXEC OFF;
GO
