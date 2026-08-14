/* ============================================================================
   aset.aktivitas_operator - daftar pegawai yang diberi hak terbatas "Catat
   Aktivitas SAJA" (bukan Admin Aset penuh) untuk aset yang mereka jadi PIC-nya.
   Aug 2026. Overlay MyGCS, TANPA mengubah skema dbo.assets.
   ----------------------------------------------------------------------------
   Hak ini SELALU digabung-cek dengan aset.pic_assignment saat aksi (bukan cuma
   saat digrant) - kalau PIC-nya sudah dicabut/dipindahkan, hak catat aktivitas
   ikut hilang otomatis tanpa perlu dicabut manual di sini. Lihat AsetOverlayService.
   CanCatatAktivitasAsync.

   Upsert per NIK (1 baris per pegawai) - aktif/nonaktifkan lewat kolom `aktif`,
   bukan hapus baris, supaya riwayat siapa pernah diberi akses tetap ada.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\15-aktivitas-operator-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.aktivitas_operator', 'U') IS NULL
BEGIN
    CREATE TABLE aset.aktivitas_operator
    (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_aktivitas_operator PRIMARY KEY,
        nik          NVARCHAR(20)  NOT NULL CONSTRAINT UQ_aset_aktivitas_operator_nik UNIQUE,
        nama         NVARCHAR(150) NOT NULL,
        aktif        BIT           NOT NULL CONSTRAINT DF_aset_aktivitas_operator_aktif DEFAULT (1),
        id_pembuat   NVARCHAR(20)  NOT NULL,
        tgl_dibuat   DATETIME2     NOT NULL CONSTRAINT DF_aset_aktivitas_operator_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah  NVARCHAR(20)  NULL,
        tgl_diubah   DATETIME2     NULL
    );
    PRINT 'Tabel aset.aktivitas_operator dibuat.';
END
ELSE
    PRINT 'LEWATI: tabel aset.aktivitas_operator sudah ada.';
GO