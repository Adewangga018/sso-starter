# Implementasi SSO Hub — ASP.NET Core Identity + OpenIddict (Opsi A)

Dokumen ini merekam perubahan backend dari autentikasi **JWT custom** menjadi
**OpenID Connect / OAuth 2.0** yang benar sesuai SRS MyGCS v2.1 (Bab 2.9), dengan
**ASP.NET Core Identity** sebagai user store.

Status: **Fase 1 (fondasi backend) SELESAI & terverifikasi.** Fase 2–3 (frontend &
hardening produksi) belum.

---

## 1. Apa yang berubah

| Sebelum | Sesudah |
|---|---|
| `AuthController` + `TokenService` menerbitkan JWT HMAC (symmetric key di appsettings) | **OpenIddict** menerbitkan token OAuth2/OIDC (Authorization Code + PKCE + refresh), tanda tangan **asimetris** |
| User dibaca langsung dari `easy.users` (GCS) tiap login | **ASP.NET Core Identity** jadi user store (tabel `Users`, `Roles`, dst); GCS hanya sumber migrasi |
| `sub` = `easy.users.Id` | `sub` = ID Identity; klaim `gcs_uid` + `nik` menjaga tautan ke data pegawai GCS |
| Tidak ada SSO lintas aplikasi | Endpoint OIDC standar: modul mana pun (termasuk non-.NET) bisa jadi Relying Party |

### File baru / berubah
- `Models/ApplicationUser.cs` — user Identity + field `FullName`, `Nik`, `GcsUserId`, `IsActive`.
- `Data/ApplicationDbContext.cs` — kini `IdentityDbContext<ApplicationUser>` + OpenIddict. Tabel
  Identity diberi nama generik (`Users`, `Roles`, `UserRoles`, `UserClaims`, `RoleClaims`,
  `UserLogins`, `UserTokens`) via `ToTable(...)`; tabel OpenIddict tetap.
- `Controllers/AuthorizationController.cs` — endpoint OIDC: `/connect/authorize`, `/token`, `/userinfo`, `/logout`.
- `Controllers/AccountController.cs` — login interaktif (`/api/account/login`) + **lazy provisioning** dari GCS.
- `Data/OidcSeeder.cs` — seed role, scope `mygcs.api`, dan client `mygcs-spa` (idempotent).
- `Services/CurrentUserContext.cs` — resolve pegawai via klaim `gcs_uid`/`nik` (bukan lagi `sub`).
- `Program.cs` — Identity + OpenIddict server + validation.
- **Dihapus**: `Services/TokenService.cs`, `Controllers/AuthController.cs`.
- Migrasi baru: `AddIdentityUserProfileFields` (sudah diterapkan ke DB).

### Migrasi massal user (semua 333 karyawan)
Seluruh `easy.users` (333) telah **di-import sekaligus** menjadi akun Identity valid di `dbo.users`
(dipetakan: name→FullName, email→Email/UserName, nik→Nik, status→IsActive, id→GcsUserId, semua
dapat role `Karyawan`). Password bcrypt lama disimpan di `PasswordHash`, dan
[`BCryptAwarePasswordHasher`](Services/BCryptAwarePasswordHasher.cs) memverifikasinya saat login
lalu **otomatis meng-upgrade ke PBKDF2** (terverifikasi end-to-end: login password lama → 200,
hash berubah ke `AQAAAA…`). Kolom gaya Laravel yang sempat ditambahkan ke `dbo.users` sudah
dihapus → struktur kembali murni Identity. `easy.users` kini **redundan** (boleh dihapus/disimpan
sebagai cadangan). Endpoint `ProvisionFromLegacyAsync` tetap ada sebagai fallback.

### Cara kerja login (Opsi A)
1. Karyawan login pertama kali → `AccountController` verifikasi ke `easy.users` (BCrypt).
2. Jika cocok → dibuatkan akun Identity dengan password sama (di-hash ulang PBKDF2). **Migrasi otomatis, password lama tetap dipakai.**
3. Login berikutnya divalidasi sepenuhnya oleh Identity (tidak menyentuh GCS lagi).
4. `/connect/authorize` menerbitkan token OIDC berisi klaim `sub`, `name`, `email`, `nik`, `gcs_uid`, `role`.

---

## 2. Yang sudah diverifikasi (lokal)

- ✅ Build 0 error; migrasi diterapkan ke `db_mygcs`.
- ✅ Discovery `/.well-known/openid-configuration` lengkap (authorize/token/userinfo/logout, scope, PKCE S256).
- ✅ Seeder membuat 3 role (`Admin`, `AdminModul`, `Karyawan`), scope `mygcs.api`, client `mygcs-spa`.
- ✅ `/api/account/login` menolak kredensial salah dengan 401 sopan (pipeline lazy-provisioning jalan).
- ✅ API modul (`/api/dashboard`, `/api/personal`) menolak request tanpa token (401).
- ✅ `/health` tetap berfungsi.

