import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, X } from 'lucide-react'
import './inovasi.css'

// P.3 Jadwal Kegiatan (PDCA). Kolom bulan urut Januari s/d Desember pada tahun
// awal Periode (mis. 2026/2027 -> Jan-Des 2026). Pemilih "Dari-Sampai" membatasi
// kolom yang tampil. Tiap sel (tahapan x Rencana/Realisasi x bulan) menyimpan
// rentang tanggal yang dipilih lewat kalender.
const MONTHS = [
  [1, 'Jan'], [2, 'Feb'], [3, 'Mar'], [4, 'Apr'], [5, 'Mei'], [6, 'Jun'],
  [7, 'Jul'], [8, 'Agu'], [9, 'Sep'], [10, 'Okt'], [11, 'Nov'], [12, 'Des'],
]

const pad = (n) => String(n).padStart(2, '0')
const lastDay = (year, m) => new Date(year, m, 0).getDate() // m: 1-12
const dayOf = (iso) => (iso ? Number(iso.slice(8, 10)) : null)

// Periode "2026/2027" -> semua bulan memakai tahun awal periode (2026).
function buildCols(periode) {
  const y1 = Number(String(periode || '').split('/')[0]) || new Date().getFullYear()
  return MONTHS.map(([m, label]) => ({ m, label, year: y1 }))
}

function fmtRange(r) {
  if (!r?.start) return ''
  const s = dayOf(r.start)
  const e = r.end ? dayOf(r.end) : s
  return s === e ? `${s}` : `${s}–${e}`
}

