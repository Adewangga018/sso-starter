import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Loader2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

function StatusBadge({ status }) {
  const slug = status.toLowerCase().replace(/\s+/g, '-')
  return <span className={`mo-status mo-status--${slug}`}>{status}</span>
}
function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// mode: 'review' | 'approval'
export default function MenungguSurat({ mode }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isReview = mode === 'review'
  const title = isReview ? 'Menunggu Review' : 'Menunggu Approval'
  const subtitle = isReview
    ? 'Surat yang menunggu review Anda.'
    : 'Surat yang menunggu persetujuan (approval) Anda.'

  useEffect(() => {
    let alive = true
    const fetcher = isReview ? api.getMenungguReviewOffice : api.getMenungguApprovalOffice
    fetcher()
      .then((d) => { if (alive) { setRows(d); setLoading(false) } })
      .catch((err) => {
        if (alive) {
          setError(err instanceof ApiError ? err.message : 'Gagal memuat data.')
          setLoading(false)
        }
      })
    return () => { alive = false }
  }, [isReview])

  return (
    <div className="mo">
      <div className="mo__intro">
        <h2 className="mo__intro-title">{title}</h2>
        <p className="mo__intro-sub">{subtitle}</p>
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
                  <th>Judul</th>
                  <th>Jenis</th>
                  <th>Sifat</th>
                  <th>Kecepatan</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="mo-empty">Tidak ada surat yang menunggu tindakan Anda.</td></tr>
                )}
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{formatTgl(s.tanggalSurat ?? s.dibuatPada)}</td>
                    <td className="mo-td-judul">{s.judul}</td>
                    <td>{s.jenis}</td>
                    <td>{s.sifat}</td>
                    <td>{s.kecepatan}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <Link to={`/my-office/surat/${s.id}`} className="mo-icon-btn" title="Lihat & tindak">
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
