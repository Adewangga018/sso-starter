import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { METODOLOGI, unduhCsv } from './rekapUtils'
import './inovasi.css'

// Rekap Kegiatan Inovasi > Grafik Sumbang Gagasan. Tiga tampilan sederhana:
// jumlah gagasan per bulan (batang), sebaran status, dan sebaran metodologi.
// Satu deret data = satu warna (tanpa legenda); angka ditulis langsung pada
// batang agar terbaca tanpa bergantung pada warna.
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HIJAU = '#1f6b39'

export default function GrafikGagasan() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [tahun, setTahun] = useState(null)   // null = belum ditentukan, '' = semua tahun
  const [metodologi, setMetodologi] = useState('')

  useEffect(() => {
    api.listGagasan()
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
  }, [])

  const tahunOpsi = useMemo(
    () => [...new Set((rows ?? []).map((r) => new Date(r.createdAt).getFullYear()))].sort((a, b) => b - a),
    [rows])

  // Tahun default = tahun terbaru yang ada datanya (sekali saja, agar pilihan
  // "Semua Tahun" tidak langsung dikembalikan).
  useEffect(() => { if (tahun === null && tahunOpsi.length) setTahun(String(tahunOpsi[0])) }, [tahunOpsi, tahun])

  const terpilih = useMemo(() => (rows ?? []).filter((r) =>
    (!tahun || String(new Date(r.createdAt).getFullYear()) === tahun) &&
    (!metodologi || r.metodologi === metodologi)
  ), [rows, tahun, metodologi])

  const perBulan = useMemo(() => {
    const n = Array(12).fill(0)
    terpilih.forEach((r) => { n[new Date(r.createdAt).getMonth()] += 1 })
    return BULAN.map((b, i) => ({ label: b, nilai: n[i] }))
  }, [terpilih])

  const perStatus = useMemo(() => {
    const map = new Map()
    terpilih.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1))
    return [...map.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)
  }, [terpilih])

  const perMetodologi = useMemo(() => {
    const hitung = (m) => terpilih.filter((r) => (m === '-' ? !r.metodologi : r.metodologi === m)).length
    return [...METODOLOGI.map((m) => ({ label: m, nilai: hitung(m) })), { label: 'Belum ditetapkan', nilai: hitung('-') }]
      .filter((x) => x.nilai > 0)
  }, [terpilih])

  function unduh() {
    unduhCsv(`grafik-sumbang-gagasan-${tahun || 'semua'}`,
      ['Kelompok', 'Label', 'Jumlah'],
      [
        ...perBulan.map((x) => ['Per Bulan', x.label, x.nilai]),
        ...perStatus.map((x) => ['Per Status', x.label, x.nilai]),
        ...perMetodologi.map((x) => ['Per Metodologi', x.label, x.nilai]),
      ])
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Grafik Sumbang Gagasan</h2>
      <p className="inv__subtitle">Sebaran usulan Sumbang Gagasan per bulan, status, dan metodologi dalam lingkup yang dapat Anda lihat.</p>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__filters">
          <select className="inv__select" value={tahun ?? ''} onChange={(e) => setTahun(e.target.value)}>
            <option value="">Semua Tahun</option>
            {tahunOpsi.map((t) => <option key={t} value={t}>Tahun {t}</option>)}
          </select>
          <select className="inv__select" value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
            <option value="">Semua Metodologi</option>
            {METODOLOGI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button type="button" className="inv__btn inv__btn--soft" onClick={unduh} disabled={terpilih.length === 0}>
          <Download size={15} /> Download
        </button>
      </div>

      {terpilih.length === 0
        ? <div className="inv__banner inv__banner--info">Belum ada gagasan pada filter ini.</div>
        : (
          <>
            <div className="inv__chart-card">
              <h3 className="inv__chart-title">Jumlah Gagasan per Bulan{tahun ? ` - ${tahun}` : ''}</h3>
              <BatangVertikal data={perBulan} />
            </div>
            <div className="inv__chart-row">
              <div className="inv__chart-card">
                <h3 className="inv__chart-title">Sebaran Status</h3>
                <BatangHorizontal data={perStatus} />
              </div>
              <div className="inv__chart-card">
                <h3 className="inv__chart-title">Sebaran Metodologi</h3>
                <BatangHorizontal data={perMetodologi} />
              </div>
            </div>
          </>
        )}
    </div>
  )
}

// Batang dengan ujung membulat 4px yang menempel pada garis dasar.
function batangTegak(x, y, w, h, r = 4) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} a${rr},${rr} 0 0 1 ${rr},-${rr} h${w - rr * 2} a${rr},${rr} 0 0 1 ${rr},${rr} V${y + h} Z`
}
function batangDatar(x, y, w, h, r = 4) {
  const rr = Math.min(r, w, h / 2)
  return `M${x},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${h - rr * 2} a${rr},${rr} 0 0 1 -${rr},${rr} H${x} Z`
}

function BatangVertikal({ data }) {
  const W = 760, H = 260, L = 34, R = 10, T = 22, B = 30
  const plotW = W - L - R, plotH = H - T - B
  const maks = Math.max(1, ...data.map((d) => d.nilai))
  const step = plotW / data.length
  const bw = Math.max(10, step - 12)
  const garis = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maks * f))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagram batang jumlah gagasan per bulan" style={{ display: 'block' }}>
      {[...new Set(garis)].map((v) => {
        const y = T + plotH - (v / maks) * plotH
        return (
          <g key={v}>
            <line x1={L} y1={y} x2={W - R} y2={y} stroke="#e6ece7" strokeWidth={1} />
            <text x={L - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="#8a978c">{v}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const h = (d.nilai / maks) * plotH
        const x = L + step * i + (step - bw) / 2
        const y = T + plotH - h
        return (
          <g key={d.label}>
            {d.nilai > 0 && (
              <>
                <path d={batangTegak(x, y, bw, h)} fill={HIJAU} />
                <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#2c3a30">{d.nilai}</text>
              </>
            )}
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize={10.5} fill="#5c6b60">{d.label}</text>
            <title>{`${d.label}: ${d.nilai} gagasan`}</title>
          </g>
        )
      })}
      <line x1={L} y1={T + plotH} x2={W - R} y2={T + plotH} stroke="#c8d3ca" strokeWidth={1} />
    </svg>
  )
}

function BatangHorizontal({ data }) {
  const W = 460, LABEL = 168, R = 44, BAR = 20, GAP = 10, T = 6
  const H = Math.max(60, data.length * (BAR + GAP) + T * 2)
  const plotW = W - LABEL - R
  const maks = Math.max(1, ...data.map((d) => d.nilai))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagram batang sebaran gagasan" style={{ display: 'block' }}>
      {data.map((d, i) => {
        const y = T + i * (BAR + GAP)
        const w = Math.max(2, (d.nilai / maks) * plotW)
        return (
          <g key={d.label}>
            <text x={LABEL - 8} y={y + BAR / 2 + 4} textAnchor="end" fontSize={11} fill="#5c6b60">{d.label}</text>
            <path d={batangDatar(LABEL, y, w, BAR)} fill={HIJAU} />
            <text x={LABEL + w + 7} y={y + BAR / 2 + 4} fontSize={11} fontWeight={700} fill="#2c3a30">{d.nilai}</text>
            <title>{`${d.label}: ${d.nilai} gagasan`}</title>
          </g>
        )
      })}
    </svg>
  )
}
