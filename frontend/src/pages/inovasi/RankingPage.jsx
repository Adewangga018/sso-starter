import { useState } from 'react'
import InovasiRanking from './InovasiRanking'
import RankingGagasan from './RankingGagasan'
import './inovasi.css'

// Rekap Kegiatan Inovasi > Ranking. Menyatukan dua peringkat yang dulu terpisah
// menjadi satu menu bertab: partisipasi Sumbang Gagasan (per pengaju) dan
// jumlah risalah inovasi (per Ketua gugus).
const TAB = [
  { key: 'gagasan', label: 'Sumbang Gagasan', sub: 'Peringkat partisipasi pegawai berdasarkan jumlah Sumbang Gagasan yang diajukan, dalam lingkup yang dapat Anda lihat.' },
  { key: 'inovasi', label: 'Inovasi', sub: 'Peringkat Ketua gugus berdasarkan jumlah risalah inovasi, dirinci per metodologi (SS / GIO / 5R).' },
]

export default function RankingPage() {
  const [tab, setTab] = useState('gagasan')
  const aktif = TAB.find((t) => t.key === tab) ?? TAB[0]

  return (
    <div className="inv">
      <h2 className="inv__title">Ranking</h2>
      <p className="inv__subtitle">{aktif.sub}</p>

      <div className="inv__steps">
        {TAB.map((t) => (
          <button key={t.key} type="button"
            className={`inv__step${tab === t.key ? ' inv__step--active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'gagasan' ? <RankingGagasan embedded /> : <InovasiRanking embedded />}
    </div>
  )
}
