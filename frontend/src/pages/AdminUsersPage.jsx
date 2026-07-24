import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Info, LockOpen, Search, UsersRound } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './AdminUsersPage.css'

function Switch({ checked, disabled, onChange, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`admin-users__switch${checked ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={onChange}
      title={title}
    >
      <span className="admin-users__switch-knob" />
    </button>
  )
}

export default function AdminUsersPage() {
  const { isAdmin } = useAuth()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async (term) => {
    setLoading(true)
    setError('')
    try {
      setUsers(await api.getAdminUsers(term))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat daftar pengguna.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search; also runs once on mount (empty term = all users).
  useEffect(() => {
    if (!isAdmin) return
    const t = setTimeout(() => load(query.trim()), 300)
    return () => clearTimeout(t)
  }, [isAdmin, query, load])

  async function runAction(id, action, okText) {
    setBusyId(id)
    setMsg(null)
    try {
      await action()
      await load(query.trim())
      setMsg({ type: 'ok', text: okText })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    } finally {
      setBusyId(null)
    }
  }

  if (!isAdmin) {
    return <div className="admin-users"><p className="admin-users__forbidden">Akses ditolak. Hanya Admin IT.</p></div>
  }

  return (
    <div className="admin-users">
      <div className="admin-users__head">
        <Link to="/admin" className="admin-users__back"><ArrowLeft size={16} /> Panel Admin</Link>
        <h1><UsersRound size={20} /> Manajemen Pengguna &amp; Role</h1>
      </div>

      <div className="admin-users__note">
        <Info size={15} />
        <span>
          Mengubah hak <b>Admin IT</b> atau status akun berlaku saat pengguna tersebut login ulang
          (atau token-nya diperbarui). Anda tidak dapat mencabut Admin/menonaktifkan akun Anda sendiri.
        </span>
      </div>

      <div className="admin-users__search">
        <Search size={16} className="admin-users__search-icon" />
        <input
          placeholder="Cari nama, email, atau ID karyawan..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <span className="admin-users__hint">Memuat...</span>}
      </div>

      {error && <div className="admin-users__alert admin-users__alert--err">{error}</div>}
      {msg && <div className={`admin-users__alert admin-users__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="admin-users__table-wrap">
        <table className="admin-users__table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>ID Karyawan</th>
              <th>Status</th>
              <th className="admin-users__col-center">Admin IT</th>
              <th className="admin-users__col-center">Juri</th>
              <th className="admin-users__col-center">Aktif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={busyId === u.id ? 'is-busy' : ''}>
                <td>
                  <div className="admin-users__name">
                    {u.fullName ?? '—'}
                    {u.isSelf && <span className="admin-users__you">Anda</span>}
                  </div>
                  <div className="admin-users__email">{u.email}</div>
                </td>
                <td>{u.nik ?? '—'}</td>
                <td>
                  <div className="admin-users__badges">
                    {!u.isActive && <span className="admin-users__badge admin-users__badge--off">Nonaktif</span>}
                    {u.locked && <span className="admin-users__badge admin-users__badge--warn">Terkunci</span>}
                    {u.twoFactor && <span className="admin-users__badge admin-users__badge--ok">MFA</span>}
                    {u.isActive && !u.locked && !u.twoFactor && <span className="admin-users__muted">—</span>}
                  </div>
                </td>
                <td className="admin-users__col-center">
                  <Switch
                    checked={u.isAdmin}
                    disabled={busyId === u.id || (u.isSelf && u.isAdmin)}
                    title={u.isSelf && u.isAdmin ? 'Tidak bisa mencabut admin sendiri' : 'Toggle hak Admin IT'}
                    onChange={() =>
                      runAction(u.id, () => api.setUserAdmin(u.id, !u.isAdmin),
                        !u.isAdmin ? `${u.fullName ?? u.email} kini Admin IT.` : `Hak Admin ${u.fullName ?? u.email} dicabut.`)
                    }
                  />
                </td>
                <td className="admin-users__col-center">
                  <Switch
                    checked={u.isJuri}
                    disabled={busyId === u.id}
                    title="Tandai pengguna sebagai Juri (dapat ditempatkan di stream penilaian)"
                    onChange={() =>
                      runAction(u.id, () => api.setUserJuri(u.id, !u.isJuri),
                        !u.isJuri ? `${u.fullName ?? u.email} kini Juri.` : `Peran Juri ${u.fullName ?? u.email} dicabut.`)
                    }
                  />
                </td>
                <td className="admin-users__col-center">
                  <Switch
                    checked={u.isActive}
                    disabled={busyId === u.id || u.isSelf}
                    title={u.isSelf ? 'Tidak bisa menonaktifkan akun sendiri' : 'Aktif/nonaktifkan akun'}
                    onChange={() =>
                      runAction(u.id, () => api.setUserActive(u.id, !u.isActive),
                        !u.isActive ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.')
                    }
                  />
                </td>
                <td>
                  {u.locked && (
                    <button
                      type="button"
                      className="admin-users__unlock"
                      disabled={busyId === u.id}
                      onClick={() => runAction(u.id, () => api.unlockUser(u.id), 'Kunci akun dibuka.')}
                    >
                      <LockOpen size={14} /> Buka Kunci
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!users.length && !loading && (
              <tr><td colSpan={7} className="admin-users__empty">Tidak ada pengguna.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
