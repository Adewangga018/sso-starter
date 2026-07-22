/* ============================================================================
   MyGCS — Skema Job Grade (JG) & Person Grade (PG)
   Target : database db_mygcs  |  schema: grading   |  RDBMS: SQL Server
   Referensi: "Analisis Pemetaan Job Grade PT GCS — Revisi 5 (Juli 2026)"
              + kesepakatan tim (Pak A, Pak F, Pak J).

   PRINSIP:
   - JG MELEKAT PADA JABATAN -> kolom "jg" ada langsung di tabel grading.jabatan.
     Contoh: Kabag Perbendaharaan (jg 16), Kabag Pengadaan (jg 15) - sama-sama Band III.
   - band = pengelompokan jenjang saja (Direksi, I-VI). BUKAN tempat JG (tidak ada
     jg_min/jg_max di band). Jangkar yang stabil saat struktur berubah.
   - job_grade = master skala JG 7-21 + peta ke band. Di-link dari jabatan.jg.
   - PG per pegawai = transaksi per tahun (person_grade).
   - Penempatan = siapa mengisi jabatan mana (orang <-> jabatan). BUKAN definisi jabatan.
   - Atasan-bawahan: satu sumber = jabatan.id_atasan; tabel jabatan_hirarki dibangun
     otomatis untuk query cepat.
   - Pegawai dirujuk lewat id_karyawan ke GCS.dbo.MST_PEGAWAI (lintas-DB, tanpa FK).

   KOMPATIBILITAS: server produksi = SQL Server 2014 (12.0). Karena itu file ini
   TIDAK memakai "CREATE OR ALTER" (baru ada di 2016 SP1) - dipakai pola
   "IF OBJECT_ID(...) IS NOT NULL DROP ... ; GO ; CREATE ...". Status penempatan
   memakai nilai 'Aktif' | 'Selesai'.
   ============================================================================ */

IF SCHEMA_ID('grading') IS NULL EXEC('CREATE SCHEMA grading');
GO

/* ===========================================================================
   1) MASTER / JANGKAR
   =========================================================================== */

-- Band / jenjang. Band 0 = Direksi (Direktur Utama & Direktur). Hanya pengelompokan
-- level - JG TIDAK di sini (JG ada di jabatan).
IF OBJECT_ID('grading.band') IS NULL
CREATE TABLE grading.band (
    id_band     TINYINT       NOT NULL PRIMARY KEY,   -- 0..6
    kode        NVARCHAR(10)  NULL,                   -- 'DIR','I'..'VI'
    nama        NVARCHAR(60)  NOT NULL,               -- General Manager, Manager, ...
    urutan      TINYINT       NOT NULL,               -- 0 = tertinggi
    keterangan  NVARCHAR(200) NULL
);
GO

-- Skala JG 7-21 -> band (master). Dipakai untuk memvalidasi & memetakan JG jabatan.
IF OBJECT_ID('grading.job_grade') IS NULL
CREATE TABLE grading.job_grade (
    jg       TINYINT NOT NULL PRIMARY KEY,            -- 7..21
    id_band  TINYINT NOT NULL,
    CONSTRAINT fk_jobgrade_band FOREIGN KEY (id_band) REFERENCES grading.band(id_band)
);
GO

-- Unit organisasi (hierarki Direktorat > Kompartemen > Departemen > Bagian/Region).
-- Ini "SO/struktur" yang berlaku; jabatan menempel ke sini lewat id_unit.
IF OBJECT_ID('grading.unit_organisasi') IS NULL
CREATE TABLE grading.unit_organisasi (
    id_unit          INT IDENTITY(1,1) PRIMARY KEY,
    nama             NVARCHAR(150) NOT NULL,
    tipe             NVARCHAR(30)  NOT NULL,          -- Direktorat|Kompartemen|Departemen|Bagian|Region
    id_unit_induk    INT           NULL,              -- unit atasannya (self)
    wilayah          NVARCHAR(50)  NULL,
    id_struktur_sdm  INT           NULL,              -- jembatan ke PEGAWAI_SDM.id_struktur (opsional)
    keterangan       NVARCHAR(300) NULL,
    CONSTRAINT fk_unit_induk FOREIGN KEY (id_unit_induk) REFERENCES grading.unit_organisasi(id_unit)
);
GO

