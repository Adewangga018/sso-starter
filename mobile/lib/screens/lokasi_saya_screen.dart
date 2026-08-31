import 'package:flutter/material.dart';

import '../models/lokasi_saya.dart';
import '../services/api_client.dart';
import '../services/device_integrity_service.dart';
import '../services/location_service.dart';
import '../theme/app_theme.dart';

/// Karyawan bengkel/gudang/sopir/dll yang tidak beraktivitas di kantor bisa mengajukan
/// titik absen sendiri di sini - berlaku setelah disetujui Admin SDM ("Kelola Lokasi
/// Absensi"). Selama belum disetujui, absen tetap divalidasi ke default Kantor Pusat.
class LokasiSayaScreen extends StatefulWidget {
  const LokasiSayaScreen({super.key});

  @override
  State<LokasiSayaScreen> createState() => _LokasiSayaScreenState();
}

class _LokasiSayaScreenState extends State<LokasiSayaScreen> {
  bool _loading = true;
  String? _error;
  LokasiSaya? _lokasi;

  bool _submitting = false;
  String? _submitError;
  String? _submitNote;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final lok = await ApiClient.instance.getLokasiSaya();
      if (!mounted) return;
      setState(() { _lokasi = lok; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  Future<void> _ajukan() async {
    setState(() { _submitting = true; _submitError = null; _submitNote = null; });
    try {
      final loc = await LocationService.instance.getCurrentLocation();
      if (loc.isMocked) {
        setState(() => _submitError = 'Lokasi terdeteksi menggunakan aplikasi fake GPS. Nonaktifkan mock location lalu coba lagi.');
        return;
      }
      final integrity = await DeviceIntegrityService.instance.check();
      if (integrity.isRooted) {
        setState(() => _submitError = 'Perangkat terdeteksi ter-root. Pengajuan titik absen tidak dapat dilakukan dari perangkat ini.');
        return;
      }
      if (integrity.spoofAppsFound.isNotEmpty) {
        setState(() => _submitError = 'Terdeteksi aplikasi yang berpotensi memalsukan lokasi/sensor perangkat. Copot aplikasi tersebut lalu coba lagi.');
        return;
      }
      await ApiClient.instance.ajukanLokasi(lat: loc.lat, lng: loc.lng, keterangan: _keterangan);
      if (!mounted) return;
      setState(() => _submitNote = 'Pengajuan terkirim. Menunggu persetujuan Admin SDM.');
      await _load();
    } catch (e) {
      setState(() => _submitError = '$e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String? _keterangan;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Titik Absen Saya')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildStatusCard(),
                      const SizedBox(height: 16),
                      _buildAjukanCard(),
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
            ElevatedButton(onPressed: _load, child: const Text('Coba Lagi')),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    final lok = _lokasi;
    final belumPernah = lok?.status == null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Status Saat Ini', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.green900)),
            const SizedBox(height: 12),
            if (belumPernah)
              const Text(
                'Anda belum pernah mengajukan titik absen pribadi. Absen tetap divalidasi ke '
                'Kantor Pusat PT Gresik Cipta Sejahtera.',
                style: TextStyle(fontSize: 13, color: Colors.black54),
              )
            else ...[
              _statusChip(lok!.status!),
              const SizedBox(height: 10),
              if (lok.alamat != null)
                Text(lok.alamat!, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.green900)),
              if (lok.lat != null && lok.lng != null)
                Text('Titik: ${lok.lat!.toStringAsFixed(6)}, ${lok.lng!.toStringAsFixed(6)}',
                    style: const TextStyle(fontSize: 13, color: Colors.black54)),
              Text('Radius: ${lok.radiusMeters.toStringAsFixed(0)} meter', style: const TextStyle(fontSize: 13, color: Colors.black54)),
              if (lok.keterangan != null && lok.keterangan!.isNotEmpty)
                Text('Keterangan: ${lok.keterangan}', style: const TextStyle(fontSize: 13, color: Colors.black54)),
              if (lok.status == 'Menunggu')
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('Absen Anda masih memakai Kantor Pusat sampai pengajuan ini disetujui Admin SDM.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.gold700)),
                ),
              if (lok.status == 'Ditolak' && lok.catatanAdmin != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('Catatan Admin SDM: ${lok.catatanAdmin}', style: const TextStyle(fontSize: 12.5, color: AppColors.danger)),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    final color = status == 'Disetujui' ? AppColors.green700 : status == 'Ditolak' ? AppColors.danger : AppColors.gold700;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(status, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: color)),
    );
  }

  Widget _buildAjukanCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Ajukan / Ajukan Ulang Titik', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.green900)),
            const SizedBox(height: 8),
            const Text(
              'Berdiri di lokasi kerja Anda (bengkel/gudang/dll), lalu tekan tombol di bawah - '
              'lokasi GPS Anda saat ini akan diajukan ke Admin SDM untuk disetujui.',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 14),
            TextField(
              decoration: const InputDecoration(labelText: 'Keterangan (opsional)', hintText: 'mis. Gudang Sidoarjo', border: OutlineInputBorder()),
              onChanged: (v) => _keterangan = v,
            ),
            const SizedBox(height: 14),
            if (_submitError != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_submitError!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5))),
            if (_submitNote != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_submitNote!, style: const TextStyle(color: AppColors.green700, fontSize: 12.5))),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _submitting ? null : _ajukan,
                icon: _submitting
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.my_location),
                label: Text(_submitting ? 'Mengirim...' : 'Ajukan Lokasi Saat Ini'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
