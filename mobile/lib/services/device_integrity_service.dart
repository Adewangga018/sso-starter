import 'dart:io';

import 'package:flutter/services.dart';

class DeviceIntegrityResult {
  final bool isRooted;
  final List<String> spoofAppsFound;

  const DeviceIntegrityResult({required this.isRooted, required this.spoofAppsFound});

  bool get isSuspicious => isRooted || spoofAppsFound.isNotEmpty;

  static const clean = DeviceIntegrityResult(isRooted: false, spoofAppsFound: []);
}

/// Lapisan proteksi TAMBAHAN di luar `LocationService.isMocked` (yang cuma menangkap
/// jalur resmi Developer Options > mock location app). Memeriksa lewat MethodChannel
/// native Android (lihat MainActivity.kt):
/// - Root device (heuristik su binary/build tags).
/// - App fake-GPS atau cloning-container (Parallel Space, App Cloner, dst) yang
///   ter-install - teknik umum untuk memalsukan lokasi tanpa memicu flag isMocked sama
///   sekali, karena lokasi "dipalsukan" di luar API mock-provider resmi Android.
///
/// iOS: tidak ada channel native (Apple tidak mengekspos deteksi setara) - selalu
/// mengembalikan `clean`, proteksi utama untuk iOS tetap `isMocked` di LocationService.
class DeviceIntegrityService {
  DeviceIntegrityService._();
  static final DeviceIntegrityService instance = DeviceIntegrityService._();

  static const _channel = MethodChannel('com.gresik.gcs.myabsensi/device_integrity');

  Future<DeviceIntegrityResult> check() async {
    if (!Platform.isAndroid) return DeviceIntegrityResult.clean;

    try {
      final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>('check');
      if (raw == null) return DeviceIntegrityResult.clean;
      final isRooted = raw['isRooted'] as bool? ?? false;
      final spoofApps = (raw['spoofAppsFound'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList();
      return DeviceIntegrityResult(isRooted: isRooted, spoofAppsFound: spoofApps);
    } catch (_) {
      // Kalau channel gagal (device/OS aneh dsb), jangan blokir absen sah karena
      // masalah teknis di luar kendali user - anggap bersih, deteksi utama (isMocked)
      // tetap jalan sebagai lapisan proteksi.
      return DeviceIntegrityResult.clean;
    }
  }
}
