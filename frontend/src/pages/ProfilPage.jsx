import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Briefcase,
  Camera,
  CheckCircle2,
  Edit3,
  FileText,
  Folder,
  HeartPulse,
  Loader2,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import PdfPopupModal from '../components/PdfPopupModal'
import PhotoCropModal from '../components/PhotoCropModal'
import BerkasFileRow from '../components/BerkasFileRow'
import ChildrenSection from '../components/ChildrenSection'
import TanggunganBpjsSection from '../components/TanggunganBpjsSection'
import WilayahFields from '../components/WilayahFields'
import './ProfilPage.css'

const PHOTO_ACCEPT = 'image/png,image/jpeg'

const GENDER_OPTIONS = ['Laki-laki', 'Perempuan']
const STATUS_KARYAWAN_OPTIONS = ['BP', 'IK', 'Layanan Jasa', 'PKWT', 'Tetap']
const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya']
const PENDIDIKAN_OPTIONS = ['SD', 'SMP', 'SMA/SMK', 'D3', 'S1', 'S2', 'S3']
const NIKAH_OPTIONS = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati']
const MARITAL_KEYS = new Set(['kk', 'buku-nikah'])
const ACCEPT = '.pdf,.png,.jpg,.jpeg'

function formatTanggal(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '')
const emptyToNull = (v) => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

function initForm(p) {
  return {
    namaLengkap: p.namaLengkap ?? '',
    nik: p.nik ?? '',
    tempatLahir: p.tempatLahir ?? '',
    tglLahir: toDateInput(p.tglLahir),
    jenisKelamin: p.jenisKelamin ?? '',
    statusKaryawan: p.statusKaryawan ?? '',
    agama: p.agama ?? '',
    pendidikan: p.pendidikan ?? '',
    noHp: p.noHp ?? '',
    alamat: p.alamat?.alamat ?? '',
    rt: p.alamat?.rt ?? '',
    rw: p.alamat?.rw ?? '',
    provinsi: p.alamat?.provinsi ?? '',
    kabupaten: p.alamat?.kabupaten ?? '',
    kecamatan: p.alamat?.kecamatan ?? '',
    desa: p.alamat?.desa ?? '',
    kodePos: p.alamat?.kodePos ?? '',
    riwayatKesehatan: p.riwayatKesehatan ?? '',
    statusNikah: p.statusNikah ?? '',
    namaPasangan: p.pasangan?.nama ?? '',
    tempatLahirPasangan: p.pasangan?.tempatLahir ?? '',
    tglLahirPasangan: toDateInput(p.pasangan?.tglLahir),
    jumlahAnak: p.jumlahAnak ?? '',
    namaDarurat: p.namaDarurat ?? '',
    hpDarurat: p.hpDarurat ?? '',
  }
}

function buildPayload(form) {
  return {
    namaLengkap: (form.namaLengkap ?? '').trim(),
    nik: emptyToNull(form.nik),
    tempatLahir: emptyToNull(form.tempatLahir),
    tglLahir: form.tglLahir || null,
    jenisKelamin: emptyToNull(form.jenisKelamin),
    statusKaryawan: emptyToNull(form.statusKaryawan),
    agama: emptyToNull(form.agama),
    pendidikan: emptyToNull(form.pendidikan),
    noHp: emptyToNull(form.noHp),
    alamat: {
      alamat: emptyToNull(form.alamat),
      rt: emptyToNull(form.rt),
      rw: emptyToNull(form.rw),
      provinsi: emptyToNull(form.provinsi),
      kabupaten: emptyToNull(form.kabupaten),
      kecamatan: emptyToNull(form.kecamatan),
      desa: emptyToNull(form.desa),
      kodePos: emptyToNull(form.kodePos),
    },
    riwayatKesehatan: emptyToNull(form.riwayatKesehatan),
    statusNikah: emptyToNull(form.statusNikah),
    namaPasangan: emptyToNull(form.namaPasangan),
    tempatLahirPasangan: emptyToNull(form.tempatLahirPasangan),
    tglLahirPasangan: form.tglLahirPasangan || null,
    jumlahAnak: (form.jumlahAnak ?? '') === '' ? null : Number(form.jumlahAnak),
    namaDarurat: emptyToNull(form.namaDarurat),
    hpDarurat: emptyToNull(form.hpDarurat),
  }
}

