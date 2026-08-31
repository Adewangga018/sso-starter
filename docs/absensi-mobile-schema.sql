-- Skema baru utk sistem absensi app mobile (MyGCS Absensi) - TERPISAH dari:
--   - GCS.dbo.vw_web_sdm_absensi (fingerprint IoT lobby, via AbsensiLog) - tidak disentuh,
--     tetap satu-satunya sumber "Log Absensi" di My Personal (diminta manager 2026-08-27).
--   - dbo.Attendances (fitur absen selfie WEB lama, sudah dihapus dari UI My Personal) -
--     dibiarkan apa adanya sbg data historis, tidak dipakai lagi utk tulisan baru.
-- Non-destruktif & idempoten - aman dijalankan berkali-kali.

IF SCHEMA_ID('absensi') IS NULL EXEC('CREATE SCHEMA absensi');
GO

/* ---------------------------------------------------------------------------
   log - catatan check-in/check-out dari app mobile (GPS + foto + deteksi fake-GPS
   sudah lolos di sisi app sebelum sampai sini - lihat PersonalController.PostAbsensi).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('absensi.log', 'U') IS NULL
BEGIN
    CREATE TABLE absensi.log
    (
        id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_absensi_log PRIMARY KEY,
        id_karyawan     NVARCHAR(20)  NOT NULL,
        nama_karyawan   NVARCHAR(150) NOT NULL,
        tanggal         DATE NOT NULL,
        nama_hari       NVARCHAR(20) NULL,
        check_in        NVARCHAR(8) NULL,               -- "HH:mm:ss"
        check_out       NVARCHAR(8) NULL,
        foto            NVARCHAR(255) NULL,              -- path relatif (Attendance:PhotoPath)
        lat             DECIMAL(10,7) NOT NULL,
        lng             DECIMAL(10,7) NOT NULL,
        accuracy        DECIMAL(10,2) NULL,
        type            NVARCHAR(5) NOT NULL,             -- in | out
        tempat          NVARCHAR(150) NULL,               -- nama titik yg dipakai validasi
        dibuat_pada     DATETIME2 NOT NULL CONSTRAINT df_absensi_log_dibuat DEFAULT (SYSUTCDATETIME()),
        diperbarui_pada DATETIME2 NOT NULL CONSTRAINT df_absensi_log_update DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX ix_absensi_log_karyawan_tanggal ON absensi.log (id_karyawan, tanggal);
    PRINT 'Tabel absensi.log dibuat.';
END
ELSE PRINT 'LEWATI: absensi.log sudah ada.';
GO

/* ---------------------------------------------------------------------------
   lokasi_karyawan - titik absen pribadi (bengkel/gudang/sopir/dll yg tidak
   beraktivitas di kantor). Satu baris AKTIF per karyawan (unique id_karyawan) -
   mengajukan ulang menimpa baris lama & mereset status ke Menunggu. Selama belum
   Disetujui, validasi absen tetap pakai default Kantor Pusat (tabel Locations).
   --------------------------------------------------------------------------- */
IF OBJECT_ID('absensi.lokasi_karyawan', 'U') IS NULL
BEGIN
    CREATE TABLE absensi.lokasi_karyawan
    (
        id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_absensi_lokasi_karyawan PRIMARY KEY,
        id_karyawan     NVARCHAR(20) NOT NULL,
        nama_karyawan   NVARCHAR(150) NULL,
        lat             DECIMAL(10,7) NOT NULL,
        lng             DECIMAL(10,7) NOT NULL,
        keterangan      NVARCHAR(255) NULL,
        status          NVARCHAR(20) NOT NULL CONSTRAINT df_absensi_lok_status DEFAULT ('Menunggu'),
        sumber          NVARCHAR(20) NOT NULL,             -- Karyawan | AdminSdm
        diajukan_oleh   NVARCHAR(20) NOT NULL,
        tgl_diajukan    DATETIME2 NOT NULL CONSTRAINT df_absensi_lok_diajukan DEFAULT (SYSUTCDATETIME()),
        diputuskan_oleh NVARCHAR(20) NULL,
        tgl_diputuskan  DATETIME2 NULL,
        catatan_admin   NVARCHAR(255) NULL,
        CONSTRAINT uq_absensi_lokasi_karyawan_nik UNIQUE (id_karyawan),
        CONSTRAINT ck_absensi_lok_status CHECK (status IN ('Menunggu','Disetujui','Ditolak')),
        CONSTRAINT ck_absensi_lok_sumber CHECK (sumber IN ('Karyawan','AdminSdm'))
    );
    PRINT 'Tabel absensi.lokasi_karyawan dibuat.';
END
ELSE PRINT 'LEWATI: absensi.lokasi_karyawan sudah ada.';
GO

-- Tambahan (2026-08-27): alamat otomatis dari reverse-geocoding (OpenStreetMap Nominatim) -
-- disimpan sekali saat pengajuan/penetapan, BUKAN dihitung ulang tiap halaman admin dibuka.
IF COL_LENGTH('absensi.lokasi_karyawan', 'alamat') IS NULL
    ALTER TABLE absensi.lokasi_karyawan ADD alamat NVARCHAR(500) NULL;
GO

-- Tambahan (2026-08-28): peringatan anomali dari absen sebelumnya - "impossible travel"
-- (kecepatan tempuh mustahil) DAN/ATAU koordinat identik persis (indikasi replay
-- fake-GPS) - sinyal audit server-side yg tidak bisa dibohongi client manapun (device
-- root/APK dimodifikasi), TIDAK memblokir absen (keputusan manusia, sama pola dgn
-- accuracy) - lihat AbsensiLogEntry.cs & PersonalController.PostAbsensi.
IF COL_LENGTH('absensi.log', 'peringatan_anomali') IS NULL
    ALTER TABLE absensi.log ADD peringatan_anomali NVARCHAR(400) NULL;
GO
