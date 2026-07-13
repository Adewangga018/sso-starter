import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './AdminAuditPage.css'

const EVENT_TYPES = [
  '', 'login.success', 'login.failure', 'login.lockout', 'login.2fa_required',
  'login.2fa_failure', 'logout', 'mfa.enabled', 'mfa.disabled',
  'password.reset.requested', 'password.reset.completed', 'password.changed',
  'account.provisioned', 'role.admin_granted',
]

const isAnomaly = (t) => t.includes('failure') || t.includes('lockout')

export default function AdminAuditPage() {
  const { isAdmin } = useAuth()
  const [filters, setFilters] = useState({ email: '', eventType: '', from: '', to: '', take: 100 })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await api.getAuditLogs(filters))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat audit log.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (!isAdmin) {
    return <div className="audit"><p className="audit__forbidden">Akses ditolak. Hanya Admin.</p></div>
  }

  const failedCount = rows.filter((r) => isAnomaly(r.eventType)).length

  function update(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className="audit">
      <div className="audit__head">
        <Link to="/dashboard" className="audit__back"><ArrowLeft size={16} /> Dashboard</Link>
        <h1><ShieldAlert size={20} /> Audit Keamanan</h1>
      </div>

      <div className="audit__summary">
        <div className="audit__chip">Total ditampilkan: <b>{rows.length}</b></div>
        <div className={`audit__chip ${failedCount ? 'audit__chip--warn' : ''}`}>
          Kegagalan/lockout: <b>{failedCount}</b>
        </div>
      </div>

      <div className="audit__filters">
        <input placeholder="Email" value={filters.email} onChange={(e) => update('email', e.target.value)} />
        <select value={filters.eventType} onChange={(e) => update('eventType', e.target.value)}>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t || 'Semua event'}</option>)}
        </select>
        <label>Dari <input type="datetime-local" value={filters.from} onChange={(e) => update('from', e.target.value)} /></label>
        <label>Sampai <input type="datetime-local" value={filters.to} onChange={(e) => update('to', e.target.value)} /></label>
        <button className="audit__btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Memuat...' : 'Terapkan'}
        </button>
      </div>

      {error && <div className="audit__error">{error}</div>}

      <div className="audit__table-wrap">
        <table className="audit__table">
          <thead>
            <tr>
              <th>Waktu (UTC)</th><th>Event</th><th>Email</th><th>IP</th><th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={isAnomaly(r.eventType) ? 'audit__row--warn' : ''}>
                <td>{new Date(r.timestampUtc).toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td><span className="audit__event">{r.eventType}</span></td>
                <td>{r.email ?? '—'}</td>
                <td>{r.ipAddress ?? '—'}</td>
                <td>{r.detail ?? '—'}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td colSpan={5} className="audit__empty">Belum ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