function Row({ label, editing, locked, required, display, children }) {
  return (
    <div className="info-row">
      <div className="info-row__label">
        {label}
        {required && editing && <span className="profil__required">*</span>}
      </div>
      <div className="info-row__value">
        {editing && !locked ? children : (display ?? '-')}
      </div>
    </div>
  )
}

const REQUIRED_ON_REGISTER = [
  ['namaLengkap', 'Nama Lengkap'],
  ['nik', 'NIK'],
  ['statusKaryawan', 'Status Karyawan'],
  ['tempatLahir', 'Tempat Lahir'],
  ['tglLahir', 'Tanggal Lahir'],
  ['jenisKelamin', 'Jenis Kelamin'],
  ['agama', 'Agama'],
  ['pendidikan', 'Pendidikan'],
  ['statusNikah', 'Status Pernikahan'],
  ['noHp', 'No. HP'],
  ['alamat', 'Alamat'],
  ['rt', 'RT'],
  ['rw', 'RW'],
  ['provinsi', 'Provinsi'],
  ['kabupaten', 'Kota/Kabupaten'],
  ['kecamatan', 'Kecamatan'],
  ['desa', 'Desa/Kelurahan'],
  ['kodePos', 'Kode Pos'],
  ['namaDarurat', 'Nama Kontak Darurat'],
  ['hpDarurat', 'No. HP Darurat'],
]

function validateRegistration(form) {
  return REQUIRED_ON_REGISTER
    .filter(([name]) => String(form[name] ?? '').trim() === '')
    .map(([, label]) => label)
}

function missingFieldsOf(profile) {
  const checks = [
    [profile.namaLengkap, 'Nama Lengkap'],
    [profile.nik, 'NIK'],
    [profile.statusKaryawan, 'Status Karyawan'],
    [profile.tempatLahir, 'Tempat Lahir'],
    [profile.tglLahir, 'Tanggal Lahir'],
    [profile.jenisKelamin, 'Jenis Kelamin'],
    [profile.agama, 'Agama'],
    [profile.pendidikan, 'Pendidikan'],
    [profile.statusNikah, 'Status Pernikahan'],
    [profile.noHp, 'No. HP'],
    [profile.alamat?.alamat, 'Alamat'],
    [profile.alamat?.rt, 'RT'],
    [profile.alamat?.rw, 'RW'],
    [profile.alamat?.provinsi, 'Provinsi'],
    [profile.alamat?.kabupaten, 'Kota/Kabupaten'],
    [profile.alamat?.kecamatan, 'Kecamatan'],
    [profile.alamat?.desa, 'Desa/Kelurahan'],
    [profile.alamat?.kodePos, 'Kode Pos'],
    [profile.namaDarurat, 'Nama Kontak Darurat'],
    [profile.hpDarurat, 'No. HP Darurat'],
  ]
  return checks
    .filter(([v]) => v === null || v === undefined || String(v).trim() === '')
    .map(([, label]) => label)
}

function getCompletenessPercentage(profile) {
  if (!profile) return 0
  if (profile.profileComplete) return 100
  const missing = missingFieldsOf(profile)
  const total = REQUIRED_ON_REGISTER.length
  const filled = total - missing.length
  return Math.max(10, Math.round((filled / total) * 100))
}

function isProfileEmpty(p) {
  const fields = [
    p.nik, p.tempatLahir, p.tglLahir, p.jenisKelamin, p.agama, p.pendidikan,
    p.noHp, p.alamat?.alamat, p.riwayatKesehatan, p.namaDarurat, p.hpDarurat, p.statusNikah,
  ]
  return fields.every((v) => v === null || v === undefined || String(v).trim() === '')
}

function TextField({ form, setForm, name, type = 'text', placeholder }) {
  return (
    <input
      className="profil__input"
      type={type}
      placeholder={placeholder}
      value={form[name] ?? ''}
      onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
    />
  )
}

