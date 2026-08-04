import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Archive, ArrowLeft, Boxes, ClipboardCheck, Lightbulb, Mail, Plus, TrendingUp, Upload, Users, Users2, X,
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

const KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/

function slugify(text) {
  return (text ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const EMPTY_FORM = { key: '', label: '', subtitle: '', icon: 'users', access: 'semua', enabled: false }

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

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [keyTouched, setKeyTouched] = useState(false)
  const [formError, setFormError] = useState('')
  const [formBusy, setFormBusy] = useState(false)

  const fileInputRef = useRef(null)
  const uploadKeyRef = useRef(null)

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

  function openForm() {
    setForm(EMPTY_FORM)
    setKeyTouched(false)
    setFormError('')
    setShowForm(true)
  }

  function onLabelChange(label) {
    setForm((f) => ({ ...f, label, key: keyTouched ? f.key : slugify(label) }))
  }

  function onKeyChange(key) {
    setKeyTouched(true)
    setForm((f) => ({ ...f, key: slugify(key) }))
  }

  async function submitForm(e) {
    e.preventDefault()
    if (!form.label.trim()) {
      setFormError('Nama modul wajib diisi.')
      return
    }
    if (!KEY_FORMAT.test(form.key) || form.key.length < 3) {
      setFormError("Key modul harus huruf kecil/angka dipisah tanda hubung, minimal 3 karakter (mis. 'my-library').")
      return
    }

    setFormBusy(true)
    setFormError('')
    try {
      const created = await api.createAdminModule(form)
      setModules((prev) => [...prev, created])
      refreshSummary()
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menambah modul.')
    } finally {
      setFormBusy(false)
    }
  }

  function triggerLogoUpload(key) {
    uploadKeyRef.current = key
    fileInputRef.current?.click()
  }

  async function onLogoSelected(e) {
    const file = e.target.files?.[0]
    const key = uploadKeyRef.current
    e.target.value = ''
    if (!file || !key) return

    setBusyKey(key)
    setError('')
    try {
      const saved = await api.uploadAdminModuleLogo(key, file)
      setModules((prev) => prev.map((m) => (m.key === saved.key ? saved : m)))
      refreshSummary()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengupload logo.')
    } finally {
      setBusyKey(null)
    }
  }

  if (!isAdmin) {
    return <div className="admin-modules"><p className="admin-modules__forbidden">Akses ditolak. Hanya Admin IT.</p></div>
  }

  return (
    <div className="admin-modules">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: 'none' }}
        onChange={onLogoSelected}
      />

      <div className="admin-modules__head">
        <Link to="/admin" className="admin-modules__back"><ArrowLeft size={16} /> Panel Admin</Link>
        <div className="admin-modules__head-row">
          <h1><Boxes size={20} /> Akses Modul</h1>
          <button type="button" className="admin-modules__add-btn" onClick={openForm}>
            <Plus size={16} /> Tambah Modul
          </button>
        </div>
      </div>

      <div className="admin-modules__note">
        Atur modul mana yang aktif dan siapa yang boleh membukanya. <b>Semua Pengguna</b> = modul
        dapat dibuka setiap karyawan; <b>Admin Modul (SDM / Kepatuhan)</b> = selain Admin IT, admin
        modul terkait berbasis grading (mis. Admin SDM untuk KPI, Admin Kepatuhan untuk Prosedur,
        Health &amp; Aset) juga dapat membukanya; <b>Admin IT Saja</b> = bagi karyawan lain kartunya
        tetap tampil di dashboard tetapi terkunci &ldquo;Coming Soon&rdquo;, dan API-nya menolak akses
        mereka. Modul yang dinonaktifkan juga tampil &ldquo;Coming Soon&rdquo;. Admin IT selalu dapat
        membuka semua modul, termasuk yang sedang nonaktif, untuk keperluan uji coba. Modul baru
        yang didaftarkan di sini tampil sebagai kartu &ldquo;Coming Soon&rdquo; sampai halaman
        sungguhannya dibangun developer.
      </div>

      {showForm && (
        <form className="admin-modules__form" onSubmit={submitForm}>
          <div className="admin-modules__form-head">
            <h2>Tambah Modul Baru</h2>
            <button type="button" className="admin-modules__form-close" onClick={() => setShowForm(false)} aria-label="Tutup">
              <X size={18} />
            </button>
          </div>

          {formError && <div className="admin-modules__alert admin-modules__alert--err">{formError}</div>}

          <div className="admin-modules__form-grid">
            <label className="admin-modules__field">
              <span>Nama Modul</span>
              <input
                type="text"
                value={form.label}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="mis. My Library"
                required
              />
            </label>

            <label className="admin-modules__field">
              <span>Key (unik, tidak bisa diubah nanti)</span>
              <input
                type="text"
                value={form.key}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder="mis. my-library"
                required
              />
            </label>

            <label className="admin-modules__field">
              <span>Subjudul Kartu</span>
              <input
                type="text"
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="mis. PERPUSTAKAAN"
              />
            </label>

            <label className="admin-modules__field">
              <span>Ikon (sebelum logo diupload)</span>
              <select value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}>
                {Object.keys(ICONS).map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </label>

            <label className="admin-modules__field">
              <span>Dapat Diakses Oleh</span>
              <select value={form.access} onChange={(e) => setForm((f) => ({ ...f, access: e.target.value }))}>
                <option value="semua">Semua Pengguna</option>
                <option value="admin">Admin IT Saja</option>
              </select>
            </label>

            <label className="admin-modules__field admin-modules__field--checkbox">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              <span>Aktifkan sekarang (biasanya dibiarkan nonaktif sampai halamannya siap)</span>
            </label>
          </div>

          <div className="admin-modules__form-actions">
            <button type="button" className="admin-modules__form-cancel" onClick={() => setShowForm(false)} disabled={formBusy}>
              Batal
            </button>
            <button type="submit" className="admin-modules__form-submit" disabled={formBusy}>
              {formBusy ? 'Menyimpan...' : 'Simpan Modul'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="admin-modules__alert admin-modules__alert--err">{error}</div>}
      {loading && <div className="admin-modules__hint">Memuat...</div>}

      <div className="admin-modules__table-wrap">
        <table className="admin-modules__table">
          <thead>
            <tr>
              <th>Modul</th>
              <th className="admin-modules__col-center">Logo</th>
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
                      {m.logoUrl ? (
                        <img src={m.logoUrl} alt="" className="admin-modules__mod-logo" />
                      ) : (
                        <span className="admin-modules__mod-icon"><Icon size={18} /></span>
                      )}
                      <div>
                        <div className="admin-modules__mod-label">{m.label}</div>
                        <div className="admin-modules__mod-sub">{m.subtitle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="admin-modules__col-center">
                    <button
                      type="button"
                      className="admin-modules__logo-btn"
                      disabled={busy}
                      title="Upload/ganti logo"
                      onClick={() => triggerLogoUpload(m.key)}
                    >
                      <Upload size={15} />
                    </button>
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
              )
            })}
            {!modules.length && !loading && (
              <tr><td colSpan={5} className="admin-modules__empty">Belum ada modul terdaftar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
