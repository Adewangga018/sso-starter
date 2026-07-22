import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { api } from '../../lib/api'

// Modal pencarian pegawai (untuk menambah anggota gugus). Memanggil
// /api/inovasi/pegawai. onPick(pegawai) -> { nik, nama, jabatan, unit }.
export default function PegawaiPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 2) {
      setRows([])
      return
    }
    let live = true
    setLoading(true)
    const t = setTimeout(() => {
      api
        .cariPegawaiInovasi(term)
        .then((d) => live && setRows(d))
        .catch(() => live && setRows([]))
        .finally(() => live && setLoading(false))
    }, 300)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, open])

  if (!open) return null

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,22,0.45)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: 'min(560px, 94vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Cari Pegawai</h3>
          <button type="button" className="inv__icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="inv__search" style={{ marginBottom: 12 }}>
          <span className="inv__search-icon"><Search size={16} /></span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nama atau NIK (min. 2 huruf)..." />
        </div>
        <div style={{ overflowY: 'auto' }}>
          {loading && <div className="inv__hint">Mencari...</div>}
          {!loading && q.trim().length >= 2 && rows.length === 0 && <div className="inv__hint">Tidak ada hasil.</div>}
          <table className="inv__subtable">
            <tbody>
              {rows.map((p) => (
                <tr key={p.nik}>
                  <td style={{ width: 110 }}>{p.nik}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.nama}</div>
                    <div style={{ fontSize: 11.5, color: '#7a877d' }}>{p.jabatan ?? '-'}{p.unit ? ` - ${p.unit}` : ''}</div>
                  </td>
                  <td style={{ width: 80, textAlign: 'right' }}>
                    <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '5px 12px' }}
                      onClick={() => { onPick({ nik: p.nik, nama: p.nama, jabatan: p.jabatan, unit: p.unit }); onClose() }}>
                      Pilih
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
