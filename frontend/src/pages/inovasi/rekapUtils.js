// Utilitas bersama menu "Rekap Kegiatan Inovasi" & "History".
export const METODOLOGI = ['SS', 'GIO', '5R']

export const tglId = (v) => (v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-')
export const waktuId = (v) => (v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')

// Periode inovasi berformat "2026/2027"; dipakai sebagai filter di beberapa rekap.
export const periodeList = (rows, key = 'periode') =>
  [...new Set((rows ?? []).map((r) => r[key]).filter(Boolean))].sort((a, b) => String(b).localeCompare(String(a)))

export const cocokCari = (row, kolom, term) => {
  const t = term.trim().toLowerCase()
  if (!t) return true
  return kolom.some((k) => (row[k] ?? '').toString().toLowerCase().includes(t))
}

// Unduh tabel sebagai CSV (dibuka Excel). BOM agar karakter Indonesia tidak rusak,
// pemisah ";" mengikuti locale id-ID pada Excel.
export function unduhCsv(namaFile, header, baris) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const isi = [header, ...baris].map((r) => r.map(esc).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`﻿${isi}`], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile.endsWith('.csv') ? namaFile : `${namaFile}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
