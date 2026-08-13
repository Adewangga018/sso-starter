/* ============================================================================
   aset.jenis_aktivitas + aset.jenis_aktivitas_kategori - master daftar "Jenis
   Aktivitas" (dropdown di form Catat Aktivitas), dikelola sebagai data - bukan
   hardcode di frontend lagi. Aug 2026.
   ----------------------------------------------------------------------------
   jenis_aktivitas_kategori: relasi many-to-many ke GROUP_ASSET milik ERP
   (dbo.assets.GROUP_ASSET, cuma 6 kode: A01 Tanah, A02 Bangunan & Instalasi
   Listrik, A03 Mesin & Peralatan Pabrik, A04 Kendaraan & alat Berat, A05
   Inventaris Kantor, A06 Aktiva Tak Berwujud - diverifikasi langsung ke SQL,
   BUKAN ditebak). Tanpa FK lintas database ke GCS, cuma simpan kodenya.
   Jenis TANPA baris relasi = "Umum", tampil untuk SEMUA kategori aset.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\aset\09-jenis-aktivitas-ddl.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('aset.jenis_aktivitas', 'U') IS NULL
BEGIN
    CREATE TABLE aset.jenis_aktivitas
    (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_aset_jenis_aktivitas PRIMARY KEY,
        nama         NVARCHAR(100) NOT NULL CONSTRAINT UQ_aset_jenis_aktivitas_nama UNIQUE,
        aktif        BIT           NOT NULL CONSTRAINT DF_aset_jenis_aktivitas_aktif DEFAULT (1),
        urutan       INT           NOT NULL CONSTRAINT DF_aset_jenis_aktivitas_urutan DEFAULT (0),
        id_pembuat   NVARCHAR(20)  NOT NULL,
        tgl_dibuat   DATETIME2     NOT NULL CONSTRAINT DF_aset_jenis_aktivitas_tgldibuat DEFAULT (SYSUTCDATETIME()),
        id_pengubah  NVARCHAR(20)  NULL,
        tgl_diubah   DATETIME2     NULL
    );
    PRINT 'Tabel aset.jenis_aktivitas dibuat.';
END
GO

IF OBJECT_ID('aset.jenis_aktivitas_kategori', 'U') IS NULL
BEGIN
    CREATE TABLE aset.jenis_aktivitas_kategori
    (
        id_jenis_aktivitas INT         NOT NULL CONSTRAINT FK_aset_jak_kategori_jenis
                               REFERENCES aset.jenis_aktivitas (id) ON DELETE CASCADE,
        group_asset        VARCHAR(10) NOT NULL,  -- dbo.assets.GROUP_ASSET, tanpa FK lintas DB
        CONSTRAINT PK_aset_jenis_aktivitas_kategori PRIMARY KEY (id_jenis_aktivitas, group_asset)
    );
    PRINT 'Tabel aset.jenis_aktivitas_kategori dibuat.';
END
GO

-- Seed - aman dijalankan ulang (skip kalau sudah pernah, ditandai lewat id_pembuat).
IF NOT EXISTS (SELECT 1 FROM aset.jenis_aktivitas WHERE id_pembuat = 'SEED-2026-08')
BEGIN
    DECLARE @rows TABLE (nama NVARCHAR(100), urutan INT, kategori VARCHAR(10) NULL);
    INSERT INTO @rows (nama, urutan, kategori) VALUES
        (N'Pemeliharaan/Perbaikan',        10, NULL),
        (N'Mutasi Lokasi',                 20, NULL),
        (N'Penghapusan/Write-off',         30, NULL),
        (N'Appraisal Ulang',               40, NULL),
        (N'Klaim Asuransi',                50, NULL),
        (N'Perpanjangan Sertifikat Tanah', 60, 'A01'),
        (N'Pembayaran PBB',                70, 'A01'),
        (N'Pembayaran PBB',                70, 'A02'),
        (N'Perpanjangan IMB/PBG',          80, 'A02'),
        (N'Renovasi/Pembangunan',          90, 'A02'),
        (N'Perpanjangan STNK/Pajak Kendaraan', 100, 'A04'),
        (N'Perpanjangan KIR',              110, 'A04'),
        (N'Service Berkala Kendaraan',     120, 'A04'),
        (N'Ganti Ban/Oli/Sparepart',       130, 'A04'),
        (N'Kecelakaan/Insiden Kendaraan',  140, 'A04'),
        (N'Uji Tekan/Hydrotest Tabung',    150, 'A04'),
        (N'Uji Tekan/Hydrotest Tabung',    150, 'A05'),
        (N'Kalibrasi Alat Ukur',           160, 'A03'),
        (N'Kalibrasi Alat Ukur',           160, 'A05'),
        (N'Inspeksi K3/Keselamatan',       170, 'A03'),
        (N'Inspeksi K3/Keselamatan',       170, 'A04'),
        (N'Inspeksi K3/Keselamatan',       170, 'A05'),
        (N'Overhaul Mesin',                180, 'A03'),
        (N'Inspeksi Rutin Mesin',          190, 'A03'),
        (N'Upgrade/Penggantian Komponen',  200, 'A05'),
        (N'Upgrade/Update Sistem',         210, 'A06'),
        (N'Perpanjangan Lisensi Software', 220, 'A06'),
        (N'Lainnya',                       999, NULL);

    -- 1 baris per NAMA unik ke jenis_aktivitas (urutan/nama sama persis di semua baris kategori-nya).
    INSERT INTO aset.jenis_aktivitas (nama, urutan, id_pembuat, tgl_dibuat)
    SELECT nama, MIN(urutan), N'SEED-2026-08', SYSUTCDATETIME()
    FROM @rows
    GROUP BY nama;

    -- Relasi kategori (skip baris NULL = Umum, tidak butuh relasi).
    INSERT INTO aset.jenis_aktivitas_kategori (id_jenis_aktivitas, group_asset)
    SELECT DISTINCT j.id, r.kategori
    FROM @rows r
    JOIN aset.jenis_aktivitas j ON j.nama = r.nama
    WHERE r.kategori IS NOT NULL;

    DECLARE @jumlah INT = (SELECT COUNT(*) FROM aset.jenis_aktivitas WHERE id_pembuat = 'SEED-2026-08');
    PRINT CONCAT(@jumlah, ' jenis aktivitas disisipkan.');
END
ELSE
    PRINT 'LEWATI: seed SEED-2026-08 sudah pernah dijalankan.';
GO