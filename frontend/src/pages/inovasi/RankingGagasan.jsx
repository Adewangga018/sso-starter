import { useEffect, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { METODOLOGI, unduhCsv } from './rekapUtils'
import './inovasi.css'

// Rekap Kegiatan Inovasi > Ranking Sumbang Gagasan. Peringkat partisipasi
// pegawai berdasarkan jumlah gagasan yang ia ajukan, dipilah per status akhir
// gagasan tersebut.
const KOLOM = [
  { key: 'terkirim', label: 'Terkirim', cocok: (s) => s === 'Dikirim' },
  { key: 'revisi', label: 'Revisi', cocok: (s) => s?.startsWith('Revisi') },
  { key: 'verifikator', label: 'Disetujui Verifikator', cocok: (s) => s === 'Disetujui Verifikator' },
  { key: 'gm', label: 'Disetujui GM', cocok: (s) => s?.startsWith('Disetujui GM') },
  { key: 'terdaftar', label: 'Terdaftar', cocok: (s) => s === 'Terdaftar' },
  { key: 'ditolak', label: 'Ditolak', cocok: (s) => s === 'Ditolak' },
]

// `embedded` dipakai halaman Ranking bertab: kerangka & judul disediakan induknya.
export default function RankingGagasan({ embedded = false }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [metodologi, setMetodologi] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.listGagasan()
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
  }, [])

  const ranking = useMemo(() => {
    const map = new Map()
    for (const g of rows ?? []) {
      if (metodologi && g.metodologi !== metodologi) continue
      const nik = g.createdByNik ?? '-'
      const cur = map.get(nik) ?? { nik, nama: g.createdByNama ?? '-', total: 0, ...Object.fromEntries(KOLOM.map((k) => [k.key, 0])) }
      cur.total += 1
      const kol = KOLOM.find((k) => k.cocok(g.status))
      if (kol) cur[kol.key] += 1
      map.set(nik, cur)
    }
    const term = search.trim().toLowerCase()
    return [...map.values()]
      .filter((r) => !term || `${r.nik} ${r.nama}`.toLowerCase().includes(term))
      .sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama))
  }, [rows, metodologi, search])

  function unduh() {
    unduhCsv('ranking-sumbang-gagasan',
      ['Rank', 'NIK', 'Nama', ...KOLOM.map((k) => k.label), 'Total'],
      ranking.map((r, i) => [i + 1, r.nik, r.nama, ...KOLOM.map((k) => r[k.key]), r.total]))
  }

  if (!rows && !err) {
    const memuat = <p className="inv__subtitle">Memuat data...</p>
    return embedded ? memuat : <div className="inv">{memuat}</div>
  }

  const isi = (
    <>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__filters">
          <select className="inv__select" value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
            <option value="">Semua Metodologi</option>
            {METODOLOGI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="inv__search">
            <span className="inv__search-icon"><Search size={16} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari NIK atau nama..." />
          </div>
        </div>
        <button type="button" className="inv__btn inv__btn--soft" onClick={unduh} disabled={ranking.length === 0}>
          <Download size={15} /> Download
        </button>
      </div>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th style={{ width: 60, textAlign: 'center' }}>Rank</th><th style={{ width: 110 }}>NIK</th><th>Nama</th>
              {KOLOM.map((k) => <th key={k.key} style={{ width: 110, textAlign: 'center' }}>{k.label}</th>)}
              <th style={{ width: 80, textAlign: 'center' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 && <tr><td className="inv__no-data" colSpan={KOLOM.length + 4}>Belum ada data partisipasi.</td></tr>}
            {ranking.map((r, i) => (
              <tr key={r.nik}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{i + 1}</td>
                <td>{r.nik}</td>
                <td style={{ fontWeight: 600 }}>{r.nama}</td>
                {KOLOM.map((k) => <td key={k.key} style={{ textAlign: 'center', color: r[k.key] ? undefined : '#9aa79d' }}>{r[k.key]}</td>)}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )

  if (embedded) return isi
  return (
    <div className="inv">
      <h2 className="inv__title">Ranking Sumbang Gagasan</h2>
      <p className="inv__subtitle">Peringkat partisipasi pegawai berdasarkan jumlah Sumbang Gagasan yang diajukan, dalam lingkup yang dapat Anda lihat.</p>
      {isi}
    </div>
  )
}
