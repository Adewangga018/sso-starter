# Panduan Deploy Backend ASP.NET Core ke IIS (Pendekatan Subfolder)

Panduan ini men-deploy backend **SsoBackend** (.NET 10) sebagai **sub-application** di dalam
site frontend yang sudah ada (`my.gcs-gresik.com`), dengan alias **`api`**.

Hasil akhir:

| URL | Isi |
|---|---|
| `https://my.gcs-gresik.com/` | Frontend (sudah ada) |
| `https://my.gcs-gresik.com/api/` | Halaman bukti backend (logo + status) |
| `https://my.gcs-gresik.com/api/health` | JSON status backend + cek koneksi DB |

Karena backend & frontend berada di **satu domain**, tidak ada masalah **CORS**, dan frontend
cukup memanggil API lewat path relatif `/api/...`. IIS otomatis mengeset PathBase ke `/api`
(mode *in-process*), sehingga endpoint `/health` menjadi `/api/health` tanpa perlu ubah kode.

---

## 1. Prasyarat di Server (sekali saja)

Server harus punya **ASP.NET Core 10 Hosting Bundle** (bukan hanya .NET SDK/Runtime biasa).

1. Download `dotnet-hosting-10.x.x-win.exe` dari halaman resmi .NET 10.
2. Jalankan installer di server.
3. Restart IIS agar module terbaca:
   ```powershell
   net stop was /y
   net start w3svc
   ```
4. Verifikasi terpasang:
   ```powershell
   dotnet --list-runtimes
   ```
   Harus ada baris `Microsoft.AspNetCore.App 10.x.x`.

> Tanpa Hosting Bundle, IIS akan menampilkan error **HTTP 500.19** atau **500.31**.

---

## 2. Build / Publish Artifact (di mesin developer)

> Lewati langkah ini jika Anda sudah menerima file `sso-api-deploy.zip`.

Dari folder `backend`:

```powershell
dotnet publish -c Release -o publish
```

Hasilnya ada di folder `backend\publish\`. Untuk memudahkan transfer, kemas jadi zip:

```powershell
Compress-Archive -Path 'publish\*' -DestinationPath 'sso-api-deploy.zip' -Force
```

---

## 3. Copy Artifact ke Server

1. Salin `sso-api-deploy.zip` ke server (via RDP / file share).
2. Extract **seluruh isinya** ke folder **terpisah dari frontend**, contoh:
   ```
   C:\inetpub\backends\sso-api\
   ```
   > Jangan taruh di dalam folder fisik frontend agar file tidak tercampur.

Struktur folder setelah extract kira-kira:
```
C:\inetpub\backends\sso-api\
├── SsoBackend.dll
├── web.config
├── appsettings.json
├── wwwroot\        (index.html + logo.png)
└── ... (dll dependency lainnya)
```

---

## 4. Buat Application Pool

IIS Manager → **Application Pools** → **Add Application Pool...**

| Setting | Nilai |
|---|---|
| Name | `sso-api-pool` |
| .NET CLR Version | **No Managed Code** ← WAJIB untuk ASP.NET Core |
| Managed pipeline mode | Integrated |

---

## 5. Tambah Application (Subfolder) di Site Frontend

IIS Manager → expand **Sites** → klik kanan site `my.gcs-gresik.com` → **Add Application...**

| Setting | Nilai |
|---|---|
| Alias | `api` |
| Application pool | `sso-api-pool` |
| Physical path | `C:\inetpub\backends\sso-api` |

---

## 6. Beri Izin Folder

Beri identitas app pool izin **Read** ke folder deploy:

```powershell
icacls "C:\inetpub\backends\sso-api" /grant "IIS AppPool\sso-api-pool:(OI)(CI)(RX)" /T
```

---

## 6b. Konfigurasi SSO Produksi (Identity + OpenIddict) — WAJIB

Backend kini adalah OIDC server. Sebelum bisa jalan di produksi diperlukan **sertifikat** dan
**environment variable** (kredensial tidak lagi ada di `appsettings.json`).

### Sertifikat OIDC (signing + encryption)

Di server, buat 2 sertifikat self-signed persisten lalu beri App Pool akses private key:

```powershell
# 1) Buat sertifikat (berlaku 5 tahun) di LocalMachine store
$sign = New-SelfSignedCertificate -Subject "CN=MyGCS OIDC Signing" `
  -CertStoreLocation "Cert:\LocalMachine\My" -KeyUsage DigitalSignature `
  -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(5)
$enc  = New-SelfSignedCertificate -Subject "CN=MyGCS OIDC Encryption" `
  -CertStoreLocation "Cert:\LocalMachine\My" -KeyUsage KeyEncipherment,DataEncipherment `
  -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(5)
"Signing    : $($sign.Thumbprint)"
"Encryption : $($enc.Thumbprint)"

