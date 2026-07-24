/* ============================================================================
   grading - view penggabung pegawai ORGANIK + TKNO
   ----------------------------------------------------------------------------
   grading.vw_pegawai_semua menyatukan:
     - Pegawai organik  : dari grading.vw_penempatan_aktif (penempatan aktif +
                          jabatan/band/jg/unit organik).
     - Pegawai TKNO     : dari grading.pegawai_tkno (skema grading TKNO sendiri).
   ke satu bentuk kolom yang sama, dibedakan lewat kolom jenis_pegawai.

   PENTING soal kolom `band`:
   Angka band di kedua jenis TIDAK berada di skala yang sama artinya
   (organik: band 0-6 jenjang struktural; TKNO: skema band sendiri). Karena itu
   nama_band (nama jenjang organik: GM/Manager/Kepala Bagian/...) HANYA diisi
   untuk baris organik; untuk TKNO nama_band = NULL supaya tidak salah label
   (mis. Driver band 3 BUKAN "Kepala Bagian"). Selalu kelompokkan/saring dengan
   jenis_pegawai bila ingin membandingkan band antar jenis.

   SQL Server 2014 (compat 120) tidak mendukung CREATE OR ALTER -> pola
   DROP IF EXISTS lalu CREATE. Idempoten.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\grading\08-view-pegawai-semua.sql
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

IF OBJECT_ID('grading.vw_pegawai_semua', 'V') IS NOT NULL
    DROP VIEW grading.vw_pegawai_semua;
GO

CREATE VIEW grading.vw_pegawai_semua
AS
SELECT
    CAST(N'Organik' AS NVARCHAR(10)) AS jenis_pegawai,
    pa.id_karyawan,
    pa.nama_karyawan                 AS nama,
    pa.id_band                       AS band,
    pa.nama_band,                                       -- nama jenjang organik (NULL utk TKNO)
    pa.jg,
    pa.nama_jabatan                  AS peran,          -- jabatan struktural
    pa.nama_unit                     AS unit,           -- unit organisasi
    pa.tmt                           AS tgl_masuk
FROM grading.vw_penempatan_aktif pa
UNION ALL
SELECT
    CAST(N'TKNO' AS NVARCHAR(10))    AS jenis_pegawai,
    t.id_karyawan,
    t.nama,
    t.band,
    CAST(NULL AS NVARCHAR(50))       AS nama_band,       -- skema band TKNO beda arti -> tidak dilabeli
    t.jg,
    t.unit_staf                      AS peran,           -- peran/Unit-Staf TKNO
    t.departemen                     AS unit,            -- departemen sbg unit
    t.tgl_masuk
FROM grading.pegawai_tkno t;
GO
PRINT 'View grading.vw_pegawai_semua dibuat.';
GO

SET NOEXEC OFF;
GO
