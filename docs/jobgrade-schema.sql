/* ============================================================================
   MyGCS — Skema Job Grade (JG) & Person Grade (PG)
   Target : database db_mygcs  |  schema: grading   |  RDBMS: SQL Server
   Referensi: "Analisis Pemetaan Job Grade PT GCS — Revisi 5 (Juli 2026)"
              + kesepakatan tim (Pak A, Pak F, Pak J).

   PRINSIP:
   - Band (0=Direksi, I-VI) = MASTER/jangkar yang stabil. Apa pun perubahan
     struktur, patokannya Band/level.
   - JG jabatan = TRANSAKSI per TAHUN (bisa berubah tiap tahun). "JG terkini"
     = baris tahun terbaru. (Tanpa nomor SK - tidak dilacak.)
   - PG per pegawai = TRANSAKSI per TAHUN.
   - Tidak ada versi/periode SO untuk dibandingkan (sesuai Pak J: jangkarnya
     Band). Struktur yang tersimpan hanya yang berlaku (terkini).
   - Atasan-bawahan: SATU sumber kebenaran = jabatan.id_atasan (adjacency),
     sampai Direksi. Tabel "jabatan_hirarki" (atasan-bawahan segala tingkat)
     DIBANGUN OTOMATIS dari id_atasan - bukan diisi manual.
   - Pegawai dirujuk lewat id_karyawan ke GCS.dbo.MST_PEGAWAI (lintas-DB,
     tanpa FK fisik).
   ============================================================================ */

IF SCHEMA_ID('grading') IS NULL EXEC('CREATE SCHEMA grading');
GO

/* ===========================================================================
   1) MASTER / JANGKAR
   =========================================================================== */

-- Band / level jangkar. Band 0 = Direksi (Direktur Utama & Direktur).
-- jg_min/jg_max NULL untuk Direksi (di luar skala grading 7-21).
IF OBJECT_ID('grading.band') IS NULL
CREATE TABLE grading.band (
    id_band     TINYINT       NOT NULL PRIMARY KEY,   -- 0..6
    kode        NVARCHAR(10)  NULL,                   -- 'DIR','I'..'VI'
    nama        NVARCHAR(60)  NOT NULL,
    jg_min      TINYINT       NULL,
    jg_max      TINYINT       NULL,
    urutan      TINYINT       NOT NULL,               -- 0 = tertinggi
    keterangan  NVARCHAR(200) NULL,
    CONSTRAINT ck_band_rentang CHECK (jg_min IS NULL OR jg_max IS NULL OR jg_min <= jg_max)
);
GO

-- Skala JG 7-21 -> Band (referensi). Direksi tidak ber-JG numerik.
IF OBJECT_ID('grading.job_grade') IS NULL
CREATE TABLE grading.job_grade (
    jg       TINYINT NOT NULL PRIMARY KEY,            -- 7..21
    id_band  TINYINT NOT NULL,
    CONSTRAINT fk_jobgrade_band FOREIGN KEY (id_band) REFERENCES grading.band(id_band)
);
GO

-- Unit organisasi (hierarki Direktorat > Kompartemen > Departemen > Bagian/Region)
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
   2) JABATAN — Band jangkar melekat di sini; JG lewat transaksi.
   =========================================================================== */
IF OBJECT_ID('grading.jabatan') IS NULL
CREATE TABLE grading.jabatan (
    id_jabatan       INT IDENTITY(1,1) PRIMARY KEY,
    kode             NVARCHAR(40)  NULL,
    nama_jabatan     NVARCHAR(200) NOT NULL,
    id_band          TINYINT       NOT NULL,          -- JANGKAR (0=Direksi..6)
    id_unit          INT           NULL,
    id_atasan        INT           NULL,              -- jabatan atasan langsung (self), sampai Direksi
    inti             BIT           NULL,              -- 1=Inti (Core), 0=Pendukung (Non-Core)
    kelompok_fungsi  NVARCHAR(80)  NULL,
    jumlah_formasi   SMALLINT      NOT NULL DEFAULT 1,-- jumlah kursi
    alasan           NVARCHAR(MAX) NULL,              -- alasan penilaian (Hay: KH/PS/Acc)
    id_jabatan_sdm   INT           NULL,              -- jembatan ke PEGAWAI_SDM.id_jabatan (opsional)
    aktif            BIT           NOT NULL DEFAULT 1,
    dibuat_pada      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    diubah_pada      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_jabatan_band   FOREIGN KEY (id_band)   REFERENCES grading.band(id_band),
    CONSTRAINT fk_jabatan_unit   FOREIGN KEY (id_unit)   REFERENCES grading.unit_organisasi(id_unit),
    CONSTRAINT fk_jabatan_atasan FOREIGN KEY (id_atasan) REFERENCES grading.jabatan(id_jabatan)
);
GO
CREATE INDEX ix_jabatan_atasan ON grading.jabatan(id_atasan);
GO

