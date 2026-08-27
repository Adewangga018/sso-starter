import 'dart:math';

class OfficeLocation {
  final int id;
  final String nama;
  final double lat;
  final double lng;
  final double radiusMeters;

  OfficeLocation({required this.id, required this.nama, required this.lat, required this.lng, required this.radiusMeters});

  factory OfficeLocation.fromJson(Map<String, dynamic> json) => OfficeLocation(
        id: json['id'] as int,
        nama: json['nama'] as String? ?? '-',
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        radiusMeters: (json['radiusMeters'] as num).toDouble(),
      );
}

/// Jarak haversine (meter) - rumus identik dengan backend (PersonalController.DistanceMeters)
/// supaya status "dalam radius" di app selalu konsisten dengan validasi server.
double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
  const r = 6371000.0;
  double toRad(double d) => d * pi / 180.0;
  final dLat = toRad(lat2 - lat1);
  final dLng = toRad(lng2 - lng1);
  final a = pow(sin(dLat / 2), 2) + cos(toRad(lat1)) * cos(toRad(lat2)) * pow(sin(dLng / 2), 2);
  return 2 * r * asin(sqrt(a));
}

class NearestOffice {
  final OfficeLocation location;
  final double jarakMeters;
  bool get dalamRadius => jarakMeters <= location.radiusMeters;

  NearestOffice({required this.location, required this.jarakMeters});
}

NearestOffice? findNearest(List<OfficeLocation> locations, double lat, double lng) {
  if (locations.isEmpty) return null;
  NearestOffice? nearest;
  for (final loc in locations) {
    final jarak = distanceMeters(lat, lng, loc.lat, loc.lng);
    if (nearest == null || jarak < nearest.jarakMeters) {
      nearest = NearestOffice(location: loc, jarakMeters: jarak);
    }
  }
  return nearest;
}
