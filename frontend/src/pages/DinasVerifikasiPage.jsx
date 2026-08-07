import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Camera, Loader2, MapPinned, RotateCw, ShieldAlert, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './PayrollShared.css'

const JENIS_OPTIONS = [
  { value: '', label: 'Semua Jenis' },
  { value: 'UMDL', label: 'UMDL' },
  { value: 'SPPD', label: 'SPPD' },
]

const pad = (n) => String(n).padStart(2, '0')
function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Verifikasi bukti dinas (rentang km + foto lokasi) SELURUH perusahaan, lintas UMDL/SPPD -
// khusus Admin SDM, TIDAK terbatas pada alur approval sendiri (beda dari Kotak Persetujuan
// yang cuma menampilkan pengajuan yg approval-nya masuk ke akun ybs).
export default function DinasVerifikasiPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const [jenis, setJenis] = useState('')
  const [nik, setNik] = useState('')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null) // { url } | null
  const [previewLoading, setPreviewLoading] = useState(null) // id lagi dimuat

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await api.getDinasAdminList({ jenis, nik: nik.trim(), dari, sampai })
      setItems(data.items)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data bukti dinas.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function lihatFoto(row) {
    setPreviewLoading(row.id)
    try {
      const { url } = await api.getBlob(row.fotoUrl)
      setPreview({ url })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat foto bukti dinas.')
    } finally {
      setPreviewLoading(null)
    }
  }

  function closePreview() {
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  if (!isAdminModulSdm) {
    return (
      <div className="agt">
        <div className="agt__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Verifikasi bukti dinas hanya untuk Admin Modul SDM (Kepala Bagian SDM ke atas hingga GM SKP).</p>
          <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="agt">
      <div className="agt__top">
        <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="agt__role">Admin Modul SDM{summary?.nama ? <> · <span className="u-nama">{summary.nama}</span></> : ''}</span>
      </div>

      <div className="agt__head">
        <h2 className="agt__title"><MapPinned size={20} /> Verifikasi Dinas</h2>
        <p className="agt__sub">Bukti perjalanan dinas (rentang km + foto lokasi) seluruh perusahaan — UMDL & SPPD.</p>
      </div>

      <div className="agt__sel">
        <label>Jenis
          <select value={jenis} onChange={(e) => setJenis(e.target.value)}>
            {JENIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>NIK
          <input type="text" value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Semua" style={{ minWidth: 140 }} />
        </label>
        <label>Dari Tanggal
          <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
        </label>
        <label>Sampai Tanggal
          <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
        </label>
        <button type="button" className="agt__save agt__save--sm" onClick={load} disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <RotateCw size={14} />}
          Terapkan
        </button>
      </div>

      {error && <div className="agt__msg agt__msg--err">{error}</div>}

      {loading && !items ? (
        <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
      ) : !items || items.length === 0 ? (
        <div className="agt__empty">Tidak ada data bukti dinas yang cocok dengan filter.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="agt__presensi-table">
            <thead>
              <tr>
                <th>Waktu Input</th>
                <th>Jenis</th>
                <th>NIK</th>
                <th>Nama</th>
                <th>Rentang Km</th>
                <th>Ringkasan</th>
                <th>Status</th>
                <th>Foto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${row.jenis}-${row.id}`}>
                  <td>{formatTgl(row.dibuatPada)}</td>
                  <td>{row.jenis}</td>
                  <td>{row.nik}</td>
                  <td>{row.nama ?? '-'}</td>
                  <td>{row.rentangKm} km (PP)</td>
                  <td>{row.ringkasan ?? '-'}</td>
                  <td>{row.status ?? '-'}</td>
                  <td>
                    <button
                      type="button" className="agt__ibtn" onClick={() => lihatFoto(row)}
                      disabled={previewLoading === row.id} title="Lihat foto bukti"
                    >
                      {previewLoading === row.id ? <Loader2 size={14} className="agt__spin" /> : <Camera size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="agt__presensi" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: 0 }} onClick={closePreview}>
          <div style={{ maxWidth: 560, width: '90%', background: 'var(--gcs-white)', borderRadius: 14, padding: 14 }} onClick={(e) => e.stopPropagation()}>
            <div className="agt__presensi-head">
              <span className="agt__presensi-nama">Foto Bukti Dinas</span>
              <button type="button" className="agt__ibtn" onClick={closePreview} aria-label="Tutup"><X size={16} /></button>
            </div>
            <img src={preview.url} alt="Foto bukti dinas" style={{ width: '100%', borderRadius: 10 }} />
          </div>
        </div>
      )}
    </div>
  )
}