# 2) Beri App Pool izin baca private key kedua sertifikat
foreach ($c in @($sign, $enc)) {
  $rsa  = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($c)
  $path = "C:\ProgramData\Microsoft\Crypto\Keys\$($rsa.Key.UniqueName)"
  icacls $path /grant "IIS AppPool\sso-api-pool:(R)"
}
```

Catat kedua **thumbprint** untuk langkah berikut.

### Environment variable (di `web.config` folder deploy)

Edit `<aspNetCore>` pada `web.config` menjadi seperti ini (nilai contoh — ganti sesuai server).
File ini ada di server saja, **tidak** masuk git:

```xml
<aspNetCore processPath="dotnet" arguments=".\SsoBackend.dll" hostingModel="inprocess" stdoutLogEnabled="false">
  <environmentVariables>
    <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
    <environmentVariable name="ConnectionStrings__DefaultConnection" value="Server=...;Database=db_mygcs;User Id=svc_mygcs;Password=...;TrustServerCertificate=True;Encrypt=False;" />
    <environmentVariable name="ConnectionStrings__GcsConnection" value="Server=...;Database=GCS;User Id=svc_mygcs;Password=...;TrustServerCertificate=True;Encrypt=False;" />
    <environmentVariable name="Oidc__SigningCertificateThumbprint" value="<THUMBPRINT_SIGNING>" />
    <environmentVariable name="Oidc__EncryptionCertificateThumbprint" value="<THUMBPRINT_ENCRYPTION>" />
  </environmentVariables>
</aspNetCore>
```

> Tanpa thumbprint, aplikasi sengaja gagal start (fail-fast) agar tidak jalan tanpa sertifikat persisten.

### ⚠️ Kredensial database

- Jangan pakai `sa`. Buat **login SQL khusus** `svc_mygcs` dengan hak minimum:
  `db_mygcs` (read/write) dan `GCS` (read-only). Ini juga menghindari risiko merotasi `sa`
  yang dipakai sistem lain.
- Password `sa` & key `Jwt` lama **sudah bocor di histori git** (commit pertama) — anggap kompromi,
  ganti/rotasi. Bila perlu bersihkan histori dengan `git filter-repo` / BFG.
- **Publish ulang** (`dotnet publish -c Release`) sebelum deploy: artifact lama (`publish/`,
  `sso-api-deploy.zip`) masih memuat password di `appsettings.json`.

---

## 7. Verifikasi

Buka di browser:

- `https://my.gcs-gresik.com/api/` → harus muncul halaman **logo + badge hijau "Backend berhasil di-deploy ke IIS"**.
- `https://my.gcs-gresik.com/api/health` → harus muncul JSON:
  ```json
  {
    "status": "OK - Backend berjalan",
    "environment": "Production",
    "machineName": "...",
    "databaseConnected": true,
    "serverTimeUtc": "..."
  }
  ```

Jika `databaseConnected: true`, backend **dan** koneksi database sudah beres.

---

## 8. Integrasi dengan Frontend

Arahkan semua pemanggilan API di frontend ke path relatif **`/api/...`** (satu domain, tanpa CORS).

Contoh:
```
https://my.gcs-gresik.com/api/health
https://my.gcs-gresik.com/api/<endpoint-lainnya>
```

---

## 9. Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| **HTTP 500.19** | Hosting Bundle belum terpasang / `web.config` bermasalah. Install ulang Hosting Bundle + restart IIS. |
| **HTTP 500.30 / 502.5** | App gagal start — biasanya runtime kurang atau database tak terjangkau. Aktifkan log (lihat bawah) lalu cek **Event Viewer → Windows Logs → Application**. |
| **`/api/` malah menampilkan halaman frontend** | Site frontend (SPA) punya **URL Rewrite** rule yang menangkap semua path termasuk `/api`. Tambahkan rule pengecualian `/api` di `web.config` frontend (lihat contoh di bawah). |
| **`databaseConnected: false`** | Server IIS tidak bisa menjangkau SQL Server `192.168.100.2,49291`. Cek firewall / jaringan / kredensial di `appsettings.json`. |
| **Warning "Failed to determine the https port"** | Aman diabaikan. TLS ditangani oleh site frontend. |

### Mengaktifkan Log Error (untuk kasus 500.30 / 502.5)

1. Edit `web.config` di folder deploy, ubah:
   ```xml
   stdoutLogEnabled="false"   →   stdoutLogEnabled="true"
   ```
2. Buat folder `logs\` di dalam folder deploy.
3. Beri izin **Write** ke app pool:
   ```powershell
   icacls "C:\inetpub\backends\sso-api\logs" /grant "IIS AppPool\sso-api-pool:(OI)(CI)(M)" /T
   ```
4. Reproduksi error, lalu baca file `logs\stdout_*.log`.
5. **Kembalikan `stdoutLogEnabled="false"`** setelah selesai (agar tidak menumpuk log).

### Contoh Rule Pengecualian `/api` di `web.config` Frontend

Jika frontend adalah SPA dengan URL Rewrite, tambahkan rule ini **paling atas** di dalam
`<rewrite><rules>` pada `web.config` frontend agar request `/api` tidak dibelokkan ke `index.html`:

```xml
<rule name="Jangan rewrite subfolder api" stopProcessing="true">
  <match url="^api(/.*)?$" />
  <action type="None" />
</rule>
```

---

## Ringkasan Perintah Cepat (di server)

```powershell
# 1. Cek Hosting Bundle terpasang
dotnet --list-runtimes

# 2. Beri izin Read ke folder deploy
icacls "C:\inetpub\backends\sso-api" /grant "IIS AppPool\sso-api-pool:(OI)(CI)(RX)" /T

# 3. Restart IIS bila perlu
net stop was /y ; net start w3svc
```

Sisanya (buat App Pool + Add Application) dilakukan lewat **IIS Manager** (GUI) seperti langkah 4–5.
