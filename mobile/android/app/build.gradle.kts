import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Password keystore release - lihat android/key.properties (RAHASIA, tidak masuk git).
// Kalau file itu tidak ada (mis. clone baru tanpa keystore), releaseSigning tetap null
// dan build release otomatis jatuh ke signing debug (lihat buildTypes di bawah) supaya
// `flutter build apk --release` tetap bisa jalan untuk smoke test.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
val hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.gresik.gcs.myabsensi"
    compileSdk = flutter.compileSdkVersion
    // Versi yang diminta beberapa plugin (flutter_appauth, geolocator, dst) - flutter.ndkVersion
    // bawaan lebih lama dan memicu warning "requires higher NDK" tiap build.
    ndkVersion = "27.0.12077973"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.gresik.gcs.myabsensi"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Skema redirect OAuth (flutter_appauth) - HARUS sama dengan yang didaftarkan di
        // backend (Oidc:Mobile:RedirectUris) dan dipakai di app_config.dart. Nama paket
        // (com.gresik.gcs.myabsensi) diminta manajemen 2026-09-02 - tidak mengandung
        // underscore, jadi skema URI-nya sama persis dgn applicationId.
        manifestPlaceholders["appAuthRedirectScheme"] = "com.gresik.gcs.myabsensi"
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseSigning) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
