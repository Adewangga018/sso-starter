/* ============================================================================
   SIMULASI PROMOSI & MUTASI pada grading.penempatan
   Database: db_mygcs  |  schema: grading
   AMAN: seluruhnya dibungkus BEGIN TRAN ... ROLLBACK -> tidak menyimpan perubahan.
         Ganti ROLLBACK di akhir menjadi COMMIT bila memang ingin diterapkan.
   Prasyarat: usp_pindah_jabatan sudah dibuat (lihat jobgrade-schema.sql bagian 9).
   ============================================================================ */
SET NOCOUNT ON;
BEGIN TRAN;

/* --- Pilih 1 pegawai yang sedang menjabat, + target mutasi & promosi otomatis --- */
DECLARE @nik NVARCHAR(30), @jab_kini INT, @band_kini TINYINT, @nama NVARCHAR(150);
SELECT TOP 1 @nik = p.id_karyawan, @jab_kini = p.id_jabatan, @band_kini = j.id_band, @nama = p.nama
FROM grading.penempatan p
JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
WHERE p.status = 'Aktif'
ORDER BY p.id;

-- target MUTASI = jabatan lain di band yang SAMA
DECLARE @jab_mutasi INT = (
    SELECT TOP 1 id_jabatan FROM grading.jabatan
    WHERE id_band = @band_kini AND id_jabatan <> @jab_kini AND aktif = 1
    ORDER BY id_jabatan);

-- target PROMOSI = jabatan di band LEBIH TINGGI (urutan/band lebih kecil = lebih tinggi)
DECLARE @jab_promosi INT = (
    SELECT TOP 1 j.id_jabatan FROM grading.jabatan j
    WHERE j.id_band < @band_kini AND j.aktif = 1
    ORDER BY j.id_band DESC, j.id_jabatan);

PRINT CONCAT('Pegawai uji : ', @nik, ' (', @nama, ')');
PRINT CONCAT('Jabatan kini: ', @jab_kini, ' | target mutasi: ', ISNULL(CONVERT(varchar,@jab_mutasi),'(tidak ada)'),
             ' | target promosi: ', ISNULL(CONVERT(varchar,@jab_promosi),'(tidak ada)'));

/* --- SEBELUM --- */
SELECT 'SEBELUM' AS tahap, * FROM grading.vw_riwayat_penempatan WHERE id_karyawan = @nik ORDER BY tmt, status;

/* --- 1) MUTASI (band sama) --- jenis akan otomatis 'Mutasi' --- */
IF @jab_mutasi IS NOT NULL
    EXEC grading.usp_pindah_jabatan
        @id_karyawan = @nik, @id_jabatan_baru = @jab_mutasi,
        @catatan = N'Simulasi mutasi';

/* --- 2) PROMOSI (band lebih tinggi) --- jenis akan otomatis 'Promosi' --- */
IF @jab_promosi IS NOT NULL
    EXEC grading.usp_pindah_jabatan
        @id_karyawan = @nik, @id_jabatan_baru = @jab_promosi,
        @catatan = N'Simulasi promosi';

/* --- SESUDAH --- perhatikan kolom 'jenis' & 'status' (lama=Berakhir, baru=Aktif) --- */
SELECT 'SESUDAH' AS tahap, * FROM grading.vw_riwayat_penempatan WHERE id_karyawan = @nik ORDER BY tmt, status, tanggal_selesai;

/* --- Penempatan AKTIF akhir: harus tepat 1 baris (jabatan promosi) --- */
SELECT 'AKTIF-AKHIR' AS tahap, * FROM grading.vw_penempatan_aktif WHERE id_karyawan = @nik;

ROLLBACK;   -- <-- batalkan simulasi. Ubah ke COMMIT bila ingin benar-benar diterapkan.
