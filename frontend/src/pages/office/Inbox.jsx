import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Loader2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export default function Inbox() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.getInboxOffice()
      .then((d) => { if (alive) { setRows(d); setLoading(false) } })
      .catch((err) => {
        if (alive) {
          setError(err instanceof ApiError ? err.message : 'Gagal memuat kotak masuk.')
          setLoading(false)
        }
      })
    return () => { alive = false }
  }, [])

  return (
    <div className="mo">
      <div className="mo__intro">
        <h2 className="mo__intro-title">Kotak Masuk</h2>
        <p className="mo__intro-sub">Surat yang telah disetujui dan ditujukan atau ditembuskan kepada Anda.</p>
      </div>

      {error && <div className="mo__alert mo__alert--err">{error}</div>}

      <div className="mo-card">
        {loading ? (
          <div className="mo__loading"><Loader2 className="mo__spin" size={20} /> Memuat…</div>
        ) : (
          <div className="mo-table-wrap">
            <table className="mo-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nomor</th>
                  <th>Judul</th>
                  <th>Jenis</th>
                  <th>Sifat</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="mo-empty">Belum ada surat masuk.</td></tr>
                )}
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{formatTgl(s.tanggalSurat ?? s.dibuatPada)}</td>
                    <td>{s.nomor || '-'}</td>
                    <td className="mo-td-judul">{s.judul}</td>
                    <td>{s.jenis}</td>
                    <td>{s.sifat}</td>
                    <td>
                      <Link to={`/my-office/surat/${s.id}`} className="mo-icon-btn" title="Lihat detail">
                        <Eye size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
