import 'package:flutter/material.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const MyGcsAbsensiApp());
}

class MyGcsAbsensiApp extends StatelessWidget {
  const MyGcsAbsensiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MyGCS Absensi',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const _AuthGate(),
    );
  }
}

/// Cek token tersimpan saat app dibuka - langsung ke Home kalau masih login,
/// selain itu tampilkan layar login.
class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  bool? _loggedIn;

  @override
  void initState() {
    super.initState();
    // catchError sengaja dipasang lagi di sini (selain penanganan di AuthService sendiri) -
    // lapisan jaga terakhir supaya layar ini TIDAK PERNAH macet selamanya di loading kalau
    // ada kegagalan tak terduga di baliknya; anggap belum login (tampilkan layar login)
    // daripada spinner tanpa akhir.
    AuthService.instance.isLoggedIn.then((v) {
      if (mounted) setState(() => _loggedIn = v);
    }).catchError((_) {
      if (mounted) setState(() => _loggedIn = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loggedIn == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return _loggedIn! ? const HomeScreen() : const LoginScreen();
  }
}
