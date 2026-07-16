import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './AdminLocationsPage.css'

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

const emptyForm = { nama: '', lat: '', lng: '', radiusMeters: '150', aktif: true }

export default function AdminLocationsPage() {
  const { isAdmin } = useAuth()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLocations(await api.getAdminLocations())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat daftar lokasi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin, load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(loc) {
    setEditing(loc)
    setForm({
      nama: loc.nama,
      lat: String(loc.lat),
      lng: String(loc.lng),
      radiusMeters: String(loc.radiusMeters),
      aktif: loc.aktif,
    })
    setFormError('')
    setModalOpen(true)
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const lat = Number(form.lat)
    const lng = Number(form.lng)
    const radiusMeters = Number(form.radiusMeters)
    if (!form.nama.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radiusMeters)) {
      setFormError('Nama, lat, lng, dan radius wajib diisi dengan angka yang valid.')
      return
    }

    setSaving(true)
    try {
      const payload = { nama: form.nama.trim(), lat, lng, radiusMeters, aktif: form.aktif }
      if (editing) {
        await api.updateLocation(editing.id, payload)
      } else {
        await api.createLocation(payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan lokasi.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAktif(loc) {
    setBusyId(loc.id)
    try {
      await api.updateLocation(loc.id, {
        nama: loc.nama,
        lat: loc.lat,
        lng: loc.lng,
        radiusMeters: loc.radiusMeters,
        aktif: !loc.aktif,
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah status lokasi.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(loc) {
    if (!confirm(`Hapus lokasi "${loc.nama}"?`)) return
    setBusyId(loc.id)
    try {
      await api.deleteLocation(loc.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus lokasi.')
    } finally {
      setBusyId(null)
    }
  }

  if (!isAdmin) {
    return <div className="admin-locations"><p className="admin-locations__forbidden">Akses ditolak. Hanya Admin IT.</p></div>
  }

  return (
    <div className="admin-locations">
      <div className="admin-locations__head">
        <Link to="/admin" className="admin-locations__back"><ArrowLeft size={16} /> Panel Admin</Link>
        <h1><MapPin size={20} /> Kelola Lokasi Absensi</h1>
      </div>

      <div className="admin-locations__note">
        Titik geofence kantor/gudang untuk absensi kamera. Setiap absen divalidasi terhadap
        lokasi Aktif yang terdekat dengan koordinat pegawai, dalam radius (meter) yang diatur
        per lokasi di sini.
      </div>

      <div className="admin-locations__toolbar">
        <button type="button" className="admin-locations__add" onClick={openCreate}>
          <Plus size={16} /> Tambah Lokasi
        </button>
        {loading && <span className="admin-locations__hint">Memuat...</span>}
      </div>

      {error && <div className="admin-locations__alert admin-locations__alert--err">{error}</div>}

      <div className="admin-locations__table-wrap">
        <table className="admin-locations__table">
          <thead>
            <tr>
              <th>Nama Lokasi</th>
              <th>Koordinat</th>
              <th>Radius (m)</th>
              <th className="admin-locations__col-center">Aktif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id} className={busyId === l.id ? 'is-busy' : ''}>
                <td className="admin-locations__nama">{l.nama}</td>
                <td className="admin-locations__coord">{l.lat.toFixed(6)}, {l.lng.toFixed(6)}</td>
                <td>{l.radiusMeters}</td>
                <td className="admin-locations__col-center">
                  <Switch
                    checked={l.aktif}
                    disabled={busyId === l.id}
                    title="Aktif/nonaktifkan lokasi"
                    onChange={() => toggleAktif(l)}
                  />
                </td>
                <td>
                  <div className="admin-locations__row-actions">
                    <button type="button" className="admin-locations__row-btn" onClick={() => openEdit(l)} title="Ubah">
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="admin-locations__row-btn admin-locations__row-btn--delete"
                      onClick={() => handleDelete(l)}
                      title="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!locations.length && !loading && (
              <tr><td colSpan={5} className="admin-locations__empty">Belum ada lokasi.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="admin-locations__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="admin-locations__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-locations__modal-header">
              <h3>{editing ? `Ubah ${editing.nama}` : 'Tambah Lokasi'}</h3>
              <button type="button" className="admin-locations__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="admin-locations__modal-body" onSubmit={handleSubmit}>
              <label className="admin-locations__field">
                <span>Nama Lokasi</span>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => updateField('nama', e.target.value)}
                  placeholder="mis. Kantor Region Lampung"
                  required
                />
              </label>

              <label className="admin-locations__field">
                <span>Latitude</span>
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => updateField('lat', e.target.value)}
                  placeholder="-7.160356"
                  required
                />
              </label>

              <label className="admin-locations__field">
                <span>Longitude</span>
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => updateField('lng', e.target.value)}
                  placeholder="112.632490"
                  required
                />
              </label>

              <label className="admin-locations__field">
                <span>Radius (meter)</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={form.radiusMeters}
                  onChange={(e) => updateField('radiusMeters', e.target.value)}
                  required
                />
              </label>

              <label className="admin-locations__field admin-locations__field--switch">
                <span>Aktif</span>
                <Switch checked={form.aktif} onChange={() => updateField('aktif', !form.aktif)} title="Aktif/nonaktifkan lokasi" />
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
    </div>
  )
}
