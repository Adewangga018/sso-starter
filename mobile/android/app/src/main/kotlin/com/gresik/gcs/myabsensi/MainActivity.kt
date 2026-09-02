package com.gresik.gcs.myabsensi

import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

// Channel native tambahan di luar geolocator.isMocked (yang cuma menangkap jalur resmi
// "Developer Options > Select mock location app"). Ditambahkan 2026-08-28 setelah absensi
// masih bisa ditembus fake-GPS di device manager - kemungkinan besar lewat app "GPS
// spoofer"/cloning container (Parallel Space, App Cloner, dst) atau device rooted, yang
// TIDAK men-set flag isFromMockProvider() sama sekali sehingga lolos dari geolocator.
class MainActivity : FlutterActivity() {
    private val channelName = "com.gresik.gcs.myabsensi/device_integrity"

    // Paket aplikasi fake-GPS / cloning-container yang umum dipakai untuk menembus deteksi
    // mock-location standar Android (tidak butuh root, banyak dipakai orang awam).
    private val spoofPackages = listOf(
        "com.lexa.fakegps",
        "com.incorporateapps.fakegps.fre",
        "com.blogspot.newapphorizons.fakegps",
        "com.fly.gps",
        "com.gsmartstudio.fakegps",
        "com.theappninjas.fakegpsjoystick",
        "com.jmelabs.fakegps",
        "com.evezzon.mockgps",
        "com.rosteam.gpsemulator",
        "com.lexa.fakegps.pro",
        "com.rechild.advancedtaskkiller.fakegps",
        "com.hopto.tonyw.fakegps",
        "com.franco.simplemockapp",
        "app.greyshirts.fakegps",
        "com.andropermission.fakegps",
        // Cloning / virtualization container - alat umum utk menjalankan app di sandbox
        // sehingga bisa memalsukan sensor (termasuk lokasi) tanpa app itu sendiri sadar.
        "com.lbe.parallel.intl",
        "com.lbe.parallel",
        "com.excelliance.dualaid",
        "com.jiubang.dm.pro",
        "com.parallel.space.pro",
        "com.parallel.space.lite",
        "com.dual.space.parallel.app",
        "com.apps.appcloner",
        "com.android.vxp",
        "io.va.exposed",
        "org.meowcat.edxposed.manager",
        "de.robv.android.xposed.installer",
        "com.topjohnwu.magisk",
    )

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "check" -> result.success(
                    mapOf(
                        "isRooted" to isDeviceRooted(),
                        "spoofAppsFound" to findInstalledSpoofPackages(),
                    ),
                )
                else -> result.notImplemented()
            }
        }
    }

    private fun findInstalledSpoofPackages(): List<String> {
        val pm = packageManager
        return spoofPackages.filter { pkg ->
            try {
                pm.getPackageInfo(pkg, 0)
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    // Heuristik umum deteksi root (bukan jaminan mutlak - root modern bisa disembunyikan
    // lewat Magisk Hide/Zygisk, tapi tetap menyaring mayoritas kasus dan menaikkan
    // biaya usaha untuk menembus proteksi ini).
    private fun isDeviceRooted(): Boolean {
        val buildTags = Build.TAGS
        if (buildTags != null && buildTags.contains("test-keys")) return true

        val suPaths = listOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/system/su", "/su/bin/su", "/system/bin/.ext/.su",
            "/system/usr/we-need-root/su-backup", "/system/xbin/mu",
            "/data/local/xbin/su", "/data/local/bin/su", "/data/local/su",
        )
        if (suPaths.any { File(it).exists() }) return true

        return try {
            val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
            process.inputStream.bufferedReader().readLine() != null
        } catch (e: Exception) {
            false
        }
    }
}
