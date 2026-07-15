# Panduan Deploy MyGCS ke IIS (Final)

Panduan lengkap men-deploy platform **MyGCS** (frontend React + backend ASP.NET Core / OpenIddict)
ke **Windows Server + IIS** dengan pendekatan **subfolder** di domain `my.gcs-gresik.com`.

> Ganti `my.gcs-gresik.com` di seluruh dokumen dengan domain riil Anda bila berbeda.

---

## 0. Arsitektur Deployment

| Komponen | URL | Cara host | Sumber |
|---|---|---|---|
| **Frontend** (React SPA) | `https://my.gcs-gresik.com/` | IIS **Site** (static files) | `frontend/dist` |
| **Backend** (SSO Hub / API) | `https://my.gcs-gresik.com/api` | IIS **Application** (sub-app, ASP.NET Core) | `backend/publish` |
| **DB identitas** (`db_mygcs`) | — | SQL Server | `ConnectionStrings:DefaultConnection` |
| **DB SDM** (`GCS`) | — | SQL Server (live) | `ConnectionStrings:GcsConnection` |

- Frontend & backend **satu origin** → tidak ada CORS; cookie sesi login berfungsi.
- Backend memakai **dua database**: `db_mygcs` (Identity, OpenIddict, audit) dan `GCS` (data SDM
  live: pegawai, absensi, lembur/SPL, approval).
- Autentikasi: **OpenID Connect (OpenIddict)**, Authorization Code + PKCE.

---

## 1. Prasyarat Server

1. **IIS** aktif.
2. **ASP.NET Core 10 Hosting Bundle** — download `dotnet-hosting-10.x.x-win.exe` dari situs resmi
   .NET, install, lalu:
   ```powershell
   net stop was /y ; net start w3svc
   ```
   Verifikasi: `dotnet --list-runtimes` memuat `Microsoft.AspNetCore.App 10.x`.
3. **URL Rewrite Module** untuk IIS (dibutuhkan routing SPA frontend) — install dari
   "IIS URL Rewrite" (Microsoft).
4. **Sertifikat TLS** untuk `my.gcs-gresik.com` (dari CA atau CA internal) terpasang di IIS untuk
   binding HTTPS. *(Ini BERBEDA dari sertifikat OIDC di Bab 4.)*
5. Akses jaringan dari server IIS ke **SQL Server** (`db_mygcs` & `GCS`).

---

## 2. Build Artifact (di mesin developer)

### Backend
```powershell
cd backend
dotnet publish -c Release -o publish
```
Hasil: folder `backend/publish` (berisi `SsoBackend.dll`, `web.config`, `wwwroot/`, dll).

### Frontend
Pastikan `frontend/.env.production` menunjuk authority yang benar (default sudah benar):
```
VITE_SSO_AUTHORITY=https://my.gcs-gresik.com/api
```
Lalu:
```powershell
cd frontend
npm ci
npm run build
```
Hasil: folder `frontend/dist` (berisi `index.html`, `assets/`, gambar).

Salin `backend/publish` dan `frontend/dist` ke server, misal:
```
C:\inetpub\mygcs\web    <- isi frontend/dist
C:\inetpub\mygcs\api    <- isi backend/publish
```

---

## 3. Database & SQL Login

Aplikasi butuh dua database yang **sudah ada** di SQL Server: `db_mygcs` dan `GCS`.