/* ===========================================================================
   3) TRANSAKSI JG per TAHUN — JG (plafon) yang menempel pada jabatan.
      "JG terkini" = tahun terbaru per jabatan (lihat vw_jg_terkini).
   =========================================================================== */
IF OBJECT_ID('grading.jabatan_grade') IS NULL
CREATE TABLE grading.jabatan_grade (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    id_jabatan      INT      NOT NULL,
    jg_max          TINYINT  NOT NULL,                -- JG jabatan = plafon PG
    tahun_berlaku   SMALLINT NULL,
    catatan         NVARCHAR(300) NULL,
    dibuat_pada     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_jabatangrade_jabatan FOREIGN KEY (id_jabatan) REFERENCES grading.jabatan(id_jabatan),
    CONSTRAINT fk_jabatangrade_jg      FOREIGN KEY (jg_max)     REFERENCES grading.job_grade(jg)
);
GO
CREATE INDEX ix_jabatangrade_jabatan ON grading.jabatan_grade(id_jabatan);
GO

/* ===========================================================================
   4) PENEMPATAN — siapa mengisi jabatan mana (incumbency).
      Kursi kosong TIDAK jadi baris; terisi = ada penempatan status='Aktif'.
   =========================================================================== */
IF OBJECT_ID('grading.penempatan') IS NULL
CREATE TABLE grading.penempatan (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    id_jabatan      INT          NOT NULL,
    id_karyawan     NVARCHAR(30) NOT NULL,            -- -> GCS.dbo.MST_PEGAWAI.ID_KARYAWAN
    nama            NVARCHAR(150) NULL,               -- nama incumbent (snapshot)
    tmt             DATE         NULL,                -- terhitung mulai tanggal (opsional)
    tanggal_selesai DATE         NULL,                -- NULL = masih menjabat
    status          NVARCHAR(20) NOT NULL DEFAULT 'Aktif',  -- Aktif|Berakhir
    catatan         NVARCHAR(400) NULL,
    dibuat_pada     DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_penempatan_jabatan FOREIGN KEY (id_jabatan) REFERENCES grading.jabatan(id_jabatan),
    CONSTRAINT ck_penempatan_status  CHECK (status IN ('Aktif','Berakhir'))
);
GO
-- Satu pegawai maksimal satu penempatan aktif.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_penempatan_aktif' AND object_id=OBJECT_ID('grading.penempatan'))
CREATE UNIQUE INDEX ux_penempatan_aktif ON grading.penempatan(id_karyawan) WHERE status='Aktif';
GO

/* ===========================================================================
   5) TRANSAKSI PG per TAHUN — Person Grade per individu.
      "PG terkini" = tahun terbaru per pegawai.
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
   6) JABATAN_HIRARKI — daftar pasangan ATASAN-BAWAHAN di SEGALA TINGKAT.
      kedalaman: 0 = dirinya sendiri, 1 = bawahan langsung, 2 = bawahan-dari-bawahan, dst.
      DIBANGUN OTOMATIS dari jabatan.id_atasan (jalankan usp_bangun_hirarki_jabatan).
      Jangan diisi manual.
   =========================================================================== */
IF OBJECT_ID('grading.jabatan_hirarki') IS NULL
CREATE TABLE grading.jabatan_hirarki (
    id_jabatan_atasan   INT NOT NULL,                 -- atasan (segala tingkat)
    id_jabatan_bawahan  INT NOT NULL,                 -- bawahan (segala tingkat)
    kedalaman           INT NOT NULL,                 -- 0=diri sendiri, 1=langsung, dst
    CONSTRAINT pk_jabatan_hirarki PRIMARY KEY (id_jabatan_atasan, id_jabatan_bawahan),
    CONSTRAINT fk_hirarki_atasan  FOREIGN KEY (id_jabatan_atasan)  REFERENCES grading.jabatan(id_jabatan),
    CONSTRAINT fk_hirarki_bawahan FOREIGN KEY (id_jabatan_bawahan) REFERENCES grading.jabatan(id_jabatan)
);
GO
CREATE INDEX ix_hirarki_bawahan ON grading.jabatan_hirarki(id_jabatan_bawahan);
GO

-- Bangun ulang seluruh isi jabatan_hirarki dari id_atasan.
-- Dipanggil APLIKASI setiap kali struktur (id_atasan) berubah. Instan utk skala GCS.
CREATE OR ALTER PROCEDURE grading.usp_bangun_hirarki_jabatan
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
   7) VIEW — kondisi terkini + reproduksi tabel dokumen
   =========================================================================== */

