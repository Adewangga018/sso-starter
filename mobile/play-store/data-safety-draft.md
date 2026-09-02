# Draft Jawaban "Data Safety" — Google Play Console

Isi ini untuk diisikan manual ke formulir Data Safety di Play Console
(App content > Data safety). Disusun sesuai yang aplikasi **benar-benar** lakukan
(lihat `mobile/lib/services/location_service.dart`, `absensi_screen.dart`,
`backend/Controllers/PersonalController.cs`) — jangan diubah tanpa mengecek kodenya juga,
Google bisa menolak/mencabut app kalau jawaban tidak sesuai perilaku nyata.

## Apakah aplikasi mengumpulkan atau membagikan data pengguna?
**Ya.**

## Apakah data dikirim terenkripsi saat transit?
**Ya** (HTTPS ke backend perusahaan).

## Bisakah pengguna minta data dihapus?
**Ya** — jelaskan lewat kontak SDM/IT (tercantum di Kebijakan Privasi).

## Jenis data yang dikumpulkan

| Kategori | Jenis | Dikumpulkan? | Dibagikan ke pihak lain? | Wajib/Opsional | Tujuan |
|---|---|---|---|---|---|
| Lokasi | Lokasi presisi | Ya | Tidak | Wajib | Fungsi aplikasi (verifikasi radius absen), Pencegahan penipuan/keamanan |
| Foto & video | Foto | Ya | Tidak | Wajib | Fungsi aplikasi (bukti kehadiran) |
| Info pribadi | Nama | Ya | Tidak | Wajib | Fungsi aplikasi (identitas presensi) |
| Info pribadi | ID pengguna lain (NIK) | Ya | Tidak | Wajib | Fungsi aplikasi |
| Info perangkat | Identifier lain | Ya (indikator root/mock-location) | Tidak | Wajib | Pencegahan penipuan, keamanan, & kepatuhan |

Semua kategori lain (Info finansial, Pesan, Kontak, Riwayat penelusuran web, Aktivitas app,
dll.) — **Tidak dikumpulkan**.

## Poin penting saat mengisi form Play Console

1. **"Data shared with third parties" = Tidak** untuk semua jenis data — data hanya ke server
   milik Perusahaan sendiri, bukan pihak ketiga.
2. Untuk **Lokasi presisi**: pilih tujuan **"App functionality"** dan **"Fraud prevention,
   security, and compliance"** — JANGAN centang "Advertising or marketing" (tidak dipakai
   untuk itu).
3. **"Is this data processed ephemerally?"** → Tidak (disimpan permanen di database untuk
   riwayat absensi).
4. **"Is data collection optional?"** → Tidak, wajib untuk memakai fitur absen (jelaskan di
   kolom App functionality).
5. Bagian **"Security practices"**: centang "Data is encrypted in transit", dan "You provide
   a way for users to request that their data is deleted" (jelaskan prosesnya lewat SDM/IT).

## URL Kebijakan Privasi untuk formulir ini
`https://my.gcs-gresik.com/privacy`
