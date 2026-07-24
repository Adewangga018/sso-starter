import { useEffect, useMemo, useState } from 'react'
import { api, isEmptyDataError } from '../../lib/api'
import { jenisLabel } from './statusClass'
import './inovasi.css'

// Ranking Inovasi - peringkat Ketua gugus berdasarkan jumlah risalah dalam
// lingkup yang dapat Anda lihat. Diagregasi dari data risalah.
export default function InovasiRanking() {
  const [risalah, setRisalah] = useState(null)

  useEffect(() => {
    api.listInovasi().then((d) => setRisalah(d.items)).catch((e) => { if (isEmptyDataError(e)) setRisalah([]) })
  }, [])

  const ranking = useMemo(() => {
    const map = new Map()
    ;(risalah ?? []).forEach((r) => {
      const nama = (r.ketuaNama ?? '').trim()
      if (!nama) return
      const cur = map.get(nama) ?? { nama, total: 0, byJenis: {} }
      cur.total += 1
      cur.byJenis[r.jenis] = (cur.byJenis[r.jenis] ?? 0) + 1
      map.set(nama, cur)
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [risalah])

  if (risalah === null) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Ranking Inovasi</h2>
      <p className="inv__subtitle">Peringkat Ketua gugus berdasarkan jumlah risalah inovasi dalam lingkup yang dapat Anda lihat.</p>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead><tr><th style={{ width: 60 }}>Rank</th><th>Ketua Gugus</th><th>Rincian Metodologi</th><th style={{ textAlign: 'center', width: 90 }}>Total</th></tr></thead>
          <tbody>
            {ranking.length === 0 && <tr><td className="inv__no-data" colSpan={4}>Belum ada data partisipasi.</td></tr>}
            {ranking.map((r, i) => (
              <tr key={r.nama}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{r.nama}</td>
                <td>{Object.entries(r.byJenis).map(([j, n]) => `${jenisLabel(j)}: ${n}`).join(' · ')}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