-- JG jabatan terkini (transaksi tahun terbaru per jabatan)
CREATE OR ALTER VIEW grading.vw_jg_terkini AS
SELECT id_jabatan, jg_max, tahun_berlaku
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY id_jabatan ORDER BY tahun_berlaku DESC, id DESC) AS urut
    FROM grading.jabatan_grade
) t WHERE urut = 1;
GO

-- PG terkini per pegawai
CREATE OR ALTER VIEW grading.vw_pg_terkini AS
SELECT id_karyawan, nama, pg, golongan_lama, tahun_berlaku
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY id_karyawan ORDER BY tahun_berlaku DESC, id DESC) AS urut
    FROM grading.person_grade
) t WHERE urut = 1;
GO

-- Penempatan aktif (incumbent saat ini)
CREATE OR ALTER VIEW grading.vw_penempatan_aktif AS
SELECT id, id_jabatan, id_karyawan, nama, tmt
FROM grading.penempatan
WHERE status = 'Aktif';
GO

-- Status kebijakan PG <= JG (tabel "Kebijakan PG<=JG" Revisi 4).
-- PG BOLEH > JG (grandfathered) => "dibekukan", bukan ditolak (tidak ada CHECK keras).
CREATE OR ALTER VIEW grading.vw_status_pg_jg AS
SELECT  p.id_karyawan,
        COALESCE(p.nama, pg.nama, p.id_karyawan) AS nama,
        j.nama_jabatan                            AS jabatan,
        g.jg_max                                  AS jg_jabatan,
        pg.pg                                     AS person_grade,
        CASE
            WHEN pg.pg   IS NULL THEN 'PG belum ditetapkan'
            WHEN g.jg_max IS NULL THEN 'Jabatan belum ber-JG'
            WHEN pg.pg > g.jg_max THEN 'PG di atas JG - dibekukan'
            WHEN pg.pg = g.jg_max THEN 'Selaras (mentok di JG jabatan)'
            ELSE 'Ada ruang naik'
        END AS status_kebijakan
FROM        grading.vw_penempatan_aktif p
JOIN        grading.jabatan             j  ON j.id_jabatan  = p.id_jabatan
LEFT JOIN   grading.vw_jg_terkini       g  ON g.id_jabatan  = j.id_jabatan
LEFT JOIN   grading.vw_pg_terkini       pg ON pg.id_karyawan = p.id_karyawan;
GO

-- Rekap per Band (Formasi/Terisi/Kosong)
CREATE OR ALTER VIEW grading.vw_rekap_band AS
SELECT  b.id_band, b.kode, b.nama, b.jg_min, b.jg_max,
        ISNULL(SUM(j.jumlah_formasi), 0)                             AS formasi,
        ISNULL(SUM(t.terisi), 0)                                     AS terisi,
        ISNULL(SUM(j.jumlah_formasi), 0) - ISNULL(SUM(t.terisi), 0)  AS kosong
FROM        grading.band b
LEFT JOIN   grading.jabatan j ON j.id_band = b.id_band AND j.aktif = 1
OUTER APPLY (SELECT COUNT(*) AS terisi FROM grading.vw_penempatan_aktif pa WHERE pa.id_jabatan = j.id_jabatan) t
GROUP BY    b.id_band, b.kode, b.nama, b.jg_min, b.jg_max;
GO

-- Bagan organisasi: jabatan + atasan + band + JG terkini + incumbent.
CREATE OR ALTER VIEW grading.vw_bagan_organisasi AS
SELECT  j.id_jabatan, j.nama_jabatan AS jabatan, b.kode AS band, g.jg_max AS jg,
        j.id_atasan, a.nama_jabatan AS atasan,
        pa.id_karyawan, pa.nama AS incumbent
FROM        grading.jabatan j
JOIN        grading.band b               ON b.id_band = j.id_band
LEFT JOIN   grading.jabatan a            ON a.id_jabatan = j.id_atasan
LEFT JOIN   grading.vw_jg_terkini g      ON g.id_jabatan = j.id_jabatan
LEFT JOIN   grading.vw_penempatan_aktif pa ON pa.id_jabatan = j.id_jabatan
WHERE       j.aktif = 1;
GO

/* ===========================================================================
   8) SEED referensi (band + job_grade) — idempoten
   =========================================================================== */
