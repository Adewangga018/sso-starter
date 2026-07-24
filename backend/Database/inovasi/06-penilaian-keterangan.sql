/* ============================================================================
   inovasi - tambah kolom keterangan (panduan penilaian) ke penilaian_kriteria
   dan mengisinya (ringkasan JUKLAK Form Penilaian PT Petrokimia Gresik 2024).
   ----------------------------------------------------------------------------
   Keterangan = "apa yang dinilai" per kriteria, ditampilkan ke juri di form
   penilaian sebagai panduan. Idempoten: kolom & isi dicek/di-upsert.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF DB_NAME() <> 'db_mygcs'
BEGIN
    RAISERROR('BATAL: skrip ini harus dijalankan di database db_mygcs.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('inovasi.penilaian_kriteria', 'keterangan') IS NULL
BEGIN
    ALTER TABLE inovasi.penilaian_kriteria ADD keterangan NVARCHAR(MAX) NULL;
    PRINT 'Kolom keterangan ditambahkan.';
END
ELSE PRINT 'LEWATI: kolom keterangan sudah ada.';
GO

SELECT * INTO #kk FROM (
    SELECT * FROM (VALUES
    -- ===== GIO-SS =====
    ('GIO-SS',1,  N'Kelengkapan pendahuluan (profil perusahaan, struktur & profil gugus, radar chart kompetensi); jadwal aktifitas (Gantt) benar & lengkap dengan data pertemuan; latar belakang berdasar ketidaktercapaian KPI/keluhan pelanggan/isu/peluang (SWOT).'),
    ('GIO-SS',2,  N'Kejelasan ilustrasi masalah; validitas data checksheet (bila tidak bisa dipertanggungjawabkan, nilai maks 6); stratifikasi & diagram Pareto sesuai QC Tools; analisa dampak & harapan pihak terkait.'),
    ('GIO-SS',3,  N'Dasar penentuan target kuat; keselarasan target dengan harapan pihak terkait & tujuan perusahaan (visi/misi/KPI); kaidah SMART & aspek mutu terukur; pengesahan pihak berwenang.'),
    ('GIO-SS',4,  N'Kesesuaian ilustrasi dengan penyebab langsung dari tinjauan objek; ketepatan brainstorming menentukan faktor penyebab (4M+1E atau BOCAL); keterlibatan semua anggota gugus.'),
    ('GIO-SS',5,  N'Diagram sebab-akibat (Ishikawa/tree) sesuai kaidah QC Tools & PDCA; korelasi sebab-akibat logis; akibat merupakan masalah target dengan data terukur.'),
    ('GIO-SS',6,  N'Ketepatan analisa akar penyebab dominan (genba, data riil terukur); hubungan korelasi digambarkan scatter diagram (min 30 data, koef. korelasi >= 0,4); stratifikasi & Pareto sesuai kaidah.'),
    ('GIO-SS',7,  N'Kreatifitas & minimal 2 alternatif solusi; dasar pemilihan kuat (evaluasi teknis, analisis risiko, aspek mutu); solusi terbaik dari alternatif; mitigasi risiko tiap alternatif + PIC.'),
    ('GIO-SS',8,  N'Definisi 5W+2H sesuai PDCA; langkah How benar-benar pelaksanaan solusi terbaik; tanggal When sesuai jadwal DO (PIC 1 orang); S-Curve rencana benar; pengesahan pihak berwenang.'),
    ('GIO-SS',9,  N'Identifikasi kebutuhan sumber daya (kompetensi SDM, alat & material) secara detail dan relevan dengan rencana perbaikan serta profil anggota.'),
    ('GIO-SS',10, N'Pelaksanaan tiap tahapan sesuai rencana (5W+2H); dokumentasi/foto riil lengkap tiap aktivitas; tanggal sesuai; mencakup tindakan mitigasi risiko dari alternatif terpilih.'),
    ('GIO-SS',11, N'Pemantauan tiap capaian tahapan secara terukur; identifikasi kendala yang muncul; penyelesaian (mandiri/bantuan pihak lain) beserta hasilnya diuraikan lengkap.'),
    ('GIO-SS',12, N'Validasi terhadap objek sasaran (durasi proporsional, data parameter); tinjauan aspek mutu kualitatif & kuantitatif; S-Curve rencana vs realisasi (timeline & bobot) benar.'),
    ('GIO-SS',13, N'Perbandingan alur proses/cara kerja/desain sebelum & sesudah dengan ilustrasi visual; detail poin yang diperbaiki + bukti ketercapaian tiap solusi terpilih.'),
    ('GIO-SS',14, N'Perbandingan data tema masalah, target & akar penyebab (tabel stratifikasi + diagram QC Tools) sebelum-sesudah; periode data proporsional & valid; hasil mencapai/melebihi target.'),
    ('GIO-SS',15, N'Evaluasi aspek mutu kualitatif & kuantitatif (min 5 aspek: Q,C,D,S,H,E,M,P,R, dll); verifikasi keuangan value creation & penghematan dihitung benar + validasi pihak berkapabilitas.'),
    ('GIO-SS',16, N'Pemenuhan harapan pihak internal/eksternal (testimoni); identifikasi dampak negatif efektif & tindakan pencegahannya; dampak positif dimanfaatkan optimal & berkelanjutan.'),
    ('GIO-SS',17, N'Kelengkapan & ketepatan manfaat di skala Tim/Unit/Perusahaan/eksternal; peningkatan kompetensi tim; penghematan riil besar & potensi nilai jual; pencapaian KPI.'),
    ('GIO-SS',18, N'Kebaruan ide (aplikatif, bisa dipatenkan, daya saing skala perusahaan/nasional/internasional); inovasi riil & terpelihara; keunggulan (fitur, performa, daya tahan, nilai kompetitif) lengkap.'),
    ('GIO-SS',19, N'Standarisasi (input/proses/hasil) detail, benar, diterapkan & dipelihara, disahkan pihak berwenang; tema selanjutnya (khusus GIO) dijelaskan (identifikasi/stratifikasi/prioritas) + jadwal & pengesahan.'),
    ('GIO-SS',20, N'Sosialisasi ke pihak terkait dengan dokumentasi, lokasi, tanggal & peserta; pendaftaran/perolehan HAKI/PATEN dari DJKI dan dapat ditelusuri kebenarannya.'),
    ('GIO-SS',21, N'Pengembangan lewat presentasi internal & eksternal; benchmarking oleh pihak eksternal; replikasi internal/eksternal serta penjelasan potensi replikasi lanjutan.'),
    ('GIO-SS',22, N'Keberlangsungan inovasi dimonitor hingga kini (data kuantitatif); upaya penjaminan (action after innovation) + Instruksi Kerja; nilai tambah yang dihasilkan dijelaskan.'),
    ('GIO-SS',23, N'Kelengkapan & kesesuaian input risalah di website Sergio (di-approve atasan); ketepatan QC Tools, bahasa mudah, gambar/grafik menarik, daftar isi/definisi operasional & lampiran pendukung.'),
    ('GIO-SS',24, N'Kejelasan penyampaian materi; ketepatan diskusi & tanya jawab; manajemen waktu sesuai konvensi; keaktifan semua anggota; dilengkapi hiburan/peraga/maket/prototype.'),
    -- ===== 5R =====
    ('5R',1,  N'Kelengkapan pendahuluan (profil, struktur & profil gugus, radar chart); komitmen, keterlibatan & dukungan di seluruh area, ditandatangani semua anggota gugus 5R & pimpinan.'),
    ('5R',2,  N'Jadwal (Gantt) lengkap + jumlah pertemuan & kehadiran; tinjauan kondisi awal (denah/layout, alur kerja, foto 5R); checksheet valid; stratifikasi & Pareto sesuai PDCA; dampak & harapan pihak terkait.'),
    ('5R',3,  N'Sasaran terukur berdasar kuat & memenuhi/melebihi harapan pihak terkait; selaras visi/misi/nilai/KPI; kaidah SMART-C & aspek mutu kuantitatif; pengesahan pihak berwenang.'),
    ('5R',4,  N'Ilustrasi penyebab langsung jelas (foto lapangan); kesesuaian dengan faktor penyebab (4M+1E/BOCAL); keterlibatan semua anggota; diagram sebab-akibat sesuai kaidah PDCA.'),
    ('5R',5,  N'Data akar penyebab riil terukur; pengamatan lapangan (genba) teliti, logis & akurat; stratifikasi & Pareto sesuai PDCA; penentuan akar dominan dilakukan dengan benar.'),
    ('5R',6,  N'Proses existing & alternatif solusi rinci + PIC; minimal 2 alternatif; pemilihan berdasar evaluasi teknis, analisis risiko & aspek mutu; solusi terbaik + mitigasi risiko.'),
    ('5R',7,  N'Solusi terpilih efektif, aplikatif, inspiratif & kreatif, sehingga menghadirkan pembelajaran dan teknik baru dalam penerapan 5R.'),
    ('5R',8,  N'Rencana 5W+2H sesuai PDCA & kaidah 5R (R1 Ringkas/TPS, R2 Rapi/label/PIC, R3 Resik, R4 Rawat/Pokayoke, R5 Rajin/audit-reward-monitoring); tanggal When sesuai jadwal DO; PIC 1 orang.'),
    ('5R',9,  N'Kebutuhan sumber daya (kompetensi SDM, alat & material) teridentifikasi detail, tepat & relevan dengan rencana penerapan perbaikan.'),
    ('5R',10, N'Pelaksanaan 5W+2H lengkap (dokumentasi, evidence, grafik, ilustrasi) sesuai kaidah 5R R1-R5 (Ringkas s.d. Rajin); tanggal sesuai; R1-R5 berhasil menuntaskan masalah.'),
    ('5R',11, N'Monitoring seluruh parameter pendukung; validasi terhadap objek sasaran (durasi proporsional & relevan); hasil ditinjau aspek mutu kualitatif & kuantitatif dengan benar.'),
    ('5R',12, N'Perbandingan alur & kondisi sebelum-sesudah 5R (alur kerja, denah/layout, foto) terdokumentasi; masalah & akar penyebab (tabel/diagram sesuai kaidah); periode proporsional & data valid.'),
    ('5R',13, N'Sasaran utama improvement 5R digambarkan jelas & rinci; sasaran tercapai bahkan bisa melampaui target gugus atau target KPI.'),
    ('5R',14, N'Evaluasi aspek mutu kualitatif & kuantitatif (min 5 aspek); verifikasi keuangan (value creation & penghematan benar + validasi pihak berkapabilitas); ada nilai tambah dari improvement 5R.'),
    ('5R',15, N'Analisis manfaat & pengaruh ke pihak internal/eksternal (harapan terpenuhi); dampak negatif diidentifikasi efektif; dampak positif dimanfaatkan optimal & berkelanjutan.'),
    ('5R',16, N'Manfaat berdampak besar bagi perusahaan & pihak eksternal (testimoni); meningkatkan kompetensi seluruh tim (dibuktikan radar chart sebelum-sesudah + evidence pengembangan).'),
    ('5R',17, N'Hasil 5R terjaga & signifikan (sustainability + jaminan mutu); ide benar-benar baru (bisa dipatenkan, daya saing nasional/internasional); merupakan karya sendiri tanpa vendor.'),
    ('5R',18, N'Standarisasi R1-R5 (Ringkas s.d. Rajin) lengkap, detail, benar, diterapkan & dipelihara; dituangkan ke Instruksi Kerja (IK); menjamin masalah tidak terulang.'),
    ('5R',19, N'Pengesahan standar 5R oleh pihak berwenang, tepat & sesuai kaidah, dilengkapi arahan/komentar sesuai tanggal & masalahnya.'),
    ('5R',20, N'Sosialisasi standar ke semua pihak internal & eksternal (tanggal, lokasi & dokumentasi); Kaizen didaftarkan HAKI/PATEN ke DJKI untuk perlindungan hukum.'),
    ('5R',21, N'Risalah 5R di Sergio (approve atasan) disusun runtut sesuai PDCA & 5R, lengkap, benar, sistematik; bahasa mudah, gambar/alur/skematik menarik; definisi operasional & lampiran pendukung.'),
    ('5R',22, N'Presentasi jelas & terstruktur (tanpa lihat layar); diskusi/tanya jawab tepat + peraga; manajemen waktu sesuai konvensi; semua anggota aktif; dikemas hiburan + peraga/maket/prototype.')
    ) AS v(jenis_form, no, ket)
) AS x;

UPDATE k SET k.keterangan = s.ket
FROM inovasi.penilaian_kriteria k
JOIN #kk s ON s.jenis_form = k.jenis_form AND s.no = k.no;

DECLARE @n INT = @@ROWCOUNT;
DROP TABLE #kk;
PRINT 'Keterangan kriteria di-update: ' + CAST(@n AS VARCHAR(10)) + ' baris.';
GO

SET NOEXEC OFF;
GO