/* ===========================================================================
   2) JABATAN — JG MELEKAT DI SINI (kolom jg). Band = jenjang; jg = grade.
   =========================================================================== */
IF OBJECT_ID('grading.jabatan') IS NULL
CREATE TABLE grading.jabatan (
    id_jabatan       INT IDENTITY(1,1) PRIMARY KEY,
    kode             NVARCHAR(40)  NULL,
    nama_jabatan     NVARCHAR(200) NOT NULL,
    id_band          TINYINT       NOT NULL,          -- jenjang (0=Direksi..6)
    jg               TINYINT       NULL,              -- JG jabatan = plafon PG (NULL utk Direksi)
    id_unit          INT           NULL,              -- -> unit_organisasi (SO/struktur)
    id_atasan        INT           NULL,              -- jabatan atasan langsung (self), sampai Direksi
    inti             BIT           NULL,              -- 1=Inti (Core), 0=Pendukung (Non-Core)
    kelompok_fungsi  NVARCHAR(80)  NULL,
    jumlah_formasi   SMALLINT      NOT NULL DEFAULT 1,
    alasan           NVARCHAR(MAX) NULL,              -- alasan penilaian (Hay: KH/PS/Acc)
    id_jabatan_sdm   INT           NULL,              -- jembatan ke PEGAWAI_SDM.id_jabatan (opsional)
    aktif            BIT           NOT NULL DEFAULT 1,
    dibuat_pada      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    diubah_pada      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_jabatan_band   FOREIGN KEY (id_band)   REFERENCES grading.band(id_band),
    CONSTRAINT fk_jabatan_jg     FOREIGN KEY (jg)        REFERENCES grading.job_grade(jg),
    CONSTRAINT fk_jabatan_unit   FOREIGN KEY (id_unit)   REFERENCES grading.unit_organisasi(id_unit),
    CONSTRAINT fk_jabatan_atasan FOREIGN KEY (id_atasan) REFERENCES grading.jabatan(id_jabatan)
);
GO
CREATE INDEX ix_jabatan_atasan ON grading.jabatan(id_atasan);
GO
-- Catatan konsistensi: jg sebuah jabatan harus berada dalam rentang band-nya
-- (mis. Band III hanya jg 15-16). Ditegakkan di aplikasi; bisa juga pakai composite FK
-- ke job_grade(jg) yang sudah membawa id_band bila ingin dijamin di database.

/* ===========================================================================
   3) PENEMPATAN — siapa mengisi jabatan mana (incumbency). BUKAN definisi jabatan.
   =========================================================================== */