> Alur browser penuh (redirect authorize → login → callback → token) belum diuji end-to-end
> karena butuh frontend `/login` + `oidc-client-ts` (Fase 2).

---

## 3. Fase 2 — Integrasi Frontend (SELESAI)

Frontend React kini memakai **Authorization Code + PKCE** via `oidc-client-ts`.

### File frontend
- `vite.config.js` — proxy `/api`, `/connect`, `/.well-known` → backend `:5283` dengan
  `changeOrigin:false` (agar backend melihat Host `:5173`, satu origin dengan SPA).
- `src/lib/auth.js` — `UserManager` (client `mygcs-spa`, scope `openid profile email roles mygcs.api offline_access`).
- `src/lib/api.js` — panggil API same-origin + `Authorization: Bearer` dari token OIDC.
- `src/context/AuthContext.jsx` — state auth berbasis `oidc-client-ts` (getUser, events, refresh).
- `src/components/RequireAuth.jsx` — `signinRedirect()` bila belum login.
- `src/pages/LoginPage.jsx` — `POST /api/account/login` (set cookie) → lanjut ke `ReturnUrl` (dicek same-origin).
- `src/pages/CallbackPage.jsx` — `signinRedirectCallback()` menukar code → token.
- `.env.production` — `VITE_SSO_AUTHORITY=https://my.gcs-gresik.com/api`.

### Backend penyesuaian
- `Program.cs` — `SetIssuer` dari `Oidc:Issuer` (dev: `http://localhost:5173/`), dan
  `UseHttpsRedirection` hanya di produksi.
- `appsettings.Development.json` — `Oidc:Issuer`.

### Terverifikasi
- ✅ Discovery via proxy `:5173` konsisten (issuer + semua endpoint = `localhost:5173`).
- ✅ `/connect/authorize` tanpa cookie → 302 ke `/login?ReturnUrl=/connect/authorize?...` (PKCE diterima).
- ✅ Frontend `vite build` sukses; SPA & route `/login`, `/callback` tersaji.

### Cara uji di browser (dev)
1. Jalankan backend: `cd backend && dotnet run` (profil http, `http://localhost:5283`).
2. Jalankan frontend: `cd frontend && npm run dev` (`http://localhost:5173`).
3. Buka **`http://localhost:5173`** → otomatis diarahkan ke halaman login.
4. Login dengan kredensial karyawan yang ada di `easy.users` (GCS). Login pertama akan
   **otomatis membuat akun Identity** (lazy provisioning), lalu masuk ke dashboard.

> Alur browser penuh (login → token → dashboard) perlu kredensial GCS asli untuk diuji tuntas;
> wiring backend + frontend sudah diverifikasi dengan curl/PKCE.

---

## 4. Fase 3 — Hardening Produksi (SEBAGIAN SELESAI)

### Sudah dikerjakan (kode)
1. **Sertifikat OpenIddict.** `Program.cs` kini bercabang:
   - Dev → `AddDevelopment*Certificate()` (ephemeral, cukup untuk lokal).
   - Prod → `AddSigningCertificate(thumbprint)` + `AddEncryptionCertificate(thumbprint)` dari
     Windows cert store, dibaca dari `Oidc:SigningCertificateThumbprint` &
     `Oidc:EncryptionCertificateThumbprint`. Token kini bertahan saat App Pool recycle.
2. **Kredensial keluar dari source.** Connection string dihapus dari [appsettings.json](appsettings.json)
   (diganti placeholder kosong). Dev membacanya dari **`dotnet user-secrets`** (sudah di-set,
   `databaseConnected: true` terverifikasi). Prod dari **environment variable IIS**.
3. **HTTPS**: prod mewajibkan HTTPS; dev dilonggarkan via `DisableTransportSecurityRequirement()`.

### Wajib dilakukan operator saat deploy (lihat DEPLOY-IIS.md)
1. **Generate 2 sertifikat** (signing + encryption) di server + beri App Pool akses private key +
   set thumbprint sebagai env var. (Langkah PowerShell ada di DEPLOY-IIS.md §Sertifikat OIDC.)
2. **Set connection string sebagai env var IIS** + `ASPNETCORE_ENVIRONMENT=Production`. Aplikasi
   memakai **dua** koneksi: `ConnectionStrings__DefaultConnection` = **db_mygcs** (Identity,
   OpenIddict, audit) dan `ConnectionStrings__GcsConnection` = **GCS** (data operasional SDM live:
   absensi, lembur/SPL, approval, serta master pegawai `MST_PEGAWAI`/`easy.users`). Objek SDM
   (view & tabel bertrigger) tidak dapat dipindah ke db_mygcs karena bersifat live/transaksional.
