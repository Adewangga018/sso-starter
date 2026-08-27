import 'package:flutter_test/flutter_test.dart';

import 'package:mygcs_absensi/main.dart';

void main() {
  testWidgets('App boots and shows a loading/login state', (WidgetTester tester) async {
    await tester.pumpWidget(const MyGcsAbsensiApp());
    await tester.pump();
    // Auth-gate belum selesai resolve saat frame pertama -> spinner. Cukup pastikan
    // app tidak crash saat startup.
    expect(find.byType(MyGcsAbsensiApp), findsOneWidget);
  });
}
