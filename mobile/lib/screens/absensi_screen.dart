import 'dart:convert';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/location_service.dart';
import '../theme/app_theme.dart';

enum _Step { init, ready, capturing, submitting, done, error }

class AbsensiScreen extends StatefulWidget {
  const AbsensiScreen({super.key});

  @override
  State<AbsensiScreen> createState() => _AbsensiScreenState();
}

class _AbsensiScreenState extends State<AbsensiScreen> {
  CameraController? _controller;
  _Step _step = _Step.init;
  String? _error;
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) throw Exception('Tidak ada kamera yang tersedia di perangkat ini.');
      // Kamera depan lebih diutamakan (foto selfie bukti absen), fallback ke kamera pertama.
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      final controller = CameraController(camera, ResolutionPreset.medium, enableAudio: false);
      await controller.initialize();
      if (!mounted) return;
      setState(() { _controller = controller; _step = _Step.ready; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = 'Gagal membuka kamera: $e'; _step = _Step.error; });
    }
  }

  Future<void> _captureAndSubmit() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    setState(() { _step = _Step.capturing; _error = null; });
    try {
      final file = await controller.takePicture();
      final bytes = await file.readAsBytes();
      final dataUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      setState(() => _step = _Step.submitting);
      final location = await LocationService.instance.getCurrentLocation();

      if (location.isMocked) {
        setState(() {
          _step = _Step.error;
          _error = 'Lokasi terdeteksi menggunakan aplikasi fake GPS (mock location).\n'
              'Nonaktifkan mock location di Pengaturan > Opsi Pengembang, lalu coba lagi.';
        });
        return;
      }

      final result = await ApiClient.instance.submitAbsensi(
        fotoDataUrl: dataUrl,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        isMockLocation: location.isMocked,
      );

      if (!mounted) return;
      setState(() { _step = _Step.done; _result = result; });
    } on LocationException catch (e) {
      setState(() { _step = _Step.error; _error = e.message; });
    } on ApiException catch (e) {
      setState(() { _step = _Step.error; _error = e.message; });
    } catch (e) {
      setState(() { _step = _Step.error; _error = 'Terjadi kesalahan: $e'; });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Absen')),
      body: SafeArea(
        bottom: true,
        child: switch (_step) {
          _Step.init => const Center(child: CircularProgressIndicator()),
          _Step.error => _buildError(),
          _Step.done => _buildDone(),
          _ => _buildCamera(),
        },
      ),
    );
  }

  Widget _buildCamera() {
    final controller = _controller;
    final busy = _step == _Step.capturing || _step == _Step.submitting;
    return Column(
      children: [
        Expanded(
          child: controller != null && controller.value.isInitialized
              ? CameraPreview(controller)
              : const Center(child: CircularProgressIndicator()),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: Column(
            children: [
              if (busy)
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text('Memverifikasi lokasi...', style: TextStyle(color: Colors.black54)),
                ),
              ElevatedButton.icon(
                onPressed: busy ? null : _captureAndSubmit,
                icon: busy
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.camera),
                label: Text(busy ? 'Memproses...' : 'Ambil Foto & Absen'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(_error ?? 'Terjadi kesalahan.', textAlign: TextAlign.center),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => setState(() => _step = _Step.ready),
              child: const Text('Coba Lagi'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDone() {
    final checkIn = _result?['checkIn'] as String?;
    final checkOut = _result?['checkOut'] as String?;
    final jam = checkOut ?? checkIn ?? '-';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_rounded, size: 56, color: AppColors.green700),
            const SizedBox(height: 12),
            Text(
              checkOut != null ? 'Absen keluar berhasil ($jam)' : 'Absen masuk berhasil ($jam)',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Kembali'),
            ),
          ],
        ),
      ),
    );
  }
}