**Jangan pakai `sa`.** Buat login khusus least-privilege:
```sql
CREATE LOGIN svc_mygcs WITH PASSWORD = 'GantiPasswordKuat!';
-- db_mygcs: read/write (Identity, OpenIddict, audit)
USE db_mygcs; CREATE USER svc_mygcs FOR LOGIN svc_mygcs;
ALTER ROLE db_datareader ADD MEMBER svc_mygcs;
ALTER ROLE db_datawriter ADD MEMBER svc_mygcs;
-- GCS: read (semua) + write terbatas (pengajuan mandiri karyawan)
USE GCS; CREATE USER svc_mygcs FOR LOGIN svc_mygcs;
ALTER ROLE db_datareader ADD MEMBER svc_mygcs;                         -- baca: pegawai, absensi, approval, dll
GRANT INSERT, UPDATE, DELETE ON dbo.web_sdm_spl        TO svc_mygcs;   -- Lembur (SPL)
GRANT INSERT, UPDATE, DELETE ON dbo.web_sdm_surat_ijin TO svc_mygcs;   -- Izin (surat izin)
GRANT INSERT                 ON intranet.web_ttd_elektronik TO svc_mygcs; -- registry QR validasi (cetak izin)
GRANT UPDATE                 ON dbo.MST_PEGAWAI      TO svc_mygcs;      -- Edit profil mandiri (biodata/kontak/alamat + path dokumen)
GRANT INSERT, UPDATE, DELETE ON dbo.MST_ANAK_PEGAWAI TO svc_mygcs;      -- Edit profil: CRUD data anak + path akta

-- GCSSDM: WAJIB. View SDM di GCS (PEGAWAI_SDM, vw_web_sdm_absensi, vw_web_sdm_approval)
-- membaca lintas-database ke GCSSDM. View lintas-database MEMUTUS ownership chaining, jadi
-- login pemanggil harus punya izin SELECT di GCSSDM juga - kalau tidak, koneksi tetap sukses
-- tapi SELECT view gagal => Dashboard/Absensi HTTP 500, dan pengajuan Lembur/Izin gagal
-- (keduanya mencari atasan lewat vw_web_sdm_approval).
USE GCSSDM; CREATE USER svc_mygcs FOR LOGIN svc_mygcs;
ALTER ROLE db_datareader ADD MEMBER svc_mygcs;   -- tabel & view (ABSENSI_DETAIL, CHECK_CLOCK, HARI_LIBUR_TAB, pegawai)

-- db_datareader TIDAK mencakup scalar function. View SDM memanggil 3 function ini,
-- jadi tanpa EXECUTE: Absensi -> 500, dan pengajuan Lembur/Izin gagal (getDireksi
-- dipakai vw_web_sdm_approval untuk mencari atasan penyetuju).
GRANT EXECUTE ON dbo.checkSppdCuti     TO svc_mygcs;
GRANT EXECUTE ON dbo.getCatatanMangkir TO svc_mygcs;
GRANT EXECUTE ON dbo.getDireksi        TO svc_mygcs;
```
> ⚠️ Tabel `web_sdm_spl` & `web_sdm_surat_ijin` punya **trigger legacy** yang bisa **menulis** ke
> tabel/basis data SDM lain (mis. `GCSSDM`). Bila pengajuan gagal karena error permission dari
> trigger, koordinasikan dengan DBA/tim SDM untuk hak tulis tambahan yang dibutuhkan trigger.
>
> **Cek cepat setelah deploy:** `GET /api/health` harus menunjukkan `gcsSdmViewsReadable: true`.
> Kalau `false`, izin di `GCSSDM` di atas belum diberikan.
> ⚠️ Password `sa` & key `Jwt` lama sudah bocor di histori git commit pertama — anggap kompromi,
> jangan dipakai; login khusus di atas menggantikannya. Bila perlu bersihkan histori (`git filter-repo`/BFG).

---

## 4. Sertifikat OIDC (signing + encryption) — WAJIB

Berbeda dari sertifikat TLS domain. Ini untuk menandatangani/mengenkripsi token OpenIddict, harus
**persisten** agar token tetap valid saat App Pool recycle.

Di server (PowerShell Admin):
```powershell
# 1) Buat 2 sertifikat self-signed (5 tahun) di LocalMachine store
$sign = New-SelfSignedCertificate -Subject "CN=MyGCS OIDC Signing" `
  -CertStoreLocation "Cert:\LocalMachine\My" -KeyUsage DigitalSignature `
  -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(5)
$enc  = New-SelfSignedCertificate -Subject "CN=MyGCS OIDC Encryption" `
  -CertStoreLocation "Cert:\LocalMachine\My" -KeyUsage KeyEncipherment,DataEncipherment `
  -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddYears(5)
"Signing    : $($sign.Thumbprint)"
"Encryption : $($enc.Thumbprint)"

# 2) Beri App Pool baca private key kedua sertifikat (jalankan SETELAH App Pool dibuat di Bab 5)
foreach ($c in @($sign, $enc)) {
  $rsa  = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($c)
  $path = "C:\ProgramData\Microsoft\Crypto\Keys\$($rsa.Key.UniqueName)"
  icacls $path /grant "IIS AppPool\mygcs-api-pool:(R)"
}
```
Catat kedua **thumbprint** untuk Bab 7.

