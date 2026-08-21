/* ===========================================================================
   grading.pg_akselerasi - penanda karyawan yg PG-nya naik tiap 2 tahun (bukan
   3 tahun default) - ditetapkan Admin SDM. Kehadiran baris = diakselerasi;
   dihapus = kembali ke siklus normal. Dibaca OrgStrukturService (siklus naik
   otomatis PG, lihat NaikkanPgOtomatisJikaSaatnyaAsync) - lihat juga
   grading.person_grade di 01-schema-ddl.sql.

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\grading\11-pg-akselerasi-ddl.sql

   Idempoten: aman dijalankan ulang.
   =========================================================================== */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('Skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('grading.pg_akselerasi', 'U') IS NULL
BEGIN
    CREATE TABLE grading.pg_akselerasi
    (
        id_karyawan     NVARCHAR(20) NOT NULL CONSTRAINT PK_grading_pg_akselerasi PRIMARY KEY,
        catatan         NVARCHAR(400) NULL,
        ditetapkan_oleh NVARCHAR(20) NULL,
        dibuat_pada     DATETIME2 NOT NULL CONSTRAINT DF_pg_akselerasi_dibuat DEFAULT (SYSDATETIME())
    );
    PRINT 'Tabel grading.pg_akselerasi dibuat.';
END
ELSE
    PRINT 'LEWATI: grading.pg_akselerasi sudah ada.';
GO

SET NOEXEC OFF;
GO
