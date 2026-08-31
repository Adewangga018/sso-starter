import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../models/absensi_entry.dart';
import '../models/lokasi_saya.dart';
import '../models/office_location.dart';
import '../models/personal_profile.dart';
import 'app_config.dart';
import 'auth_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, [this.statusCode]);
  @override
  String toString() => message;
}

/// Panggil REST API backend .NET yang sama dengan web (mygcs-backend) - endpoint,
/// validasi, dan aturan bisnisnya satu sumber kebenaran di backend/Controllers.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  Future<PersonalProfile> getProfile() async {
    final res = await _get('/personal/profile');
    return PersonalProfile.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  /// Status absen HARI INI dari absensi.log (app mobile) - TERPISAH dari Log Absensi web
  /// (yang sengaja cuma menampilkan data SDM lama). null = belum absen sama sekali hari ini.
  Future<AbsensiEntry?> getAbsensiHariIni() async {
    final res = await _get('/personal/absensi/hari-ini');
    if (res.body == 'null' || res.body.isEmpty) return null;
    return AbsensiEntry.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<LokasiSaya> getLokasiSaya() async {
    final res = await _get('/personal/absensi/lokasi');
    return LokasiSaya.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  /// Mengajukan/mengajukan-ulang titik absen pribadi - status jadi Menunggu sampai
  /// disetujui/ditolak Admin SDM (menu "Kelola Lokasi Absensi").
  Future<void> ajukanLokasi({required double lat, required double lng, String? keterangan}) async {
    await _post('/personal/absensi/lokasi', jsonEncode({'lat': lat, 'lng': lng, 'keterangan': keterangan}));
  }

  Future<List<OfficeLocation>> getLocations() async {
    final res = await _get('/personal/locations');
    final list = jsonDecode(res.body) as List<dynamic>;
    return list.map((e) => OfficeLocation.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Foto profil (JPEG) - null kalau belum ada foto (lihat PersonalProfile.hasPhoto).
  Future<Uint8List?> getProfilePhoto() async {
    final token = await AuthService.instance.validAccessToken();
    if (token == null) throw ApiException('Sesi login berakhir. Silakan login ulang.', 401);
    final res = await http.get(
      Uri.parse('${AppConfig.apiBaseUrl}/personal/profile/photo'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (res.statusCode == 404) return null;
    if (res.statusCode >= 400) throw ApiException('Gagal memuat foto profil (${res.statusCode}).', res.statusCode);
    return res.bodyBytes;
  }

  Future<http.Response> _get(String path) async {
    final token = await AuthService.instance.validAccessToken();
    if (token == null) throw ApiException('Sesi login berakhir. Silakan login ulang.', 401);

    final res = await http.get(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (res.statusCode >= 400) {
      String message = 'Gagal menghubungi server (${res.statusCode}).';
      try {
        final parsed = jsonDecode(res.body);
        if (parsed is Map && parsed['message'] is String) message = parsed['message'] as String;
      } catch (_) {
        // biarkan pesan default kalau body bukan JSON
      }
      throw ApiException(message, res.statusCode);
    }
    return res;
  }

  Future<Map<String, dynamic>> submitAbsensi({
    required String fotoDataUrl,
    required double lat,
    required double lng,
    required double accuracy,
    required bool isMockLocation,
    bool isRooted = false,
    List<String> spoofAppsFound = const [],
    String? tempat,
  }) async {
    final body = jsonEncode({
      'foto': fotoDataUrl,
      'lat': lat,
      'lng': lng,
      'accuracy': accuracy,
      'tempat': tempat,
      'type': 'auto', // server yang menentukan masuk/keluar - lihat PersonalController.PostAbsensi
      'isMockLocation': isMockLocation,
      'isRooted': isRooted,
      'spoofAppsFound': spoofAppsFound,
    });

    final res = await _post('/personal/absensi', body);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<http.Response> _post(String path, String body) async {
    final token = await AuthService.instance.validAccessToken();
    if (token == null) throw ApiException('Sesi login berakhir. Silakan login ulang.', 401);

    final res = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: body,
    );

    if (res.statusCode >= 400) {
      String message = 'Gagal menghubungi server (${res.statusCode}).';
      try {
        final parsed = jsonDecode(res.body);
        if (parsed is Map && parsed['message'] is String) message = parsed['message'] as String;
      } catch (_) {
        // biarkan pesan default kalau body bukan JSON
      }
      throw ApiException(message, res.statusCode);
    }
    return res;
  }
}
