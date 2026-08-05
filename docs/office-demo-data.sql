/* ============================================================================
   My Office — data contoh/demo untuk menu Inbox, Inbox CC Otomatis, dan
   Notifikasi (isi office.surat, office.surat_distribusi, office.surat_pj,
   office.surat_dibaca, office.notifikasi kosong/sangat sedikit setelah deploy,
   sehingga ketiga menu itu tampak kosong).

   Penerima utama demo: NIK T.211273 (ARI KUNCORO) — supaya begitu akun itu
   login, Inbox / Inbox CC Otomatis / Notifikasi langsung terisi contoh di
   semua tab (Belum Dibaca, Dibaca, Dalam Proses, Dibatalkan). Pengirim &
   penanggung jawab lain memakai NIK pegawai sungguhan (dbo.PEGAWAI_SDM di GCS)
   supaya nama yang tampil masuk akal, tapi suratnya sendiri murni contoh.

   IDEMPOTEN: seluruh baris ditandai lewat prefix judul 'DEMO - '. Menjalankan
   ulang skrip ini menghapus dulu baris contoh lama (cascade ke distribusi/pj/
   dibaca lewat FK) baru menyisipkan lagi, jadi aman dijalankan berkali-kali
   dan tidak menumpuk duplikat. TIDAK menyentuh surat sungguhan (yang judulnya
   tidak diawali 'DEMO - ').

   Kompatibel SQL Server 2014. Jalankan pada db_mygcs SETELAH docs/office-schema.sql,
   docs/office-kode-surat.sql, docs/office-notifikasi.sql, dan
   docs/office-jenis-surat-lokal.sql.

   CARA PAKAI
     sqlcmd -S <server> -U sa -P <password> -d db_mygcs -C ^
            -i docs\office-demo-data.sql
   CARA HAPUS (tanpa mengganti dengan data baru): jalankan hanya blok
   "bersihkan data demo lama" di bawah, lalu GO, lalu keluar.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---- bersihkan data demo lama (idempoten) ------------------------------- */
DELETE FROM office.notifikasi WHERE judul LIKE N'DEMO - %' OR id_surat IN (SELECT id FROM office.surat WHERE judul LIKE N'DEMO - %');
DELETE FROM office.surat WHERE judul LIKE N'DEMO - %';  -- cascade: surat_pj, surat_distribusi, surat_lampiran, surat_riwayat, surat_dibaca
GO

DECLARE @now DATETIME2 = SYSUTCDATETIME();
DECLARE @id BIGINT;

/* ---------------------------------------------------------------------------
   1) Disetujui, Tujuan langsung ke T.211273, BELUM dibaca -> tab "Belum Dibaca".
   --------------------------------------------------------------------------- */
INSERT INTO office.surat (jenis, kode_bagian, kode_klasifikasi, klasifikasi, sifat, kecepatan,
    judul, keterangan, isi, status, pembuat_nik, pembuat_nama, tanggal_surat, dibuat_pada, diperbarui_pada)
VALUES (N'DR', N'GCS.06', N'TU.05.02', N'Penyusunan dan pembakuan sistem dan prosedur kerja', N'Biasa', N'Segera',
    N'DEMO - Edaran Jadwal Pemeliharaan Sistem TI', N'Contoh surat masuk untuk demo menu Inbox.',
    N'<p>Dengan hormat,</p><p>Sehubungan dengan rencana pemeliharaan berkala sistem Teknologi Informasi, bersama ini kami sampaikan bahwa akan dilaksanakan pemeliharaan pada:</p><ul><li>Hari/Tanggal: Sabtu, 8 Agustus 2026</li><li>Pukul: 22.00 WIB s.d. selesai</li><li>Sistem terdampak: My GCS, Email Korporat, dan Aplikasi Absensi</li></ul><p>Selama masa pemeliharaan, seluruh layanan tersebut <b>tidak dapat diakses sementara</b>. Kami mohon maaf atas ketidaknyamanan yang ditimbulkan.</p><p>Demikian pemberitahuan ini kami sampaikan untuk menjadi perhatian.</p>',
    N'Disetujui', N'T.221310', N'JAFRINDA REZA ELTRICO', DATEADD(DAY, -14, CAST(@now AS DATE)), DATEADD(DAY, -14, @now), DATEADD(DAY, -14, @now));
