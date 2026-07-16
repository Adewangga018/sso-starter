import { useEffect, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import PdfPopupModal from '../components/PdfPopupModal'
import BerkasFileRow from '../components/BerkasFileRow'
import ChildrenSection from '../components/ChildrenSection'
import './ProfilPage.css'

const GENDER_OPTIONS = ['Laki-laki', 'Perempuan']
const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu']
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
    agama: p.agama ?? '',
    pendidikan: p.pendidikan ?? '',
    noHp: p.noHp ?? '',
    email: p.email ?? '',
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
    agama: emptyToNull(form.agama),
    pendidikan: emptyToNull(form.pendidikan),
    noHp: emptyToNull(form.noHp),
    email: emptyToNull(form.email),
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

// One label/value row. In edit mode it renders `children` (the input); otherwise the display
// value. Locked rows always show the value and are never editable.
function Row({ label, editing, locked, display, children }) {
  return (
    <div className="info-row">
      <div className="info-row__label">{label}</div>
      <div className="info-row__value">
        {editing && !locked ? children : (display ?? '-')}
      </div>
    </div>
  )
}

// A newly-created employee record has no self-service data yet (only what HR seeded). In that
// case the page opens straight into edit mode so the fields render as inputs immediately,
// instead of a screen full of "-" behind an extra "Edit Profil" click.
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
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data profil.')
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    e.target.value = '' // allow re-selecting the same file later
    handleUpload(uploadKey, file, label, doUpload)
  }

  // Upload control for a single berkas document; only rendered while editing (see BerkasFileRow
  // usages below). Shared by the standalone KK/Buku Nikah rows and the Berkas Pribadi grid.
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

  // The doc.url is a blob: object URL; free the previous one before loading another.
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
    return <div className="profil__empty">{loadError}</div>
  }

  if (!profile) {
    return <div className="profil__empty">Memuat data profil...</div>
  }

  const marriedNow = editing ? form?.statusNikah === 'Kawin' : profile.isMarried
  const kkDoc = profile.berkas.find((b) => b.key === 'kk')
  const bukuNikahDoc = profile.berkas.find((b) => b.key === 'buku-nikah')

  return (
    <div className="profil">
      <div className="profil__header">
        <div className="profil__avatar">{profile.namaLengkap?.charAt(0)?.toUpperCase() ?? '?'}</div>
        <div className="profil__header-text">
          <h2>{profile.namaLengkap}</h2>
          <span className={`profil__status-pill${profile.isActive ? '' : ' profil__status-pill--inactive'}`}>
            {profile.isActive ? 'Karyawan Aktif' : 'Karyawan Nonaktif'}
          </span>
        </div>
        {editing ? (
          <div className="profil__edit-actions">
            <button type="button" className="profil__btn profil__btn--ghost" onClick={cancelEdit} disabled={saving}>
              Batal
            </button>
            <button type="button" className="profil__btn" onClick={saveProfile} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        ) : (
          <button type="button" className="profil__edit-btn profil__edit-btn--active" onClick={startEdit}>
            Edit Profil
          </button>
        )}
      </div>

      {editing && (
        <div className="profil__notice">
          Anda dapat memperbarui data pribadi Anda. <b>ID Karyawan</b>, status kepegawaian, dan
          email dikunci oleh sistem. Klik <b>Simpan</b> untuk menyimpan perubahan.
        </div>
      )}
      {saveError && <div className="profil__alert profil__alert--err">{saveError}</div>}

      <div className="profil__card">
        <div className="profil__section-title">Informasi Pribadi</div>
        <div className="profil__grid">
          <Row label="ID Karyawan" locked display={profile.idKaryawan} />
          <Row label="Nama Lengkap" editing={editing} display={profile.namaLengkap}>
            <TextField form={form} setForm={setForm} name="namaLengkap" />
          </Row>
          <Row label="NIK" editing={editing} display={profile.nik}>
            <TextField form={form} setForm={setForm} name="nik" placeholder="16 digit" />
          </Row>
          <Row label="Status Karyawan" locked display={profile.statusKaryawan} />
          <Row label="Tempat Lahir" editing={editing} display={profile.tempatLahir}>
            <TextField form={form} setForm={setForm} name="tempatLahir" />
          </Row>
          <Row label="Tanggal Lahir" editing={editing} display={formatTanggal(profile.tglLahir)}>
            <TextField form={form} setForm={setForm} name="tglLahir" type="date" />
          </Row>
          <Row label="Jenis Kelamin" editing={editing} display={profile.jenisKelamin}>
            <SelectField form={form} setForm={setForm} name="jenisKelamin" options={GENDER_OPTIONS} />
          </Row>
          <Row label="Agama" editing={editing} display={profile.agama}>
            <SelectField form={form} setForm={setForm} name="agama" options={AGAMA_OPTIONS} />
          </Row>
          <Row label="Pendidikan" editing={editing} display={profile.pendidikan}>
            <TextField form={form} setForm={setForm} name="pendidikan" />
          </Row>
          <Row label="Status Pernikahan" editing={editing} display={
            profile.isMarried ? (
              <button type="button" className="profil__link" onClick={() => openDocumentModal('kk', 'Kartu Keluarga')}>
                {profile.statusNikah}
              </button>
            ) : (profile.statusNikah ?? '-')
          }>
            <SelectField form={form} setForm={setForm} name="statusNikah" options={NIKAH_OPTIONS} />
          </Row>
          <Row label="Terdaftar Sejak" locked display={formatTanggal(profile.terdaftarSejak)} />
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Kontak &amp; Alamat</div>
        <div className="profil__grid">
          <Row label="No. HP" editing={editing} display={profile.noHp}>
            <TextField form={form} setForm={setForm} name="noHp" />
          </Row>
          <Row label="Email" locked display={profile.email} />
          <Row label="Alamat" editing={editing} display={profile.alamat?.alamat}>
            <TextField form={form} setForm={setForm} name="alamat" />
          </Row>
          <Row label="RT" editing={editing} display={profile.alamat?.rt}>
            <TextField form={form} setForm={setForm} name="rt" />
          </Row>
          <Row label="RW" editing={editing} display={profile.alamat?.rw}>
            <TextField form={form} setForm={setForm} name="rw" />
          </Row>
          <Row label="Desa" editing={editing} display={profile.alamat?.desa}>
            <TextField form={form} setForm={setForm} name="desa" />
          </Row>
          <Row label="Kecamatan" editing={editing} display={profile.alamat?.kecamatan}>
            <TextField form={form} setForm={setForm} name="kecamatan" />
          </Row>
          <Row label="Kabupaten" editing={editing} display={profile.alamat?.kabupaten}>
            <TextField form={form} setForm={setForm} name="kabupaten" />
          </Row>
          <Row label="Provinsi" editing={editing} display={profile.alamat?.provinsi}>
            <TextField form={form} setForm={setForm} name="provinsi" />
          </Row>
          <Row label="Kode Pos" editing={editing} display={profile.alamat?.kodePos}>
            <TextField form={form} setForm={setForm} name="kodePos" />
          </Row>
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Kesehatan &amp; Darurat</div>
        <div className="profil__grid">
          <Row label="Riwayat Kesehatan" editing={editing} display={profile.riwayatKesehatan}>
            <TextField form={form} setForm={setForm} name="riwayatKesehatan" />
          </Row>
          <Row label="Nama Kontak Darurat" editing={editing} display={profile.namaDarurat}>
            <TextField form={form} setForm={setForm} name="namaDarurat" />
          </Row>
          <Row label="No. HP Darurat" editing={editing} display={profile.hpDarurat}>
            <TextField form={form} setForm={setForm} name="hpDarurat" />
          </Row>
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Data Keluarga</div>

        {marriedNow && (
          <div className="profil__subsection">
            <BerkasFileRow
              label="Kartu Keluarga"
              available={kkDoc?.available}
              onClick={() => openDocumentModal('kk', 'Kartu Keluarga')}
              uploadSlot={renderUploadSlot('kk', 'Kartu Keluarga', kkDoc?.available)}
            />
          </div>
        )}

        {marriedNow && (
          <div className="profil__subsection">
            <div className="profil__subsection-title">Data Pasangan</div>
            <div className="profil__grid">
              <Row label="Nama Pasangan" editing={editing} display={profile.pasangan?.nama}>
                <TextField form={form} setForm={setForm} name="namaPasangan" />
              </Row>
              <Row label="Tempat Lahir" editing={editing} display={profile.pasangan?.tempatLahir}>
                <TextField form={form} setForm={setForm} name="tempatLahirPasangan" />
              </Row>
              <Row label="Tanggal Lahir" editing={editing} display={formatTanggal(profile.pasangan?.tglLahir)}>
                <TextField form={form} setForm={setForm} name="tglLahirPasangan" type="date" />
              </Row>

            </div>
            <BerkasFileRow
              label="Buku Nikah"
              available={bukuNikahDoc?.available}
              onClick={() => openDocumentModal('buku-nikah', 'Buku Nikah')}
              uploadSlot={renderUploadSlot('buku-nikah', 'Buku Nikah', bukuNikahDoc?.available)}
            />
          </div>
        )}

        <div className="profil__subsection">
          <div className="profil__subsection-title">Data Anak</div>
          <ChildrenSection anak={profile.anak} onChanged={reloadProfile} onViewAkta={openAktaModal} editing={editing} />
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Berkas Pribadi</div>
        {uploadMsg && (
          <div className={`profil__alert profil__alert--${uploadMsg.type === 'ok' ? 'ok' : 'err'}`}>
            {uploadMsg.text}
          </div>
        )}
        <div className="profil__berkas-list">
          {profile.berkas
            .filter((b) => !MARITAL_KEYS.has(b.key)) // KK & Buku Nikah now live under Data Keluarga
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

      <PdfPopupModal
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        loading={modal.loading}
        doc={modal.doc}
        error={modal.error}
      />
    </div>
  )
}
