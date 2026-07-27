/* ============================================================================
   grading - tautkan pegawai_tkno ke unit_organisasi lewat ID.
   ----------------------------------------------------------------------------
   pegawai_tkno menyimpan departemen/kompartemen/direktorat sebagai NAMA. Resolusi
   organisasi (OrgResolver) menelusuri unit lewat ID (unit_organisasi.id_unit),
   sehingga pegawai TKNO tidak pernah ter-resolve cakupannya dan TIDAK MUNCUL pada
   pemilih anggota gugus (SS -> satu departemen, 5R -> satu kompartemen).

   Perbaikan: tambah kolom id_departemen / id_kompartemen / id_direktorat yang
   merujuk grading.unit_organisasi.id_unit, diisi dengan mencocokkan nama. Kolom
   nama lama DIPERTAHANKAN (dipakai view grading.vw_pegawai_semua untuk tampilan).
   Idempoten. Jalankan setelah 07-seed-tkno.sql & 01-schema-ddl (unit_organisasi).

   CARA PAKAI
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -i backend\Database\grading\09-tkno-unit-id.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('grading.pegawai_tkno', 'id_departemen') IS NULL
    ALTER TABLE grading.pegawai_tkno ADD id_departemen INT NULL;
GO
IF COL_LENGTH('grading.pegawai_tkno', 'id_kompartemen') IS NULL
    ALTER TABLE grading.pegawai_tkno ADD id_kompartemen INT NULL;
GO
IF COL_LENGTH('grading.pegawai_tkno', 'id_direktorat') IS NULL
    ALTER TABLE grading.pegawai_tkno ADD id_direktorat INT NULL;
GO

/* Isi ID dengan mencocokkan nama ke unit_organisasi (nama TKNO sudah identik
   dengan unit_organisasi.nama). Departemen mencakup tipe Departemen/Region/Kelompok. */
UPDATE t
   SET t.id_departemen = u.id_unit
  FROM grading.pegawai_tkno t
  JOIN grading.unit_organisasi u
    ON u.nama = t.departemen AND u.tipe IN ('Departemen', 'Region', 'Kelompok');

UPDATE t
   SET t.id_kompartemen = u.id_unit
  FROM grading.pegawai_tkno t
  JOIN grading.unit_organisasi u
    ON u.nama = t.kompartemen AND u.tipe = 'Kompartemen';

UPDATE t
   SET t.id_direktorat = u.id_unit
  FROM grading.pegawai_tkno t
  JOIN grading.unit_organisasi u
    ON u.nama = t.direktorat AND u.tipe = 'Direktorat';
GO

/* Laporan: baris yang masih belum tertaut (nama tak cocok) perlu ditinjau manual. */
DECLARE @belum INT = (SELECT COUNT(*) FROM grading.pegawai_tkno
                      WHERE id_departemen IS NULL AND id_kompartemen IS NULL);
PRINT CONCAT('pegawai_tkno tertaut. Belum ada dep/komp id: ', @belum);
GO

SET NOEXEC OFF;
GO
