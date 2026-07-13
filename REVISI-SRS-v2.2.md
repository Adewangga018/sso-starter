# Usulan Revisi SRS MyGCS: v2.1 → v2.2

**Tujuan dokumen:** menyelaraskan SRS dengan arsitektur yang benar-benar diimplementasikan pada
starter project, serta menghilangkan pertentangan internal antar-pasal (terutama soal **sumber
kredensial**, **algoritma hashing**, dan **dukungan SAML**).

Dokumen ini berisi usulan teks pengganti per pasal (format **Teks lama → Usulan → Alasan**) yang
dapat langsung disalin ke SRS v2.2.

---

## 0. Keputusan prinsip yang ditetapkan (dasar seluruh revisi)

> **MyGCS Fase 1 menggunakan ASP.NET Core Identity sebagai user store & otoritas kredensial
> lokal** (di atas Microsoft SQL Server / `db_mygcs`). Data awal karyawan diperoleh dari basis
> data SDM/kepegawaian eksisting melalui migrasi/sinkronisasi. **Integrasi langsung Active
> Directory/LDAP dan dukungan SAML 2.0 TIDAK dipakai pada Fase 1** dan menjadi opsi (federasi /
> adapter) untuk fase lanjut. Protokol SSO yang aktif: **OAuth 2.0 / OpenID Connect via OpenIddict**.

Seluruh usulan di bawah menurunkan prinsip ini agar tidak ada lagi pasal yang saling
bertentangan.

---

## 1. Inkonsistensi sumber identitas: AD/LDAP vs ASP.NET Core Identity

SRS v2.1 di beberapa pasal menyatakan kredensial divalidasi ke **AD/LDAP**, namun di pasal lain
menyatakan **ASP.NET Core Identity** menyimpan & meng-hash password di SQL Server. Keduanya
saling meniadakan (AD memegang password ⇒ Hub tidak menyimpan hash; atau Identity menyimpan hash
lokal ⇒ tidak validasi ke AD). Usulan: seragamkan ke ASP.NET Core Identity.

### 1.1 Bab 2.1 — Perspektif Aplikasi
**Teks lama:**
> "…SSO Hub bersifat independen namun terhubung erat dengan direktori kepegawaian sebagai sumber
> data identitas utama, serta menyediakan protokol standar industri (SAML 2.0, OAuth 2.0, OpenID
> Connect)…"

**Usulan:**
> "…SSO Hub bersifat independen dan bertindak sebagai **Identity Provider dengan user store
> lokalnya sendiri** (ASP.NET Core Identity di atas Microsoft SQL Server). Data awal identitas
> karyawan diperoleh dari sistem SDM/kepegawaian eksisting melalui migrasi/sinkronisasi. SSO Hub
> menyediakan protokol standar industri **OAuth 2.0 dan OpenID Connect (OIDC)** melalui OpenIddict
> agar modul internal maupun aplikasi pihak ketiga dapat terintegrasi; dukungan SAML 2.0 disediakan
> **opsional** melalui adapter tambahan (lihat Bab 2.5 & 2.9)."

**Alasan:** menghapus klaim "AD/LDAP sebagai sumber identitas utama" yang bertentangan dengan
Bab 2.5/2.9, dan menurunkan SAML jadi opsional.

### 1.2 Bab 2.4 — Lingkungan Operasi
**Teks lama:**
> "Terintegrasi dengan direktori kepegawaian berbasis Active Directory/LDAP yang sudah digunakan
> di lingkungan jaringan PT GCS sebagai sumber data identitas bersama seluruh modul."

**Usulan:**
> "Kredensial dan identitas pengguna dikelola secara lokal oleh SSO Hub melalui **ASP.NET Core
> Identity** di atas Microsoft SQL Server. Data awal karyawan (nama, email, NIK, status) diperoleh
> dari **basis data SDM/kepegawaian eksisting** PT GCS melalui migrasi/sinkronisasi. Integrasi
> langsung Active Directory/LDAP tidak digunakan pada Fase 1 dan dapat dievaluasi sebagai opsi
> federasi pada fase lanjut."