function SelectField({ form, setForm, name, options }) {
  const current = form[name] ?? ''
  const opts = current && !options.includes(current) ? [current, ...options] : options
  return (
    <select
      className="profil__input"
      value={current}
      onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
    >
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

const emptyModal = { open: false, key: '', title: '', loading: false, doc: null, error: '' }

export default function ProfilPage() {
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState(emptyModal)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [uploadingKey, setUploadingKey] = useState(null)
  const [uploadMsg, setUploadMsg] = useState(null)

  const [photoUrl, setPhotoUrl] = useState(null)
  const photoUrlRef = useRef(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const photoInputRef = useRef(null)

  const setPhoto = (url) => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = url
    setPhotoUrl(url)
  }

  useEffect(() => {
    let cancelled = false
    api
      .getPersonalProfile()
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        if (isProfileEmpty(data)) {
          setForm(initForm(data))
          setEditing(true)
        }
        if (data.hasPhoto) loadPhoto()
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data profil.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => { if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current) }, [])

  async function loadPhoto() {
    try {
      const doc = await api.getProfilePhoto()
      setPhoto(doc.url)
    } catch (err) {
      if (!isEmptyDataError(err)) setPhoto(null)
    }
  }

  async function reloadProfile() {
    setProfile(await api.getPersonalProfile())
  }

  function startEdit() {
    setForm(initForm(profile))
    setSaveError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setSaveError('')
  }

  async function saveProfile() {
    const missing = validateRegistration(form)
    if (missing.length > 0) {
      setSaveError(`Lengkapi dulu: ${missing.join(', ')}.`)
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      await api.updateProfile(buildPayload(form))
      await reloadProfile()
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Gagal menyimpan profil.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(uploadKey, file, label, doUpload) {
    if (!file) return
    setUploadingKey(uploadKey)
    setUploadMsg(null)
    try {
      await doUpload(file)
      await reloadProfile()
      setUploadMsg({ type: 'ok', text: `${label} berhasil diperbarui.` })
    } catch (err) {
      setUploadMsg({ type: 'err', text: err instanceof ApiError ? err.message : `Gagal mengunggah ${label}.` })
    } finally {
      setUploadingKey(null)
    }
  }

  function onPickFile(e, uploadKey, label, doUpload) {
    const file = e.target.files?.[0]
    e.target.value = ''
    handleUpload(uploadKey, file, label, doUpload)
  }

  function onPickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      setPhotoMsg({ type: 'err', text: 'Foto harus berupa JPG atau PNG.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCropSrc(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function saveCroppedPhoto(blob) {
    setPhotoBusy(true)
    setPhotoMsg(null)
    try {
      await api.uploadProfilePhoto(blob)
      setPhoto(URL.createObjectURL(blob))
      setProfile((p) => (p ? { ...p, hasPhoto: true } : p))
      setCropSrc(null)
      setPhotoMsg({ type: 'ok', text: 'Foto profil berhasil diperbarui.' })
    } catch (err) {
      setPhotoMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan foto profil.' })
    } finally {
      setPhotoBusy(false)
    }
  }

  async function removePhoto() {
    setPhotoBusy(true)
    setPhotoMsg(null)
    try {
      await api.deleteProfilePhoto()
      setPhoto(null)
      setProfile((p) => (p ? { ...p, hasPhoto: false } : p))
      setPhotoMsg({ type: 'ok', text: 'Foto profil dihapus.' })
    } catch (err) {
      setPhotoMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus foto profil.' })
    } finally {
      setPhotoBusy(false)
    }
  }

  function renderUploadSlot(key, label, available) {
    if (!editing) return null
    const busy = uploadingKey === key
    return (
      <label className={`profil__upload${busy ? ' is-disabled' : ''}`} title="Unggah / ganti berkas (PDF/JPG/PNG, maks 10MB)">
        {busy ? <Loader2 size={14} className="profil__spin" /> : <Upload size={14} />}
        <span>{available ? 'Ubah' : 'Unggah'}</span>
        <input
          type="file"
          accept={ACCEPT}
          hidden
          disabled={busy}
          onChange={(e) => onPickFile(e, key, label, (file) => api.uploadDocument(key, file))}
        />
      </label>
    )
  }

  function revokeCurrentDoc() {
    setModal((m) => {
      if (m.doc?.url) URL.revokeObjectURL(m.doc.url)
      return m
    })
  }

  async function openDocumentModal(key, title) {
    revokeCurrentDoc()
    setModal({ open: true, key, title, loading: true, doc: null, error: '' })
    try {
      const doc = await api.getDocument(key)
      setModal((m) => ({ ...m, loading: false, doc }))
    } catch (err) {
      setModal((m) => ({ ...m, loading: false, error: err instanceof ApiError ? err.message : 'Gagal memuat dokumen.' }))
    }
  }

  async function openAktaModal(anak) {
    revokeCurrentDoc()
    setModal({ open: true, key: 'akta', title: `Akta Kelahiran - ${anak.nama ?? 'Anak'}`, loading: true, doc: null, error: '' })
    try {
      const doc = await api.getAktaAnak(anak.id)
      setModal((m) => ({ ...m, loading: false, doc }))
    } catch (err) {
      setModal((m) => ({ ...m, loading: false, error: err instanceof ApiError ? err.message : 'Gagal memuat dokumen.' }))
    }
  }

  function closeModal() {
    if (modal.doc?.url) URL.revokeObjectURL(modal.doc.url)
    setModal(emptyModal)
  }

  if (loadError) {
    return (
      <div className="profil__empty-card">
        <AlertCircle size={36} className="profil__empty-icon" />
        <h3>Gagal Memuat Profil</h3>
        <p>{loadError}</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="profil__empty-card">
        <Loader2 size={36} className="profil__spin profil__empty-icon" />
        <p>Memuat data profil kepegawaian...</p>
      </div>
    )
  }

  const marriedNow = editing ? form?.statusNikah === 'Kawin' : profile.isMarried
  const kkDoc = profile.berkas.find((b) => b.key === 'kk')
  const bukuNikahDoc = profile.berkas.find((b) => b.key === 'buku-nikah')
  const requiredNow = !profile.profileComplete
  const completenessPercent = getCompletenessPercentage(profile)

  return (
    <div className="profil">
      {/* Hero Banner Header Card */}
      <div className="profil__hero-card">
        <div className="profil__hero-main">
          <div className={`profil__avatar${editing ? ' profil__avatar--editable' : ''}`}>
            {photoUrl ? (
              <img src={photoUrl} alt="Foto profil" className="profil__avatar-img" />
            ) : (
              <span>{profile.namaLengkap?.charAt(0)?.toUpperCase() ?? '?'}</span>
            )}
            {editing && (
              <button
                type="button"
                className="profil__avatar-edit"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                title="Ubah foto profil"
                aria-label="Ubah foto profil"
              >
                {photoBusy ? <Loader2 size={15} className="profil__spin" /> : <Camera size={15} />}
              </button>
            )}
            <input ref={photoInputRef} type="file" accept={PHOTO_ACCEPT} hidden onChange={onPickPhoto} />
          </div>

          <div className="profil__hero-info">
            <div className="profil__hero-name-row">
              <h2 className="u-nama profil__hero-name">{profile.namaLengkap}</h2>
              <span className={`profil__status-pill${profile.isActive ? '' : ' profil__status-pill--inactive'}`}>
                {profile.isActive ? 'Karyawan Aktif' : 'Karyawan Nonaktif'}
              </span>
            </div>

            <div className="profil__hero-meta">
              {profile.idKaryawan && (
                <span className="profil__hero-meta-item">
                  <Briefcase size={13} /> NIK/ID: {profile.idKaryawan}
                </span>
              )}
              {profile.statusKaryawan && (
                <span className="profil__hero-meta-item">
                  <User size={13} /> Status: {profile.statusKaryawan}
                </span>
              )}
              <span className="profil__hero-meta-item profil__hero-meta-item--sso">
                <ShieldCheck size={13} /> Verified SSO
              </span>
            </div>

            {editing && (
              <div className="profil__photo-actions">
                <button type="button" className="profil__photo-link" onClick={() => photoInputRef.current?.click()} disabled={photoBusy}>
                  {photoUrl ? 'Ubah foto' : 'Tambah foto'}
                </button>
                {photoUrl && (
                  <button type="button" className="profil__photo-link profil__photo-link--danger" onClick={removePhoto} disabled={photoBusy}>
                    <Trash2 size={12} /> Hapus foto
                  </button>
                )}
              </div>
            )}
            {photoMsg && editing && (
              <div className={`profil__photo-msg profil__photo-msg--${photoMsg.type === 'ok' ? 'ok' : 'err'}`}>{photoMsg.text}</div>
            )}
          </div>
        </div>

        {/* Right Side Meter & Action Controls */}
        <div className="profil__hero-side">
          <div className="profil__completeness-box">
            <div className="profil__completeness-header">
              <span>Kelengkapan Profil</span>
              <span className="profil__completeness-val">{completenessPercent}%</span>
            </div>
            <div className="profil__completeness-bar">
              <div className="profil__completeness-fill" style={{ width: `${completenessPercent}%` }} />
            </div>
            <div className="profil__completeness-sub">
              {profile.profileComplete ? (
                <span className="text-ok"><CheckCircle2 size={12} /> Data Lengkap &amp; Terverifikasi</span>
              ) : (
                <span className="text-warn"><AlertCircle size={12} /> Perlengkapi data Anda</span>
              )}
            </div>
          </div>

          <div className="profil__hero-btn-wrap">
            {editing ? (
              <div className="profil__edit-actions">
                <button type="button" className="profil__btn profil__btn--ghost" onClick={cancelEdit} disabled={saving}>
                  <X size={14} /> Batal
                </button>
                <button type="button" className="profil__btn profil__btn--primary" onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 size={14} className="profil__spin" /> : <Save size={14} />}
                  <span>{saving ? 'Menyimpan…' : 'Simpan Profil'}</span>
                </button>
              </div>
            ) : (
              <button type="button" className="profil__edit-btn profil__edit-btn--active" onClick={startEdit}>
                <Edit3 size={15} />
                <span>Edit Profil</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Nav Pills */}
      <div className="profil__quick-nav">
        <a href="#info-pribadi" className="profil__nav-pill">
          <User size={14} /> Informasi Pribadi
        </a>
        <a href="#kontak-alamat" className="profil__nav-pill">
          <MapPin size={14} /> Kontak &amp; Alamat
        </a>
        <a href="#kesehatan-darurat" className="profil__nav-pill">
          <HeartPulse size={14} /> Kesehatan &amp; Darurat
        </a>
        {profile.registered && (
          <>
            <a href="#data-keluarga" className="profil__nav-pill">
              <Users size={14} /> Data Keluarga
            </a>
            <a href="#berkas-pribadi" className="profil__nav-pill">
              <Folder size={14} /> Berkas Pribadi
            </a>
          </>
        )}
      </div>

      {/* Notice Alerts */}
      {!editing && !profile.profileComplete && (
        <div className="profil__notice profil__notice--warn">
          <AlertCircle size={18} className="profil__notice-icon" />
          <div>
            <strong>Profil Anda belum lengkap.</strong> Menu lain (Absensi, Izin, Lembur, SPPD, UMDL, Tiket) masih terkunci sampai field berikut diisi:
            <div className="profil__missing-tags">
              {missingFieldsOf(profile).map((f) => (
                <span key={f} className="missing-tag">{f}</span>
              ))}
            </div>
            Klik <b>Edit Profil</b> di atas untuk melengkapinya.
          </div>
        </div>
      )}

      {editing && (
        <div className="profil__notice">
          <Sparkles size={18} className="profil__notice-icon" />
          <div>
            {!profile.registered ? (
              <>
                Profil Anda belum terdaftar di sistem. Lengkapi data di bawah ini lalu klik <b>Simpan</b>. Data keluarga dan berkas pribadi dapat dilengkapi setelah profil awal tersimpan.
              </>
            ) : !profile.profileComplete ? (
              <>
                Profil Anda belum lengkap. Lengkapi field bertanda <b className="profil__required">*</b> di bawah ini lalu klik <b>Simpan Profil</b> agar seluruh fitur portal terbuka.
              </>
            ) : (
              <>
                Anda sedang mengubah data pribadi. Klik <b>Simpan Profil</b> untuk memperbarui informasi Anda.
              </>
            )}
          </div>
        </div>
      )}

      {saveError && (
        <div className="profil__alert profil__alert--err">
          <AlertCircle size={16} />
          <span>{saveError}</span>
        </div>
      )}

      {/* Card 1: Informasi Pribadi */}
      <div className="profil__card" id="info-pribadi">
        <div className="profil__section-title">
          <div className="section-title-icon"><User size={16} /></div>
          <span>Informasi Pribadi</span>
        </div>
        <div className="profil__grid">
          <Row label="ID Karyawan" locked display={profile.idKaryawan} />
          <Row label="Nama Lengkap" editing={editing} required={requiredNow} display={profile.namaLengkap}>
            <TextField form={form} setForm={setForm} name="namaLengkap" />
          </Row>
          <Row label="NIK" editing={editing} required={requiredNow} display={profile.nik}>
            <TextField form={form} setForm={setForm} name="nik" placeholder="16 digit NIK" />
          </Row>
          <Row label="Status Karyawan" editing={editing} required={requiredNow} display={profile.statusKaryawan}>
            <SelectField form={form} setForm={setForm} name="statusKaryawan" options={STATUS_KARYAWAN_OPTIONS} />
          </Row>
          <Row label="Tempat Lahir" editing={editing} required={requiredNow} display={profile.tempatLahir}>
            <TextField form={form} setForm={setForm} name="tempatLahir" />
          </Row>
          <Row label="Tanggal Lahir" editing={editing} required={requiredNow} display={formatTanggal(profile.tglLahir)}>
            <TextField form={form} setForm={setForm} name="tglLahir" type="date" />
          </Row>
          <Row label="Jenis Kelamin" editing={editing} required={requiredNow} display={profile.jenisKelamin}>
            <SelectField form={form} setForm={setForm} name="jenisKelamin" options={GENDER_OPTIONS} />
          </Row>
          <Row label="Agama" editing={editing} required={requiredNow} display={profile.agama}>
            <SelectField form={form} setForm={setForm} name="agama" options={AGAMA_OPTIONS} />
          </Row>
          <Row label="Pendidikan" editing={editing} required={requiredNow} display={profile.pendidikan}>
            <SelectField form={form} setForm={setForm} name="pendidikan" options={PENDIDIKAN_OPTIONS} />
          </Row>
          <Row label="Status Pernikahan" editing={editing} required={requiredNow} display={
            profile.isMarried ? (
              <button type="button" className="profil__link" onClick={() => openDocumentModal('buku-nikah', 'Buku Nikah')}>
                {profile.statusNikah} ↗
              </button>
            ) : (profile.statusNikah ?? '-')
          }>
            <SelectField form={form} setForm={setForm} name="statusNikah" options={NIKAH_OPTIONS} />
          </Row>
          <Row label="Terdaftar Sejak" locked display={formatTanggal(profile.terdaftarSejak)} />
        </div>
      </div>

      {/* Card 2: Kontak & Alamat */}
      <div className="profil__card" id="kontak-alamat">
        <div className="profil__section-title">
          <div className="section-title-icon"><MapPin size={16} /></div>
          <span>Kontak &amp; Alamat Domisili</span>
        </div>
        <div className="profil__grid">
          <Row label="No. HP" editing={editing} required={requiredNow} display={profile.noHp}>
            <TextField form={form} setForm={setForm} name="noHp" placeholder="08xxxxxxxxxx" />
          </Row>
          <Row label="Email Corporate" locked display={profile.email} />
          <Row label="Alamat Lengkap" editing={editing} required={requiredNow} display={profile.alamat?.alamat}>
            <TextField form={form} setForm={setForm} name="alamat" placeholder="Jalan, No. Rumah, Komplek" />
          </Row>
          <Row label="RT" editing={editing} required={requiredNow} display={profile.alamat?.rt}>
            <TextField form={form} setForm={setForm} name="rt" placeholder="001" />
          </Row>
          <Row label="RW" editing={editing} required={requiredNow} display={profile.alamat?.rw}>
            <TextField form={form} setForm={setForm} name="rw" placeholder="002" />
          </Row>
          <WilayahFields profile={profile} form={form} setForm={setForm} editing={editing} required={requiredNow} />
          <Row label="Kode Pos" editing={editing} required={requiredNow} display={profile.alamat?.kodePos}>
            <TextField form={form} setForm={setForm} name="kodePos" placeholder="60xxx" />
          </Row>
        </div>
      </div>

      {/* Card 3: Kesehatan & Darurat */}
      <div className="profil__card" id="kesehatan-darurat">
        <div className="profil__section-title">
          <div className="section-title-icon"><HeartPulse size={16} /></div>
          <span>Kesehatan &amp; Kontak Darurat</span>
        </div>
        <div className="profil__grid">
          <Row label="Riwayat Kesehatan / Alergi" editing={editing} display={profile.riwayatKesehatan}>
            <TextField form={form} setForm={setForm} name="riwayatKesehatan" placeholder="Riwayat penyakit / alergi obat (opsional)" />
          </Row>
          <Row label="Nama Kontak Darurat" editing={editing} required={requiredNow} display={profile.namaDarurat}>
            <TextField form={form} setForm={setForm} name="namaDarurat" placeholder="Nama kerabat/keluarga" />
          </Row>
          <Row label="No. HP Darurat" editing={editing} required={requiredNow} display={profile.hpDarurat}>
            <TextField form={form} setForm={setForm} name="hpDarurat" placeholder="08xxxxxxxxxx" />
          </Row>
        </div>
      </div>

      {/* Card 4: Data Keluarga (If Registered) */}
      {profile.registered && (
        <div className="profil__card" id="data-keluarga">
          <div className="profil__section-title">
            <div className="section-title-icon"><Users size={16} /></div>
            <span>Data Keluarga &amp; Tanggungan</span>
          </div>

          <div className="profil__subsection">
            <BerkasFileRow
              label="Kartu Keluarga (KK)"
              available={kkDoc?.available}
              onClick={() => openDocumentModal('kk', 'Kartu Keluarga')}
              uploadSlot={renderUploadSlot('kk', 'Kartu Keluarga', kkDoc?.available)}
            />
          </div>

          {marriedNow && (
            <>
              <div className="profil__subsection">
                <div className="profil__subsection-title">Data Pasangan (Suami/Istri)</div>
                <div className="profil__grid">
                  <Row label="Nama Pasangan" editing={editing} display={profile.pasangan?.nama}>
                    <TextField form={form} setForm={setForm} name="namaPasangan" />
                  </Row>
                  <Row label="Tempat Lahir Pasangan" editing={editing} display={profile.pasangan?.tempatLahir}>
                    <TextField form={form} setForm={setForm} name="tempatLahirPasangan" />
                  </Row>
                  <Row label="Tanggal Lahir Pasangan" editing={editing} display={formatTanggal(profile.pasangan?.tglLahir)}>
                    <TextField form={form} setForm={setForm} name="tglLahirPasangan" type="date" />
                  </Row>
                </div>
                <BerkasFileRow
                  label="Buku Nikah / Akta Nikah"
                  available={bukuNikahDoc?.available}
                  onClick={() => openDocumentModal('buku-nikah', 'Buku Nikah')}
                  uploadSlot={renderUploadSlot('buku-nikah', 'Buku Nikah', bukuNikahDoc?.available)}
                />
              </div>

              <div className="profil__subsection">
                <div className="profil__subsection-title">Data Anak</div>
                <ChildrenSection anak={profile.anak} onChanged={reloadProfile} onViewAkta={openAktaModal} editing={editing} />
              </div>
            </>
          )}

          {/* Tidak digantung pada status menikah - single parent dgn banyak anak jg relevan. */}
          <TanggunganBpjsSection />
        </div>
      )}

      {/* Card 5: Berkas Pribadi (If Registered) */}
      {profile.registered && (
        <div className="profil__card" id="berkas-pribadi">
          <div className="profil__section-title">
            <div className="section-title-icon"><Folder size={16} /></div>
            <span>Berkas &amp; Dokumen Pribadi</span>
          </div>
          {uploadMsg && (
            <div className={`profil__alert profil__alert--${uploadMsg.type === 'ok' ? 'ok' : 'err'}`}>
              <AlertCircle size={15} />
              <span>{uploadMsg.text}</span>
            </div>
          )}
          <div className="profil__berkas-list">
            {profile.berkas
              .filter((b) => !MARITAL_KEYS.has(b.key))
              .map((b) => (
                <BerkasFileRow
                  key={b.key}
                  label={b.label}
                  available={b.available}
                  onClick={() => openDocumentModal(b.key, b.label)}
                  uploadSlot={renderUploadSlot(b.key, b.label, b.available)}
                />
              ))}
          </div>
        </div>
      )}

      <PdfPopupModal
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        loading={modal.loading}
        doc={modal.doc}
        error={modal.error}
      />

      {cropSrc && (
        <PhotoCropModal
          src={cropSrc}
          busy={photoBusy}
          onCancel={() => { if (!photoBusy) setCropSrc(null) }}
          onConfirm={saveCroppedPhoto}
        />
      )}
    </div>
  )
}
