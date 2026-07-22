import './inovasi.css'

const METODOLOGI = [
  ['Sistem Saran (SS)', 'Siklus PDCA. Gugus kecil (Ketua + Sekretaris) dalam SATU departemen, didampingi Fasilitator.'],
  ['Gugus Inovasi Operasi (GIO)', 'Metode DELTA (8 Langkah 7 Alat) + pembuktian statistik. Boleh lintas departemen; ada Pembina.'],
  ['Program 5R', 'Ringkas, Rapi, Resik, Rawat, Rajin. Memakai template & siklus PDCA yang sama dengan Sistem Saran; boleh lintas departemen.'],
]

const ALUR = [
  ['1. Sumbang Gagasan', 'Karyawan mengirim gagasan berisi judul & latar belakang (kondisi awal).'],
  ['2. Reviewer (Manager)', 'Manager departemen menilai: setuju / minta revisi / tolak.'],
  ['3. Kanal GM', 'GM menetapkan metodologi (SS/GIO/5R), Fasilitator (semua), dan Pembina (khusus GIO) lewat pencarian pegawai. SS hanya satu departemen; GIO/5R boleh lintas departemen.'],
  ['4. Pendaftaran', 'Setelah disetujui, pengaju mendaftarkan gagasan menjadi risalah - mengisi nama gugus & anggota (Sekretaris/Anggota). Ketua, Fasilitator, dan Pembina (GIO) terisi otomatis.'],
  ['5. Risalah', 'Isi risalah sesuai template: PLAN (P.1-P.8/P.10) -> pengesahan -> DO -> CHECK -> ACTION.'],
]

export default function InovasiPanduan() {
  return (
    <div className="inv">
      <h2 className="inv__title">Panduan Inovasi</h2>
      <p className="inv__subtitle">Metodologi ditentukan oleh GM saat menyetujui gagasan - Anda cukup menyumbang gagasan terlebih dahulu.</p>

      <div className="inv__card">
        <div className="inv__section-head"><span className="inv__section-tag">Alur</span><h3>Dari Gagasan ke Risalah</h3></div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
          {ALUR.map(([t, d]) => <li key={t}><b>{t}</b> - {d}</li>)}
        </ol>
      </div>

      <div className="inv__card">
        <div className="inv__section-head"><span className="inv__section-tag">Metodologi</span><h3>SS / GIO / 5R</h3></div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
          {METODOLOGI.map(([t, d]) => <li key={t}><b>{t}</b> - {d}</li>)}
        </ul>
      </div>

      <div className="inv__card">
        <div className="inv__section-head"><span className="inv__section-tag">Ketentuan</span><h3>Hal Penting</h3></div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
          <li>Nomor registrasi risalah terbit otomatis saat diajukan (jenis-urut departemen/urut kompartemen/tahun).</li>
          <li>Periode inovasi ditulis lintas tahun, mis. 2026/2027. Satu gugus boleh membuat lebih dari satu tema.</li>
          <li>Data pendukung (P.2) boleh dilengkapi lampiran file/foto atau tautan.</li>
          <li>Dampak QCDSE+M bersifat opsional.</li>
          <li>Fishbone: akar penyebab terkecil diberi kotak, prioritas diurut 1-5.</li>
          <li>Tahap DO/CHECK/ACTION baru terbuka setelah Lembar Pengesahan PLAN diverifikasi & divalidasi.</li>
        </ul>
      </div>
    </div>
  )
}