**Alasan:** menyesuaikan sumber data ke sistem SDM (bukan AD/LDAP) sesuai implementasi.

### 1.3 KF-A-02 (Bab 4.1.3) — Kebutuhan Fungsional
**Teks lama:**
> "Sistem harus melakukan validasi kredensial pengguna terhadap direktori Active Directory/LDAP."

**Usulan:**
> "Sistem harus melakukan validasi kredensial pengguna terhadap **user store ASP.NET Core Identity
> (Microsoft SQL Server)**. Kata sandi disimpan dalam bentuk hash (PBKDF2; hash legacy bcrypt hasil
> migrasi didukung dan di-upgrade otomatis ke PBKDF2 pada login berhasil)."

**Alasan:** ini pertentangan paling langsung; disamakan dengan Bab 2.5/2.9.

### 1.4 Flow of Event 4.1.4 (langkah 4)
**Teks lama:** "Sistem MyGCS memvalidasi kredensial terhadap Active Directory/LDAP."
**Usulan:** "Sistem MyGCS memvalidasi kredensial terhadap **user store internal (ASP.NET Core Identity)**."

### 1.5 Flow of Event 4.2.4 (langkah 3) — Provisioning
**Teks lama:** "Sistem mengirimkan permintaan pembuatan akun ke Active Directory/LDAP."
**Usulan:** "Sistem membuat akun pengguna pada **user store ASP.NET Core Identity (SQL Server)**,
termasuk penetapan role/hak akses awal."

**Alasan:** akun dibuat di store lokal, bukan di AD.

### 1.6 Bab 7.3 — Antarmuka Komunikasi
**Teks lama:** "Komunikasi dengan direktori kepegawaian menggunakan protokol LDAP/LDAPS."
**Usulan:**
> "Sinkronisasi data karyawan dari sistem SDM dilakukan melalui **koneksi basis data (Entity
> Framework Core / SQL) atau API internal**. Komunikasi LDAP/LDAPS ke Active Directory tidak
> digunakan pada Fase 1 (opsi federasi fase lanjut)."

---

## 2. Inkonsistensi algoritma hashing: bcrypt vs PBKDF2/Argon2

### 2.1 Bab 8.2 — Kebutuhan Keamanan Data
**Teks lama:**
> "Kata sandi pengguna disimpan dalam bentuk hash menggunakan algoritma yang aman (bcrypt/Argon2)
> dan tidak pernah disimpan dalam bentuk teks biasa."

**Usulan:**
> "Kata sandi pengguna disimpan dalam bentuk hash menggunakan **ASP.NET Core Identity Password
> Hasher (PBKDF2 default; Argon2 sesuai konfigurasi)** dan tidak pernah disimpan dalam bentuk teks
> biasa. Hash **legacy bcrypt** hasil migrasi dari sistem lama didukung untuk masa transisi dan
> **di-upgrade otomatis ke PBKDF2** saat login berhasil."

**Alasan:** ASP.NET Core Identity secara bawaan memakai PBKDF2 (bukan bcrypt); teks lama
bertentangan dengan Bab 2.5. Klausul baru sekaligus mendokumentasikan penanganan bcrypt legacy
yang benar-benar diterapkan.

### 2.2 Bab 2.5 — Batasan (penyempurnaan, bukan koreksi)
**Tambahan kalimat** (Bab 2.5 sudah benar menyebut PBKDF2/Argon2 via Identity Password Hasher):
> "Akun legacy yang dimigrasikan dari sistem lama (berformat bcrypt) diverifikasi melalui hasher
> kompatibel dan di-hash ulang ke format standar (PBKDF2) pada login berhasil pertama."

---

## 3. Inkonsistensi dukungan SAML 2.0

Bab awal mengiklankan SAML sebagai kapabilitas inti, sementara Bab 2.5 & 2.9 mengakui OpenIddict
tidak mendukung SAML. Usulan: turunkan SAML jadi opsional di semua pasal.

