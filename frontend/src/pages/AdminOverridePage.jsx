import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../components/DialogProvider'
import './AdminLocationsPage.css'
import './AbsensiLokasiAdminPage.css'

function Switch({ checked, disabled, onChange, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`admin-locations__switch${checked ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={onChange}
      title={title}
    >
      <span className="admin-locations__switch-knob" />
    </button>
  )
}

const pad = (n) => String(n).padStart(2, '0')
function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyForm = { idKaryawan: '', nama: '', modul: 'SDM' }

export default function AdminOverridePage() {
  const { isAdmin } = useAuth()
  const dialog = useDialog()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerRows, setPickerRows] = useState([])
  const [pickerLoading, setPickerLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setItems(await api.getAdminOverrides())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin, load])

  function openCreate() {
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.idKaryawan) { setFormError('Pilih karyawan terlebih dahulu.'); return }
    setSaving(true)
    try {
      await api.buatAdminOverride({ idKaryawan: form.idKaryawan, modul: form.modul })
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAktif(row) {
    setBusyId(row.id)
    try {
      await api.setAktifAdminOverride(row.id, !row.aktif)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah status.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(row) {
    if (!(await dialog.confirm({
      title: 'Hapus Toggle',
      message: `Hapus toggle Admin ${row.modul} untuk ${row.namaKaryawan ?? row.idKaryawan}? Karyawan ini kembali ke status default (mengikuti jabatannya di Struktur Organisasi).`,
      danger: true,
      confirmText: 'Hapus',
    }))) return
    setBusyId(row.id)
    try {
      await api.hapusAdminOverride(row.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus data.')
    } finally {
      setBusyId(null)
    }
  }

  function openPicker() {
    setPickerQuery('')
    setPickerRows([])
    setPickerOpen(true)
  }

  async function runPicker(q) {
    setPickerQuery(q)
    setPickerLoading(true)
    try {
      setPickerRows(await api.cariPegawaiAdminOverride(q))
    } catch {
      setPickerRows([])
    } finally {
      setPickerLoading(false)
    }
  }

  function pickPegawai(p) {
    setForm((f) => ({ ...f, idKaryawan: p.nik, nama: p.nama }))
    setPickerOpen(false)
  }

  if (!isAdmin) {
    return <div className="admin-locations"><p className="admin-locations__forbidden">Akses ditolak. Hanya Admin IT.</p></div>
  }

  return (
    <div className="admin-locations">
      <div className="admin-locations__head">
        <Link to="/admin" className="admin-locations__back"><ArrowLeft size={16} /> Panel Admin</Link>
        <h1><ShieldCheck size={20} /> Admin Modul (Toggle Manual)</h1>
      </div>

      <div className="admin-locations__note">
        Beri atau cabut status <b>Admin SDM</b>/<b>Admin Kepatuhan</b> untuk karyawan tertentu, terlepas dari
        jabatannya di Struktur Organisasi. Bersifat tambahan — mencabut toggle di sini tidak menghapus hak admin
        yang memang sudah didapat karyawan dari jabatannya. Hanya bisa dikelola dari sini (Panel Admin IT).
      </div>

      <div className="admin-locations__toolbar">
        <button type="button" className="admin-locations__add" onClick={openCreate}>
          <Plus size={16} /> Beri Akses
        </button>
        {loading && <span className="admin-locations__hint">Memuat...</span>}
      </div>

      {error && <div className="admin-locations__alert admin-locations__alert--err">{error}</div>}

      <div className="admin-locations__table-wrap">
        <table className="admin-locations__table">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Modul</th>
              <th className="admin-locations__col-center">Aktif</th>
              <th>Diberikan Oleh</th>
              <th>Diberikan Pada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className={busyId === row.id ? 'is-busy' : ''}>
                <td className="admin-locations__nama">
                  <div>{row.namaKaryawan ?? '-'}</div>
                  <div style={{ fontSize: 12, color: 'var(--gcs-text-muted)', fontWeight: 400 }}>{row.idKaryawan}</div>
                </td>
                <td>Admin {row.modul}</td>
                <td className="admin-locations__col-center">
                  <Switch checked={row.aktif} disabled={busyId === row.id} title="Aktif/nonaktifkan" onChange={() => toggleAktif(row)} />
                </td>
                <td>{row.diberikanOleh}</td>
                <td>{formatTgl(row.diberikanPada)}</td>
                <td>
                  <div className="admin-locations__row-actions">
                    <button
                      type="button" className="admin-locations__row-btn admin-locations__row-btn--delete"
                      onClick={() => handleDelete(row)} title="Hapus" disabled={busyId === row.id}
                    >
                      {busyId === row.id ? <Loader2 size={15} className="agt__spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={6} className="admin-locations__empty">Belum ada toggle manual yang dibuat.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="admin-locations__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="admin-locations__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-locations__modal-header">
              <h3>Beri Akses Admin</h3>
              <button type="button" className="admin-locations__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <form className="admin-locations__modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="alp__field">
                <span>Karyawan</span>
                <button type="button" className="alp__picker-btn" onClick={openPicker}>
                  <Search size={14} /> {form.nama ? `${form.nama} (${form.idKaryawan})` : 'Cari & pilih karyawan...'}
                </button>
              </label>
              <label className="alp__field">
                <span>Modul</span>
                <select
                  value={form.modul}
                  onChange={(e) => setForm((f) => ({ ...f, modul: e.target.value }))}
                  style={{ padding: '9px 10px', border: '1px solid var(--gcs-border)', borderRadius: 8, fontSize: 14 }}
                >
                  <option value="SDM">Admin SDM</option>
                  <option value="Kepatuhan">Admin Kepatuhan</option>
                </select>
              </label>
              {formError && <div className="admin-locations__alert admin-locations__alert--err">{formError}</div>}
              <div className="admin-locations__modal-footer">
                <button type="submit" className="admin-locations__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="admin-locations__modal-backdrop" style={{ zIndex: 60 }} onClick={() => setPickerOpen(false)}>
          <div className="admin-locations__modal" style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-locations__modal-header">
              <h3>Cari Karyawan</h3>
              <button type="button" className="admin-locations__modal-close" onClick={() => setPickerOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <div className="admin-locations__modal-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <input
                type="text" autoFocus placeholder="Nama atau NIK..." value={pickerQuery}
                onChange={(e) => runPicker(e.target.value)}
                style={{ marginBottom: 10, padding: '8px 10px', border: '1px solid var(--gcs-border)', borderRadius: 8 }}
              />
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {pickerLoading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--gcs-text-muted)' }}>Mencari…</div>
                ) : pickerRows.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--gcs-text-muted)' }}>Ketik nama/NIK untuk mencari.</div>
                ) : (
                  pickerRows.map((p) => (
                    <button type="button" key={p.nik} className="alp__picker-row" onClick={() => pickPegawai(p)}>
                      <div>{p.nama}</div>
                      <div style={{ fontSize: 12, color: 'var(--gcs-text-muted)' }}>{p.nik}{p.unitKerja ? ` · ${p.unitKerja}` : ''}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