MERGE grading.band AS t
USING (VALUES
    (0, N'DIR', N'Direksi (Direktur Utama & Direktur)', NULL, NULL, 0, N'Di atas Band I; di luar skala 7-21'),
    (1, N'I',   N'General Manager',  20, 21, 1, N'Pemimpin Kompartemen'),
    (2, N'II',  N'Manager',          17, 19, 2, N'Pemimpin Departemen'),
    (3, N'III', N'Kepala Bagian',    15, 16, 3, N'Pemimpin Bagian'),
    (4, N'IV',  N'Staf Pemula',      12, 14, 4, N'Analisis/teknis'),
    (5, N'V',   N'Pelaksana Senior',  9, 11, 5, N'Eksekusi berpengalaman'),
    (6, N'VI',  N'Pelaksana Junior',  7,  8, 6, N'Entry level')
) AS s(id_band, kode, nama, jg_min, jg_max, urutan, keterangan)
ON t.id_band = s.id_band
WHEN MATCHED THEN UPDATE SET kode=s.kode, nama=s.nama, jg_min=s.jg_min, jg_max=s.jg_max, urutan=s.urutan, keterangan=s.keterangan
WHEN NOT MATCHED THEN INSERT (id_band,kode,nama,jg_min,jg_max,urutan,keterangan)
    VALUES (s.id_band,s.kode,s.nama,s.jg_min,s.jg_max,s.urutan,s.keterangan);

MERGE grading.job_grade AS t
USING (VALUES (21,1),(20,1),(19,2),(18,2),(17,2),(16,3),(15,3),(14,4),(13,4),(12,4),(11,5),(10,5),(9,5),(8,6),(7,6)) AS s(jg,id_band)
ON t.jg = s.jg
WHEN MATCHED THEN UPDATE SET id_band = s.id_band
WHEN NOT MATCHED THEN INSERT (jg,id_band) VALUES (s.jg,s.id_band);
GO

/* ===========================================================================
   9) CONTOH data — ILUSTRASI (bukan data final). Rantai Direktur -> GM -> Manager,
      transaksi JG & PG, penempatan, dan kebijakan PG<=JG. Ganti dgn data riil.
   =========================================================================== */
IF NOT EXISTS (SELECT 1 FROM grading.jabatan)
BEGIN
    INSERT INTO grading.jabatan (nama_jabatan,id_band,id_atasan,inti,kelompok_fungsi,jumlah_formasi,alasan)
    VALUES (N'Direktur Komersil',0,NULL,NULL,N'Direksi',1,N'BOD-1');
    DECLARE @dir INT = SCOPE_IDENTITY();

    INSERT INTO grading.jabatan (nama_jabatan,id_band,id_atasan,inti,kelompok_fungsi,jumlah_formasi,alasan)
    VALUES (N'GM SDM, Kepatuhan & Pengembangan',1,@dir,0,N'Governance/SDM',1,N'Governance 12% + SDM 10% KPI 2026.');
    DECLARE @gm INT = SCOPE_IDENTITY();

    INSERT INTO grading.jabatan (nama_jabatan,id_band,id_atasan,inti,kelompok_fungsi,jumlah_formasi,alasan)
    VALUES (N'Manager Kepatuhan',2,@gm,0,N'Kepatuhan',1,N'Second line (turun dari 18, Rev4).');
    DECLARE @mgr INT = SCOPE_IDENTITY();

    -- Transaksi JG (set JG max) untuk jabatan ber-grade
    INSERT INTO grading.jabatan_grade (id_jabatan,jg_max,tahun_berlaku,catatan)
    VALUES (@gm,20,2026,NULL),
           (@mgr,17,2026,N'Turun dari 18 (Rev4)');

    -- Penempatan (incumbency)
    INSERT INTO grading.penempatan (id_jabatan,id_karyawan,nama,tmt,status)
    VALUES (@gm, N'GCS-GMSDM', N'Moh. Faisal Alfarokhi','2026-01-01',N'Aktif'),
           (@mgr,N'GCS-NBD',   N'Nanang Budi D, SE',    '2026-01-01',N'Aktif');

    -- Transaksi PG. Nanang: PG18 > jg_max jabatan (17) -> di view = "dibekukan".
    INSERT INTO grading.person_grade (id_karyawan,nama,pg,tahun_berlaku,catatan)
    VALUES (N'GCS-NBD', N'Nanang Budi D, SE', 18, 2026, N'PG dibekukan - gaji tetap');

    EXEC grading.usp_bangun_hirarki_jabatan;
END
GO

/* Cek cepat:
   SELECT * FROM grading.vw_bagan_organisasi;
   SELECT * FROM grading.vw_status_pg_jg;      -- baris "PG di atas JG - dibekukan"
   SELECT * FROM grading.vw_rekap_band ORDER BY id_band;
   -- semua bawahan (segala tingkat) sebuah jabatan @X, query pendek:
   -- SELECT id_jabatan_bawahan FROM grading.jabatan_hirarki WHERE id_jabatan_atasan=@X AND kedalaman>0;
*/