### 3.1 Bab 8.4 — Atribut Kualitas (Interoperabilitas)
**Teks lama:**
> "Mendukung standar protokol terbuka (SAML, OAuth2, OIDC) agar kompatibel dengan modul internal
> maupun aplikasi eksternal di masa mendatang."

**Usulan:**
> "Mendukung standar protokol terbuka **OAuth 2.0 dan OpenID Connect (OIDC)** melalui OpenIddict.
> Dukungan **SAML 2.0 bersifat opsional**, hanya bila diperlukan modul/aplikasi legacy, melalui
> komponen adapter tambahan di luar OpenIddict (lihat Bab 2.5 & 2.9)."

### 3.2 KF-A-04 (Bab 4.1.3)
**Teks lama:**
> "Sistem harus menerbitkan token/assertion (SAML atau JWT) yang valid dan memiliki masa berlaku
> (expiry) tertentu setelah otentikasi berhasil, dapat digunakan lintas modul."

**Usulan:**
> "Sistem harus menerbitkan **token OAuth 2.0/OpenID Connect (JWT: access token & ID token)** yang
> valid dan memiliki masa berlaku (expiry) tertentu setelah otentikasi berhasil, dapat digunakan
> lintas modul. Penerbitan **assertion SAML 2.0 bersifat opsional** dan memerlukan adapter tambahan."

**Alasan:** menyelaraskan dengan catatan implementasi yang sudah ada di Bab 2.9/4.1.3.

---

## 4. Diagram & glosarium yang perlu diperbarui

Tidak dapat direvisi lewat teks saja; perlu digambar/disunting ulang:

- **Gambar 2.1 (Use Case Diagram)** — hapus/ubah aktor "Direktori Active Directory/LDAP" menjadi
  "Sistem SDM (sumber data awal)"; tandai AD/LDAP sebagai opsional fase lanjut bila tetap dicantumkan.
- **Gambar 4.1 (Sequence Diagram Login)** — ganti langkah "Validasi kredensial (LDAP)" menjadi
  "Validasi kredensial (ASP.NET Core Identity)"; label "Redirect ke IdP (SAML/OIDC)" → "(OIDC)".
- **Gambar 4.2 (Sequence Diagram Provisioning)** — ganti "Buat akun & set atribut" pada Active
  Directory menjadi pada user store Identity (SQL Server).
- **Glosarium** — entri "LDAP/Active Directory" dan "SAML 2.0" boleh tetap sebagai definisi istilah,
  namun tambahkan keterangan "*(tidak digunakan pada Fase 1; opsi fase lanjut)*".

---

## 5. Pasal yang SUDAH konsisten (tidak perlu diubah)

- **Bab 2.9 (Technology Stack)** dan catatan implementasinya — sudah benar (Identity + OpenIddict,
  SAML diakui butuh adapter).
- **KF-B-03** ("menonaktifkan akun … berdasarkan sinkronisasi data dari sistem SDM") — konsisten
  dengan model "SDM sebagai sumber data".
- **Bab 2.5** soal PBKDF2/Argon2 via Identity Password Hasher — benar (hanya perlu tambahan kalimat
  legacy bcrypt pada §2.2 di atas).

---

## 6. Usulan baris untuk tabel "Riwayat Revisi Dokumen"

| Versi | Tanggal | Deskripsi Perubahan | Disusun oleh |
|---|---|---|---|
| 2.2 | _(isi tanggal)_ | Penyelarasan SRS dengan arsitektur terimplementasi: penetapan **ASP.NET Core Identity (SQL Server)** sebagai user store & otoritas kredensial lokal menggantikan validasi Active Directory/LDAP (KF-A-02, Flow 4.1.4/4.2.4, Bab 2.1/2.4/7.3); penyeragaman algoritma hashing ke **PBKDF2/Argon2** + dukungan migrasi bcrypt legacy (Bab 8.2); penurunan **SAML 2.0** menjadi opsional/adapter di seluruh pasal (Bab 2.1/8.4, KF-A-04); pembaruan diagram use case & sequence. AD/LDAP dan SAML ditetapkan sebagai opsi fase lanjut. | IT Interns |
