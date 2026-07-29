/* ============================================================================
   health - modul My Health (Kesehatan) MyGCS, di db_mygcs. Layer paralel.
   Inisiasi awal: Medical Check-Up (MCU). Arsip terpusat jadwal & hasil MCU
   karyawan + status tindak lanjut. TIDAK menyentuh tabel SDM (GCS).

   Pengelola = "Admin Kepatuhan" (Departemen Kepatuhan / Tata Kelola) - lihat
   ModuleAccessService.IsHealthAdminAsync. Data hasil MCU bersifat sensitif:
   karyawan hanya melihat hasil DIRINYA sendiri; admin melihat semua.

   Model: satu periode MCU (health.periode) punya banyak hasil per karyawan
   (health.hasil, maks 1 per (periode, nik)).

   SQL Server 2014 (compat 120). NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE).
   Idempoten. Lampiran laporan MCU disimpan VARBINARY(MAX) di health.hasil.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\health-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('health') IS NULL
    EXEC('CREATE SCHEMA health AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   periode - kampanye/batch MCU (mis. "MCU Tahunan 2026")
   --------------------------------------------------------------------------- */
IF OBJECT_ID('health.periode', 'U') IS NULL
BEGIN
    CREATE TABLE health.periode
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_health_periode PRIMARY KEY,
        judul         NVARCHAR(200) NOT NULL,
        tahun         INT NOT NULL,
        penyelenggara NVARCHAR(200) NULL,                    -- vendor/klinik/RS pelaksana
        lokasi        NVARCHAR(200) NULL,
        tgl_mulai     DATE NULL,
        tgl_selesai   DATE NULL,
        catatan       NVARCHAR(1000) NULL,
        status        NVARCHAR(20) NOT NULL CONSTRAINT df_health_periode_status DEFAULT ('Direncanakan'),
        id_pembuat    NVARCHAR(20)  NOT NULL,
        tgl_dibuat    DATETIME2 NOT NULL CONSTRAINT df_health_periode_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah    DATETIME2 NULL,
        CONSTRAINT ck_health_periode_status CHECK (status IN ('Direncanakan','Berlangsung','Selesai'))
    );
    CREATE INDEX ix_health_periode_tahun ON health.periode (tahun);
    PRINT 'Tabel health.periode dibuat.';
END
ELSE PRINT 'LEWATI: health.periode sudah ada.';
GO

/* ---------------------------------------------------------------------------
   hasil - hasil MCU per karyawan dalam satu periode (maks 1 per periode+nik)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('health.hasil', 'U') IS NULL
BEGIN
    CREATE TABLE health.hasil
    (
        id                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_health_hasil PRIMARY KEY,
        id_periode           BIGINT NOT NULL,
        nik                  NVARCHAR(20)  NOT NULL,
        nama                 NVARCHAR(150) NULL,
        tgl_pemeriksaan      DATE NULL,
        tinggi               DECIMAL(5,1) NULL,               -- cm
        berat                DECIMAL(5,1) NULL,               -- kg
        tekanan_darah        NVARCHAR(20) NULL,               -- mis. "120/80"
        status_umum          NVARCHAR(30) NOT NULL CONSTRAINT df_health_hasil_status DEFAULT ('Sehat'),
        ringkasan            NVARCHAR(2000) NULL,             -- kesimpulan pemeriksaan
        rekomendasi          NVARCHAR(2000) NULL,
        status_tindak_lanjut NVARCHAR(20) NOT NULL CONSTRAINT df_health_hasil_tl DEFAULT ('Tidak Perlu'),
        nama_file            NVARCHAR(255) NULL,              -- lampiran laporan MCU (opsional)
        tipe_file            NVARCHAR(120) NULL,
        konten               VARBINARY(MAX) NULL,
        id_pencatat          NVARCHAR(20)  NOT NULL,
        nama_pencatat        NVARCHAR(150) NULL,
        tgl_dicatat          DATETIME2 NOT NULL CONSTRAINT df_health_hasil_dicatat DEFAULT (SYSUTCDATETIME()),
        tgl_diubah           DATETIME2 NULL,
        CONSTRAINT fk_health_hasil_periode FOREIGN KEY (id_periode) REFERENCES health.periode (id),
        CONSTRAINT uq_health_hasil UNIQUE (id_periode, nik),
        CONSTRAINT ck_health_hasil_status CHECK (status_umum IN ('Sehat','Perlu Perhatian','Tindak Lanjut')),
        CONSTRAINT ck_health_hasil_tl CHECK (status_tindak_lanjut IN ('Tidak Perlu','Belum','Dijadwalkan','Selesai'))
    );
    CREATE INDEX ix_health_hasil_periode ON health.hasil (id_periode);
    CREATE INDEX ix_health_hasil_nik ON health.hasil (nik);
    PRINT 'Tabel health.hasil dibuat.';
END
ELSE PRINT 'LEWATI: health.hasil sudah ada.';
GO

SET NOEXEC OFF;
GO
