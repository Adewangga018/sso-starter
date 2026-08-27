import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      final ok = await AuthService.instance.login();
      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
      } else {
        setState(() => _error = 'Login dibatalkan.');
      }
    } catch (e) {
      setState(() => _error = 'Gagal login: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.badge_rounded, size: 64, color: AppColors.green900),
              const SizedBox(height: 16),
              const Text(
                'MyGCS Absensi',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.green900),
              ),
              const SizedBox(height: 8),
              const Text(
                'Masuk dengan akun MyGCS Anda untuk mulai absen.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 32),
              if (_error != null) ...[
                Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.danger)),
                const SizedBox(height: 12),
              ],
              ElevatedButton(
                onPressed: _loading ? null : _login,
                child: _loading
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Masuk dengan SSO MyGCS'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
