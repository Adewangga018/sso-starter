import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../models/absensi_entry.dart';
import '../models/office_location.dart';
import '../models/personal_profile.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import 'absensi_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _loading = true;
  String? _error;

  PersonalProfile? _profile;
  Uint8List? _photoBytes;
  AbsensiEntry? _today;
  List<OfficeLocation> _locations = [];

  Position? _position;
  NearestOffice? _nearest;
  bool _locationLoading = false;
  String? _locationError;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        ApiClient.instance.getProfile(),
        ApiClient.instance.getAbsensi(),
        ApiClient.instance.getLocations(),
      ]);
      final profile = results[0] as PersonalProfile;
      final absensi = results[1] as List<AbsensiEntry>;
      final locations = results[2] as List<OfficeLocation>;

      Uint8List? photo;
      if (profile.hasPhoto) {
        try { photo = await ApiClient.instance.getProfilePhoto(); } catch (_) { photo = null; }
      }

      final now = DateTime.now();
      AbsensiEntry? today;
      for (final e in absensi) {
        if (e.isSameDate(now)) { today = e; break; }
      }

      if (!mounted) return;
      setState(() {
        _profile = profile;
        _photoBytes = photo;
        _today = today;
        _locations = locations;
        _loading = false;
      });
      _refreshLocation();
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  Future<void> _refreshLocation() async {
    setState(() { _locationLoading = true; _locationError = null; });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        throw Exception('Izin lokasi ditolak.');
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('GPS tidak aktif.');
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
      );
      if (!mounted) return;
      setState(() {
        _position = pos;
        _nearest = findNearest(_locations, pos.latitude, pos.longitude);
        _locationLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _locationError = '$e'; _locationLoading = false; });
    }
  }

  Future<void> _logout() async {
    await AuthService.instance.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _goAbsen() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AbsensiScreen()),
    );
    if (result == true) _loadAll();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MyGCS Absensi'),
        actions: [
          IconButton(tooltip: 'Keluar', icon: const Icon(Icons.logout), onPressed: _logout),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadAll,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                    children: [
                      _buildAccountCard(),
                      const SizedBox(height: 14),
                      _buildStatusCard(),
                      const SizedBox(height: 14),
                      _buildLocationCard(),
                      const SizedBox(height: 20),
                      _buildActionButton(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 44, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(_error ?? '', textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadAll, child: const Text('Coba Lagi')),
          ],
        ),
      ),
    );
  }

  Widget _buildAccountCard() {
    final p = _profile;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: AppColors.gold500,
              backgroundImage: _photoBytes != null ? MemoryImage(_photoBytes!) : null,
              child: _photoBytes == null
                  ? Text(p?.initial ?? '?', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.green900))
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p?.namaLengkap ?? '-', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.green900)),
                  const SizedBox(height: 3),
                  Text('NIK ${p?.nik ?? '-'}', style: const TextStyle(fontSize: 12.5, color: Colors.black54)),
                  if (p?.statusKaryawan != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.green700.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        p!.statusKaryawan!,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.green700),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    final step = stepFor(_today);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.today_rounded, size: 18, color: AppColors.green900),
                const SizedBox(width: 8),
                const Text('Absensi Hari Ini', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.green900)),
                const Spacer(),
                Text(_formatToday(), style: const TextStyle(fontSize: 12, color: Colors.black54)),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _statusTile('Masuk', _today?.checkIn, step == AbsensiStep.checkIn)),
                const SizedBox(width: 10),
                Expanded(child: _statusTile('Keluar', _today?.checkOut, step == AbsensiStep.checkOut)),
              ],
            ),
            if (step == AbsensiStep.done) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(color: AppColors.green700.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle_rounded, size: 16, color: AppColors.green700),
                    SizedBox(width: 6),
                    Text('Absensi hari ini sudah lengkap.', style: TextStyle(fontSize: 12.5, color: AppColors.green700, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusTile(String label, String? time, bool isNext) {
    final done = time != null;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
      decoration: BoxDecoration(
        color: done ? AppColors.green700.withValues(alpha: 0.08) : (isNext ? AppColors.gold500.withValues(alpha: 0.12) : Colors.black.withValues(alpha: 0.035)),
        borderRadius: BorderRadius.circular(12),
        border: isNext && !done ? Border.all(color: AppColors.gold500, width: 1.4) : null,
      ),
      child: Column(
        children: [
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: done ? AppColors.green700 : Colors.black54)),
          const SizedBox(height: 6),
          Text(
            time ?? (isNext ? 'Berikutnya' : '-'),
            style: TextStyle(fontSize: done ? 18 : 13, fontWeight: FontWeight.w800, color: done ? AppColors.green900 : (isNext ? AppColors.gold700 : Colors.black38)),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.location_on_rounded, size: 18, color: AppColors.green900),
                const SizedBox(width: 8),
                const Text('Lokasi Anda', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.green900)),
                const Spacer(),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: _locationLoading
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.refresh_rounded, size: 20),
                  onPressed: _locationLoading ? null : _refreshLocation,
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (_locationError != null)
              Text(_locationError!, style: const TextStyle(fontSize: 12.5, color: AppColors.danger))
            else if (_position == null)
              const Text('Mengambil lokasi...', style: TextStyle(fontSize: 12.5, color: Colors.black54))
            else ...[
              _kv('Koordinat', '${_position!.latitude.toStringAsFixed(6)}, ${_position!.longitude.toStringAsFixed(6)}'),
              _kv('Akurasi GPS', '±${_position!.accuracy.toStringAsFixed(0)} m'),
              if (_nearest != null) ...[
                _kv('Kantor terdekat', _nearest!.location.nama),
                _kv('Jarak', '${_nearest!.jarakMeters.toStringAsFixed(0)} m (radius ${_nearest!.location.radiusMeters.toStringAsFixed(0)} m)'),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                  decoration: BoxDecoration(
                    color: (_nearest!.dalamRadius ? AppColors.green700 : AppColors.danger).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(_nearest!.dalamRadius ? Icons.check_circle_rounded : Icons.error_rounded,
                          size: 16, color: _nearest!.dalamRadius ? AppColors.green700 : AppColors.danger),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _nearest!.dalamRadius ? 'Anda berada di dalam area kantor.' : 'Anda di luar radius area kantor.',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: _nearest!.dalamRadius ? AppColors.green700 : AppColors.danger,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else if (_locations.isEmpty)
                const Text('Belum ada lokasi kantor terdaftar.', style: TextStyle(fontSize: 12.5, color: Colors.black54)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(k, style: const TextStyle(fontSize: 12.5, color: Colors.black54))),
          Expanded(child: Text(v, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.green900))),
        ],
      ),
    );
  }

  Widget _buildActionButton() {
    final step = stepFor(_today);
    final done = step == AbsensiStep.done;
    final label = step == AbsensiStep.checkIn ? 'Absen Masuk' : step == AbsensiStep.checkOut ? 'Absen Keluar' : 'Absensi Selesai';
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: done ? null : _goAbsen,
        icon: Icon(done ? Icons.check_circle_rounded : Icons.fingerprint),
        label: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(label)),
      ),
    );
  }

  String _formatToday() {
    const hari = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Minggu'];
    const bulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    final now = DateTime.now();
    return '${hari[now.weekday - 1]}, ${now.day} ${bulan[now.month]} ${now.year}';
  }
}
