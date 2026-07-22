/* ============================================================================
   grading - contoh query studi kasus (PG/JG, jabatan, band, organisasi)
   ----------------------------------------------------------------------------
   Kumpulan query SIAP PAKAI untuk dijalankan satu-satu (bukan skrip migrasi -
   semuanya read-only SELECT, aman dijalankan kapan saja). Jalankan blok per
   blok sesuai kebutuhan, mis.:
     sqlcmd -S 192.168.100.2,49291 -U sa -P <password> -d db_mygcs -C ^
            -Q "<isi salah satu query di bawah>"
   atau tempel langsung ke SSMS/Azure Data Studio.
   ============================================================================ */

-- =============================================================================
-- 1) REKAP FORMASI PER BAND (formasi/terisi/kosong) - live, bukan angka statis
-- =============================================================================
SELECT * FROM grading.vw_rekap_band ORDER BY id_band;


-- =============================================================================
-- 2) DAFTAR JABATAN KOSONG per band - kandidat rekrutmen/promosi
-- =============================================================================
SELECT b.nama AS band, j.nama_jabatan, j.jg, u.nama AS unit, ja.nama_jabatan AS atasan
FROM grading.jabatan j
JOIN grading.band b ON b.id_band = j.id_band
LEFT JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
LEFT JOIN grading.jabatan ja ON ja.id_jabatan = j.id_atasan
LEFT JOIN grading.penempatan p ON p.id_jabatan = j.id_jabatan AND p.status = 'Aktif'
WHERE p.id IS NULL
ORDER BY j.id_band, j.jg DESC, j.nama_jabatan;


-- =============================================================================
-- 3) STATUS KEBIJAKAN PG <= JG - siapa yang "dibekukan" (PG > JG jabatan)
-- =============================================================================
SELECT * FROM grading.vw_status_pg_jg
WHERE status_kebijakan = N'PG di atas JG - dibekukan'
ORDER BY id_band, nama_karyawan;

-- 3b) Semua status sekaligus (dibekukan / selaras / ada ruang naik), diringkas per status
SELECT status_kebijakan, COUNT(*) AS jumlah_pegawai
FROM grading.vw_status_pg_jg
GROUP BY status_kebijakan
ORDER BY jumlah_pegawai DESC;


-- =============================================================================
-- 4) KANDIDAT PROMOSI - PG sudah "Selaras (mentok di JG jabatan)", siap naik
--    kalau dapat jabatan ber-JG lebih tinggi
-- =============================================================================
SELECT id_karyawan, nama_karyawan, nama_jabatan, id_band, jg_jabatan, person_grade
FROM grading.vw_status_pg_jg
WHERE status_kebijakan = N'Selaras (mentok di JG jabatan)'
ORDER BY id_band, jg_jabatan DESC;


-- =============================================================================
-- 5) SATU BAND, JG BERBEDA-BEDA - buktikan "JG melekat di jabatan, band cuma
--    jenjang" (mis. lihat Band III: Bag. Perbendaharaan JG16 vs Bag.
--    Pengadaan & Pengelolaan Pengembangan JG15, walau band-nya sama)
-- =============================================================================
SELECT b.nama AS band, j.jg, j.nama_jabatan
FROM grading.jabatan j
JOIN grading.band b ON b.id_band = j.id_band
WHERE j.id_band = 3   -- ganti 0-6 untuk lihat band lain
ORDER BY j.jg DESC, j.nama_jabatan;


-- =============================================================================
-- 6) STRUKTUR ORGANISASI TOP-DOWN - seluruh bawahan (langsung + tidak
--    langsung) dari satu jabatan, pakai closure table jabatan_hirarki
--    (contoh: GM Penjualan Retail - ganti teks di WHERE untuk jabatan lain)
-- =============================================================================
SELECT h.kedalaman, REPLICATE(N'  ', h.kedalaman) + jb.nama_jabatan AS struktur,
       jb.jg, p.id_karyawan, p.nama AS nama_karyawan
FROM grading.jabatan_hirarki h
JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
JOIN grading.jabatan jb ON jb.id_jabatan = h.id_jabatan_bawahan
LEFT JOIN grading.penempatan p ON p.id_jabatan = jb.id_jabatan AND p.status = 'Aktif'
WHERE ja.nama_jabatan = N'GM Penjualan Retail'
ORDER BY h.kedalaman, jb.nama_jabatan;


-- =============================================================================
-- 7) RANTAI PELAPORAN KE ATAS - dari satu karyawan sampai ke Direktur Utama
--    (contoh: T.211273 = Ari Kuncoro - ganti NIK/ID_KARYAWAN di WHERE)
-- =============================================================================
SELECT h.kedalaman, ja.nama_jabatan AS atasan, ja.jg, pa.id_karyawan, pa.nama AS nama_atasan
FROM grading.penempatan p
JOIN grading.jabatan_hirarki h ON h.id_jabatan_bawahan = p.id_jabatan
JOIN grading.jabatan ja ON ja.id_jabatan = h.id_jabatan_atasan
LEFT JOIN grading.penempatan pa ON pa.id_jabatan = ja.id_jabatan AND pa.status = 'Aktif'
WHERE p.id_karyawan = N'T.211273' AND p.status = 'Aktif'
ORDER BY h.kedalaman DESC;


-- =============================================================================
-- 8) SPAN OF CONTROL - jumlah bawahan LANGSUNG per jabatan (bukan seluruh
--    turunan), diurutkan dari yang terbesar
-- =============================================================================
SELECT ja.nama_jabatan AS atasan, ja.id_band, COUNT(*) AS jumlah_bawahan_langsung
FROM grading.jabatan jb
JOIN grading.jabatan ja ON ja.id_jabatan = jb.id_atasan
GROUP BY ja.nama_jabatan, ja.id_band
ORDER BY jumlah_bawahan_langsung DESC;