export default function JadwalPdca({ jadwal, setJadwal, readOnly, periode }) {
  const cols = useMemo(() => buildCols(periode), [periode])
  const [winStart, setWinStart] = useState(0)
  const [winEnd, setWinEnd] = useState(cols.length - 1)
  const [openCell, setOpenCell] = useState(null) // { idx, col }

  useEffect(() => {
    setWinStart((s) => Math.min(s, cols.length - 1))
    setWinEnd((e) => Math.min(e, cols.length - 1))
  }, [cols.length])

  const shown = cols.slice(winStart, winEnd + 1)

  // Header tahun (colSpan) dari bulan yang ditampilkan.
  const yearGroups = []
  shown.forEach((c) => {
    const last = yearGroups[yearGroups.length - 1]
    if (last && last.year === c.year) last.span += 1
    else yearGroups.push({ year: c.year, span: 1 })
  })

  function applyRange(idx, m, range) {
    setJadwal((prev) => prev.map((r, i) => {
      if (i !== idx) return r
      const ranges = { ...(r.ranges || {}) }
      let bulanArr = r.bulanArr || []
      if (range) {
        ranges[m] = range
        if (!bulanArr.includes(m)) bulanArr = [...bulanArr, m]
      } else {
        delete ranges[m]
        bulanArr = bulanArr.filter((x) => x !== m)
      }
      return { ...r, ranges, bulanArr }
    }))
  }

  return (
    <>
      <div className="inv__jadwal-toolbar">
        <span className="inv__hint" style={{ margin: 0 }}>Tampilkan bulan</span>
        <label className="inv__jadwal-win">Dari
          <select value={winStart} disabled={readOnly}
            onChange={(e) => { const v = Number(e.target.value); setWinStart(v); if (v > winEnd) setWinEnd(v) }}>
            {cols.map((c, i) => <option key={i} value={i}>{c.label} {c.year}</option>)}
          </select>
        </label>
        <label className="inv__jadwal-win">Sampai
          <select value={winEnd} disabled={readOnly}
            onChange={(e) => { const v = Number(e.target.value); setWinEnd(v); if (v < winStart) setWinStart(v) }}>
            {cols.map((c, i) => <option key={i} value={i} disabled={i < winStart}>{c.label} {c.year}</option>)}
          </select>
        </label>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="inv__subtable inv__jadwal">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: 150 }}>Tahapan</th>
              <th rowSpan={2} style={{ width: 74 }}>Ket.</th>
              {yearGroups.map((y) => <th key={y.year} colSpan={y.span} style={{ textAlign: 'center' }}>{y.year}</th>)}
              <th rowSpan={2} style={{ width: 52 }}>Jml.</th>
            </tr>
            <tr>
              {shown.map((c) => <th key={c.m} style={{ textAlign: 'center', minWidth: 42 }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {jadwal.map((row, idx) => (
              <tr key={`${row.tahapan}-${row.jenis}`}>
                {row.jenis === 'Rencana' && <td rowSpan={2} style={{ fontWeight: 700, verticalAlign: 'middle' }}>{row.label || row.tahapan}</td>}
                <td>{row.jenis}</td>
                {shown.map((c) => {
                  const r = row.ranges?.[c.m]
                  const on = Boolean(r?.start) || (row.bulanArr || []).includes(c.m)
                  const bg = on ? (row.jenis === 'Rencana' ? '#1f4f2c' : '#a7d3b0') : undefined
                  const fg = on && row.jenis === 'Rencana' ? '#fff' : '#22402c'
                  return (
                    <td key={c.m}
                      className="inv__jadwal-cell"
                      style={{ background: bg, color: fg, cursor: readOnly ? 'default' : 'pointer' }}
                      title={r?.start ? `${r.start}${r.end && r.end !== r.start ? ` s/d ${r.end}` : ''}` : (readOnly ? undefined : 'Klik untuk pilih tanggal')}
                      onClick={() => { if (!readOnly) setOpenCell({ idx, col: c }) }}>
                      {fmtRange(r)}
                    </td>
                  )
                })}
                {row.jenis === 'Rencana' && (
                  <td rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', fontWeight: 700 }}>
                    {readOnly ? (row.jumlah || '-') : <input type="number" min={0} value={row.jumlah ?? ''} style={{ width: 40, textAlign: 'center' }} onChange={(e) => setJadwal((prev) => prev.map((r, i) => i === idx ? { ...r, jumlah: e.target.value } : r))} />}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="inv__hint">Klik sel bulan untuk memilih <b>rentang tanggal</b> (kalender). Hijau tua = Rencana, hijau muda = Realisasi. Jml. = total pertemuan per tahapan.</p>

      {openCell && (
        <CellDateModal
          tahapan={jadwal[openCell.idx].label || jadwal[openCell.idx].tahapan}
          jenis={jadwal[openCell.idx].jenis}
          col={openCell.col}
          range={jadwal[openCell.idx].ranges?.[openCell.col.m]}
          onClose={() => setOpenCell(null)}
          onApply={(rng) => { applyRange(openCell.idx, openCell.col.m, rng); setOpenCell(null) }}
          onClear={() => { applyRange(openCell.idx, openCell.col.m, null); setOpenCell(null) }}
        />
      )}
    </>
  )
}

function CellDateModal({ tahapan, jenis, col, range, onClose, onApply, onClear }) {
  const min = `${col.year}-${pad(col.m)}-01`
  const max = `${col.year}-${pad(col.m)}-${pad(lastDay(col.year, col.m))}`
  const [start, setStart] = useState(range?.start || min)
  const [end, setEnd] = useState(range?.end || range?.start || min)
  const ref = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,22,0.45)', display: 'grid', placeItems: 'center', zIndex: 70, padding: 16 }}>
      <div ref={ref} onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(320px, 94vw)', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarRange size={16} /> Rentang Tanggal
          </h3>
          <button type="button" className="inv__icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="inv__hint" style={{ marginTop: 0, marginBottom: 12 }}>{tahapan} &middot; {jenis} &middot; <b>{col.label} {col.year}</b></p>
        <label className="inv__field" style={{ marginBottom: 10 }}>
          <span>Tanggal Mulai</span>
          <input type="date" min={min} max={max} value={start}
            onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value) }} />
        </label>
        <label className="inv__field" style={{ marginBottom: 14 }}>
          <span>Tanggal Selesai</span>
          <input type="date" min={start || min} max={max} value={end}
            onChange={(e) => setEnd(e.target.value)} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" className="inv__btn inv__btn--ghost" onClick={onClear}>Hapus</button>
          <button type="button" className="inv__btn inv__btn--primary" onClick={() => onApply({ start, end: end || start })}>Simpan</button>
        </div>
      </div>
    </div>
  )
}
