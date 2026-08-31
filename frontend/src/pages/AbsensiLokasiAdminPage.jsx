import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, MapPin, Plus, RotateCw, Search, ShieldAlert, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './PayrollShared.css'
import './AbsensiLokasiAdminPage.css'

function StatusBadge({ status }) {
  const cls = status === 'Disetujui' ? 'agt__appr--ok' : status === 'Ditolak' ? 'agt__appr--reject' : 'agt__appr--wait'
  return <span className={`agt__appr ${cls}`}>{status}</span>
}

const pad = (n) => String(n).padStart(2, '0')
function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyForm = { idKaryawan: '', nama: '', lat: '', lng: '', keterangan: '' }

export default function AbsensiLokasiAdminPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const [items, setItems] = useState(null)
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

  async function load() {
    setLoading(true); setError('')
    try {
      setItems(await api.getAbsensiLokasiList())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data lokasi absensi.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePutusan(row, setuju) {
    setBusyId(row.id)
    try {
      await api.putusanAbsensiLokasi(row.id, { setuju, catatan: null })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memproses keputusan.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleHapus(row) {
    if (!window.confirm(`Cabut titik absen pribadi ${row.namaKaryawan ?? row.idKaryawan}? Karyawan ini kembali memakai titik default (Kantor Pusat).`)) return
    setBusyId(row.id)
    try {
      await api.hapusAbsensiLokasi(row.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus data.')
    } finally {
      setBusyId(null)
    }
  }

  function openModal() {
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.idKaryawan) { setFormError('Pilih karyawan terlebih dahulu.'); return }
    if (form.lat === '' || form.lng === '') { setFormError('Koordinat lat/lng wajib diisi.'); return }
    setSaving(true)
    try {
      await api.tetapkanAbsensiLokasi({
        idKaryawan: form.idKaryawan,
        lat: Number(form.lat),
        lng: Number(form.lng),
        keterangan: form.keterangan.trim() || null,
      })
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
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
      setPickerRows(await api.cariPegawaiAbsensiLokasi(q))
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

  function useMyLocation() {
    if (!navigator.geolocation) { setFormError('Browser ini tidak mendukung geolokasi.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(7), lng: pos.coords.longitude.toFixed(7) })),
      () => setFormError('Gagal membaca lokasi perangkat ini.'),
    )
  }

  if (!isAdminModulSdm) {
    return (
      <div className="agt">
        <div className="agt__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Kelola Lokasi Absensi hanya untuk Admin Modul SDM.</p>
          <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="agt">
      <div className="agt__top">
        <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="agt__role">Admin Modul SDM{summary?.nama ? <> · <span className="u-nama">{summary.nama}</span></> : ''}</span>
      </div>

      <div className="agt__head">
        <h2 className="agt__title"><MapPin size={20} /> Kelola Lokasi Absensi</h2>
        <p className="agt__sub">
          Titik absen pribadi karyawan yang tidak beraktivitas di kantor (bengkel, gudang, sopir, dll).
          Selama belum disetujui, absen karyawan tetap divalidasi ke titik default (Kantor Pusat PT Gresik Cipta Sejahtera).
        </p>
      </div>

      <div className="agt__sel" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="agt__save agt__save--sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <RotateCw size={14} />}
          Muat Ulang
        </button>
        <button type="button" className="agt__save" onClick={openModal}>
          <Plus size={15} /> Tetapkan Langsung
        </button>
      </div>

      {error && <div className="agt__msg agt__msg--err">{error}</div>}

      {loading && !items ? (
        <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
      ) : !items || items.length === 0 ? (
        <div className="agt__empty">Belum ada titik absen pribadi yang diajukan/ditetapkan.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="agt__presensi-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Titik &amp; Radius</th>
                <th>Alamat (Otomatis)</th>
                <th>Status</th>
                <th>Sumber</th>
                <th>Diajukan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div>{row.namaKaryawan ?? '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gcs-text-muted)' }}>{row.idKaryawan}</div>
                  </td>
                  <td>
                    <a href={`https://www.google.com/maps?q=${row.lat},${row.lng}`} target="_blank" rel="noreferrer">
                      {row.lat.toFixed?.(5) ?? row.lat}, {row.lng.toFixed?.(5) ?? row.lng}
                    </a>
                    <div style={{ fontSize: 12, color: 'var(--gcs-text-muted)' }}>Radius {row.radiusMeters} m</div>
                  </td>
                  <td>
                    <div>{row.alamat ?? <span style={{ color: 'var(--gcs-text-muted)' }}>Alamat otomatis tidak tersedia</span>}</div>
                    {row.keterangan && (
                      <div style={{ fontSize: 12, color: 'var(--gcs-text-muted)' }}>Catatan: {row.keterangan}</div>
                    )}
                  </td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.sumber === 'AdminSdm' ? 'Admin SDM' : 'Karyawan'}</td>
                  <td>{formatTgl(row.tglDiajukan)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {row.status === 'Menunggu' && (
                        <>
                          <button
                            type="button" className="agt__ibtn" title="Setujui"
                            disabled={busyId === row.id} onClick={() => handlePutusan(row, true)}
                          >
                            {busyId === row.id ? <Loader2 size={14} className="agt__spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button" className="agt__ibtn" title="Tolak"
                            disabled={busyId === row.id} onClick={() => handlePutusan(row, false)}
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                      <button
                        type="button" className="agt__ibtn" title="Cabut / Hapus"
                        disabled={busyId === row.id} onClick={() => handleHapus(row)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="agt__presensi" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: 0 }} onClick={() => setModalOpen(false)}>
          <div style={{ maxWidth: 480, width: '92%', background: 'var(--gcs-white)', borderRadius: 14, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="agt__presensi-head">
              <span className="agt__presensi-nama">Tetapkan Titik Absen Karyawan</span>
              <button type="button" className="agt__ibtn" onClick={() => setModalOpen(false)} aria-label="Tutup"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <label className="alp__field">
                <span>Karyawan</span>
                <button type="button" className="alp__picker-btn" onClick={openPicker}>
                  <Search size={14} /> {form.nama ? `${form.nama} (${form.idKaryawan})` : 'Cari & pilih karyawan...'}
                </button>
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <label className="alp__field" style={{ flex: 1 }}>
                  <span>Latitude</span>
                  <input type="number" step="any" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} required />
                </label>
                <label className="alp__field" style={{ flex: 1 }}>
                  <span>Longitude</span>
                  <input type="number" step="any" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} required />
                </label>
              </div>
              <button type="button" className="alp__link-btn" onClick={useMyLocation}>Pakai lokasi perangkat ini sekarang</button>
              <label className="alp__field">
                <span>Keterangan (opsional)</span>
                <input type="text" placeholder="mis. Gudang Sidoarjo" value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} />
              </label>
              <p style={{ fontSize: 12, color: 'var(--gcs-text-muted)', margin: 0 }}>
                Radius berlaku {' '}<b>150 meter</b>{' '}(sama untuk semua titik). Titik ini langsung berstatus Disetujui.
              </p>
              {formError && <div className="agt__msg agt__msg--err">{formError}</div>}
              <button type="submit" className="agt__save" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="agt__presensi" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: 0 }} onClick={() => setPickerOpen(false)}>
          <div style={{ maxWidth: 420, width: '92%', maxHeight: '70vh', background: 'var(--gcs-white)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="agt__presensi-head">
              <span className="agt__presensi-nama">Cari Karyawan</span>
              <button type="button" className="agt__ibtn" onClick={() => setPickerOpen(false)} aria-label="Tutup"><X size={16} /></button>
            </div>
            <input
              type="text" autoFocus placeholder="Nama atau NIK..." value={pickerQuery}
              onChange={(e) => runPicker(e.target.value)}
              style={{ margin: '10px 0', padding: '8px 10px', border: '1px solid var(--gcs-border)', borderRadius: 8 }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {pickerLoading ? (
                <div className="agt__loading"><Loader2 className="agt__spin" size={16} /> Mencari…</div>
              ) : pickerRows.length === 0 ? (
                <div className="agt__empty">Ketik nama/NIK untuk mencari.</div>
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
      )}
    </div>
  )
}
