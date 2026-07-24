// Visualisasi diagram tulang ikan (Ishikawa) dari data P.6 Fishbone.
// Urutan rusuk dibaca dari garis tengah ke luar: penyebab ke-1, ke-2, dst
// (kotak bergaris; penyebab terakhir = akar terdalam, kotak terisi), lalu kotak
// faktor (judul) di ujung rusuk. "Akar Penyebab
// Dominan" sengaja tidak digambar di sini — cukup tampil pada tabel P.6.
// Seluruh teks ditampilkan penuh (dibungkus multi-baris, tanpa "...").
const COLORS = ['#1f6b39', '#2f7d4f', '#3b6ea5', '#a5762f', '#7a4fa3', '#b0533a']
const CAP = 6 // maksimum penyebab yang divisualkan per faktor

const FAKTOR_LABEL = (f) => ({
  Man: 'Manusia (Man)',
  Method: 'Metode (Method)',
  Machine: 'Mesin/Alat (Machine)',
  Material: 'Material (Data)',
  Environment: 'Lingkungan (Env.)',
}[f] || f)

// Sisi tiap faktor pada 4M1E standar: Man/Method/Material di ATAS garis tengah,
// Machine/Environment di BAWAH. -1 = atas, 1 = bawah.
const SIDE = { Man: -1, Method: -1, Material: -1, Machine: 1, Environment: 1 }

const splitCauses = (s) => String(s || '').split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean).slice(0, CAP)

// Bungkus teks jadi beberapa baris <= maxChars, pemenggalan kata panjang dipaksa.
function wrap(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (w.length > maxChars) {
      if (cur) { lines.push(cur); cur = '' }
      let rest = w
      while (rest.length > maxChars) { lines.push(rest.slice(0, maxChars)); rest = rest.slice(maxChars) }
      cur = rest
      continue
    }
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w }
    else { cur = (cur + ' ' + w).trim() }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

export default function FishboneDiagram({ fishbone = [], masalah }) {
  const items = (fishbone || []).filter((f) => f.faktor)
  if (!items.length) return null

  const RIB = 46, GAP = 8, FACT_H = 26, LINE_H = 12, PAD = 8
  const BW = 168, CAUSE_CHARS = 28
  const spineX0 = 40, headX = 1020, W = 1240

  // Geometri rantai + sisi (atas/bawah) per faktor. Jarak "near" diukur dari
  // ujung rusuk (dekat garis tengah) ke arah luar: penyebab dulu, faktor terakhir.
  const factors = items.map((f, i) => {
    const causes = splitCauses(f.penyebab).map((text) => {
      const lines = wrap(text, CAUSE_CHARS)
      return { lines, h: lines.length * LINE_H + PAD }
    })

    let d = 0
    const placed = causes.map((c) => { const near = d; d += c.h + GAP; return { ...c, near } })
    const factNear = d // sisi dalam kotak faktor
    d += FACT_H
    const factW = Math.max(130, FAKTOR_LABEL(f.faktor).length * 7.3 + 26)
    const dir = SIDE[f.faktor] ?? (i % 2 === 0 ? -1 : 1)
    return { f, i, causes: placed, factNear, extent: RIB + d, factW, dir }
  })

  // Sebar horizontal: kelompok atas & bawah masing-masing merata sepanjang tulang,
  // sehingga rusuk atas (Man/Method/Material) & bawah (Machine/Env.) tidak bertumpuk.
  const regionX0 = 200
  const assignX = (group) => {
    const step = (headX - regionX0) / (group.length + 1)
    group.forEach((x, k) => { x.baseX = regionX0 + step * (k + 1) })
  }
  assignX(factors.filter((x) => x.dir === -1))
  assignX(factors.filter((x) => x.dir === 1))

  const maxExtent = Math.max(...factors.map((x) => x.extent))
  const headLines = wrap(masalah || 'Masalah Utama', 20)
  const headH = Math.max(92, headLines.length * 15 + 26)
  const midY = Math.max(190, maxExtent + 20, headH / 2 + 20)
  const H = midY * 2

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--inv-line, #dbe3dc)', borderRadius: 10, padding: 8, background: '#fbfdfb' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 820, maxWidth: 1240, display: 'block' }} role="img" aria-label="Diagram tulang ikan (fishbone)">
        {/* Tulang punggung + panah ke kepala */}
        <line x1={spineX0} y1={midY} x2={headX} y2={midY} stroke="#1f4f2c" strokeWidth={3} />
        <polygon points={`${headX},${midY - 9} ${headX},${midY + 9} ${headX + 16},${midY}`} fill="#1f4f2c" />
        {/* Kepala = masalah utama */}
        <rect x={headX + 16} y={midY - headH / 2} width={188} height={headH} rx={10} fill="#1f4f2c" />
        <text x={headX + 110} y={midY - (headLines.length - 1) * 7.5} fill="#fff" fontSize={11.5} fontWeight={700} textAnchor="middle">
          {headLines.map((ln, i) => <tspan key={i} x={headX + 110} dy={i === 0 ? 0 : 15}>{ln}</tspan>)}
        </text>

        {factors.map(({ f, i, causes, factNear, factW, dir, baseX }) => {
          const tipX = baseX - 62
          const tipY = midY + dir * RIB // ujung rusuk diagonal = pangkal rantai
          const color = COLORS[i % COLORS.length]
          const factTopY = dir === 1 ? tipY + dir * factNear : tipY + dir * (factNear + FACT_H)

          return (
            <g key={i}>
              {/* Rusuk diagonal spine -> pangkal rantai */}
              <line x1={baseX} y1={midY} x2={tipX} y2={tipY} stroke={color} strokeWidth={2.5} />
              {/* Konektor vertikal: pangkal rantai -> kotak faktor di ujung */}
              <line x1={tipX} y1={tipY} x2={tipX} y2={tipY + dir * factNear} stroke={color} strokeWidth={1.4} />
              {/* Kotak penyebab (bergaris), urut dari garis tengah ke luar */}
              {causes.map((c, ci) => {
                const nearY = tipY + dir * c.near
                const topY = dir === 1 ? nearY : nearY - c.h
                // Penyebab terakhir (paling luar) = akar terdalam -> kotak terisi.
                const last = ci === causes.length - 1
                return (
                  <g key={ci}>
                    <rect x={tipX - BW / 2} y={topY} width={BW} height={c.h} rx={4}
                      fill={last ? color : '#fff'} stroke={last ? '#14331f' : color} strokeWidth={last ? 2 : 1.2} />
                    {c.lines.map((ln, li) => (
                      <text key={li} x={tipX} y={topY + 4 + LINE_H * (li + 0.85)} fill={last ? '#fff' : '#2c3a30'} fontSize={9.5} fontWeight={last ? 700 : 400} textAnchor="middle">{ln}</text>
                    ))}
                  </g>
                )
              })}
              {/* Kotak faktor (judul) di ujung rusuk, lebar mengikuti panjang label */}
              <rect x={tipX - factW / 2} y={factTopY} width={factW} height={FACT_H} rx={6} fill={color} />
              <text x={tipX} y={factTopY + FACT_H / 2 + 4} fill="#fff" fontSize={12} fontWeight={700} textAnchor="middle">{FAKTOR_LABEL(f.faktor)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