---

## 5. Setup IIS — Backend (sub-application `/api`)

1. **Application Pool**: IIS Manager → Application Pools → Add
   - Name: `mygcs-api-pool`
   - **.NET CLR Version: `No Managed Code`** (wajib untuk ASP.NET Core)
2. Izin folder untuk App Pool:
   ```powershell
   icacls "C:\inetpub\mygcs\api" /grant "IIS AppPool\mygcs-api-pool:(OI)(CI)(RX)" /T
   ```
3. (Frontend site dibuat dulu di Bab 6, lalu) klik kanan site `my.gcs-gresik.com` → **Add Application**:
   - Alias: `api`
   - Application pool: `mygcs-api-pool`
   - Physical path: `C:\inetpub\mygcs\api`

---

## 6. Setup IIS — Frontend (SPA di root)

1. IIS Manager → **Add Website**:
   - Site name: `mygcs`
   - Physical path: `C:\inetpub\mygcs\web`
   - Binding: **https**, host `my.gcs-gresik.com`, pilih sertifikat TLS domain.
2. **SPA routing** — buat `C:\inetpub\mygcs\web\web.config` (React Router butuh fallback ke
   `index.html`, dan **jangan** rewrite `/api`):
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <rule name="SPA fallback" stopProcessing="true">
             <match url=".*" />
             <conditions logicalGrouping="MatchAll">
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
               <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
               <add input="{REQUEST_URI}" pattern="^/api(/|$)" negate="true" />
             </conditions>
             <action type="Rewrite" url="/index.html" />
           </rule>
         </rules>
       </rewrite>
     </system.webServer>
   </configuration>
   ```

---

## 7. Environment Variables (backend `web.config`)

Edit `C:\inetpub\mygcs\api\web.config`, tambahkan `<environmentVariables>` di dalam `<aspNetCore>`
(nilai contoh — sesuaikan). File ini ada di server saja, **tidak** masuk git:

```xml
<aspNetCore processPath="dotnet" arguments=".\SsoBackend.dll" hostingModel="inprocess" stdoutLogEnabled="false">
  <environmentVariables>
    <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />

    <!-- Dua koneksi database -->
    <environmentVariable name="ConnectionStrings__DefaultConnection" value="Server=SQLHOST,PORT;Database=db_mygcs;User Id=svc_mygcs;Password=...;TrustServerCertificate=True;Encrypt=False;" />
    <environmentVariable name="ConnectionStrings__GcsConnection"     value="Server=SQLHOST,PORT;Database=GCS;User Id=svc_mygcs;Password=...;TrustServerCertificate=True;Encrypt=False;" />

    <!-- Sertifikat OIDC (thumbprint dari Bab 4) -->
    <environmentVariable name="Oidc__SigningCertificateThumbprint"    value="THUMBPRINT_SIGNING" />
    <environmentVariable name="Oidc__EncryptionCertificateThumbprint" value="THUMBPRINT_ENCRYPTION" />

    <!-- Issuer OIDC HARUS sama dengan VITE_SSO_AUTHORITY frontend -->
    <environmentVariable name="Oidc__Issuer" value="https://my.gcs-gresik.com/api" />

    <!-- Bootstrap Admin IT: email di sini otomatis diberi role Admin saat login. WAJIB berupa
         akun yang BISA login (ada di easy.users, atau sudah ada di tabel Users). Ini admin
         pertama; admin berikutnya dikelola lewat Panel Admin (lihat Bab 7b). -->
    <environmentVariable name="Admin__Emails__0" value="admin.it@gcs-gresik.com" />

    <!-- Folder dokumen karyawan (KTP/KK/ijazah, dll.) di server WCP-GCS. Kolom FILE_* di
         MST_PEGAWAI menyimpan path relatif (uploads/karyawan/xxx.jpg) yang di-resolve ke
         bawah folder ini, lalu di-stream lewat endpoint ber-otorisasi (bukan URL publik).
         Edit-profil mandiri MENULIS ke folder ini → App Pool butuh izin Read + Write.
         Backend co-located di server WCP-GCS → cukup path lokal; kalau remote, pakai UNC. -->
    <environmentVariable name="LegacyFiles__Root" value="D:\web_apps\WCP-GCS" />

    <!-- (Opsional) SMTP untuk reset password nyata; jika kosong, link ditulis ke log -->
    <environmentVariable name="Email__Smtp__Host"     value="smtp.gcs-gresik.com" />
    <environmentVariable name="Email__Smtp__Port"     value="587" />
    <environmentVariable name="Email__Smtp__EnableSsl" value="true" />
    <environmentVariable name="Email__Smtp__User"     value="no-reply@gcs-gresik.com" />
    <environmentVariable name="Email__Smtp__Password" value="..." />
    <environmentVariable name="Email__Smtp__From"     value="no-reply@gcs-gresik.com" />
  </environmentVariables>
