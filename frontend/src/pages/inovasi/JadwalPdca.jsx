import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, X } from 'lucide-react'
import './inovasi.css'

// Jadwal Kegiatan (P.3 SS / P.4 GIO / C 5R). Kolom bulan mengikuti Periode: mis.
// 2026/2027 -> Jan 2026 s/d Des 2027 (dua tahun). Saat mengisi, pemilih
// "Dari-Sampai" membatasi kolom yang tampil; saat baca-saja (hasil & detail)
// kolom otomatis menyempit ke bulan yang benar-benar terjadwal sehingga bulan
// yang tidak terpakai tidak ikut tampil.
// Tiap sel dikunci year*100+bulan (ym) agar Jul 2026 != Jul 2027.
// SS/GIO: baris = tahapan x Rencana/Realisasi + kolom Jml. 5R (prop `fiveR`):
// satu baris per tahapan, tanpa Rencana/Realisasi dan tanpa Jml.
const MONTHS = [
  [1, 'Jan'], [2, 'Feb'], [3, 'Mar'], [4, 'Apr'], [5, 'Mei'], [6, 'Jun'],
  [7, 'Jul'], [8, 'Agu'], [9, 'Sep'], [10, 'Okt'], [11, 'Nov'], [12, 'Des'],
]

const pad = (n) => String(n).padStart(2, '0')
const lastDay = (year, m) => new Date(year, m, 0).getDate() // m: 1-12
const dayOf = (iso) => (iso ? Number(iso.slice(8, 10)) : null)

// Periode "2026/2027" -> dua tahun berturut (2026 & 2027), masing-masing 12 bulan.
// Bila periode hanya satu tahun, tampilkan tahun itu + tahun berikutnya.
function buildCols(periode) {
  const parts = String(periode || '').split('/').map((s) => Number(s.trim())).filter(Boolean)
  const y1 = parts[0] || new Date().getFullYear()
  const years = parts.length >= 2 ? [parts[0], parts[1]] : [y1, y1 + 1]
  const cols = []
  for (const year of years) for (const [m, label] of MONTHS) cols.push({ ym: year * 100 + m, m, label, year })
  return cols
}

function fmtRange(r) {
  if (!r?.start) return ''
  const s = dayOf(r.start)
  const e = r.end ? dayOf(r.end) : s
  return s === e ? `${s}` : `${s}–${e}`
}

// Rentang kolom yang benar-benar terjadwal (bulan pertama s/d terakhir yang
// terisi). Dipakai pada mode baca-saja: hasil & detail hanya menampilkan bulan
// sesuai jadwalnya, bukan seluruh 24 bulan Periode. null bila belum ada jadwal.
function rentangTerpakai(cols, jadwal) {
  const on = new Set()
  for (const r of jadwal ?? []) {
    for (const ym of Object.keys(r?.ranges ?? {})) on.add(Number(ym))
    for (const ym of r?.bulanArr ?? []) on.add(Number(ym))
  }
  let lo = -1
  let hi = -1
  cols.forEach((c, i) => { if (on.has(c.ym)) { if (lo < 0) lo = i; hi = i } })
  return lo < 0 ? null : { lo, hi }
}

