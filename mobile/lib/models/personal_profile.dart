class PersonalProfile {
  final String namaLengkap;
  final String idKaryawan;
  final String nik;
  final String? statusKaryawan;
  final bool hasPhoto;

  PersonalProfile({
    required this.namaLengkap,
    required this.idKaryawan,
    required this.nik,
    required this.statusKaryawan,
    required this.hasPhoto,
  });

  factory PersonalProfile.fromJson(Map<String, dynamic> json) => PersonalProfile(
        namaLengkap: (json['namaLengkap'] as String?)?.trim().isNotEmpty == true
            ? json['namaLengkap'] as String
            : '-',
        idKaryawan: json['idKaryawan'] as String? ?? '',
        nik: json['nik'] as String? ?? '',
        statusKaryawan: json['statusKaryawan'] as String?,
        hasPhoto: json['hasPhoto'] as bool? ?? false,
      );

  String get initial => namaLengkap.trim().isNotEmpty ? namaLengkap.trim()[0].toUpperCase() : '?';
}
