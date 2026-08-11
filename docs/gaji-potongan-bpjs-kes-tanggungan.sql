/* ============================================================================
   Potongan BPJS Kesehatan (POT_BPJS_KES): basis JG_PG -> Karyawan_Periode.
   Default = 0 (BPJS Kesehatan perusahaan menanggung karyawan + maks 3 tanggungan
   di luar diri sendiri - anak dan/atau pasangan, dibaca dari MST_PEGAWAI.STATUS_NIKAH
   + MST_ANAK_PEGAWAI). Special case: tanggungan > 3 -> potongan tambahan 1% dari
   Pendapatan Dasar PER ORANG kelebihan, dihitung via kalkulator "Hitung dari
   Tanggungan" (GajiService.HitungBpjsKesPotonganAsync) - TIDAK otomatis penuh,
   admin tetap review & Simpan lewat admin/manual biasa.

   NON-DESTRUKTIF & idempoten. gaji.tarif utk POT_BPJS_KES kosong (basisnya pindah
   dari JG_PG), aman dibersihkan.
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

UPDATE gaji.komponen
SET basis = 'Karyawan_Periode',
    keterangan = N'Default 0 - BPJS Kesehatan perusahaan menanggung karyawan + maks 3 tanggungan (anak/pasangan). Kalau tanggungan >3, tambahan 1% dari Pendapatan Dasar per orang kelebihan (Hitung dari Tanggungan).'
WHERE kode = 'POT_BPJS_KES';

DELETE t FROM gaji.tarif t
    JOIN gaji.komponen k ON k.id_komponen = t.id_komponen
    WHERE k.kode = 'POT_BPJS_KES';

PRINT 'Potongan BPJS Kesehatan kini basis Karyawan_Periode (default 0, kelebihan tanggungan via kalkulator).';
GO
SET NOEXEC OFF;
GO
