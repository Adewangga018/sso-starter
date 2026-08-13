/* ============================================================================
   Tunjangan Pajak, Tunjangan Shift, Premi Asuransi (tunjangan & potongan), Pajak
   (potongan) - dipindah dari basis 'JG_PG' (matriks Formula & Generalisasi) ke
   'Karyawan_Periode' (Manual per Karyawan), sesuai permintaan user 2026-08-11:
   nilainya beda-beda tiap karyawan, bukan mengikuti matriks JG x PG umum.
     - TJ_PAJAK  = POT_PAJAK  (dikonfirmasi user selalu sama - di-mirror frontend)
     - TJ_PREMI  = POT_PREMI  (dikonfirmasi user selalu sama - di-mirror frontend)
     - TJ_SHIFT  = manual independen, beda tiap karyawan
   Kelima komponen ini belum pernah dikonfigurasi (gaji.tarif kosong utk semuanya),
   jadi aman dipindah tanpa kehilangan data - baris gaji.tarif basi-basi lama (kalau
   ada) tetap dibersihkan untuk jaga-jaga. NON-DESTRUKTIF & idempoten.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

DECLARE @kode TABLE (kode NVARCHAR(30));
INSERT INTO @kode VALUES ('TJ_PAJAK'), ('TJ_SHIFT'), ('TJ_PREMI'), ('POT_PREMI'), ('POT_PAJAK');

UPDATE k
SET k.basis = 'Karyawan_Periode'
FROM gaji.komponen k
JOIN @kode x ON x.kode = k.kode
WHERE k.basis <> 'Karyawan_Periode';
PRINT 'gaji.komponen.basis TJ_PAJAK/TJ_SHIFT/TJ_PREMI/POT_PREMI/POT_PAJAK dipindah ke Karyawan_Periode (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' baris).';

DELETE t
FROM gaji.tarif t
JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
JOIN @kode x ON x.kode = k.kode;
PRINT 'Sisa gaji.tarif (matriks JG x PG lama, kalau ada) utk kelima komponen dibersihkan (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' baris).';
GO

SET NOEXEC OFF;
GO
