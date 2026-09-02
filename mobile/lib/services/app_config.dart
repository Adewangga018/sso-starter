/// Konfigurasi lingkungan (dev/prod). Untuk sekarang di-hardcode lewat --dart-define
/// (lihat README) - belum perlu flavor terpisah selama tim masih kecil.
class AppConfig {
  AppConfig._();

  /// URL dasar backend .NET (SSO Hub / API) - sama persis dengan yang dipakai web.
  /// Dev: jalankan `dotnet run` di backend/, lalu jalankan app dari emulator Android
  /// (10.0.2.2 = alias localhost mesin host dari dalam emulator).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://my.gcs-gresik.com/api',
  );

  /// Issuer OIDC (OpenIddict) - HARUS sama dengan Oidc__Issuer backend.
  static const String oidcIssuer = String.fromEnvironment(
    'OIDC_ISSUER',
    defaultValue: 'https://my.gcs-gresik.com/api',
  );

  static const String oidcClientId = 'mygcs-mobile';

  /// Skema custom - HARUS sama dengan appAuthRedirectScheme (Android) &
  /// CFBundleURLSchemes (iOS), dan terdaftar di backend Oidc:Mobile:RedirectUris.
  /// Nama paket com.gresik.gcs.myabsensi diminta manajemen 2026-09-02.
  static const String oidcRedirectUri = 'com.gresik.gcs.myabsensi:/oauthredirect';

  static const List<String> oidcScopes = [
    'openid',
    'profile',
    'email',
    'roles',
    'offline_access',
    'mygcs.api',
  ];

  /// AppAuth-Android menolak koneksi non-HTTPS secara default (benar utk production).
  /// Otomatis diizinkan HANYA kalau issuer bukan https:// - dev lokal biasa jalan di
  /// http://10.0.2.2:5283 tanpa TLS. Tidak mungkin ter-aktif tanpa sengaja di
  /// production karena oidcIssuer production selalu https://.
  static bool get allowInsecureConnections => !oidcIssuer.startsWith('https://');
}
