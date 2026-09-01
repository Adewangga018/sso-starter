import 'dart:async';

import 'package:geolocator/geolocator.dart';

class LocationResult {
  final double lat;
  final double lng;
  final double accuracy;
  final bool isMocked;

  LocationResult({required this.lat, required this.lng, required this.accuracy, required this.isMocked});
}

class LocationException implements Exception {
  final String message;
  LocationException(this.message);
  @override
  String toString() => message;
}

/// Ambil posisi GPS + deteksi mock-location (fake-GPS).
///
/// Android: `Position.isMocked` diisi dari `Location.isFromMockProvider()` milik OS -
/// true kalau lokasi berasal dari app "Fake GPS" / Developer Options > Select mock
/// location app, TIDAK bisa dipalsukan dari sisi Dart karena flag-nya ditentukan
/// FusedLocationProviderClient di level sistem sebelum sampai ke app.
///
/// iOS: deteksi mock jauh lebih terbatas (Apple tidak expose mock-provider flag
/// resmi seperti Android) - `isMocked` di iOS umumnya selalu false pada device asli,
/// jadi proteksi utama kita ada di sisi Android. Ini batasan platform, bukan bug.
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  Future<LocationResult> getCurrentLocation() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      throw LocationException('Izin lokasi ditolak. Aktifkan izin lokasi untuk aplikasi ini di pengaturan HP.');
    }

    if (!await Geolocator.isLocationServiceEnabled()) {
      throw LocationException('GPS/Location Service tidak aktif. Aktifkan GPS lalu coba lagi.');
    }

    Position pos;
    try {
      pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 30)),
      );
    } on TimeoutException {
      // Sinyal GPS murni lemah (umum di dalam gedung, apalagi sesaat setelah mock-location
      // app dicopot - fix GPS asli pertama kali/"cold start" bisa lebih lambat dari fix palsu
      // yg instan). Coba sekali lagi dgn akurasi lebih rendah (dibantu WiFi/seluler) sebelum
      // benar-benar gagal - accuracy tetap dicatat & tidak dipakai memblokir absen (lihat
      // PersonalController.PostAbsensi), jadi aman dipakai sbg fallback.
      try {
        pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 15)),
        );
      } on TimeoutException {
        throw LocationException(
          'Sinyal GPS lemah/belum ditemukan. Coba dekat jendela atau area terbuka, lalu coba lagi.');
      }
    }

    return LocationResult(lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy, isMocked: pos.isMocked);
  }
}