SET @id = SCOPE_IDENTITY();
INSERT INTO office.surat_distribusi (id_surat, tipe, nik, nama, jabatan)
VALUES (@id, N'Tujuan', N'T.211273', N'ARI KUNCORO', N'Pjs Manager');
INSERT INTO office.surat_riwayat (id_surat, aksi, oleh_nik, oleh_nama, tgl)
VALUES (@id, N'Disetujui', N'T.221310', N'JAFRINDA REZA ELTRICO', DATEADD(DAY, -14, @now));
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibuat_pada)
VALUES (N'T.211273', N'DEMO - Ada surat baru untuk anda', @id, N'T.221310', N'JAFRINDA REZA ELTRICO', N'Staf Pemula', DATEADD(DAY, -14, @now));

/* ---------------------------------------------------------------------------
   2) Disetujui, Tujuan langsung ke T.211273, SUDAH dibaca -> tab "Dibaca".
   --------------------------------------------------------------------------- */
INSERT INTO office.surat (jenis, kode_bagian, kode_klasifikasi, klasifikasi, sifat, kecepatan,
    judul, keterangan, isi, status, pembuat_nik, pembuat_nama, tanggal_surat, dibuat_pada, diperbarui_pada)
VALUES (N'MI', N'GCS.06', N'NK.02.01', N'Pelatihan SDM : diklat jenjang jabatan, diklat penunjang', N'Biasa', N'Biasa',
    N'DEMO - Memo Persiapan Rapat Koordinasi Bulanan', N'Contoh surat masuk yang sudah dibaca untuk demo menu Inbox.',
    N'<p>Mengingatkan kembali kepada seluruh Kepala Bagian dan Asisten Manager di lingkungan Departemen Pengembangan bahwa rapat koordinasi bulanan akan diselenggarakan sesuai jadwal berikut:</p><ul><li>Hari/Tanggal: Senin, 3 Agustus 2026</li><li>Pukul: 09.00 WIB s.d. selesai</li><li>Tempat: Ruang Rapat Departemen Pengembangan</li></ul><p>Agenda utama meliputi evaluasi capaian kerja bulan berjalan dan penyusunan rencana kerja bulan berikutnya. Mohon kehadiran tepat waktu.</p><p>Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>',
    N'Disetujui', N'T.210269', N'ARI RAHAYU', DATEADD(DAY, -9, CAST(@now AS DATE)), DATEADD(DAY, -9, @now), DATEADD(DAY, -9, @now));
SET @id = SCOPE_IDENTITY();
INSERT INTO office.surat_distribusi (id_surat, tipe, nik, nama, jabatan)
VALUES (@id, N'Tujuan', N'T.211273', N'ARI KUNCORO', N'Pjs Manager');
INSERT INTO office.surat_dibaca (id_surat, nik, dibaca_pada)
VALUES (@id, N'T.211273', DATEADD(DAY, -8, @now));
INSERT INTO office.surat_riwayat (id_surat, aksi, oleh_nik, oleh_nama, tgl)
VALUES (@id, N'Disetujui', N'T.210269', N'ARI RAHAYU', DATEADD(DAY, -9, @now));
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibaca_pada, dibuat_pada)
VALUES (N'T.211273', N'DEMO - Ada surat baru untuk anda', @id, N'T.210269', N'ARI RAHAYU', N'Pjs Kepala Bagian', DATEADD(DAY, -8, @now), DATEADD(DAY, -9, @now));

/* ---------------------------------------------------------------------------
   3) Disetujui, TEMBUSAN (CC) ke T.211273, BELUM dibaca -> Inbox CC Otomatis
      tab "Belum Dibaca".
   --------------------------------------------------------------------------- */
INSERT INTO office.surat (jenis, kode_bagian, kode_klasifikasi, klasifikasi, sifat, kecepatan,
    judul, keterangan, status, pembuat_nik, pembuat_nama, tanggal_surat, dibuat_pada, diperbarui_pada)
VALUES (N'SP', N'GCS.06', N'TU.04.06', N'Perjanjian kerja sama dan kontrak dengan pihak eksternal', N'Terbatas', N'Biasa',
    N'DEMO - Perjanjian Kerja Sama Vendor Logistik', N'Contoh tembusan (CC) untuk demo menu Inbox CC Otomatis.',
    N'Disetujui', N'2115251', N'MOH. FAISAL ALFAROKHI', DATEADD(DAY, -6, CAST(@now AS DATE)), DATEADD(DAY, -6, @now), DATEADD(DAY, -6, @now));
