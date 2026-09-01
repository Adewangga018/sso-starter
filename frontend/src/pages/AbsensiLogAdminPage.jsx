import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ImageOff, Loader2, RotateCw, ShieldAlert, TriangleAlert, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './PayrollShared.css'
import './AbsensiLokasiAdminPage.css'

const pad = (n) => String(n).padStart(2, '0')
function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AbsensiLogAdminPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hanyaPeringatan, setHanyaPeringatan] = useState(true)
  const [nik, setNik] = useState('')

  const [fotoOpen, setFotoOpen] = useState(false)
  const [fotoUrl, setFotoUrl] = useState(null)
  const [fotoLoading, setFotoLoading] = useState(false)
  const [fotoError, setFotoError] = useState('')

  async function lihatFoto(row) {
    setFotoOpen(true); setFotoLoading(true); setFotoError(''); setFotoUrl(null)
    try {
      const { url } = await api.getAbsensiLogFoto(row.id)
      setFotoUrl(url)
    } catch (err) {
      setFotoError(err instanceof ApiError ? err.message : 'Gagal memuat foto.')
    } finally {
      setFotoLoading(false)
    }
  }

  function tutupFoto() {
    setFotoOpen(false)
    if (fotoUrl) URL.revokeObjectURL(fotoUrl)
    setFotoUrl(null); setFotoError('')
  }

  async function load() {
    setLoading(true); setError('')
    try {
      setItems(await api.listAbsensiLogAdmin({ hanyaPeringatan, nik: nik.trim() || undefined }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data log absensi.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [hanyaPeringatan]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdminModulSdm) {
    return (
      <div className="agt">
        <div className="agt__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Audit Log Absensi Mobile hanya untuk Admin Modul SDM.</p>
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
        <h2 className="agt__title"><TriangleAlert size={20} /> Audit Log Absensi Mobile</h2>
        <p className="agt__sub">
          Riwayat absen app mobile (MyGCS Absensi). Baris dengan tanda <b>peringatan</b> berarti server
          mendeteksi anomali dari absen sebelumnya: kecepatan tempuh yang tidak masuk akal ("impossible
          travel") ATAU koordinat yang identik persis (indikasi kuat lokasi di-replay dari nilai yang
          di-hardcode alat fake-GPS). Ini murni sinyal audit, tidak memblokir absen - keputusan tindak
          lanjut ada di tangan Admin SDM.
        </p>
      </div>

      <div className="agt__sel" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
            <input type="checkbox" checked={hanyaPeringatan} onChange={(e) => setHanyaPeringatan(e.target.checked)} />
            Hanya yang ada peringatan
          </label>
          <input
            type="text" placeholder="Filter NIK..." value={nik}
            onChange={(e) => setNik(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ padding: '7px 10px', border: '1px solid var(--gcs-border)', borderRadius: 8, fontSize: 13.5 }}
          />
        </div>
        <button type="button" className="agt__save agt__save--sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <RotateCw size={14} />}
          Muat Ulang
        </button>
      </div>

      {error && <div className="agt__msg agt__msg--err">{error}</div>}

      {loading && !items ? (
        <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
      ) : !items || items.length === 0 ? (
        <div className="agt__empty">
          {hanyaPeringatan ? 'Tidak ada catatan absen dengan peringatan.' : 'Belum ada data log absensi.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="agt__presensi-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Tanggal</th>
                <th>Jam</th>
                <th>Titik</th>
                <th>Akurasi</th>
                <th>Peringatan</th>
                <th>Foto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} style={row.peringatanAnomali ? { background: 'rgba(217,119,6,0.08)' } : undefined}>
                  <td>
                    <div>{row.namaKaryawan ?? '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gcs-text-muted)' }}>{row.idKaryawan}</div>
                  </td>
                  <td>{row.tanggal}</td>
                  <td>{row.checkIn ? `Masuk ${row.checkIn}` : row.checkOut ? `Keluar ${row.checkOut}` : '-'}</td>
                  <td>{row.tempat ?? '-'}</td>
                  <td>{row.accuracy != null ? `${Math.round(row.accuracy)} m` : '-'}</td>
                  <td>
                    {row.peringatanAnomali ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', color: '#b45309', fontSize: 12.5, fontWeight: 600 }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{row.peringatanAnomali}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--gcs-text-muted)', fontSize: 12.5 }}>-</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="agt__ibtn" title="Lihat foto" onClick={() => lihatFoto(row)}>
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fotoOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)' }}
          onClick={tutupFoto}
        >
          <div
            style={{ maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button" onClick={tutupFoto} aria-label="Tutup"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, color: '#fff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            {fotoLoading ? (
              <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 className="agt__spin" size={20} /> Memuat foto…
              </div>
            ) : fotoError ? (
              <div style={{ color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24 }}>
                <ImageOff size={32} />
                <span>{fotoError}</span>
              </div>
            ) : (
              <img
                src={fotoUrl} alt="Foto bukti absen"
                style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, display: 'block' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
