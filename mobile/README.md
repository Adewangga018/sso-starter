# MyGCS Absensi (Flutter)

App absen mobile (Android & iOS) untuk MyGCS. Alasan utama app ini ada, bukan cukup
pakai web: browser (Geolocation API) tidak bisa mendeteksi *mock location* / fake-GPS
di Android, sementara native app bisa lewat flag `Position.isMocked` (geolocator).
Kalau `isMocked == true`, app menolak mengirim absen dan backend (`PersonalController.
PostAbsensi`) juga menolak ulang di sisi server bila flag itu somehow tetap terkirim
`true` - jadi pertahanan dobel (klien + server).

Login pakai SSO yang SAMA dengan web (OpenIddict OAuth2/OIDC + PKCE), lewat browser
sistem (Chrome Custom Tabs / SFSafariViewController) - bukan form username/password
terpisah. Backend-nya juga satu: proyek `../backend` (ASP.NET Core), tidak ada API
duplikat, cuma nambah satu client OIDC baru (`mygcs-mobile`, lihat
`backend/Data/OidcSeeder.cs`) dan satu flag baru di payload absensi (`isMockLocation`,
lihat `backend/Controllers/PersonalController.cs` & `Models/Dto/PersonalProfileDto.cs`).

## Struktur

```
lib/
  main.dart              # entry point + auth gate (login vs home)
  theme/app_theme.dart   # palet warna brand MyGCS (samakan dgn frontend/src/index.css)
  services/
    app_config.dart      # base URL API, issuer OIDC, client id, redirect URI, scope
    auth_service.dart     # login/refresh/logout SSO (flutter_appauth + secure storage)
    location_service.dart # ambil GPS + deteksi mock-location
    api_client.dart       # panggil REST API backend .NET (Bearer token)
  screens/
    login_screen.dart
    home_screen.dart
    absensi_screen.dart   # kamera + lokasi + submit absen
```

## Menjalankan untuk development

Backend (`cd ../backend && dotnet run`, default `http://localhost:5283`) DAN frontend
(`cd ../frontend && npm run dev`, default `http://localhost:5173`) harus **dua-duanya**
jalan - bukan cuma backend. Alasannya: backend meredirect login ke path `/login`
RELATIF terhadap origin yang memanggilnya, dan halaman `/login` itu sendiri adalah
route React (bagian dari SPA di frontend), bukan sesuatu yang di-serve backend. Di
web, ini otomatis benar karena browser selalu memanggil lewat proxy Vite (`5173`),
yang meneruskan `/connect`, `/api`, `/.well-known` ke backend TAPI menyajikan
`/login` dkk dari React SPA itu sendiri. Mobile app harus meniru pola yang sama -
arahkan ke port **frontend**, bukan backend langsung, walau app-nya sendiri tidak
memakai HTML/JS apa pun dari frontend (cuma numpang proxy-nya).

Override base URL & issuer lewat `--dart-define` saat run/build, supaya
`lib/services/app_config.dart` tidak perlu diubah manual tiap ganti environment:

```bash
# Emulator Android: 10.0.2.2 adalah alias localhost mesin host dari dalam emulator.
# PENTING: port 5173 (frontend/Vite), BUKAN 5283 (backend) - lihat penjelasan di atas.
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:5173/api \
  --dart-define=OIDC_ISSUER=http://10.0.2.2:5173

# HP fisik yang tersambung ke WiFi yang sama dengan mesin dev, ganti IP sesuai mesin:
flutter run \
  --dart-define=API_BASE_URL=http://192.168.x.x:5173/api \
  --dart-define=OIDC_ISSUER=http://192.168.x.x:5173
```

Tanpa `--dart-define`, app memakai default production
(`https://my.gcs-gresik.com/api`) - di production backend & frontend satu origin
(IIS), jadi masalah di atas tidak muncul sama sekali.

## Redirect URI OAuth (PENTING - tiga tempat ini harus selalu sinkron)

Skema custom `com.gcs.mygcsabsensi:/oauthredirect` (tanpa underscore - skema URI
tidak boleh mengandung underscore, beda dari `applicationId`/`namespace` Android yang
boleh) didaftarkan di:

1. `backend/appsettings.json` -> `Oidc:Mobile:RedirectUris`
2. `mobile/android/app/build.gradle.kts` -> `manifestPlaceholders["appAuthRedirectScheme"]`
3. `mobile/ios/Runner/Info.plist` -> `CFBundleURLTypes` / `CFBundleURLSchemes`
4. `mobile/lib/services/app_config.dart` -> `oidcRedirectUri`

Kalau salah satu diubah, tiga lainnya wajib ikut diubah - kalau tidak, login akan
gagal dengan error redirect_uri_mismatch dari backend.

## Build

```bash
flutter build apk --release      # Android
flutter build ipa --release      # iOS (perlu macOS + akun Apple Developer)
```

## Keterbatasan yang perlu diketahui

- Deteksi mock-location jauh lebih andal di **Android** (`Location.
  isFromMockProvider()` di level OS). Di **iOS**, Apple tidak menyediakan flag resmi
  setara, jadi `isMocked` di iOS pada praktiknya nyaris selalu `false` bahkan kalau
  dipalsukan - lihat komentar di `location_service.dart`. Proteksi utama fitur ini
  berlaku penuh di Android; di iOS statusnya "lebih baik dari web" (native, minimal
  cepat & tidak bisa dipalsukan lewat DevTools browser) tapi bukan jaminan mutlak.
- Foto absen WAJIB diambil lewat kamera in-app (`camera` package) - app ini sengaja
  tidak memakai `image_picker` mode galeri supaya tidak bisa unggah foto lama/hasil
  edit.