SET @id = SCOPE_IDENTITY();
INSERT INTO office.surat_distribusi (id_surat, tipe, nik, nama, jabatan) VALUES
    (@id, N'Tujuan', N'T.223313', N'DICKY SUSANTHO', N'Lakda'),
    (@id, N'CC',     N'T.211273', N'ARI KUNCORO',    N'Pjs Manager');
INSERT INTO office.surat_riwayat (id_surat, aksi, oleh_nik, oleh_nama, tgl)
VALUES (@id, N'Disetujui', N'2115251', N'MOH. FAISAL ALFAROKHI', DATEADD(DAY, -6, @now));
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibuat_pada)
VALUES (N'T.211273', N'DEMO - Anda menerima tembusan surat', @id, N'2115251', N'MOH. FAISAL ALFAROKHI', N'General Manager', DATEADD(DAY, -6, @now));

/* ---------------------------------------------------------------------------
   4) Disetujui, TEMBUSAN (CC) ke T.211273, SUDAH dibaca -> Inbox CC Otomatis
      tab "Dibaca".
   --------------------------------------------------------------------------- */
INSERT INTO office.surat (jenis, kode_bagian, kode_klasifikasi, klasifikasi, sifat, kecepatan,
    judul, keterangan, status, pembuat_nik, pembuat_nama, tanggal_surat, dibuat_pada, diperbarui_pada)
VALUES (N'AD', N'GCS.06', N'TU.04.06', N'Perjanjian kerja sama dan kontrak dengan pihak eksternal', N'Biasa', N'Biasa',
    N'DEMO - Addendum Kontrak Sewa Kendaraan Operasional', N'Contoh tembusan (CC) yang sudah dibaca untuk demo menu Inbox CC Otomatis.',
    N'Disetujui', N'T.223313', N'DICKY SUSANTHO', DATEADD(DAY, -3, CAST(@now AS DATE)), DATEADD(DAY, -3, @now), DATEADD(DAY, -3, @now));
SET @id = SCOPE_IDENTITY();
INSERT INTO office.surat_distribusi (id_surat, tipe, nik, nama, jabatan) VALUES
    (@id, N'Tujuan', N'T.210269', N'ARI RAHAYU',   N'Pjs Kepala Bagian'),
    (@id, N'CC',     N'T.211273', N'ARI KUNCORO',  N'Pjs Manager');
INSERT INTO office.surat_dibaca (id_surat, nik, dibaca_pada)
VALUES (@id, N'T.211273', DATEADD(DAY, -2, @now));
INSERT INTO office.surat_riwayat (id_surat, aksi, oleh_nik, oleh_nama, tgl)
VALUES (@id, N'Disetujui', N'T.223313', N'DICKY SUSANTHO', DATEADD(DAY, -3, @now));
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibaca_pada, dibuat_pada)
VALUES (N'T.211273', N'DEMO - Anda menerima tembusan surat', @id, N'T.223313', N'DICKY SUSANTHO', N'Lakda', DATEADD(DAY, -2, @now), DATEADD(DAY, -3, @now));

/* ---------------------------------------------------------------------------
   5) Menunggu Approval, T.211273 sebagai Approver -> Inbox tab "Dalam Proses"
      ("Menunggu approval Anda") + menu Menunggu Persetujuan.
   --------------------------------------------------------------------------- */
INSERT INTO office.surat (jenis, kode_bagian, kode_klasifikasi, klasifikasi, sifat, kecepatan,
    judul, keterangan, status, pembuat_nik, pembuat_nama, tanggal_surat, dibuat_pada, diperbarui_pada)
VALUES (N'MI', N'GCS.06', N'NK.02.01', N'Pelatihan SDM : diklat jenjang jabatan, diklat penunjang', N'Biasa', N'Segera',
    N'DEMO - Permohonan Anggaran Pelatihan SDM', N'Contoh surat yang sedang menunggu approval untuk demo tab Dalam Proses.',
    N'Menunggu Approval', N'T.221310', N'JAFRINDA REZA ELTRICO', DATEADD(DAY, -2, CAST(@now AS DATE)), DATEADD(DAY, -2, @now), DATEADD(DAY, -1, @now));