</aspNetCore>
```

> **Penting:**
> - Tanpa thumbprint sertifikat, aplikasi sengaja gagal start (fail-fast).
> - `Oidc__Issuer` wajib `https://my.gcs-gresik.com/api` agar cocok dengan authority frontend.
> - **`LegacyFiles__Root`**: identitas App Pool (`IIS AppPool\mygcs-api-pool` atau akun servis
>   yang dipakai) **harus punya izin NTFS Read + Write** ke folder itu (dan ke share bila UNC) —
>   Read untuk menampilkan dokumen, Write karena edit-profil mandiri mengunggah/mengganti
>   dokumen. Tanpa izin, dokumen gagal dibuka/diunggah walau health OK. Set: klik-kanan folder →
>   *Properties* → *Security* → tambah user App Pool dengan hak *Modify* (mencakup Read & Write).
> - Redirect URI SPA (`https://my.gcs-gresik.com/callback`) & post-logout (`.../`) **sudah**
>   terdaftar otomatis oleh seeder (dari `appsettings.json` → `Oidc:Spa`). Bila domain berbeda,
>   ubah `appsettings.json` sebelum publish.

Setelah semua diset, restart App Pool: IIS Manager → `mygcs-api-pool` → **Recycle** (atau
`net stop was /y ; net start w3svc`).

---

## 7b. Panel Admin IT (manajemen akun & role)

Panel Admin (`/admin`) memerlukan akun ber-role **Admin**. Tidak ada infrastruktur tambahan —
role `Admin` sudah otomatis dibuat seeder (`OidcSeeder`) di `db_mygcs`. Yang perlu dilakukan
hanya **menetapkan admin pertama**, lalu selanjutnya kelola dari UI.

**Langkah:**

1. **Deploy kode terbaru** (backend **dan** frontend). Ini WAJIB:
   - Backend membawa endpoint `/admin/*` **dan** perbaikan penting: klaim `role` kini
     dimasukkan ke **ID token** (sebelumnya hanya di access token, sehingga SPA tak pernah
     mengenali admin). Tanpa build ini, Panel Admin selalu "Akses ditolak" walau role sudah ada.
   - Frontend membawa route `/admin`, `/admin/users`, dll. Tanpa build ini, `/admin` dilempar
     ke `/dashboard`.
2. **Set `Admin__Emails__0`** (Bab 7) ke email akun admin IT yang **benar-benar bisa login**
   (karyawan yang ada di `easy.users`, atau akun yang sudah ada di tabel `Users`). Recycle App Pool.
3. **Login** dengan akun itu → otomatis diberi role Admin → menu **Panel Admin** muncul.
4. **Admin berikutnya** tidak perlu lewat config: buka **Panel Admin → Manajemen Pengguna & Role**,
   lalu **toggle "Admin IT"** pada akun yang diinginkan.

> **Berlaku setelah login ulang.** Role dibawa di token saat diterbitkan. Menambah/mencabut role
> (via config atau toggle) baru terasa saat pengguna itu **login ulang** atau token-nya di-refresh.

