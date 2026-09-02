const sectionStyle = { marginBottom: 28 }
const h2Style = { fontFamily: 'var(--font-heading)', fontSize: 19, color: 'var(--gcs-green-900)', marginBottom: 10 }
const pStyle = { fontSize: 14.5, lineHeight: 1.7, color: 'var(--gcs-ink)', margin: '0 0 10px 0' }
const liStyle = { fontSize: 14.5, lineHeight: 1.7, color: 'var(--gcs-ink)', marginBottom: 6 }

// Kebijakan Privasi publik - WAJIB Google Play (Data Safety form mensyaratkan URL publik
// yang bisa diakses siapa pun tanpa login). Sengaja DI LUAR RequireAuth (rute publik,
// sama pola dgn /login) - reviewer Google & siapa pun harus bisa membukanya tanpa akun.
export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--gcs-bg)', padding: '48px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 12, padding: '40px 44px', boxShadow: 'var(--gcs-shadow)' }}>
        <img src="/LOGO GCS.png" alt="Logo GCS" style={{ height: 40, marginBottom: 22 }} />
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: 'var(--gcs-green-900)', margin: '0 0 6px 0' }}>
          Kebijakan Privasi MyGCS Absensi
        </h1>
        <p style={{ fontSize: 13, color: 'var(--gcs-text-muted)', margin: '0 0 30px 0' }}>
          Berlaku sejak 1 September 2026 &middot; PT Gresik Cipta Sejahtera
        </p>

        <div style={sectionStyle}>
          <p style={pStyle}>
            Aplikasi MyGCS Absensi ("Aplikasi") disediakan oleh PT Gresik Cipta Sejahtera ("Perusahaan")
            khusus untuk digunakan oleh karyawan Perusahaan sebagai sarana presensi (absen masuk/keluar)
            berbasis lokasi dan foto. Kebijakan ini menjelaskan data apa yang dikumpulkan Aplikasi, untuk
            apa data itu digunakan, dan bagaimana data itu disimpan.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Data yang Dikumpulkan</h2>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={liStyle}><b>Lokasi (GPS)</b> — diambil hanya pada saat pengguna menekan tombol absen, untuk memverifikasi bahwa pengguna berada dalam radius titik kerja yang sah. Aplikasi tidak melacak lokasi di latar belakang atau di luar momen absen.</li>
            <li style={liStyle}><b>Foto kamera</b> — foto selfie diambil langsung saat itu juga (tidak boleh mengunggah dari galeri) sebagai bukti kehadiran, disimpan dengan cap tanggal/jam dari server perusahaan.</li>
            <li style={liStyle}><b>Identitas kepegawaian</b> — nama, NIK, dan data jabatan yang diambil dari akun Single Sign-On (SSO) MyGCS milik Perusahaan saat login.</li>
            <li style={liStyle}><b>Informasi perangkat</b> — sinyal teknis terbatas (mis. status mode lokasi palsu/"mock location", status root perangkat) khusus untuk mencegah kecurangan presensi, tidak dipakai untuk keperluan lain.</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Penggunaan Data</h2>
          <p style={pStyle}>
            Seluruh data di atas digunakan semata-mata untuk keperluan administrasi kepegawaian internal
            Perusahaan (validasi kehadiran, penggajian, dan audit kepatuhan kerja). Data <b>tidak
            dibagikan, dijual, atau digunakan untuk iklan/pemasaran</b> oleh pihak mana pun, termasuk pihak
            ketiga.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Penyimpanan &amp; Keamanan</h2>
          <p style={pStyle}>
            Data disimpan di server milik Perusahaan (bukan pihak ketiga/cloud publik), dikirim melalui
            koneksi terenkripsi (HTTPS), dan hanya dapat diakses oleh personel HR/SDM berwenang serta
            atasan langsung terkait sesuai kebutuhan administrasi. Aplikasi hanya dapat digunakan oleh
            karyawan yang memiliki akun SSO aktif dari Perusahaan.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Hak Pengguna</h2>
          <p style={pStyle}>
            Karyawan dapat menghubungi Departemen SDM atau Divisi TI Perusahaan untuk menanyakan,
            memperbaiki, atau meminta penghapusan data pribadinya sesuai peraturan perusahaan dan
            perundang-undangan yang berlaku.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Kontak</h2>
          <p style={pStyle}>
            Bagian Teknologi Informasi dan Multimedia<br />
            PT Gresik Cipta Sejahtera<br />
            Email: <a href="mailto:it@gcs-gresik.com" style={{ color: 'var(--gcs-green-600)' }}>it@gcs-gresik.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