SET @id = SCOPE_IDENTITY();
INSERT INTO office.surat_pj (id_surat, peran, urutan, nik, nama, jabatan, status, tgl) VALUES
    (@id, N'Reviewer', 1, N'T.210269', N'ARI RAHAYU',  N'Pjs Kepala Bagian', N'Disetujui', DATEADD(DAY, -1, @now)),
    (@id, N'Approver', 1, N'T.211273', N'ARI KUNCORO', N'Pjs Manager',       N'Menunggu', NULL);
INSERT INTO office.surat_riwayat (id_surat, aksi, oleh_nik, oleh_nama, tgl) VALUES
    (@id, N'Dikirim ke Review', N'T.221310', N'JAFRINDA REZA ELTRICO', DATEADD(DAY, -2, @now)),
    (@id, N'Direview', N'T.210269', N'ARI RAHAYU', DATEADD(DAY, -1, @now));
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibuat_pada)
VALUES (N'T.211273', N'DEMO - Surat menunggu approval Anda', @id, N'T.210269', N'ARI RAHAYU', N'Pjs Kepala Bagian', DATEADD(DAY, -1, @now));

/* ---------------------------------------------------------------------------
   6) Ditolak, Tujuan ke T.211273 -> Inbox tab "Dibatalkan".
   --------------------------------------------------------------------------- */
INSERT INTO office.surat (jenis, kode_bagian, kode_klasifikasi, klasifikasi, sifat, kecepatan,
    judul, keterangan, status, pembuat_nik, pembuat_nama, tanggal_surat, dibuat_pada, diperbarui_pada)
VALUES (N'DR', N'GCS.06', N'LG.00.01', N'Perencanaan dan evaluasi kebutuhan barang/jasa', N'Biasa', N'Biasa',
    N'DEMO - Usulan Perubahan SOP Pengadaan Barang', N'Contoh surat ditolak untuk demo tab Dibatalkan.',
    N'Ditolak', N'T.211272', N'IWAN RANGGA KUSUMA', DATEADD(DAY, -20, CAST(@now AS DATE)), DATEADD(DAY, -20, @now), DATEADD(DAY, -18, @now));
SET @id = SCOPE_IDENTITY();
INSERT INTO office.surat_distribusi (id_surat, tipe, nik, nama, jabatan)
VALUES (@id, N'Tujuan', N'T.211273', N'ARI KUNCORO', N'Pjs Manager');
INSERT INTO office.surat_pj (id_surat, peran, urutan, nik, nama, jabatan, status, komentar, tgl)
VALUES (@id, N'Approver', 1, N'T.211273', N'ARI KUNCORO', N'Pjs Manager', N'Ditolak', N'Perlu kajian ulang anggaran sebelum diajukan kembali.', DATEADD(DAY, -18, @now));
INSERT INTO office.surat_riwayat (id_surat, aksi, oleh_nik, oleh_nama, catatan, tgl) VALUES
    (@id, N'Dikirim ke Review', N'T.211272', N'IWAN RANGGA KUSUMA', NULL, DATEADD(DAY, -20, @now)),
    (@id, N'Ditolak', N'T.211273', N'ARI KUNCORO', N'Perlu kajian ulang anggaran sebelum diajukan kembali.', DATEADD(DAY, -18, @now));
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibaca_pada, dibuat_pada)
VALUES (N'T.211272', N'DEMO - Surat Anda ditolak', @id, N'T.211273', N'ARI KUNCORO', N'Pjs Manager', NULL, DATEADD(DAY, -18, @now));

/* ---------------------------------------------------------------------------
   7) Menunggu Approval, alur berjenjang lengkap (2 Reviewer -> Approver ->
      Signer) + distribusi ke banyak bagian, -> demo tab "Hirarki" supaya
      terlihat seperti diagram alur DOF (rantai jenjang + baris Tujuan
      yang panjang).
   --------------------------------------------------------------------------- */
INSERT INTO office.surat (jenis, kode_bagian, kode_klasifikasi, klasifikasi, sifat, kecepatan,
    judul, keterangan, status, pembuat_nik, pembuat_nama, tanggal_surat, dibuat_pada, diperbarui_pada)
