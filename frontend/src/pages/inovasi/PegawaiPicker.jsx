import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { api } from '../../lib/api'

// Modal pencarian pegawai (untuk menambah anggota gugus). Memanggil
// /api/inovasi/pegawai. onPick(pegawai) -> { nik, nama, jabatan, unit }.
// gugusId membatasi hasil sesuai cakupan metodologi (SS/5R). existingNiks =
// daftar NIK yang sudah menjadi anggota; kandidat itu ditandai & tak bisa dipilih
// lagi (mencegah duplikat).
export default function PegawaiPicker({ open, onClose, onPick, gugusId, existingNiks = [] }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const taken = new Set((existingNiks ?? []).filter(Boolean).map(String))

  // Saat dibuka / kata kunci < 2 huruf: tampilkan daftar default sesuai cakupan
  // gugus (dep./kompartemen) tanpa perlu mengetik. >= 2 huruf: cari lebih luas.
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    const cari = term.length >= 2 ? term : ''
    let live = true
    setLoading(true)
    const t = setTimeout(() => {
      api
        .cariPegawaiInovasi(cari, gugusId)
        .then((d) => live && setRows(d))
        .catch(() => live && setRows([]))
        .finally(() => live && setLoading(false))
    }, cari ? 300 : 0)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, open, gugusId])

  if (!open) return null

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,22,0.45)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 12 }}>
      {/* Tinggi maksimum lewat kelas (inv__sheet--short): butuh dvh + cadangan
          vh, lihat inovasi.css. */}
      <div className="inv__sheet--short" onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: 'min(560px, 94vw)', display: 'flex', flexDirection: 'column', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Cari Pegawai</h3>
          <button type="button" className="inv__icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="inv__search" style={{ marginBottom: 8 }}>
          <span className="inv__search-icon"><Search size={16} /></span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nama atau NIK untuk mencari lebih luas..." />
        </div>
        <p className="inv__hint" style={{ marginTop: 0, marginBottom: 12 }}>Pegawai satu departemen/kompartemen tampil otomatis. Ketik (min. 2 huruf) untuk mencari lebih luas.</p>
        <div style={{ overflowY: 'auto' }}>
          {loading && <div className="inv__hint">Memuat...</div>}
          {!loading && rows.length === 0 && (
            <div className="inv__hint">{q.trim().length >= 2 ? 'Tidak ada hasil.' : 'Belum ada pegawai pada cakupan ini.'}</div>
          )}
          <table className="inv__subtable">
            <tbody>
              {rows.map((p) => {
                const sudah = taken.has(String(p.nik))
                return (
                  <tr key={p.nik} style={sudah ? { opacity: 0.55 } : undefined}>
                    <td style={{ width: 110 }}>{p.nik}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.nama}</div>
                      <div style={{ fontSize: 11.5, color: '#7a877d' }}>{p.jabatan ?? '-'}{p.unit ? ` - ${p.unit}` : ''}</div>
                    </td>
                    <td style={{ width: 90, textAlign: 'right' }}>
                      {sudah ? (
                        <span style={{ fontSize: 11.5, color: '#7a877d' }}>Sudah ada</span>
                      ) : (
                        <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '5px 12px' }}
                          onClick={() => { onPick({ nik: p.nik, nama: p.nama, jabatan: p.jabatan, unit: p.unit }); onClose() }}>
                          Pilih
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
