/* ============================================================================
   grading - stored procedure hirarki + views
   (Server ini SQL Server 2014, compatibility level 120 - TIDAK mendukung
   "CREATE OR ALTER" (baru ada di SQL Server 2016 SP1+). Dipakai pola klasik:
   DROP IF EXISTS lalu CREATE.)
   ----------------------------------------------------------------------------
   - usp_bangun_hirarki_jabatan: membangun ulang grading.jabatan_hirarki
     (closure table atasan-bawahan segala tingkat) dari grading.jabatan.id_atasan.
     Jalankan ulang kapan pun jabatan/id_atasan berubah.
   - vw_pg_terkini        : PG terbaru (tahun_berlaku terbesar) per karyawan.
   - vw_penempatan_aktif  : penempatan aktif + detail jabatan/band/jg/unit.
   - vw_status_pg_jg      : status kebijakan PG<=JG (baris "dibekukan" berarti
                             PG karyawan sudah melebihi JG jabatan yang
                             diduduki - lihat grading.jabatan.jg langsung,
                             BUKAN dari tabel transaksi JG terpisah karena
                             jabatan_grade sudah dihapus dari desain).
   - vw_rekap_band        : rekap formasi/terisi/kosong per band, dihitung
                             langsung dari grading.jabatan + grading.penempatan
                             (bukan dari angka statis Analisis_Pemetaan_JG).
   - vw_bagan_organisasi  : bagan organisasi jabatan (nama, band, jg langsung
                             dari grading.jabatan.jg, atasan, incumbent aktif).

   Catatan: vw_jg_terkini SENGAJA TIDAK dibuat (dihapus dari desain) karena JG
   sudah melekat langsung di grading.jabatan.jg - tidak ada transaksi JG
   terpisah yang perlu "versi terkini"-nya.
   ============================================================================ */

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('grading.vw_jg_terkini', 'V') IS NOT NULL
    DROP VIEW grading.vw_jg_terkini;  -- pastikan tidak ada sisa dari desain lama
GO

IF OBJECT_ID('grading.usp_bangun_hirarki_jabatan', 'P') IS NOT NULL
    DROP PROCEDURE grading.usp_bangun_hirarki_jabatan;
GO

CREATE PROCEDURE grading.usp_bangun_hirarki_jabatan
AS
BEGIN
    SET NOCOUNT ON;

    TRUNCATE TABLE grading.jabatan_hirarki;

    ;WITH rcte AS (
        SELECT id_jabatan AS id_jabatan_atasan, id_jabatan AS id_jabatan_bawahan, 0 AS kedalaman
        FROM grading.jabatan
        UNION ALL
        SELECT r.id_jabatan_atasan, j.id_jabatan, r.kedalaman + 1
        FROM rcte r
        JOIN grading.jabatan j ON j.id_atasan = r.id_jabatan_bawahan
    )
    INSERT INTO grading.jabatan_hirarki (id_jabatan_atasan, id_jabatan_bawahan, kedalaman)
    SELECT id_jabatan_atasan, id_jabatan_bawahan, kedalaman
    FROM rcte
    OPTION (MAXRECURSION 100);

    PRINT 'grading.jabatan_hirarki dibangun ulang: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' baris.';
END
GO
PRINT 'Stored procedure grading.usp_bangun_hirarki_jabatan dibuat.';
GO

IF OBJECT_ID('grading.vw_pg_terkini', 'V') IS NOT NULL
    DROP VIEW grading.vw_pg_terkini;
GO
CREATE VIEW grading.vw_pg_terkini
AS
SELECT pg1.id_karyawan, pg1.nama, pg1.pg, pg1.golongan_lama, pg1.tahun_berlaku
FROM grading.person_grade pg1
WHERE pg1.tahun_berlaku = (
    SELECT MAX(pg2.tahun_berlaku) FROM grading.person_grade pg2 WHERE pg2.id_karyawan = pg1.id_karyawan
);
GO
PRINT 'View grading.vw_pg_terkini dibuat.';
GO