3. ⚠️ **Rotasi kredensial yang sudah bocor di git.** Password SA & key `Jwt` lama ada di histori
   commit pertama — anggap kompromi. **Rekomendasi kuat**: buat **SQL login khusus MyGCS**
   (least-privilege: `db_mygcs` read/write) menggantikan `sa`, karena merotasi
   `sa` bisa memutus sistem lain yang memakai server DB yang sama. Bila perlu, bersihkan histori
   git dengan `git filter-repo`/BFG.
4. ⚠️ **Artifact lama mengandung password.** Folder `publish/` & `sso-api-deploy.zip` dibuat sebelum
   perubahan ini dan masih memuat password di `appsettings.json`. **Publish ulang** sebelum deploy.

## 5. Fase 4 — MFA, Reset Password, Audit Trail (SELESAI backend + frontend)

### MFA (KF-A-03) — authenticator app / TOTP
- Backend: `AccountController` login **2 langkah** (`/api/account/login` → `login-2fa`),
  setup/enable/disable (`/api/account/2fa/*`) + kode pemulihan.
- Frontend: langkah kode di [LoginPage](../frontend/src/pages/LoginPage.jsx) + halaman
  [SecurityPage](../frontend/src/pages/SecurityPage.jsx) (`/security`) untuk aktif/nonaktif.
- Varian **OTP email/SMS** belum (menunggu gateway PT GCS) — TOTP tidak butuh pengiriman.

### Reset password mandiri
- Backend: `/api/account/forgot-password` (netral, anti-enumerasi) + `/reset-password` +
  `/change-password`. Link reset dikirim via `IEmailSender`.
- **Pengiriman email**: `Program.cs` memilih otomatis — **`SmtpEmailSender`** bila
  `Email:Smtp:Host` diisi (produksi), atau **`LoggingEmailSender`** (link ke log) bila kosong (dev).
  Config SMTP: `Email:Smtp:{Host,Port,EnableSsl,User,Password,From}`.
- Frontend: halaman `/forgot-password` & `/reset-password`.
- Catatan: user yang **belum pernah login** belum ada di Identity (lazy provisioning), jadi
  forgot-password baru berlaku setelah login pertama.

### Audit trail (Fitur D)
- Tabel **`AuditLogs`** (append-only) + `IAuditLogger` mencatat: login sukses/gagal/lockout,
  2FA, logout, provisioning, reset/ganti password (timestamp UTC, email, IP, user-agent).
- **Immutability keras (KF-D-03)**: trigger DB `TR_AuditLogs_AppendOnly` **memblokir UPDATE & DELETE**
  (terverifikasi). Enkripsi at-rest (SQL Server TDE) masih level infrastruktur.
- **Dashboard monitoring (KF-D-04)**: `GET /api/audit` (role `Admin`) + halaman admin
  [/admin/audit](../frontend/src/pages/AdminAuditPage.jsx) dengan filter + highlight anomali
  (login gagal/lockout). Link "Audit" muncul di TopBar untuk admin.
- **Bootstrap Admin**: email di config `Admin:Emails` otomatis diberi role `Admin` saat login
  (sementara, sebelum ada UI manajemen user).
- Belum: **notifikasi/alert aktif** ke admin (KF-D-05) saat anomali — sekarang hanya
  ditandai visual di dashboard.

### Terverifikasi
- ✅ Login gagal → 401 + baris audit; `/api/audit` & `/api/account/2fa/*` → 401 tanpa token.
- ✅ forgot-password → 200 netral (lewat proxy). Frontend `vite build` sukses; route baru tersaji.
- Uji tuntas (aktifkan 2FA, terima link reset dari log, query audit sbg admin) perlu login user GCS asli.

---

## 5. Fase 4 — Rapikan Arsitektur (lanjutan)

`DashboardController` & `PersonalController` saat ini hidup di dalam SSO Hub, padahal secara SRS
itu logika **modul My Personal**. Idealnya dipindah ke aplikasi modul terpisah yang jadi Relying
Party OIDC terhadap Hub. Hub cukup berisi: autentikasi, token, manajemen user/role/client, audit.

---

## Ringkasan perintah dev

```bash
# jalankan (dev, HTTP)
dotnet run                      # http://localhost:5283

# discovery OIDC
curl http://localhost:5283/.well-known/openid-configuration

# tambah migrasi baru
dotnet ef migrations add <Nama> --context ApplicationDbContext
dotnet ef database update --context ApplicationDbContext
```
