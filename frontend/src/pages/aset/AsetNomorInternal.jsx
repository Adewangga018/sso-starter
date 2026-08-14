import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Search, Save, Eye } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { encodeAsetId } from './asetShared'
import './AsetPage.css'

// Input Nomor Aset Internal - halaman khusus Admin Aset untuk mengisi nomor aset
// buatan tim Aset (aset.nomor_internal) secara massal, tanpa perlu buka Detail Aset
// satu-satu. Master aset tetap dari ERP; kolom ini murni label internal MyGCS.
export default function AsetNomorInternal() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [hanyaKosong, setHanyaKosong] = useState(false)
  const [draft, setDraft] = useState({}) // objectId -> nilai input sedang diketik
  const [saving, setSaving] = useState({}) // objectId -> boolean
  const [rowMsg, setRowMsg] = useState({}) // objectId -> {t, m}

  const load = useCallback(async (term) => {
    setLoading(true)
    try {
      const [list, admin] = await Promise.all([api.getAsetList(term), api.getAsetAdminStatus()])
      setData(list); setIsAdmin(admin.isAdminAset); setError('')
    } catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], total: 0 })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat aset.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load('') }, [load])

  // Cari otomatis 400ms setelah berhenti mengetik - lihat catatan sama di Inventaris.jsx.
  const bukanRenderPertama = useRef(false)
  useEffect(() => {
    if (!bukanRenderPertama.current) { bukanRenderPertama.current = true; return }
    const t = setTimeout(() => load(q), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const rows = hanyaKosong ? data.items.filter((a) => !a.nomorAset) : data.items

  function nilaiInput(a) { return draft[a.objectId] ?? a.nomorAset ?? '' }

  async function simpan(a) {
    const nomorAset = (draft[a.objectId] ?? a.nomorAset ?? '').trim()
    if (!nomorAset) { setRowMsg((m) => ({ ...m, [a.objectId]: { t: 'err', m: 'Nomor aset wajib diisi.' } })); return }
    setSaving((s) => ({ ...s, [a.objectId]: true }))
    setRowMsg((m) => ({ ...m, [a.objectId]: null }))
    try {
      await api.setAsetNomorInternal(a.objectId, { nomorAset, catatan: null })
      setRowMsg((m) => ({ ...m, [a.objectId]: { t: 'ok', m: 'Tersimpan.' } }))
      await load(q)
    } catch (err) {
      setRowMsg((m) => ({ ...m, [a.objectId]: { t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menyimpan.' } }))
    } finally {
      setSaving((s) => ({ ...s, [a.objectId]: false }))
    }
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title">Input Nomor Aset Internal</h2>
          <p className="aset__sub">Isi nomor aset buatan tim Aset per unit — terpisah dari kode ERP, dipakai sebagai label internal MyGCS.</p>
        </div>
      </div>

      <div className="aset__tools">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
          <input type="checkbox" checked={hanyaKosong} onChange={(e) => setHanyaKosong(e.target.checked)} /> Hanya yang belum ada nomor
        </label>
        <form onSubmit={(e) => { e.preventDefault(); load(q) }} style={{ display: 'flex', gap: 6 }}>
          <input className="aset__search" placeholder="Cari kode/nama/lokasi…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" className="aset__ibtn" aria-label="Cari"><Search size={16} /></button>
        </form>
      </div>

      {!isAdmin && !loading && (
        <div className="aset__msg aset__msg--err">Hanya Admin Aset yang dapat mengisi nomor aset internal. Anda bisa melihat datanya, tapi tidak bisa menyimpan perubahan.</div>
      )}

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : rows.length === 0 ? <div className="aset__empty">Tidak ada aset ditemukan.</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr><th>Kode</th><th>Nama</th><th>Lokasi</th><th>Nomor Aset Internal</th><th></th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.objectId}>
                    <td className="aset__kode"><Link to={`/my-asset/detail/${encodeAsetId(a.objectId)}`}>{a.objectId}</Link></td>
                    <td>{a.nama || '—'}</td>
                    <td className="aset__muted">{a.lokasi || '—'}</td>
                    <td>
                      <input
                        className="aset__search"
                        style={{ minWidth: 160 }}
                        value={nilaiInput(a)}
                        disabled={!isAdmin}
                        placeholder="mis. AST-2026-0001"
                        onChange={(e) => setDraft((d) => ({ ...d, [a.objectId]: e.target.value }))}
                      />
                      {rowMsg[a.objectId] && (
                        <div style={{ fontSize: '0.72rem', marginTop: 4, color: rowMsg[a.objectId].t === 'ok' ? 'var(--gcs-green-600)' : '#c0392b' }}>
                          {rowMsg[a.objectId].m}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="aset__row-act">
                        {isAdmin && (
                          <button type="button" className="aset__ibtn" title="Simpan" aria-label="Simpan" disabled={saving[a.objectId]} onClick={() => simpan(a)}>
                            {saving[a.objectId] ? <Loader2 size={14} className="aset__spin" /> : <Save size={14} />}
                          </button>
                        )}
                        <Link className="aset__ibtn" title="Detail" aria-label="Detail" to={`/my-asset/detail/${encodeAsetId(a.objectId)}`}><Eye size={14} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}