IF OBJECT_ID('grading.vw_penempatan_aktif', 'V') IS NOT NULL
    DROP VIEW grading.vw_penempatan_aktif;
GO
CREATE VIEW grading.vw_penempatan_aktif
AS
SELECT
    p.id                AS id_penempatan,
    p.id_karyawan,
    p.nama              AS nama_karyawan,
    p.tmt,
    p.catatan,
    j.id_jabatan,
    j.nama_jabatan,
    j.id_band,
    b.nama              AS nama_band,
    j.jg,
    u.nama              AS nama_unit,
    ja.nama_jabatan     AS nama_atasan
FROM grading.penempatan p
JOIN grading.jabatan j        ON j.id_jabatan = p.id_jabatan
JOIN grading.band b            ON b.id_band = j.id_band
LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
LEFT JOIN grading.jabatan ja    ON ja.id_jabatan = j.id_atasan
WHERE p.status = 'Aktif';
GO
PRINT 'View grading.vw_penempatan_aktif dibuat.';
GO

IF OBJECT_ID('grading.vw_status_pg_jg', 'V') IS NOT NULL
    DROP VIEW grading.vw_status_pg_jg;
GO
CREATE VIEW grading.vw_status_pg_jg
AS
SELECT
    pa.id_karyawan,
    pa.nama_karyawan,
    pa.nama_jabatan,
    pa.id_band,
    pa.jg               AS jg_jabatan,
    g.pg                AS person_grade,
    CASE
        WHEN g.pg IS NULL THEN N'PG belum ditetapkan'
        WHEN pa.jg IS NULL THEN N'Jabatan di luar skala JG (Direksi/di luar formasi)'
        WHEN g.pg > pa.jg THEN N'PG di atas JG - dibekukan'
        WHEN g.pg = pa.jg THEN N'Selaras (mentok di JG jabatan)'
        ELSE N'Ada ruang naik'
    END AS status_kebijakan
FROM grading.vw_penempatan_aktif pa
LEFT JOIN grading.vw_pg_terkini g ON g.id_karyawan = pa.id_karyawan;
GO
PRINT 'View grading.vw_status_pg_jg dibuat.';
GO

IF OBJECT_ID('grading.vw_rekap_band', 'V') IS NOT NULL
    DROP VIEW grading.vw_rekap_band;
GO
CREATE VIEW grading.vw_rekap_band
AS
SELECT
    b.id_band,
    b.nama                                   AS nama_band,
    COUNT(j.id_jabatan)                      AS jumlah_jabatan,
    SUM(CASE WHEN p.id_karyawan IS NOT NULL THEN 1 ELSE 0 END) AS terisi,
    SUM(CASE WHEN p.id_karyawan IS NULL THEN 1 ELSE 0 END)     AS kosong
FROM grading.band b
LEFT JOIN grading.jabatan j ON j.id_band = b.id_band
LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
GROUP BY b.id_band, b.nama;
GO
PRINT 'View grading.vw_rekap_band dibuat.';
GO

IF OBJECT_ID('grading.vw_bagan_organisasi', 'V') IS NOT NULL
    DROP VIEW grading.vw_bagan_organisasi;
GO
CREATE VIEW grading.vw_bagan_organisasi
AS
SELECT
    j.id_jabatan,
    j.nama_jabatan,
    j.id_band,
    b.nama              AS nama_band,
    j.jg,
    j.id_atasan,
    ja.nama_jabatan     AS nama_atasan,
    u.nama              AS nama_unit,
    p.id_karyawan,
    p.nama              AS nama_karyawan
FROM grading.jabatan j
JOIN grading.band b ON b.id_band = j.id_band
LEFT JOIN grading.jabatan ja ON ja.id_jabatan = j.id_atasan
LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif';
GO
PRINT 'View grading.vw_bagan_organisasi dibuat.';
GO

EXEC grading.usp_bangun_hirarki_jabatan;
GO

SET NOEXEC OFF;
GO
