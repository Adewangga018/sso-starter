import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Archive, ArrowLeft, Boxes, ClipboardCheck, Lightbulb, Mail, TrendingUp, Users, Users2,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './AdminModulesPage.css'

// Ikon per modul, sama dengan kartu modul di dashboard (DashboardPage.jsx).
const ICONS = {
  users: Users,
  mail: Mail,
  'clipboard-check': ClipboardCheck,
  activity: Activity,
  lightbulb: Lightbulb,
  archive: Archive,
  'trending-up': TrendingUp,
  'users-round': Users2,
}

function Switch({ checked, disabled, onChange, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`admin-modules__switch${checked ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={onChange}
      title={title}
    >
      <span className="admin-modules__switch-knob" />
    </button>
  )
}

function formatUpdated(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminModulesPage() {
  const { isAdmin, refreshSummary } = useAuth()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setModules(await api.getAdminModules())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat daftar modul.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin, load])

  // Satu jalur simpan untuk kedua kolom (aktif & akses): kirim state penuh baris itu,
  // lalu ganti barisnya dengan hasil dari server supaya "Diubah" ikut segar.
  async function save(mod, patch) {
    setBusyKey(mod.key)
    setError('')
    try {
      const saved = await api.updateAdminModule(mod.key, {
        enabled: patch.enabled ?? mod.enabled,
        access: patch.access ?? mod.access,
      })
      setModules((prev) => prev.map((m) => (m.key === saved.key ? saved : m)))
      // Kartu modul di dashboard ikut berubah untuk admin yang sedang login.
      refreshSummary()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan modul.')
    } finally {
      setBusyKey(null)
    }
  }

  if (!isAdmin) {
    return <div className="admin-modules"><p className="admin-modules__forbidden">Akses ditolak. Hanya Admin IT.</p></div>
  }

  return (
    <div className="admin-modules">
      <div className="admin-modules__head">
        <Link to="/admin" className="admin-modules__back"><ArrowLeft size={16} /> Panel Admin</Link>
        <h1><Boxes size={20} /> Akses Modul</h1>
      </div>

      <div className="admin-modules__note">
        Atur modul mana yang aktif dan siapa yang boleh membukanya. <b>Semua Pengguna</b> = modul
        dapat dibuka setiap karyawan; <b>Admin IT Saja</b> = bagi karyawan kartunya tetap tampil
        di dashboard tetapi terkunci &ldquo;Coming Soon&rdquo;, dan API-nya menolak akses mereka.
        Modul yang dinonaktifkan juga tampil &ldquo;Coming Soon&rdquo;. Admin IT selalu dapat
        membuka semua modul, termasuk yang sedang nonaktif, untuk keperluan uji coba.
      </div>

      {error && <div className="admin-modules__alert admin-modules__alert--err">{error}</div>}
      {loading && <div className="admin-modules__hint">Memuat...</div>}

      <div className="admin-modules__table-wrap">
        <table className="admin-modules__table">
          <thead>
            <tr>
              <th>Modul</th>
              <th className="admin-modules__col-center">Aktif</th>
              <th>Dapat Diakses Oleh</th>
              <th>Terakhir Diubah</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const Icon = ICONS[m.icon] ?? Boxes
              const busy = busyKey === m.key
              return (
                <tr key={m.key} className={busy ? 'is-busy' : ''}>
                  <td>
                    <div className="admin-modules__mod">
                      <span className="admin-modules__mod-icon"><Icon size={18} /></span>
                      <div>
                        <div className="admin-modules__mod-label">{m.label}</div>
                        <div className="admin-modules__mod-sub">{m.subtitle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="admin-modules__col-center">
                    <Switch
                      checked={m.enabled}
                      disabled={busy}
                      title={m.enabled ? 'Nonaktifkan modul' : 'Aktifkan modul'}
                      onChange={() => save(m, { enabled: !m.enabled })}
                    />
                  </td>
                  <td>
                    <select
                      className="admin-modules__select"
                      value={m.access}
                      disabled={busy}
                      onChange={(e) => save(m, { access: e.target.value })}
                    >
                      <option value="semua">Semua Pengguna</option>
                      <option value="admin">Admin IT Saja</option>
                    </select>
                  </td>
                  <td className="admin-modules__updated">
                    {formatUpdated(m.updatedAt)}
                    {m.updatedBy && <div className="admin-modules__updated-by">{m.updatedBy}</div>}
                  </td>
                </tr>
              )
            })}
            {!modules.length && !loading && (
              <tr><td colSpan={4} className="admin-modules__empty">Belum ada modul terdaftar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
