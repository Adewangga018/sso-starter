/* ============================================================================
   cuti v2 - RESET SALDO SEKALI JALAN. Set semua karyawan ke saldo penuh 24
   (akrual=24) untuk periode berjalan, diambil=0. Aturan akrual & pemotongan
   cuti bersama berlaku setelah ini. JALANKAN SEKALI saat mengaktifkan aturan v2.
   JANGAN masukkan ke prod-migrasi.sql (bukan idempoten untuk data).
   ============================================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() <> 'db_mygcs'
BEGIN RAISERROR('BATAL: jalankan di db_mygcs.',16,1); SET NOEXEC ON; END
GO

DECLARE @wib DATETIME2 = DATEADD(HOUR, 7, SYSUTCDATETIME());
DECLARE @thn INT = YEAR(@wib);
DECLARE @periode NVARCHAR(20) = CAST(@thn AS NVARCHAR(4)) + '-' + CAST(@thn + 1 AS NVARCHAR(4));
DECLARE @batas INT = (SELECT TOP 1 batas_akumulasi FROM cuti.setelan WHERE id = 1);
SET @batas = ISNULL(@batas, 24);

UPDATE cuti.saldo
SET akrual          = @batas,
    cuti_bersama    = 0,
    hak             = @batas,
    diambil         = 0,
    saldo           = @batas,
    periode         = @periode,
    tgl_cutoff      = CAST(@wib AS DATE),
    diperbarui_pada = SYSUTCDATETIME();

PRINT CONCAT('Reset selesai: ', @@ROWCOUNT, ' karyawan diset ke ', @batas, ' hari untuk periode ', @periode, '.');
GO
