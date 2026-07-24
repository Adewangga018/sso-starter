import { useEffect, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { api, isEmptyDataError } from '../../lib/api'
import { METODOLOGI, periodeList, unduhCsv } from './rekapUtils'
import './inovasi.css'

// Rekap Kegiatan Inovasi > Ranking Inovasi. Peringkat Ketua gugus berdasarkan
// jumlah risalah, dirinci per metodologi (SS / GIO / 5R) dalam lingkup yang
// dapat Anda lihat. Diagregasi dari data risalah.
// `embedded` dipakai halaman Ranking bertab: kerangka & judul disediakan induknya.
export default function InovasiRanking({ embedded = false }) {
  const [risalah, setRisalah] = useState(null)
  const [periode, setPeriode] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.listInovasi().then((d) => setRisalah(d.items)).catch((e) => { if (isEmptyDataError(e)) setRisalah([]) })
  }, [])

  const periodeOpsi = useMemo(() => periodeList(risalah), [risalah])

  const ranking = useMemo(() => {
    const map = new Map()
    for (const r of risalah ?? []) {
      if (periode && r.periode !== periode) continue
      const nama = (r.ketuaNama ?? '').trim()
      if (!nama) continue
      const cur = map.get(nama) ?? { nama, total: 0, ...Object.fromEntries(METODOLOGI.map((m) => [m, 0])) }
      cur.total += 1
      if (cur[r.jenis] !== undefined) cur[r.jenis] += 1
      map.set(nama, cur)
    }
    const term = search.trim().toLowerCase()
    return [...map.values()]
      .filter((r) => !term || r.nama.toLowerCase().includes(term))
      .sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama))
  }, [risalah, periode, search])

  function unduh() {
    unduhCsv('ranking-inovasi',
      ['Rank', 'Ketua Gugus', ...METODOLOGI, 'Total'],
      ranking.map((r, i) => [i + 1, r.nama, ...METODOLOGI.map((m) => r[m]), r.total]))
  }

  if (risalah === null) {
    const memuat = <p className="inv__subtitle">Memuat data...</p>
    return embedded ? memuat : <div className="inv">{memuat}</div>
  }

  const isi = (
    <>
      <div className="inv__toolbar">
        <div className="inv__filters">
          <select className="inv__select" value={periode} onChange={(e) => setPeriode(e.target.value)}>
            <option value="">Semua Periode</option>
            {periodeOpsi.map((p) => <option key={p} value={p}>Periode {p}</option>)}
          </select>
          <div className="inv__search">
            <span className="inv__search-icon"><Search size={16} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama ketua gugus..." />
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
              <th style={{ width: 60, textAlign: 'center' }}>Rank</th>
              <th>Ketua Gugus</th>
              {METODOLOGI.map((m) => <th key={m} style={{ width: 80, textAlign: 'center' }}>{m}</th>)}
              <th style={{ width: 90, textAlign: 'center' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 && <tr><td className="inv__no-data" colSpan={METODOLOGI.length + 3}>Belum ada data partisipasi.</td></tr>}
            {ranking.map((r, i) => (
              <tr key={r.nama}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{r.nama}</td>
                {METODOLOGI.map((m) => <td key={m} style={{ textAlign: 'center', color: r[m] ? undefined : '#9aa79d' }}>{r[m]}</td>)}
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
      <h2 className="inv__title">Ranking Inovasi</h2>
      <p className="inv__subtitle">Peringkat Ketua gugus berdasarkan jumlah risalah inovasi, dirinci per metodologi (SS / GIO / 5R).</p>
      {isi}
    </div>
  )
}