-- =============================================================================
-- 9) DAFTAR PEGAWAI PER BAND LENGKAP DENGAN GAP PG vs JG
-- =============================================================================
SELECT pa.id_band, b.nama AS band, pa.nama_karyawan, pa.nama_jabatan, pa.jg AS jg_jabatan,
       g.pg AS person_grade,
       (CAST(pa.jg AS SMALLINT) - CAST(g.pg AS SMALLINT)) AS sisa_ruang_naik,  -- CAST wajib: tinyint tak bertanda, hasil bisa negatif (kasus "dibekukan")
       pa.tmt
FROM grading.vw_penempatan_aktif pa
JOIN grading.band b ON b.id_band = pa.id_band
LEFT JOIN grading.vw_pg_terkini g ON g.id_karyawan = pa.id_karyawan
ORDER BY pa.id_band, sisa_ruang_naik ASC;


-- =============================================================================
-- 10) SENIORITAS - pegawai dengan masa kerja terpanjang (dari tmt penempatan
--     Band 1-3; untuk masa kerja presisi/lengkap pakai TGL_MASUK di GCS)
-- =============================================================================
SELECT TOP 15 p.id_karyawan, p.nama, j.nama_jabatan, p.tmt,
       DATEDIFF(YEAR, p.tmt, GETDATE()) AS lama_tahun_di_posisi_ini
FROM grading.penempatan p
JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
WHERE p.status = 'Aktif' AND p.tmt IS NOT NULL
ORDER BY p.tmt ASC;


-- =============================================================================
-- 11) CARI PEGAWAI BY NIK/ID_KARYAWAN - gabungan grading + GCS (lintas DB,
--     TANPA FK - GCS.dbo.MST_PEGAWAI adalah sumber identitas resminya)
--     (contoh: T.980187 = Widodo - ganti NIK di WHERE untuk pegawai lain)
-- =============================================================================
SELECT m.ID_KARYAWAN, m.NAMA_LENGKAP, m.NIK AS nik_ktp, m.STATUS_KARYAWAN,
       pa.nama_jabatan, pa.id_band, pa.jg AS jg_jabatan, g.pg AS person_grade
FROM GCS.dbo.MST_PEGAWAI m
LEFT JOIN grading.vw_penempatan_aktif pa ON pa.id_karyawan = m.ID_KARYAWAN
LEFT JOIN grading.vw_pg_terkini g ON g.id_karyawan = m.ID_KARYAWAN
WHERE m.ID_KARYAWAN = N'T.980187';


-- =============================================================================
-- 12) INTEGRITAS LINTAS-DB - pastikan semua id_karyawan di grading masih ada
--     di GCS.dbo.MST_PEGAWAI (jalankan berkala, karena TIDAK ada FK sungguhan)
-- =============================================================================
SELECT p.id_karyawan, p.nama, N'penempatan' AS sumber
FROM grading.penempatan p
LEFT JOIN GCS.dbo.MST_PEGAWAI m ON m.ID_KARYAWAN = p.id_karyawan
WHERE m.ID_PEGAWAI IS NULL
UNION ALL
SELECT g.id_karyawan, g.nama, N'person_grade'
FROM grading.person_grade g
LEFT JOIN GCS.dbo.MST_PEGAWAI m ON m.ID_KARYAWAN = g.id_karyawan
WHERE m.ID_PEGAWAI IS NULL;
-- Hasil kosong = semua id_karyawan valid.


-- =============================================================================
-- 13) GOLONGAN LAMA 'D' - lacak pegawai Band 6 yang masih memakai penanda
--     golongan sistem lama (menjelang migrasi penuh ke Band/JG/PG)
-- =============================================================================
SELECT g.id_karyawan, g.nama, g.golongan_lama, pa.nama_jabatan, pa.jg
FROM grading.person_grade g
JOIN grading.vw_penempatan_aktif pa ON pa.id_karyawan = g.id_karyawan
WHERE g.golongan_lama IS NOT NULL
ORDER BY pa.jg DESC, g.nama;


-- =============================================================================
-- 14) JABATAN DENGAN STATUS Pjs. (belum definitif) - dari catatan penempatan
-- =============================================================================
SELECT id_karyawan, nama_karyawan, nama_jabatan, id_band, catatan
FROM grading.vw_penempatan_aktif
WHERE catatan LIKE N'%Pjs.%'
ORDER BY id_band;


-- =============================================================================
-- 15) DISTRIBUSI JG DALAM SATU DEPARTEMEN/UNIT - bandingkan bobot antar unit
-- =============================================================================
SELECT u.nama AS unit, COUNT(j.id_jabatan) AS jumlah_jabatan, MIN(j.jg) AS jg_terendah, MAX(j.jg) AS jg_tertinggi
FROM grading.jabatan j
JOIN grading.unit_organisasi u ON u.id_unit = j.id_unit
WHERE j.jg IS NOT NULL
GROUP BY u.nama
ORDER BY jg_tertinggi DESC, jumlah_jabatan DESC;


-- =============================================================================
-- 16) BAGAN ORGANISASI LENGKAP (semua jabatan, terisi/kosong) - dari view
-- =============================================================================
SELECT nama_jabatan, nama_band, jg, nama_atasan, nama_unit, id_karyawan, nama_karyawan
FROM grading.vw_bagan_organisasi
ORDER BY id_band, jg DESC, nama_jabatan;
