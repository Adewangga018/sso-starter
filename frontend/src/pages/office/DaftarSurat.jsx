import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, FilePlus2, Loader2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

const FILTERS = ['Semua', 'Draft', 'Menunggu Review', 'Menunggu Approval', 'Disetujui', 'Revisi', 'Batal']

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

export default function DaftarSurat() {
  const [filter, setFilter] = useState('Semua')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = useCallback(async (f) => {
    setLoading(true); setError('')
    try {
      const data = await api.getDaftarSurat(f === 'Semua' ? null : f)
      setRows(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat daftar surat.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(filter) }, [filter, load])

  return (
    <div className="mo">
      <div className="mo__head-row">
        <div>
          <h2 className="mo__intro-title">Daftar Surat</h2>
          <p className="mo__intro-sub">Surat yang Anda buat beserta statusnya.</p>
        </div>
        <button type="button" className="mo-btn" onClick={() => navigate('/my-office/buat')}>
          <FilePlus2 size={16} /> Buat Surat
        </button>
      </div>

      <div className="mo-filters">
        {FILTERS.map((f) => (
          <button type="button" key={f} className={`mo-filter${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
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
                  <tr><td colSpan={7} className="mo-empty">Belum ada surat.</td></tr>
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