> **Akun `admin.it@gcs-gresik.com` (Dev) TIDAK dibuat di produksi.** Seeder pembuat akun itu
> (`DevAdminSeeder`) hanya jalan di Development. Jangan mengandalkannya di server — pakai akun
> nyata via `Admin__Emails__0`.

> ⚠️ **Catatan lingkungan.** Bila Dev dan Produksi memakai **`db_mygcs` yang sama**, maka tabel
> `Users`/`Roles`/`AuditLogs` **dipakai bersama** — grant admin & akun uji dari lokal ikut muncul
> di produksi (dan sebaliknya). Untuk pemisahan bersih, gunakan database `db_mygcs` terpisah untuk
> Produksi. Tidak wajib, tapi disarankan sebelum go-live.

---

## 8. Verifikasi

Urutan cek:

1. **Backend hidup** → buka `https://my.gcs-gresik.com/api/`
   → muncul halaman **logo + "Backend berhasil di-deploy ke IIS"**.
2. **Health** → `https://my.gcs-gresik.com/api/health` — **ketiga flag harus `true`**:
   ```json
   {
     "status": "OK - Backend berjalan",
     "databaseConnected": true,        // db_mygcs (Identity/OpenIddict/audit)
     "gcsDatabaseConnected": true,     // GCS (data SDM)
     "gcsSdmViewsReadable": true       // view SDM lintas-database ke GCSSDM
   }
   ```
   Kalau `status` = `DEGRADED`, lihat flag mana yang `false`:
   - `gcsDatabaseConnected:false` → `ConnectionStrings__GcsConnection` salah.
   - **`gcsSdmViewsReadable:false`** → login SQL belum punya izin **SELECT di `GCSSDM`** (Bab 3).
     Gejalanya: Dashboard & Absensi HTTP 500, pengajuan Lembur/Izin gagal.
3. **Discovery OIDC** → `https://my.gcs-gresik.com/api/.well-known/openid-configuration`
   → cek `"issuer": "https://my.gcs-gresik.com/api"` (harus **sama** dengan authority frontend).
4. **Frontend** → buka `https://my.gcs-gresik.com/`
   → diarahkan ke halaman login → login dengan kredensial karyawan (data lama `easy.users`).
   → masuk dashboard; cek modul **My Personal → Profil / Absensi / Lembur / Izin** (baca/tulis ke GCS;
   fitur cetak Izin menghasilkan QR di sisi browser).
5. **Panel Admin** → login dengan akun `Admin__Emails__0` → tombol **Panel Admin** muncul di kanan
   atas → buka `https://my.gcs-gresik.com/admin` → statistik tampil dan **Manajemen Pengguna & Role**
   bisa toggle Admin. Kalau "Akses ditolak" padahal akun sudah di `Admin__Emails`: pastikan **backend
   build terbaru** ter-deploy (perbaikan role→ID token) dan Anda **login ulang**. Kalau `/admin`
   melempar ke `/dashboard`: **frontend build terbaru** belum ter-deploy.

---

## 8b. Update / Redeploy (aplikasi sudah berjalan)

File `.dll` **terkunci** oleh worker process IIS (`w3wp.exe`) selama App Pool hidup — muncul error
*"Folder In Use / file is open in another program"*. Aplikasi **harus dihentikan dulu**.

### Cara 0 — Script otomatis `deploy.ps1` (RECOMMENDED)
Mengotomatiskan seluruh Cara A (build → app_offline → hapus → copy → online lagi), dan
**selalu mempertahankan `web.config`** di server.

```powershell
# sesuaikan path share sekali saja di bagian param() deploy.ps1
.\deploy.ps1 -DryRun     # lihat dulu apa yang akan dilakukan (aman, tidak mengubah apa pun)
.\deploy.ps1             # build + deploy backend & frontend
.\deploy.ps1 -BackendOnly
.\deploy.ps1 -SkipBuild  # deploy artifact yang sudah ada
```

### Cara A — `app_offline.htm` manual (cukup akses file share)
Tidak perlu IIS Manager / RDP:

