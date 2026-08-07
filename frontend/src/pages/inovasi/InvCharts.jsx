// Diagram batang ringan (inline SVG, tanpa library eksternal) dipakai bersama
// oleh halaman-halaman Rekap & Statistik Inovasi (Grafik Sumbang Gagasan,
// Ringkasan Seluruh Perusahaan, dst).
export const HIJAU = '#1f6b39'

function batangTegak(x, y, w, h, r = 4) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} a${rr},${rr} 0 0 1 ${rr},-${rr} h${w - rr * 2} a${rr},${rr} 0 0 1 ${rr},${rr} V${y + h} Z`
}
function batangDatar(x, y, w, h, r = 4) {
  const rr = Math.min(r, w, h / 2)
  return `M${x},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${h - rr * 2} a${rr},${rr} 0 0 1 -${rr},${rr} H${x} Z`
}

export function BatangVertikal({ data, warna = HIJAU }) {
  const W = 760, H = 260, L = 34, R = 10, T = 22, B = 30
  const plotW = W - L - R, plotH = H - T - B
  const maks = Math.max(1, ...data.map((d) => d.nilai))
  const step = plotW / data.length
  const bw = Math.max(10, step - 12)
  const garis = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maks * f))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagram batang" style={{ display: 'block' }}>
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
                <path d={batangTegak(x, y, bw, h)} fill={warna} />
                <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#2c3a30">{d.nilai}</text>
              </>
            )}
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize={10.5} fill="#5c6b60">{d.label}</text>
            <title>{`${d.label}: ${d.nilai}`}</title>
          </g>
        )
      })}
      <line x1={L} y1={T + plotH} x2={W - R} y2={T + plotH} stroke="#c8d3ca" strokeWidth={1} />
    </svg>
  )
}

export function BatangHorizontal({ data, warna = HIJAU }) {
  // Hitung panjang teks label terpanjang untuk penyesuaian area label
  const maxLabelLen = Math.max(0, ...data.map((d) => (d?.label ?? '').length))

  // LABEL: alokasi lebar area teks di sebelah kiri batang diagram
  // Fleksibel antara 160px hingga 240px menyesuaikan isi label
  const LABEL = Math.min(240, Math.max(160, Math.round(maxLabelLen * 6.5 + 24)))
  const R = 44, BAR = 20, GAP = 10, T = 6
  const W = Math.max(520, LABEL + 280)
  const H = Math.max(60, data.length * (BAR + GAP) + T * 2)
  const plotW = W - LABEL - R
  const maks = Math.max(1, ...data.map((d) => d.nilai))

  // Batas maksimum karakter agar teks label tidak pernah terpotong di tepi kiri canvas (x < 8)
  const maxChars = Math.max(12, Math.floor((LABEL - 16) / 6.4))

  function formatLabelText(str) {
    if (!str) return ''
    if (str.length <= maxChars) return str
    return str.slice(0, maxChars - 1) + '…'
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagram batang" style={{ display: 'block' }}>
      {data.map((d, i) => {
        const y = T + i * (BAR + GAP)
        const w = Math.max(2, (d.nilai / maks) * plotW)
        const labelTampil = formatLabelText(d.label)
        return (
          <g key={d.label}>
            <text x={LABEL - 8} y={y + BAR / 2 + 4} textAnchor="end" fontSize={11} fill="#5c6b60">
              {labelTampil}
            </text>
            <path d={batangDatar(LABEL, y, w, BAR)} fill={warna} />
            <text x={LABEL + w + 7} y={y + BAR / 2 + 4} fontSize={11} fontWeight={700} fill="#2c3a30">
              {d.nilai}
            </text>
            <title>{`${d.label}: ${d.nilai}`}</title>
          </g>
        )
      })}
    </svg>
  )
}