VALUES (N'SP', N'GCS.06', N'TU.05.02', N'Penyusunan dan pembakuan sistem dan prosedur kerja', N'Biasa', N'Segera',
    N'DEMO - Surat Edaran Kebijakan K3LH ke Seluruh Bagian', N'Contoh surat dengan alur persetujuan berjenjang dan distribusi luas untuk demo tab Hirarki.',
    N'Menunggu Approval', N'T.221310', N'JAFRINDA REZA ELTRICO', DATEADD(DAY, -5, CAST(@now AS DATE)), DATEADD(DAY, -5, @now), DATEADD(DAY, -1, @now));
SET @id = SCOPE_IDENTITY();
INSERT INTO office.surat_pj (id_surat, peran, urutan, nik, nama, jabatan, status, tgl) VALUES
    (@id, N'Reviewer', 1, N'T.210269', N'ARI RAHAYU',            N'Pjs Kepala Bagian', N'Disetujui', DATEADD(DAY, -4, @now)),
    (@id, N'Reviewer', 2, N'T.211272', N'IWAN RANGGA KUSUMA',    N'Kepala Bagian',     N'Disetujui', DATEADD(DAY, -3, @now)),
    (@id, N'Approver', 1, N'T.211273', N'ARI KUNCORO',           N'Pjs Manager',       N'Menunggu',  NULL),
    (@id, N'Signer',   1, N'T.223313', N'DICKY SUSANTHO',        N'Lakda',             N'Menunggu',  NULL);
INSERT INTO office.surat_distribusi (id_surat, tipe, nik, nama, jabatan) VALUES
    (@id, N'Tujuan', N'DEMO001', N'Bagian Produksi I',        N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO002', N'Bagian Produksi II',       N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO003', N'Bagian Pemeliharaan',      N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO004', N'Bagian K3LH',              N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO005', N'Bagian SDM',               N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO006', N'Bagian Keuangan',          N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO007', N'Bagian Umum',              N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO008', N'Bagian Logistik',          N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO009', N'Bagian Teknologi Informasi', N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO010', N'Bagian Hukum',             N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO011', N'Bagian Humas',             N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO012', N'Bagian Pengadaan',         N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO013', N'Bagian QA/QC',             N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO014', N'Bagian Teknik',            N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO015', N'Bagian Utilitas',          N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO016', N'Bagian Gudang',            N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO017', N'Bagian Transportasi',      N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO018', N'Bagian Keamanan',          N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO019', N'Bagian Kesehatan Kerja',   N'Kepala Bagian'),
    (@id, N'Tujuan', N'DEMO020', N'Bagian Diklat',            N'Kepala Bagian'),
    (@id, N'CC',     N'DEMO021', N'Sekretariat Perusahaan',   N'Staf'),
    (@id, N'CC',     N'DEMO022', N'Arsip Pusat',              N'Staf');
INSERT INTO office.surat_riwayat (id_surat, aksi, oleh_nik, oleh_nama, tgl) VALUES
    (@id, N'Dikirim ke Review', N'T.221310', N'JAFRINDA REZA ELTRICO', DATEADD(DAY, -5, @now)),
    (@id, N'Direview', N'T.210269', N'ARI RAHAYU', DATEADD(DAY, -4, @now)),
    (@id, N'Direview', N'T.211272', N'IWAN RANGGA KUSUMA', DATEADD(DAY, -3, @now));
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibuat_pada)
VALUES (N'T.211273', N'DEMO - Surat menunggu approval Anda', @id, N'T.211272', N'IWAN RANGGA KUSUMA', N'Kepala Bagian', DATEADD(DAY, -3, @now));

/* ---------------------------------------------------------------------------
   8) Notifikasi tambahan (tanpa mempengaruhi Inbox) supaya tab Notifikasi
      punya campuran terbaca/belum terbaca yang wajar.
   --------------------------------------------------------------------------- */
INSERT INTO office.notifikasi (nik, judul, id_surat, oleh_nik, oleh_nama, oleh_jabatan, dibaca_pada, dibuat_pada)
VALUES (N'T.211273', N'DEMO - Selamat datang di My Office', NULL, NULL, NULL, NULL, DATEADD(DAY, -25, @now), DATEADD(DAY, -25, @now));
GO

DECLARE @surat INT = (SELECT COUNT(*) FROM office.surat WHERE judul LIKE N'DEMO - %');
DECLARE @notif INT = (SELECT COUNT(*) FROM office.notifikasi WHERE judul LIKE N'DEMO - %');
PRINT CONCAT('Data demo: ', @surat, ' surat, ', @notif, ' notifikasi.');
GO
