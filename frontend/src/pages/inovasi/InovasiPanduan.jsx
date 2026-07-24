import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './inovasi.css'

// Panduan ringkas, menyesuaikan peran pembaca (Karyawan / Manager-GM / Juri /
// Pengelola Juri). Sengaja dipadatkan jadi sedikit kartu.

const METODOLOGI = [
  ['Sistem Saran (SS)', 'Perbaikan kecil, siklus PDCA. Anggota HARUS satu departemen. Didampingi 1 Fasilitator.'],
  ['Gugus Inovasi Operasi (GIO)', 'Masalah kompleks, metode DELTA (8 Langkah) + pembuktian statistik. Anggota bebas (boleh lintas unit).'],
  ['Program 5R', 'Ringkas-Rapi-Resik-Rawat-Rajin, template PDCA. Anggota satu kompartemen, maksimum 10 orang.'],
]

// ---------- Karyawan ----------
const ALUR_PENGGUNA = [
  ['Sumbang Gagasan', 'Isi judul, latar belakang, masalah, solusi.'],
  ['Verifikasi & Persetujuan', 'Manager memverifikasi, lalu GM menyetujui sekaligus menetapkan metodologi (SS/GIO/5R).'],
  ['Daftarkan ke Risalah', 'Tombol "Daftarkan ke SERGIO" muncul setelah disetujui. Isi nama gugus - Anda jadi Ketua, no. registrasi terbit.'],
  ['Lengkapi Anggota', 'Tambah Sekretaris, Anggota, dan Fasilitator (wajib). Pencarian pegawai mengikuti cakupan metodologi.'],
  ['Isi PLAN', 'Lengkapi P.1-P.8 (GIO s/d P.10): data, jadwal PDCA, sasaran SMART, QCDSE, fishbone, rencana 5W+2H, judul. Lalu ajukan pengesahan.'],
  ['Pengesahan PLAN', 'Fasilitator verifikasi -> Pembina Dept & Kompartemen validasi. Setelah disetujui, DO/CHECK/ACTION terbuka.'],
  ['DO -> CHECK -> ACTION', 'Isi pelaksanaan, evaluasi, standarisasi, lalu ajukan Pengesahan Akhir. Disetujui -> status Selesai & siap dinilai juri.'],
]

// ---------- Manager / GM ----------
const APPROVER_LANGKAH = [
  ['Verifikasi (Manager)', 'Periksa gagasan bawahan (latar belakang, masalah, solusi): Setujui (teruskan ke GM), Revisi, atau Tolak.'],
  ['Persetujuan (GM)', 'Setujui gagasan yang lolos verifikasi DAN pilih metodologi. Bila lintas kompartemen, GM tujuan ikut menyetujui.'],
  ['Setelah disetujui', 'Ketua (pengaju) mendaftarkan risalah & mengisi anggota - Anda tidak menetapkan anggota.'],
  ['Pengesahan', 'Anda ikut menandatangani Lembar Pengesahan PLAN & Pengesahan Akhir bila menjadi Pembina; tombol muncul saat giliran Anda.'],
  ['Pemantauan', 'Manager melihat seluruh risalah departemennya; GM seluruh risalah kompartemennya (read-only, bisa buka Detail).'],
]

const APPROVER_METODOLOGI = [
  ['SS', 'Perbaikan kecil dalam satu departemen (PDCA sederhana).'],
  ['GIO', 'Masalah lintas fungsi berskala besar yang butuh analisis statistik; anggota boleh lintas unit.'],
  ['5R', 'Program housekeeping area kerja, lingkup satu kompartemen.'],
  ['Lintas departemen', 'SS tidak boleh (harus satu departemen) - pilih GIO atau 5R.'],
]

// ---------- Juri ----------
const JURI = [
  ['Penempatan', 'Ditempatkan di sebuah stream (1 Ketua, 3 Anggota, 1 Sekretaris) yang ditugaskan ke inovasi berstatus Selesai.'],
  ['Penilaian', 'Ketua & Anggota memberi skor 1-10 per kriteria; Sekretaris hanya memantau. Rubrik: GIO/SS (24 kriteria) atau 5R (22), otomatis sesuai jenis.'],
  ['Tahap & nilai', 'Kriteria per tahap (PLAN, DO, CHECK, ACTION, MAKALAH, PRESENTATION). Total = jumlah (nilai/10 x bobot), skala 0-100.'],
  ['Kategori & nilai akhir', '>=94 Platinum, >=87 Gold, >=79 Silver, >=61 Bronze, <61 Partisipatif. Nilai akhir = rata-rata Ketua + 3 Anggota yang lengkap.'],
]

const PENGELOLA_JURI = [
  ['Peran', 'Koordinator penjurian. Akses TERBATAS: hanya Juri & Penilaian Inovasi, Stream Penilai, dan Penugasan ke Inovasi.'],
  ['Stream Penilai', 'Susun panel: 1 Ketua, 3 Anggota, 1 Sekretaris dari pengguna ber-role Juri.'],
  ['Penugasan', 'Tugaskan stream ke inovasi. Hanya inovasi berstatus Selesai (lulus Pengesahan Akhir) yang bisa dipilih.'],
]

function GuideCard({ tag, title, items, ordered = false, lead }) {
  const List = ordered ? 'ol' : 'ul'
  return (
    <div className="inv__card">
      <div className="inv__section-head"><span className="inv__section-tag">{tag}</span><h3>{title}</h3></div>
      {lead && <p className="inv__hint" style={{ marginTop: -4 }}>{lead}</p>}
      <List style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
        {items.map(([t, d]) => <li key={t}><b>{t}</b> — {d}</li>)}
      </List>
    </div>
  )
}

export default function InovasiPanduan() {
  const ctx = useOutletContext() || {}
  const peran = ctx.peran ?? 'Karyawan'
  const { isJuri, isPengelolaJuri } = useAuth()
  const isApprover = peran === 'Manager' || peran === 'GM'

  return (
    <div className="inv">
      <h2 className="inv__title">Panduan Inovasi</h2>
      <p className="inv__subtitle">
        {isApprover
          ? `Verifikasi & persetujuan untuk ${peran === 'Manager' ? 'Manager (Verifikator)' : 'GM Kompartemen'}.`
          : 'Dari menyumbang gagasan sampai risalah selesai. Metodologi ditetapkan GM - Anda cukup menyumbang gagasan lebih dulu.'}
      </p>

      {isApprover ? (
        <>
          <GuideCard tag="Langkah" title="Langkah Verifikasi & Persetujuan" items={APPROVER_LANGKAH} ordered
            lead="Manager memverifikasi lebih dulu, lalu GM menyetujui & menetapkan metodologi." />
          <GuideCard tag="Metodologi" title="Memilih Metodologi (GM)" items={APPROVER_METODOLOGI} />
        </>
      ) : (
        <>
          <GuideCard tag="Alur" title="Alur: dari Gagasan sampai Selesai" items={ALUR_PENGGUNA} ordered />
          <GuideCard tag="Metodologi" title="SS / GIO / 5R" items={METODOLOGI} />
        </>
      )}

      {isPengelolaJuri && <GuideCard tag="Pengelola Juri" title="Panduan Pengelola Juri" items={PENGELOLA_JURI} />}
      {isJuri && <GuideCard tag="Juri" title="Panduan Penilaian Juri" items={JURI} />}
    </div>
  )
}