IF OBJECT_ID('grading.penempatan') IS NULL
CREATE TABLE grading.penempatan (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    id_jabatan      INT          NOT NULL,
    id_karyawan     NVARCHAR(30) NOT NULL,            -- -> GCS.dbo.MST_PEGAWAI.ID_KARYAWAN
    nama            NVARCHAR(150) NULL,
    tmt             DATE         NULL,                -- terhitung mulai tanggal (opsional)
    tanggal_selesai DATE         NULL,                -- NULL = masih menjabat
    status          NVARCHAR(20) NOT NULL DEFAULT 'Aktif',   -- Aktif|Selesai
    jenis           NVARCHAR(20) NULL,                        -- Pengangkatan|Mutasi|Promosi|Demosi (cara masuk jabatan ini)
    catatan         NVARCHAR(400) NULL,
    dibuat_pada     DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_penempatan_jabatan FOREIGN KEY (id_jabatan) REFERENCES grading.jabatan(id_jabatan),
    CONSTRAINT ck_penempatan_status  CHECK (status IN ('Aktif','Selesai'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_penempatan_aktif' AND object_id=OBJECT_ID('grading.penempatan'))
CREATE UNIQUE INDEX ux_penempatan_aktif ON grading.penempatan(id_karyawan) WHERE status='Aktif';
GO

/* ===========================================================================
   4) TRANSAKSI PG per TAHUN — Person Grade per individu.
      "PG terkini" = tahun terbaru per pegawai (lihat vw_pg_terkini).
   =========================================================================== */
IF OBJECT_ID('grading.person_grade') IS NULL
CREATE TABLE grading.person_grade (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    id_karyawan     NVARCHAR(30) NOT NULL,
    nama            NVARCHAR(150) NULL,
    pg              TINYINT      NOT NULL,            -- 7..21
    golongan_lama   NVARCHAR(10) NULL,                -- 'D', dst
    tahun_berlaku   SMALLINT     NULL,
    catatan         NVARCHAR(300) NULL,
    dibuat_pada     DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX ix_persongrade_karyawan ON grading.person_grade(id_karyawan);
GO

/* ===========================================================================
   5) JABATAN_HIRARKI — pasangan ATASAN-BAWAHAN segala tingkat, DIBANGUN OTOMATIS
      dari jabatan.id_atasan. kedalaman: 0=diri sendiri, 1=langsung, dst.
   =========================================================================== */
IF OBJECT_ID('grading.jabatan_hirarki') IS NULL
CREATE TABLE grading.jabatan_hirarki (
    id_jabatan_atasan   INT NOT NULL,
    id_jabatan_bawahan  INT NOT NULL,
    kedalaman           INT NOT NULL,
    CONSTRAINT pk_jabatan_hirarki PRIMARY KEY (id_jabatan_atasan, id_jabatan_bawahan),
    CONSTRAINT fk_hirarki_atasan  FOREIGN KEY (id_jabatan_atasan)  REFERENCES grading.jabatan(id_jabatan),
    CONSTRAINT fk_hirarki_bawahan FOREIGN KEY (id_jabatan_bawahan) REFERENCES grading.jabatan(id_jabatan)
);
GO
CREATE INDEX ix_hirarki_bawahan ON grading.jabatan_hirarki(id_jabatan_bawahan);
GO

IF OBJECT_ID('grading.usp_bangun_hirarki_jabatan','P') IS NOT NULL DROP PROCEDURE grading.usp_bangun_hirarki_jabatan;
GO
CREATE PROCEDURE grading.usp_bangun_hirarki_jabatan
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM grading.jabatan_hirarki;
    ;WITH r AS (
        SELECT id_jabatan AS id_jabatan_atasan, id_jabatan AS id_jabatan_bawahan, 0 AS kedalaman
        FROM grading.jabatan
        UNION ALL
        SELECT r.id_jabatan_atasan, j.id_jabatan, r.kedalaman + 1
        FROM grading.jabatan j
        JOIN r ON j.id_atasan = r.id_jabatan_bawahan
    )
    INSERT INTO grading.jabatan_hirarki (id_jabatan_atasan, id_jabatan_bawahan, kedalaman)
    SELECT id_jabatan_atasan, id_jabatan_bawahan, kedalaman FROM r OPTION (MAXRECURSION 100);
END;
GO

/* ===========================================================================
   6) VIEW
   =========================================================================== */

-- PG terkini per pegawai (transaksi tahun terbaru)
IF OBJECT_ID('grading.vw_pg_terkini','V') IS NOT NULL DROP VIEW grading.vw_pg_terkini;
GO
CREATE VIEW grading.vw_pg_terkini AS
SELECT id_karyawan, nama, pg, golongan_lama, tahun_berlaku
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY id_karyawan ORDER BY tahun_berlaku DESC, id DESC) AS urut
    FROM grading.person_grade
) t WHERE urut = 1;
GO

-- Penempatan aktif (incumbent saat ini)
IF OBJECT_ID('grading.vw_penempatan_aktif','V') IS NOT NULL DROP VIEW grading.vw_penempatan_aktif;
GO
CREATE VIEW grading.vw_penempatan_aktif AS
SELECT id, id_jabatan, id_karyawan, nama, tmt
FROM grading.penempatan
WHERE status = 'Aktif';
GO

-- Status kebijakan PG <= JG (JG langsung dari jabatan.jg).
-- PG BOLEH > JG (grandfathered) => "dibekukan", bukan ditolak.
IF OBJECT_ID('grading.vw_status_pg_jg','V') IS NOT NULL DROP VIEW grading.vw_status_pg_jg;
GO
CREATE VIEW grading.vw_status_pg_jg AS
SELECT  p.id_karyawan,
        COALESCE(p.nama, pg.nama, p.id_karyawan) AS nama,
        j.nama_jabatan                            AS jabatan,
        j.jg                                      AS jg_jabatan,
        pg.pg                                     AS person_grade,
        CASE
            WHEN pg.pg IS NULL THEN 'PG belum ditetapkan'
            WHEN j.jg  IS NULL THEN 'Jabatan belum ber-JG'
            WHEN pg.pg > j.jg  THEN 'PG di atas JG - dibekukan'
            WHEN pg.pg = j.jg  THEN 'Selaras (mentok di JG jabatan)'
            ELSE 'Ada ruang naik'
        END AS status_kebijakan
FROM        grading.vw_penempatan_aktif p
JOIN        grading.jabatan            j  ON j.id_jabatan  = p.id_jabatan
LEFT JOIN   grading.vw_pg_terkini      pg ON pg.id_karyawan = p.id_karyawan;
GO

-- Rekap per Band (Formasi/Terisi/Kosong)
IF OBJECT_ID('grading.vw_rekap_band','V') IS NOT NULL DROP VIEW grading.vw_rekap_band;
GO
CREATE VIEW grading.vw_rekap_band AS
SELECT  b.id_band, b.kode, b.nama,
        ISNULL(SUM(j.jumlah_formasi), 0)                             AS formasi,
        ISNULL(SUM(t.terisi), 0)                                     AS terisi,
        ISNULL(SUM(j.jumlah_formasi), 0) - ISNULL(SUM(t.terisi), 0)  AS kosong
FROM        grading.band b
LEFT JOIN   grading.jabatan j ON j.id_band = b.id_band AND j.aktif = 1
OUTER APPLY (SELECT COUNT(*) AS terisi FROM grading.vw_penempatan_aktif pa WHERE pa.id_jabatan = j.id_jabatan) t
GROUP BY    b.id_band, b.kode, b.nama;
GO

-- Bagan organisasi: jabatan + band + jg + atasan + incumbent.
IF OBJECT_ID('grading.vw_bagan_organisasi','V') IS NOT NULL DROP VIEW grading.vw_bagan_organisasi;
GO
CREATE VIEW grading.vw_bagan_organisasi AS
SELECT  j.id_jabatan, j.nama_jabatan AS jabatan, b.kode AS band, j.jg,
        j.id_atasan, a.nama_jabatan AS atasan,
        pa.id_karyawan, pa.nama AS incumbent
FROM        grading.jabatan j
JOIN        grading.band b     ON b.id_band = j.id_band
LEFT JOIN   grading.jabatan a  ON a.id_jabatan = j.id_atasan
LEFT JOIN   grading.vw_penempatan_aktif pa ON pa.id_jabatan = j.id_jabatan
WHERE       j.aktif = 1;
GO

/* ===========================================================================
   7) SEED referensi (band + job_grade) — idempoten
   =========================================================================== */
MERGE grading.band AS t
USING (VALUES
    (0, N'DIR', N'Direksi (Direktur Utama & Direktur)', 0, N'Di atas Band I; di luar skala 7-21'),
    (1, N'I',   N'General Manager',  1, N'Pemimpin Kompartemen'),
    (2, N'II',  N'Manager',          2, N'Pemimpin Departemen'),
    (3, N'III', N'Kepala Bagian',    3, N'Pemimpin Bagian'),
    (4, N'IV',  N'Staf Pemula',      4, N'Analisis/teknis'),
    (5, N'V',   N'Pelaksana Senior', 5, N'Eksekusi berpengalaman'),
    (6, N'VI',  N'Pelaksana Junior', 6, N'Entry level')
) AS s(id_band, kode, nama, urutan, keterangan)
ON t.id_band = s.id_band
WHEN MATCHED THEN UPDATE SET kode=s.kode, nama=s.nama, urutan=s.urutan, keterangan=s.keterangan
WHEN NOT MATCHED THEN INSERT (id_band,kode,nama,urutan,keterangan)
    VALUES (s.id_band,s.kode,s.nama,s.urutan,s.keterangan);

MERGE grading.job_grade AS t
USING (VALUES (21,1),(20,1),(19,2),(18,2),(17,2),(16,3),(15,3),(14,4),(13,4),(12,4),(11,5),(10,5),(9,5),(8,6),(7,6)) AS s(jg,id_band)
ON t.jg = s.jg
WHEN MATCHED THEN UPDATE SET id_band = s.id_band
WHEN NOT MATCHED THEN INSERT (jg,id_band) VALUES (s.jg,s.id_band);
GO

/* ===========================================================================
   8) CONTOH data — ILUSTRASI. Rantai Direktur -> GM -> Manager; JG langsung di
      jabatan; PG transaksi; penempatan; kebijakan PG<=JG. Ganti dgn data riil.
   =========================================================================== */
IF NOT EXISTS (SELECT 1 FROM grading.jabatan)
BEGIN
    -- Direksi: band 0, jg NULL. GM: band 1, jg 20. Manager Kepatuhan: band 2, jg 17.
    INSERT INTO grading.jabatan (nama_jabatan,id_band,jg,id_atasan,inti,kelompok_fungsi,alasan)
    VALUES (N'Direktur Komersil',0,NULL,NULL,NULL,N'Direksi',N'BOD-1');
    DECLARE @dir INT = SCOPE_IDENTITY();

    INSERT INTO grading.jabatan (nama_jabatan,id_band,jg,id_atasan,inti,kelompok_fungsi,alasan)
    VALUES (N'GM SDM, Kepatuhan & Pengembangan',1,20,@dir,0,N'Governance/SDM',N'Governance 12% + SDM 10% KPI 2026.');
    DECLARE @gm INT = SCOPE_IDENTITY();

    INSERT INTO grading.jabatan (nama_jabatan,id_band,jg,id_atasan,inti,kelompok_fungsi,alasan)
    VALUES (N'Manager Kepatuhan',2,17,@gm,0,N'Kepatuhan',N'Second line (turun dari 18, Rev4).');
    DECLARE @mgr INT = SCOPE_IDENTITY();

    -- Contoh Band III: JG melekat per jabatan (Pak A)
    INSERT INTO grading.jabatan (nama_jabatan,id_band,jg,id_atasan,kelompok_fungsi) VALUES
        (N'Kabag Perbendaharaan',3,16,@gm,N'Keuangan'),
        (N'Kabag Pengadaan',     3,15,@gm,N'Pengadaan'),
        (N'Kabag Jasa Gudang',   3,16,@gm,N'Logistik');

    -- Penempatan (incumbency)
    INSERT INTO grading.penempatan (id_jabatan,id_karyawan,nama,tmt,status)
    VALUES (@gm, N'GCS-GMSDM', N'Moh. Faisal Alfarokhi','2026-01-01',N'Aktif'),
           (@mgr,N'GCS-NBD',   N'Nanang Budi D, SE',    '2026-01-01',N'Aktif');

    -- PG. Nanang: PG18 > jg jabatan (17) -> di view = "dibekukan".
    INSERT INTO grading.person_grade (id_karyawan,nama,pg,tahun_berlaku,catatan)
    VALUES (N'GCS-NBD', N'Nanang Budi D, SE', 18, 2026, N'PG dibekukan - gaji tetap');

    EXEC grading.usp_bangun_hirarki_jabatan;
END
GO

/* ===========================================================================
   9) PROMOSI & MUTASI — dikelola lewat penempatan (akhiri lama -> buat baru).
      Promosi = jabatan tujuan band lebih tinggi; Mutasi = band sama; Demosi = lebih rendah.
   =========================================================================== */

-- Untuk DB yang tabel penempatan-nya sudah ada tanpa kolom 'jenis' (idempoten).
IF COL_LENGTH('grading.penempatan','jenis') IS NULL
    ALTER TABLE grading.penempatan ADD jenis NVARCHAR(20) NULL;
GO

-- Pindah jabatan (promosi/mutasi/demosi) secara atomik & aman terhadap unique index
-- (satu penempatan Aktif per pegawai): akhiri yang lama DULU, baru buat yang baru.
-- @jenis boleh NULL -> otomatis ditentukan dari perbandingan band (jenjang).
IF OBJECT_ID('grading.usp_pindah_jabatan','P') IS NOT NULL DROP PROCEDURE grading.usp_pindah_jabatan;
GO
CREATE PROCEDURE grading.usp_pindah_jabatan
    @id_karyawan     NVARCHAR(30),
    @id_jabatan_baru INT,
    @jenis           NVARCHAR(20)  = NULL,   -- NULL = auto (Pengangkatan/Promosi/Mutasi/Demosi)
    @tmt             DATE          = NULL,   -- NULL = hari ini
    @nama            NVARCHAR(150) = NULL,
    @catatan         NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @tmt IS NULL SET @tmt = CAST(SYSDATETIME() AS DATE);

    DECLARE @urutan_baru TINYINT;
    SELECT @urutan_baru = b.urutan
    FROM grading.jabatan j JOIN grading.band b ON b.id_band = j.id_band
    WHERE j.id_jabatan = @id_jabatan_baru;
    IF @urutan_baru IS NULL BEGIN RAISERROR('Jabatan tujuan tidak ditemukan.',16,1); RETURN; END;

    BEGIN TRAN;
        -- penempatan Aktif saat ini (kalau ada)
        DECLARE @id_lama INT, @jab_lama INT, @urutan_lama TINYINT;
        SELECT @id_lama = id, @jab_lama = id_jabatan
        FROM grading.penempatan WHERE id_karyawan = @id_karyawan AND status = 'Aktif';

        IF @jab_lama IS NOT NULL
            SELECT @urutan_lama = b.urutan
            FROM grading.jabatan j JOIN grading.band b ON b.id_band = j.id_band
            WHERE j.id_jabatan = @jab_lama;

        -- tentukan jenis otomatis bila tidak diberikan (urutan kecil = jenjang lebih tinggi)
        IF @jenis IS NULL
            SET @jenis = CASE
                WHEN @id_lama IS NULL          THEN N'Pengangkatan'
                WHEN @urutan_baru < @urutan_lama THEN N'Promosi'
                WHEN @urutan_baru > @urutan_lama THEN N'Demosi'
                ELSE N'Mutasi' END;

        -- ambil nama snapshot bila tidak diberikan
        IF @nama IS NULL
            SELECT TOP 1 @nama = nama FROM grading.penempatan WHERE id_karyawan = @id_karyawan ORDER BY id DESC;

        -- 1) akhiri penempatan lama
        IF @id_lama IS NOT NULL
            UPDATE grading.penempatan SET status = N'Selesai', tanggal_selesai = @tmt WHERE id = @id_lama;

        -- 2) buat penempatan baru
        INSERT INTO grading.penempatan (id_jabatan, id_karyawan, nama, tmt, status, jenis, catatan)
        VALUES (@id_jabatan_baru, @id_karyawan, @nama, @tmt, N'Aktif', @jenis, @catatan);
    COMMIT;
END;
GO

-- Riwayat penempatan per pegawai (untuk lini masa karir / laporan promosi-mutasi).
IF OBJECT_ID('grading.vw_riwayat_penempatan','V') IS NOT NULL DROP VIEW grading.vw_riwayat_penempatan;
GO
CREATE VIEW grading.vw_riwayat_penempatan AS
SELECT  p.id_karyawan, p.nama, j.nama_jabatan, b.kode AS band, j.jg,
        p.jenis, p.tmt, p.tanggal_selesai, p.status
FROM        grading.penempatan p
JOIN        grading.jabatan     j ON j.id_jabatan = p.id_jabatan
JOIN        grading.band        b ON b.id_band   = j.id_band;
GO

/* Cek cepat:
   SELECT * FROM grading.vw_bagan_organisasi;      -- lihat kolom jg per jabatan
   SELECT * FROM grading.vw_status_pg_jg;           -- baris "PG di atas JG - dibekukan"
   SELECT * FROM grading.vw_rekap_band ORDER BY id_band;
   -- semua bawahan (segala tingkat) jabatan @X:
   -- SELECT id_jabatan_bawahan FROM grading.jabatan_hirarki WHERE id_jabatan_atasan=@X AND kedalaman>0;
*/