export default function JadwalPdca({ jadwal, setJadwal, readOnly, periode, fiveR = false }) {
  const cols = useMemo(() => buildCols(periode), [periode])
  const [winStart, setWinStart] = useState(0)
  const [winEnd, setWinEnd] = useState(cols.length - 1)
  const [openCell, setOpenCell] = useState(null) // { idx, col }

  // Saat jumlah kolom berubah (mis. Periode berubah), tampilkan seluruh rentang.
  useEffect(() => {
    setWinStart(0)
    setWinEnd(cols.length - 1)
  }, [cols.length])

  // Baca-saja: kolom mengikuti jadwal yang terisi (tanpa pemilih Dari-Sampai).
  // Mode edit: mengikuti pemilih agar bulan kosong tetap bisa diklik.
  const terpakai = useMemo(() => rentangTerpakai(cols, jadwal), [cols, jadwal])
  const win = readOnly ? (terpakai ?? { lo: 0, hi: cols.length - 1 }) : { lo: winStart, hi: winEnd }
  const shown = cols.slice(win.lo, win.hi + 1)

  // 5R: satu baris per tahapan (pakai baris 'Rencana' sebagai kanonis).
  const rows = fiveR ? jadwal.filter((r) => r.jenis === 'Rencana') : jadwal

  // Header tahun (colSpan) dari bulan yang ditampilkan.
  const yearGroups = []
  shown.forEach((c) => {
    const last = yearGroups[yearGroups.length - 1]
    if (last && last.year === c.year) last.span += 1
    else yearGroups.push({ year: c.year, span: 1 })
  })

  function applyRange(idx, ym, range) {
    setJadwal((prev) => prev.map((r, i) => {
      if (i !== idx) return r
      const ranges = { ...(r.ranges || {}) }
      let bulanArr = r.bulanArr || []
      if (range) {
        ranges[ym] = range
        if (!bulanArr.includes(ym)) bulanArr = [...bulanArr, ym]
      } else {
        delete ranges[ym]
        bulanArr = bulanArr.filter((x) => x !== ym)
      }
      return { ...r, ranges, bulanArr }
    }))
  }

  // Sel bulan (satu untuk tiap tahapan x bulan). `dark` menentukan warna: hijau
  // tua untuk Rencana / baris tunggal 5R, hijau muda untuk Realisasi.
  const renderCells = (row, idx, dark) => shown.map((c) => {
    const r = row.ranges?.[c.ym]
    const on = Boolean(r?.start) || (row.bulanArr || []).includes(c.ym)
    const bg = on ? (dark ? '#1f4f2c' : '#a7d3b0') : undefined
    const fg = on && dark ? '#fff' : '#22402c'
    return (
      <td key={c.ym}
        className="inv__jadwal-cell"
        style={{ background: bg, color: fg, cursor: readOnly ? 'default' : 'pointer' }}
        title={r?.start ? `${r.start}${r.end && r.end !== r.start ? ` s/d ${r.end}` : ''}` : (readOnly ? undefined : 'Klik untuk pilih tanggal')}
        onClick={() => { if (!readOnly) setOpenCell({ idx, col: c }) }}>
        {fmtRange(r)}
      </td>
    )
  })

  return (
    <>
      {!readOnly && (
        <div className="inv__jadwal-toolbar">
          <span className="inv__hint" style={{ margin: 0 }}>Tampilkan bulan</span>
          <label className="inv__jadwal-win">Dari
            <select value={winStart}
              onChange={(e) => { const v = Number(e.target.value); setWinStart(v); if (v > winEnd) setWinEnd(v) }}>
              {cols.map((c, i) => <option key={i} value={i}>{c.label} {c.year}</option>)}
            </select>
          </label>
          <label className="inv__jadwal-win">Sampai
            <select value={winEnd}
              onChange={(e) => { const v = Number(e.target.value); setWinEnd(v); if (v < winStart) setWinStart(v) }}>
              {cols.map((c, i) => <option key={i} value={i} disabled={i < winStart}>{c.label} {c.year}</option>)}
            </select>
          </label>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="inv__subtable inv__jadwal">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: 150 }}>Tahapan</th>
              {!fiveR && <th rowSpan={2} style={{ width: 74 }}>Ket.</th>}
              {yearGroups.map((y) => <th key={y.year} colSpan={y.span} style={{ textAlign: 'center' }}>{y.year}</th>)}
              {!fiveR && <th rowSpan={2} style={{ width: 52 }}>Jml.</th>}
            </tr>
            <tr>
              {shown.map((c) => <th key={c.ym} style={{ textAlign: 'center', minWidth: 42 }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {fiveR
              ? rows.map((row) => {
                const idx = jadwal.indexOf(row)
                return (
                  <tr key={row.tahapan}>
                    <td style={{ fontWeight: 700 }}>{row.label || row.tahapan}</td>
                    {renderCells(row, idx, true)}
                  </tr>
                )
              })
              : jadwal.map((row, idx) => (
                <tr key={`${row.tahapan}-${row.jenis}`}>
                  {row.jenis === 'Rencana' && <td rowSpan={2} style={{ fontWeight: 700, verticalAlign: 'middle' }}>{row.label || row.tahapan}</td>}
                  <td>{row.jenis}</td>
                  {renderCells(row, idx, row.jenis === 'Rencana')}
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
      <p className="inv__hint">
        {readOnly
          ? (terpakai ? 'Kolom bulan mengikuti jadwal yang terisi.' : 'Belum ada bulan terjadwal.')
          : <>Klik sel bulan untuk memilih <b>rentang tanggal</b> (kalender).</>}
        {fiveR ? ' Sel hijau menandai bulan pelaksanaan tahapan.' : ' Hijau tua = Rencana, hijau muda = Realisasi. Jml. = total pertemuan per tahapan.'}
      </p>

      {openCell && (
        <CellDateModal
          tahapan={jadwal[openCell.idx].label || jadwal[openCell.idx].tahapan}
          jenis={fiveR ? null : jadwal[openCell.idx].jenis}
          col={openCell.col}
          range={jadwal[openCell.idx].ranges?.[openCell.col.ym]}
          onClose={() => setOpenCell(null)}
          onApply={(rng) => { applyRange(openCell.idx, openCell.col.ym, rng); setOpenCell(null) }}
          onClear={() => { applyRange(openCell.idx, openCell.col.ym, null); setOpenCell(null) }}
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
        <p className="inv__hint" style={{ marginTop: 0, marginBottom: 12 }}>{tahapan}{jenis ? ` · ${jenis}` : ''} &middot; <b>{col.label} {col.year}</b></p>
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
