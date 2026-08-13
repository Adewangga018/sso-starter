import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { api } from '../../lib/api'
import './AsetPage.css'

// Modal pencarian pegawai untuk PIC aset (search-as-you-type, min 2 huruf).
// onPick(pegawai) -> { nik, nama, jabatan, unit }.
export default function AsetPegawaiPicker({ onClose, onPick }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRows([]); setLoading(false); return }
    let live = true
    setLoading(true)
    const t = setTimeout(() => {
      api.cariPegawaiAset(term)
        .then((d) => live && setRows(d))
        .catch(() => live && setRows([]))
        .finally(() => live && setLoading(false))
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  return (
    <div className="aset__overlay" onClick={onClose}>
      <div className="aset__modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="aset__modal-head">
          <h3>Cari Pegawai</h3>
          <button type="button" className="aset__x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="aset__modal-body">
          <label className="aset__f aset__f--full">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Nama atau NIK</span>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik minimal 2 huruf…" />
          </label>

          <div style={{ gridColumn: '1 / -1', maxHeight: 320, overflowY: 'auto' }}>
            {loading && <div className="aset__muted" style={{ fontSize: '0.84rem' }}>Memuat…</div>}
            {!loading && q.trim().length >= 2 && rows.length === 0 && (
              <div className="aset__muted" style={{ fontSize: '0.84rem' }}>Tidak ada hasil.</div>
            )}
            {!loading && q.trim().length < 2 && (
              <div className="aset__muted" style={{ fontSize: '0.84rem' }}>Ketik nama atau NIK untuk mencari.</div>
            )}
            <div className="aset__mlist">
              {rows.map((p) => (
                <button
                  type="button"
                  key={p.nik}
                  className="aset__mrow"
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--gcs-border)', background: 'var(--gcs-white)' }}
                  onClick={() => { onPick(p); onClose() }}
                >
                  <span>
                    <b>{p.nama}</b> ({p.nik})
                    <br /><small className="aset__muted">{p.jabatan || '—'}{p.unit ? ` · ${p.unit}` : ''}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}