/* ============================================================================
   coaching - fitur Coaching & Diskusi Tim (My Team), di db_mygcs. Layer paralel;
   tidak menyentuh SDM. Hirarki atasan-bawahan dibaca dari grading. Percakapan
   ASINKRON berbasis thread (bukan real-time).

   Dua bentuk percakapan:
   - SESI 1-on-1 (privat 2 orang di garis vertikal atasan<->bawahan): punya topik,
     thread pesan, dan tindak lanjut (action item).
   - RUANG TIM (grup): pesan diberi ruang_nik = NIK atasan pemilik ruang; anggota =
     atasan itu + bawahan langsung efektifnya.

   SQL Server 2014 (compat 120): tanpa CREATE OR ALTER / DROP IF EXISTS.
   NON-DESTRUKTIF (IF OBJECT_ID ... IS NULL CREATE). Idempoten.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i docs\coaching-schema.sql
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('coaching') IS NULL
    EXEC('CREATE SCHEMA coaching AUTHORIZATION dbo');
GO

/* ---------------------------------------------------------------------------
   sesi - sesi coaching 1-on-1 (privat: id_atasan + id_bawahan)
   --------------------------------------------------------------------------- */
IF OBJECT_ID('coaching.sesi', 'U') IS NULL
BEGIN
    CREATE TABLE coaching.sesi
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_coaching_sesi PRIMARY KEY,
        id_atasan     NVARCHAR(20)  NOT NULL,          -- peserta yang lebih tinggi (ancestor)
        nama_atasan   NVARCHAR(150) NULL,
        id_bawahan    NVARCHAR(20)  NOT NULL,          -- peserta yang lebih rendah (descendant)
        nama_bawahan  NVARCHAR(150) NULL,
        topik         NVARCHAR(200) NOT NULL,
        status        NVARCHAR(20)  NOT NULL CONSTRAINT df_coaching_sesi_status DEFAULT ('Berjalan'),
        id_pembuat    NVARCHAR(20)  NOT NULL,
        tgl_dibuat    DATETIME2 NOT NULL CONSTRAINT df_coaching_sesi_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_terakhir  DATETIME2 NULL,                  -- aktivitas terakhir (utk urutan)
        CONSTRAINT ck_coaching_sesi_status CHECK (status IN ('Berjalan','Selesai'))
    );
    CREATE INDEX ix_coaching_sesi_atasan ON coaching.sesi (id_atasan);
    CREATE INDEX ix_coaching_sesi_bawahan ON coaching.sesi (id_bawahan);
    PRINT 'Tabel coaching.sesi dibuat.';
END
ELSE PRINT 'LEWATI: coaching.sesi sudah ada.';
GO

/* ---------------------------------------------------------------------------
   pesan - pesan untuk SESI (id_sesi) ATAU RUANG TIM (ruang_nik). Tepat satu terisi.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('coaching.pesan', 'U') IS NULL
BEGIN
    CREATE TABLE coaching.pesan
    (
        id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_coaching_pesan PRIMARY KEY,
        id_sesi       BIGINT       NULL,               -- FK ke coaching.sesi (percakapan 1-on-1)
        ruang_nik     NVARCHAR(20) NULL,               -- NIK atasan pemilik ruang tim
        id_pengirim   NVARCHAR(20)  NOT NULL,
        nama_pengirim NVARCHAR(150) NULL,
        isi           NVARCHAR(2000) NOT NULL,
        tgl_kirim     DATETIME2 NOT NULL CONSTRAINT df_coaching_pesan_kirim DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_coaching_pesan_sesi FOREIGN KEY (id_sesi) REFERENCES coaching.sesi (id),
        CONSTRAINT ck_coaching_pesan_kanal CHECK (
            (id_sesi IS NOT NULL AND ruang_nik IS NULL) OR
            (id_sesi IS NULL AND ruang_nik IS NOT NULL))
    );
    CREATE INDEX ix_coaching_pesan_sesi ON coaching.pesan (id_sesi);
    CREATE INDEX ix_coaching_pesan_ruang ON coaching.pesan (ruang_nik);
    PRINT 'Tabel coaching.pesan dibuat.';
END
ELSE PRINT 'LEWATI: coaching.pesan sudah ada.';
GO

/* ---------------------------------------------------------------------------
   tindak_lanjut - action item hasil sesi coaching
   --------------------------------------------------------------------------- */
IF OBJECT_ID('coaching.tindak_lanjut', 'U') IS NULL
BEGIN
    CREATE TABLE coaching.tindak_lanjut
    (
        id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_coaching_tl PRIMARY KEY,
        id_sesi     BIGINT NOT NULL,
        isi         NVARCHAR(500) NOT NULL,
        status      NVARCHAR(20)  NOT NULL CONSTRAINT df_coaching_tl_status DEFAULT ('Terbuka'),
        id_pembuat  NVARCHAR(20)  NOT NULL,
        tgl_dibuat  DATETIME2 NOT NULL CONSTRAINT df_coaching_tl_dibuat DEFAULT (SYSUTCDATETIME()),
        tgl_selesai DATETIME2 NULL,
        CONSTRAINT fk_coaching_tl_sesi FOREIGN KEY (id_sesi) REFERENCES coaching.sesi (id),
        CONSTRAINT ck_coaching_tl_status CHECK (status IN ('Terbuka','Selesai'))
    );
    CREATE INDEX ix_coaching_tl_sesi ON coaching.tindak_lanjut (id_sesi);
    PRINT 'Tabel coaching.tindak_lanjut dibuat.';
END
ELSE PRINT 'LEWATI: coaching.tindak_lanjut sudah ada.';
GO

SET NOEXEC OFF;
GO
