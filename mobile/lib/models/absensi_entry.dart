class AbsensiEntry {
  final DateTime tanggal;
  final String? checkIn;
  final String? checkOut;
  final String sumber;

  AbsensiEntry({required this.tanggal, this.checkIn, this.checkOut, required this.sumber});

  factory AbsensiEntry.fromJson(Map<String, dynamic> json) => AbsensiEntry(
        tanggal: DateTime.parse(json['tanggal'] as String),
        checkIn: json['checkIn'] as String?,
        checkOut: json['checkOut'] as String?,
        sumber: json['sumber'] as String? ?? '',
      );

  bool isSameDate(DateTime other) =>
      tanggal.year == other.year && tanggal.month == other.month && tanggal.day == other.day;
}

enum AbsensiStep { checkIn, checkOut, done }

AbsensiStep stepFor(AbsensiEntry? today) {
  if (today == null || today.checkIn == null) return AbsensiStep.checkIn;
  if (today.checkOut == null) return AbsensiStep.checkOut;
  return AbsensiStep.done;
}
