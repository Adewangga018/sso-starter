/// Status titik absen pribadi milik SAYA (bengkel/gudang/sopir/dll yg tidak beraktivitas
/// di kantor) - lihat PersonalController.GetLokasiSaya. Status null = belum pernah
/// mengajukan, absen tetap divalidasi ke default Kantor Pusat.
class LokasiSaya {
  final String? status; // Menunggu | Disetujui | Ditolak | null
  final double? lat;
  final double? lng;
  final String? keterangan;
  final String? alamat;
  final String? catatanAdmin;
  final DateTime? tglDiajukan;
  final DateTime? tglDiputuskan;
  final double radiusMeters;

  LokasiSaya({
    required this.status,
    required this.lat,
    required this.lng,
    required this.keterangan,
    required this.alamat,
    required this.catatanAdmin,
    required this.tglDiajukan,
    required this.tglDiputuskan,
    required this.radiusMeters,
  });

  factory LokasiSaya.fromJson(Map<String, dynamic> json) => LokasiSaya(
        status: json['status'] as String?,
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
        keterangan: json['keterangan'] as String?,
        alamat: json['alamat'] as String?,
        catatanAdmin: json['catatanAdmin'] as String?,
        tglDiajukan: json['tglDiajukan'] != null ? DateTime.tryParse(json['tglDiajukan'] as String) : null,
        tglDiputuskan: json['tglDiputuskan'] != null ? DateTime.tryParse(json['tglDiputuskan'] as String) : null,
        radiusMeters: (json['radiusMeters'] as num?)?.toDouble() ?? 150,
      );
}
