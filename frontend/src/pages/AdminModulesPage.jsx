import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Archive, ArrowLeft, Boxes, ChevronDown, ChevronRight, ClipboardCheck, Lightbulb,
  Lock, LockOpen, Mail, TrendingUp, Users, Users2,
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
  const [features, setFeatures] = useState([])
  const [expanded, setExpanded] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [busyFeature, setBusyFeature] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [mods, feats] = await Promise.all([api.getAdminModules(), api.getAdminFeatures()])
      setModules(mods)
      setFeatures(feats)
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

  async function saveFeature(f, enabled) {
    setBusyFeature(f.key)
    setError('')
    try {
      const saved = await api.updateAdminFeature(f.key, enabled)
      setFeatures((prev) => prev.map((x) => (x.key === saved.key ? saved : x)))
      refreshSummary()   // menu sidebar admin ikut menyesuaikan
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan fitur.')
    } finally {
      setBusyFeature(null)
    }
  }

  function toggleExpand(key) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const featuresByModule = features.reduce((acc, f) => {
    (acc[f.moduleKey] ??= []).push(f)
    return acc
  }, {})

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
        dapat dibuka setiap karyawan; <b>Admin Modul (SDM / Kepatuhan)</b> = selain Admin IT, admin
        modul terkait berbasis grading (mis. Admin SDM untuk KPI, Admin Kepatuhan untuk Prosedur,
        Health &amp; Aset) juga dapat membukanya; <b>Admin IT Saja</b> = bagi karyawan lain kartunya
        tetap tampil di dashboard tetapi terkunci &ldquo;Coming Soon&rdquo;, dan API-nya menolak akses
        mereka. Modul yang dinonaktifkan juga tampil &ldquo;Coming Soon&rdquo;. Admin IT selalu dapat
        membuka semua modul, termasuk yang sedang nonaktif, untuk keperluan uji coba.
        <br /><br />
        Klik tanda <b>&rsaquo;</b> di sebuah modul untuk mengunci/membuka <b>fitur</b> (item menu
        sidebar) di dalamnya satu per satu. Fitur yang <b>Terkunci</b> disembunyikan dari menu
        pengguna & API-nya ditolak; Admin IT tetap melihat & bisa mengujinya.
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
              const feats = featuresByModule[m.key] ?? []
              const isOpen = expanded.has(m.key)
              return (
                <Fragment key={m.key}>
                <tr className={busy ? 'is-busy' : ''}>
                  <td>
                    <div className="admin-modules__mod">
                      {feats.length > 0 ? (
                        <button type="button" className="admin-modules__expand" onClick={() => toggleExpand(m.key)}
                          title={isOpen ? 'Sembunyikan fitur' : `Kelola ${feats.length} fitur`}>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      ) : <span className="admin-modules__expand-spacer" />}
                      <span className="admin-modules__mod-icon"><Icon size={18} /></span>
                      <div>
                        <div className="admin-modules__mod-label">{m.label}</div>
                        <div className="admin-modules__mod-sub">{m.subtitle}{feats.length > 0 ? ` · ${feats.length} fitur` : ''}</div>
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
                      <option value="admin_modul">Admin Modul (SDM / Kepatuhan)</option>
                      <option value="admin">Admin IT Saja</option>
                    </select>
                  </td>
                  <td className="admin-modules__updated">
                    {formatUpdated(m.updatedAt)}
                    {m.updatedBy && <div className="admin-modules__updated-by">{m.updatedBy}</div>}
                  </td>
                </tr>
                {isOpen && feats.map((f) => {
                  const fbusy = busyFeature === f.key
                  return (
                    <tr key={f.key} className={`admin-modules__feature-row${fbusy ? ' is-busy' : ''}`}>
                      <td>
                        <div className="admin-modules__feature">
                          {f.enabled ? <LockOpen size={14} /> : <Lock size={14} />}
                          <span>{f.label}</span>
                          {!f.enabled && <span className="admin-modules__feature-locked">Terkunci</span>}
                        </div>
                      </td>
                      <td className="admin-modules__col-center">
                        <Switch
                          checked={f.enabled}
                          disabled={fbusy}
                          title={f.enabled ? 'Kunci fitur' : 'Buka fitur'}
                          onChange={() => saveFeature(f, !f.enabled)}
                        />
                      </td>
                      <td className="admin-modules__feature-hint">{f.enabled ? 'Terbuka untuk pengguna' : 'Disembunyikan dari menu & diblok'}</td>
                      <td className="admin-modules__updated">
                        {formatUpdated(f.updatedAt)}
                        {f.updatedBy && <div className="admin-modules__updated-by">{f.updatedBy}</div>}
                      </td>
                    </tr>
                  )
                })}
                </Fragment>
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
