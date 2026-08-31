-- Diagnostik: kenapa header Nugraha Iman Prakosa masih tampil "Pegawai Organik"
-- padahal sudah ditempatkan sebagai Direktur Keuangan di Struktur Organisasi.
-- Jalankan di db_mygcs. Ganti nilai @nama kalau perlu dicocokkan manual.

DECLARE @nama NVARCHAR(200) = N'%Iman Prakosa%';

-- 1) NIK yang dipakai LOGIN (token OpenIddict) - ini NIK yang dipakai header/PosisiResolver
--    untuk mencari jabatannya. Cek di MST_PEGAWAI (profil MyGCS).
SELECT ID_KARYAWAN, NAMA_LENGKAP, EMAIL
FROM dbo.MST_PEGAWAI
WHERE NAMA_LENGKAP LIKE @nama;

-- 2) NIK yang dipakai roster SDM aktif (sumber picker "Tempatkan Karyawan").
SELECT Nik, nama, data_aktif, jenis_pegawai
FROM dbo.PEGAWAI_SDM
WHERE nama LIKE @nama;

-- 3) Baris penempatan grading (ini yang menentukan jabatan tampil di header/MyTeam) -
--    cek apakah id_karyawan di sini SAMA PERSIS dengan ID_KARYAWAN di query (1).
SELECT p.id, p.id_karyawan, p.nama, p.status, j.nama_jabatan, b.nama AS band
FROM grading.penempatan p
JOIN grading.jabatan j ON j.id_jabatan = p.id_jabatan
JOIN grading.band b ON b.id_band = j.id_band
WHERE p.nama LIKE @nama
ORDER BY p.status DESC, p.tmt DESC;

-- Diagnosa:
--  - Kalau query (3) TIDAK mengembalikan baris berstatus 'Aktif' sama sekali -> dia belum
--    pernah benar-benar "Tempatkan Karyawan" (mungkin baru ditambahkan sebagai jabatan
--    kosong di bagan, belum diisi orangnya).
--  - Kalau ADA baris Aktif di (3), tapi id_karyawan-nya BEDA dari ID_KARYAWAN di (1) ->
--    dia ditempatkan pakai NIK/badge lama (mis. dari PEGAWAI_SDM yang masih punya baris
--    duplikat lama), sedangkan akun MyGCS login-nya pakai NIK yang lebih baru. Header
--    mencari berdasarkan NIK login (1), jadi tidak ketemu ke baris (3) -> fallback ke
--    jabatan legacy PEGAWAI_SDM, yang kalau kosong akhirnya tampil "Pegawai Organik".
--
-- Perbaikan (lewat UI, bukan lewat SQL manual - supaya riwayat/hirarki tetap konsisten):
--  Admin SDM > Struktur Organisasi > cari jabatan Direktur Keuangan > "Akhiri Penempatan"
--  baris yang salah (kalau ada) > "Tempatkan Karyawan" lagi, cari namanya dari kotak
--  pencarian, dan pastikan NIK yang muncul di hasil pencarian SAMA dengan ID_KARYAWAN
--  dari query (1) di atas.
