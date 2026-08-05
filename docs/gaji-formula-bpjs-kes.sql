/* ============================================================================
   Tunjangan BPJS Kesehatan (TJ_BPJS_KES) dihitung dari RUMUS, bukan diinput
   manual per JG x PG:
     Pendapatan Dasar = Gaji Pokok + Tj. Jabatan + Tj. Perumahan + Tj. Pangan
                         + Tj. Angkutan (jumlah seluruh komponen basis Band/JG/PG)
     Tunjangan BPJS Kesehatan = persen% x MIN(Pendapatan Dasar, batas_atas)
   Default: persen=4, batas_atas=12.000.000 (aturan BPJS Kesehatan standar).
   Kolom formula_persen/formula_batas di gaji.komponen dibuat GENERIK - basis
   'PendapatanDasar' bisa dipakai komponen lain nanti tanpa migrasi baru.

   NON-DESTRUKTIF & idempoten. gaji.tarif utk TJ_BPJS_KES kosong (basisnya
   pindah dari JG_PG), aman dibersihkan.
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

/* 1) Kolom parameter rumus (generik, dipakai basis 'PendapatanDasar') --------- */
IF COL_LENGTH('gaji.komponen', 'formula_persen') IS NULL
    ALTER TABLE gaji.komponen ADD formula_persen DECIMAL(7,4) NULL;
GO
IF COL_LENGTH('gaji.komponen', 'formula_batas') IS NULL
    ALTER TABLE gaji.komponen ADD formula_batas DECIMAL(18,2) NULL;
GO

/* 2) Perluas CHECK basis. Daftar SELALU superset final (termasuk 'Flat' dari
      gaji-potongan-flat.sql) - lihat catatan idempotensi di gaji-tarif-tunggal-schema.sql. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_gaji_komponen_basis')
    ALTER TABLE gaji.komponen DROP CONSTRAINT ck_gaji_komponen_basis;
GO
ALTER TABLE gaji.komponen ADD CONSTRAINT ck_gaji_komponen_basis
    CHECK (basis IN ('Karyawan_Periode','JG_PG','Band','JG','PG','PendapatanDasar','Flat'));
GO

/* 3) Pindahkan TJ_BPJS_KES ke basis rumus ------------------------------------ */
UPDATE gaji.komponen
SET basis = 'PendapatanDasar', formula_persen = 4, formula_batas = 12000000,
    keterangan = N'4% dari Pendapatan Dasar (Gaji Pokok + Tj. Jabatan + Tj. Perumahan + Tj. Pangan + Tj. Angkutan), maksimum 4% x Rp12.000.000'
WHERE kode = 'TJ_BPJS_KES';

/* 4) Bersihkan sisa tarif JG x PG-nya (kosong saat ditulis) ------------------ */
DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode = 'TJ_BPJS_KES';

PRINT 'Tunjangan BPJS Kesehatan kini dihitung otomatis dari rumus Pendapatan Dasar.';
GO
SET NOEXEC OFF;
GO