1. Copy **`app_offline.htm`** ke folder root backend di server (mis. `\\server\web_apps$\backend-mygcs\`).
   → ASP.NET Core Module langsung mematikan aplikasi **dan melepas semua kunci file** (± 1-2 detik),
   pengunjung melihat halaman pemeliharaan.
2. Hapus isi folder **KECUALI `web.config`** dan **`app_offline.htm`**.
   > ⚠️ `web.config` di server berisi env var/rahasia Anda — **jangan ditimpa** oleh yang dari publish.
3. Copy isi `sso-backend-publish.zip` yang baru (semua **kecuali `web.config`**).
4. **Hapus `app_offline.htm`** → aplikasi otomatis start lagi.

### Cara B — Stop App Pool via IIS Manager (butuh RDP/IIS Manager)
1. Buka **IIS Manager** di server.
2. Panel kiri → **Application Pools**.
3. Klik `mygcs-api-pool` → panel kanan **Stop**.
4. Ganti file (kecuali `web.config`) → panel kanan **Start**.

### Cara C — Stop App Pool via command line (di server, sebagai Administrator)
```powershell
# PowerShell
Import-Module WebAdministration
Stop-WebAppPool  -Name "mygcs-api-pool"
# ...ganti file (kecuali web.config)...
Start-WebAppPool -Name "mygcs-api-pool"
```
```cmd
:: atau appcmd
%windir%\system32\inetsrv\appcmd stop  apppool /apppool.name:"mygcs-api-pool"
%windir%\system32\inetsrv\appcmd start apppool /apppool.name:"mygcs-api-pool"
```

> **Frontend** tidak pernah terkunci (file statis) — cukup timpa isi folder web-nya kapan saja.

---

## 9. Troubleshooting

| Gejala | Sebab & solusi |
|---|---|
| **HTTP 500.19 / 500.31** | Hosting Bundle belum terpasang / rusak. Install ulang + restart IIS. |
| **HTTP 500.30 / 502.5** | App gagal start. Aktifkan log (`stdoutLogEnabled="true"` + buat folder `logs\` + izin Write ke App Pool), reproduksi, baca `logs\stdout_*.log` atau **Event Viewer → Application**. Sering: thumbprint sertifikat salah, koneksi DB gagal, atau App Pool tak bisa baca private key sertifikat (ulangi Bab 4 langkah 2). |
| **Login mentok / redirect ke `/api/login`** | Pastikan memakai build terbaru (perbaikan redirect root `/login` sudah ada). Publish ulang bila artifact lama. |
| **`oidc-client` error "issuer mismatch"** | `Oidc__Issuer` ≠ `VITE_SSO_AUTHORITY`. Samakan keduanya ke `https://my.gcs-gresik.com/api`. |
| **Buka `/dashboard`/`/login` langsung → 404** | `web.config` SPA (Bab 6) belum ada atau URL Rewrite Module belum terpasang. |
| **Endpoint API mis. `/api/account/login` → 404** (padahal `/api/connect/authorize` jalan) | Route controller **tidak boleh** ber-prefix `api/`. Sub-app IIS `/api` sudah melepas `/api` via PathBase, jadi controller harus root-relative (`[Route("account")]`, bukan `[Route("api/account")]`) — mengikuti pola OpenIddict `connect/*`. Sudah diperbaiki di kode; kalau menambah controller baru, ikuti konvensi ini. |
| **Absensi/Lembur/Izin "Data pegawai tidak ditemukan"** | Akun Identity tidak punya NIK yang cocok di `MST_PEGAWAI` (GCS), atau `GcsConnection` salah. Cek env var `ConnectionStrings__GcsConnection`. (Bug lama di mana controller memakai `[Authorize]` polos alih-alih skema Bearer sudah diperbaiki di kode.) |
| **Reset password tak terkirim email** | `Email__Smtp__Host` belum diisi → link hanya ditulis ke log. Isi konfig SMTP. |
| **Dokumen karyawan "Dokumen belum tersedia" padahal ada** | (1) `LegacyFiles__Root` belum diset / salah folder. (2) Identitas App Pool tak punya izin **NTFS Read** ke folder/ share dokumen (Bab 7). (3) Path di kolom `FILE_*` tak cocok dengan isi folder. |
| **Edit profil gagal simpan / unggah dokumen error** | Unggah dokumen butuh izin **NTFS Write** App Pool ke `LegacyFiles__Root` (Bab 7). Simpan biodata butuh **UPDATE** di `dbo.MST_PEGAWAI`; tambah/hapus anak butuh **INSERT/UPDATE/DELETE** di `dbo.MST_ANAK_PEGAWAI` (GCS) untuk login `svc_mygcs` — bukan hanya `db_datareader`. |
| **Panel Admin "Akses ditolak" padahal sudah di `Admin__Emails`** | Backend build lama (klaim `role` belum masuk ID token). Deploy backend terbaru, lalu **login ulang** agar token baru membawa role. |
| **Buka `/admin` malah ke `/dashboard`** | Frontend build lama tanpa route `/admin`. Deploy frontend terbaru (`npm run build` → salin). |
| **`databaseConnected:false`** | Server IIS tak bisa menjangkau SQL / kredensial `svc_mygcs` salah. |

**Aktifkan log error** (sementara): set `stdoutLogEnabled="true"`, buat folder `C:\inetpub\mygcs\api\logs`,
`icacls ... /grant "IIS AppPool\mygcs-api-pool:(OI)(CI)(M)"`, reproduksi, lalu **kembalikan ke `false`**.

---

## 10. Ringkasan Checklist

- [ ] Hosting Bundle .NET 10 + URL Rewrite Module terpasang; IIS restart.
- [ ] Sertifikat TLS domain terpasang (binding https).
- [ ] `dotnet publish` (backend) + `npm run build` (frontend) → salin ke server.
- [ ] SQL login `svc_mygcs` (least-privilege) di `db_mygcs` + `GCS`.
- [ ] 2 sertifikat OIDC dibuat; App Pool diberi akses private key; thumbprint dicatat.
- [ ] App Pool `mygcs-api-pool` (No Managed Code) + izin folder.
- [ ] Site frontend (root, https) + `web.config` SPA fallback.
- [ ] Sub-application `api` menunjuk ke folder publish backend.
- [ ] `web.config` backend: `ASPNETCORE_ENVIRONMENT`, 2 connection string, 2 thumbprint, `Oidc__Issuer`, `LegacyFiles__Root`, (opsional Admin/SMTP).
- [ ] Folder dokumen (`LegacyFiles__Root`) diberi izin **NTFS Read + Write** ke App Pool `mygcs-api-pool` (Write untuk edit-profil unggah dokumen).
- [ ] `svc_mygcs` diberi **UPDATE** pada `dbo.MST_PEGAWAI` dan **INSERT/UPDATE/DELETE** pada `dbo.MST_ANAK_PEGAWAI` (GCS) untuk edit profil + CRUD anak.
- [ ] **Panel Admin**: `Admin__Emails__0` diisi email admin IT yang **bisa login**; login sekali untuk aktivasi role, lalu kelola admin lain lewat toggle (Bab 7b).
- [ ] Recycle App Pool.
- [ ] Verifikasi: `/api/` → halaman logo, `/api/health` → db true, discovery issuer benar, login end-to-end jalan.

---

## Lampiran — Ringkasan Variabel Konfigurasi

| Key (env var IIS) | Contoh | Wajib |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | ✅ |
| `ConnectionStrings__DefaultConnection` | `...Database=db_mygcs...` | ✅ |
| `ConnectionStrings__GcsConnection` | `...Database=GCS...` | ✅ |
| `Oidc__SigningCertificateThumbprint` | `A1B2...` | ✅ |
| `Oidc__EncryptionCertificateThumbprint` | `C3D4...` | ✅ |
| `Oidc__Issuer` | `https://my.gcs-gresik.com/api` | ✅ |
| `LegacyFiles__Root` | `D:\web_apps\WCP-GCS` (folder dokumen karyawan; App Pool butuh izin Read) | ✅ |
| `Admin__Emails__0` | `admin.it@gcs-gresik.com` | opsional |
| `Email__Smtp__Host` (+Port/User/Password/From/EnableSsl) | `smtp...` | opsional |

Detail arsitektur & fitur ada di [backend/IMPLEMENTASI-IDENTITY-OIDC.md](backend/IMPLEMENTASI-IDENTITY-OIDC.md).
