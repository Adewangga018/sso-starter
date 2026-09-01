import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'app_config.dart';

/// Login SSO ke MyGCS lewat browser sistem (Chrome Custom Tabs / SFSafariViewController),
/// memakai flow OAuth2 Authorization Code + PKCE yang SAMA dengan yang dipakai SPA web
/// (backend OpenIddict-nya satu, cuma client_id & redirect URI-nya beda - lihat OidcSeeder.cs).
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  final FlutterAppAuth _appAuth = const FlutterAppAuth();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const _kAccessToken = 'access_token';
  static const _kRefreshToken = 'refresh_token';
  static const _kIdToken = 'id_token';
  static const _kAccessTokenExpiry = 'access_token_expiry';

  // Kegagalan baca/dekripsi Keystore (mis. "BadPaddingException" - kunci Keystore tidak
  // lagi cocok dgn data terenkripsi lama, umum terjadi setelah restore data/clone HP) tidak
  // boleh membuat app macet selamanya di layar loading (lihat main.dart, _AuthGate) - kalau
  // itu terjadi, anggap saja belum login & bersihkan sisa data yang sudah tidak terbaca,
  // supaya percobaan berikutnya bersih (ditemukan 2026-09-01, kasus nyata di device Xiaomi).
  Future<String?> get accessToken async {
    try {
      return await _storage.read(key: _kAccessToken);
    } catch (_) {
      await _storage.deleteAll().catchError((_) {});
      return null;
    }
  }

  Future<bool> get isLoggedIn async => (await accessToken) != null;

  /// Buka layar login SSO. Return true kalau berhasil login & token tersimpan.
  Future<bool> login() async {
    final result = await _appAuth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(
        AppConfig.oidcClientId,
        AppConfig.oidcRedirectUri,
        issuer: AppConfig.oidcIssuer,
        scopes: AppConfig.oidcScopes,
        preferEphemeralSession: false,
        allowInsecureConnections: AppConfig.allowInsecureConnections,
      ),
    );

    if (result.accessToken == null) return false;
    await _persist(result.accessToken, result.refreshToken, result.idToken, result.accessTokenExpirationDateTime);
    return true;
  }

  /// Ambil access token yang valid, refresh dulu kalau sudah/hampir kedaluwarsa.
  /// Dipakai ApiClient sebelum tiap panggilan API.
  Future<String?> validAccessToken() async {
    // Sama spt accessToken getter - kegagalan baca Keystore dianggap belum login,
    // bukan macet/lempar exception ke pemanggil (ApiClient).
    String? expiry, token;
    try {
      expiry = await _storage.read(key: _kAccessTokenExpiry);
      token = await _storage.read(key: _kAccessToken);
    } catch (_) {
      await _storage.deleteAll().catchError((_) {});
      return null;
    }
    if (token == null) return null;

    final expiryDate = expiry != null ? DateTime.tryParse(expiry) : null;
    final expiringSoon = expiryDate == null || expiryDate.isBefore(DateTime.now().add(const Duration(seconds: 30)));
    if (!expiringSoon) return token;

    final refreshToken = await _storage.read(key: _kRefreshToken);
    if (refreshToken == null) return token; // tidak ada refresh token, pakai apa adanya (biar 401 & minta login ulang)

    try {
      final result = await _appAuth.token(
        TokenRequest(
          AppConfig.oidcClientId,
          AppConfig.oidcRedirectUri,
          issuer: AppConfig.oidcIssuer,
          refreshToken: refreshToken,
          scopes: AppConfig.oidcScopes,
          allowInsecureConnections: AppConfig.allowInsecureConnections,
        ),
      );
      await _persist(result.accessToken, result.refreshToken ?? refreshToken, result.idToken, result.accessTokenExpirationDateTime);
      return result.accessToken ?? token;
    } catch (_) {
      // Refresh gagal (mis. token dicabut) - biarkan caller dapat 401 lalu minta login ulang.
      return token;
    }
  }

  Future<void> logout() async {
    final idToken = await _storage.read(key: _kIdToken);
    await _storage.deleteAll();
    if (idToken == null) return;
    try {
      await _appAuth.endSession(
        EndSessionRequest(
          idTokenHint: idToken,
          issuer: AppConfig.oidcIssuer,
          postLogoutRedirectUrl: AppConfig.oidcRedirectUri,
          allowInsecureConnections: AppConfig.allowInsecureConnections,
        ),
      );
    } catch (_) {
      // Sesi lokal sudah dihapus; kegagalan endsession di server tidak menghalangi logout lokal.
    }
  }

  Future<void> _persist(String? access, String? refresh, String? idToken, DateTime? expiry) async {
    if (access != null) await _storage.write(key: _kAccessToken, value: access);
    if (refresh != null) await _storage.write(key: _kRefreshToken, value: refresh);
    if (idToken != null) await _storage.write(key: _kIdToken, value: idToken);
    if (expiry != null) await _storage.write(key: _kAccessTokenExpiry, value: expiry.toIso8601String());
  }
}
