import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './inovasi.css'

const METODOLOGI = [
  ['Sistem Saran (SS)', 'Siklus PDCA. Gugus kecil (Ketua + Sekretaris) dalam SATU departemen, didampingi Fasilitator.'],
  ['Gugus Inovasi Operasi (GIO)', 'Metode DELTA (8 Langkah 7 Alat) + pembuktian statistik. Boleh lintas departemen.'],
  ['Program 5R', 'Ringkas, Rapi, Resik, Rawat, Rajin. Memakai template & siklus PDCA yang sama dengan Sistem Saran; boleh lintas departemen.'],
]

const ALUR = [
  ['1. Sumbang Gagasan', 'Karyawan mengirim gagasan berisi judul, latar belakang, pokok masalah & usulan solusi.'],
  ['2. Verifikasi (Manager)', 'Manager departemen menilai: setuju / minta revisi / tolak.'],
  ['3. Persetujuan GM Kompartemen Asal', 'GM menyetujui dan menetapkan metodologi (SS/GIO/5R).'],
  ['4. Persetujuan GM Kompartemen Tujuan', 'Hanya bila gagasan menyasar kompartemen lain.'],
  ['5. Pendaftaran', 'Setelah disetujui, pengaju mendaftarkan gagasan menjadi risalah - mengisi nama gugus & anggota. Ketua & Fasilitator terisi otomatis.'],
  ['6. Risalah', 'Isi risalah sesuai template: PLAN (P.1-P.8/P.10) -> pengesahan -> DO -> CHECK -> ACTION.'],
  ['7. Penilaian Juri', 'Bila ditugaskan Admin, tim juri menilai risalah dengan rubrik GIO/SS atau 5R.'],
]

const APPROVAL = [
  ['Verifikator (Manager)', 'Langkah pertama. Periksa kelengkapan & kelayakan gagasan, lalu Setujui / Revisi / Tolak. Giliran Anda sebelum GM.'],
  ['GM Kompartemen Asal', 'Menyetujui gagasan DAN memilih metodologi (SS / GIO / 5R). Wajib pilih metodologi saat menyetujui.'],
  ['GM Kompartemen Tujuan', 'Ikut menyetujui hanya bila gagasan menyasar kompartemen lain.'],
  ['Pengesahan Risalah', 'Setelah risalah didaftarkan, Pembina (Dept/Kompartemen) menandatangani Lembar Pengesahan PLAN (verifikasi lalu validasi); setelah itu DO/CHECK/ACTION terbuka, ditutup dengan Pengesahan Akhir.'],
]

const JURI = [
  ['Penempatan', 'Admin menempatkan Anda di sebuah stream sebagai Ketua, Anggota, atau Sekretaris.'],
  ['Siapa menilai', 'Ketua & Anggota memberi skor 1-10 per kriteria. Sekretaris hanya memantau/melihat hasil.'],
  ['Rubrik', 'GIO/SS (24 kriteria) untuk risalah SS & GIO; 5R (22 kriteria) untuk risalah 5R. Rubrik terpilih otomatis dari jenis risalah.'],
  ['Bertahap', 'Penilaian dibagi per tahap: PLAN, DO, CHECK, ACTION, MAKALAH, PRESENTATION.'],
  ['Perhitungan', 'Total = jumlah (nilai/10 x bobot kriteria), skala 0-100. Kategori: >=94 Platinum, >=87 Gold, >=79 Silver, >=61 Bronze, <61 Partisipatif.'],
  ['Nilai akhir', 'Rata-rata nilai Ketua + 2 Anggota yang telah mengisi seluruh kriteria.'],
]

function GuideCard({ tag, title, items, ordered = false }) {
  const List = ordered ? 'ol' : 'ul'
  return (
    <div className="inv__card">
      <div className="inv__section-head"><span className="inv__section-tag">{tag}</span><h3>{title}</h3></div>
      <List style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
        {items.map(([t, d]) => <li key={t}><b>{t}</b> - {d}</li>)}
      </List>
    </div>
  )
}

export default function InovasiPanduan() {
  const ctx = useOutletContext() || {}
  const peran = ctx.peran ?? 'Karyawan'
  const { isJuri } = useAuth()
  const isApprover = peran === 'Manager' || peran === 'GM'

  return (
    <div className="inv">
      <h2 className="inv__title">Panduan Inovasi</h2>
      <p className="inv__subtitle">
        {isApprover
          ? 'Panduan verifikasi & persetujuan gagasan/risalah untuk Manager dan GM.'
          : 'Metodologi ditentukan oleh GM saat menyetujui gagasan - Anda cukup menyumbang gagasan terlebih dahulu.'}
      </p>

      {isApprover ? (
        <GuideCard tag="Persetujuan" title="Alur Verifikasi & Persetujuan" items={APPROVAL} ordered />
      ) : (
        <>
          <GuideCard tag="Alur" title="Dari Gagasan ke Risalah" items={ALUR} ordered />
          <GuideCard tag="Metodologi" title="SS / GIO / 5R" items={METODOLOGI} />
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
        </>
      )}

      {isJuri && <GuideCard tag="Juri" title="Panduan Penilaian Juri" items={JURI} />}
    </div>
  )
}
