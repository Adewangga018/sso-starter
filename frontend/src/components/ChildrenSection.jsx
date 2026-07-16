import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import BerkasFileRow from './BerkasFileRow'

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '')
const emptyToNull = (v) => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

function formatTanggal(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

const blankForm = { nama: '', urutan: '', tempatLahir: '', tglLahir: '' }

// Full CRUD for the employee's children (MST_ANAK_PEGAWAI) plus akta upload/view. Each change
// calls onChanged() so the parent reloads the profile; akta viewing is delegated up via
// onViewAkta so it reuses the page's document popup.
export default function ChildrenSection({ anak, onChanged, onViewAkta, editing }) {
  const [editId, setEditId] = useState(null) // a child id, 'new', or null
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null) // upload/delete in-flight for this child
  const [confirmId, setConfirmId] = useState(null)
  const [msg, setMsg] = useState(null)

  // If the parent's Edit Profil is cancelled while a child sub-form is open, close it too —
  // actions here are only reachable while editing anyway, but this covers the edge case.
  useEffect(() => {
    if (!editing) {
      setEditId(null)
      setError('')
      setConfirmId(null)
    }
  }, [editing])

  function startAdd() {
    setForm(blankForm)
    setError('')
    setConfirmId(null)
    setEditId('new')
  }

  function startEdit(a) {
    setForm({
      nama: a.nama ?? '',
      urutan: a.urutan ?? '',
      tempatLahir: a.tempatLahir ?? '',
      tglLahir: toDateInput(a.tglLahir),
    })
    setError('')
    setConfirmId(null)
    setEditId(a.id)
  }

  function cancel() {
    setEditId(null)
    setError('')
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function save() {
    if (!form.nama.trim()) {
      setError('Nama anak wajib diisi.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      nama: form.nama.trim(),
      urutan: form.urutan === '' ? null : Number(form.urutan),
      tempatLahir: emptyToNull(form.tempatLahir),
      tglLahir: form.tglLahir || null,
    }
    try {
      if (editId === 'new') await api.createAnak(payload)
      else await api.updateAnak(editId, payload)
      setEditId(null)
      await onChanged()
      setMsg({ type: 'ok', text: 'Data anak tersimpan.' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan data anak.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    setBusyId(id)
    setMsg(null)
    try {
      await api.deleteAnak(id)
      setConfirmId(null)
      await onChanged()
      setMsg({ type: 'ok', text: 'Data anak dihapus.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus data anak.' })
    } finally {
      setBusyId(null)
    }
  }

  async function uploadAkta(id, e, label) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setBusyId(id)
    setMsg(null)
    try {
      await api.uploadAktaAnak(id, file)
      await onChanged()
      setMsg({ type: 'ok', text: `Akta ${label} diperbarui.` })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengunggah akta.' })
    } finally {
      setBusyId(null)
    }
  }

  const editForm = (
    <div className="profil__anak-form">
      <input
        className="profil__input"
        placeholder="Nama anak"
        value={form.nama}
        onChange={(e) => setField('nama', e.target.value)}
      />
      <input
        className="profil__input"
        type="number"
        min="1"
        placeholder="Urutan anak (opsional)"
        value={form.urutan}
        onChange={(e) => setField('urutan', e.target.value)}
      />
      <input
        className="profil__input"
        placeholder="Tempat lahir"
        value={form.tempatLahir}
        onChange={(e) => setField('tempatLahir', e.target.value)}
      />
      <input
        className="profil__input"
        type="date"
        value={form.tglLahir}
        onChange={(e) => setField('tglLahir', e.target.value)}
      />
      <div className="profil__anak-form-actions">
        <button type="button" className="profil__btn profil__btn--ghost" onClick={cancel} disabled={saving}>
          Batal
        </button>
        <button type="button" className="profil__btn" onClick={save} disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
      {error && <div className="profil__alert profil__alert--err">{error}</div>}
    </div>
  )

  return (
    <>
      {msg && <div className={`profil__alert profil__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="profil__anak-list">
        {anak.length === 0 && editId !== 'new' && (
          <div className="profil__empty-inline">Belum ada data anak.</div>
        )}

        {anak.map((a) =>
          editId === a.id ? (
            <div className="profil__anak-item profil__anak-item--editing" key={a.id}>{editForm}</div>
          ) : (
            <div className="profil__anak-item" key={a.id}>
              <div className="profil__grid">
                <div className="info-row">
                  <div className="info-row__label">Urutan Anak</div>
                  <div className="info-row__value">{a.urutan ?? '-'}</div>
                </div>
                <div className="info-row">
                  <div className="info-row__label">Nama Anak</div>
                  <div className="info-row__value">{a.nama ?? '-'}</div>
                </div>
                <div className="info-row">
                  <div className="info-row__label">Tempat Lahir</div>
                  <div className="info-row__value">{a.tempatLahir ?? '-'}</div>
                </div>
                <div className="info-row">
                  <div className="info-row__label">Tanggal Lahir</div>
                  <div className="info-row__value">{formatTanggal(a.tglLahir)}</div>
                </div>
              </div>

              <BerkasFileRow
                label="Akta Kelahiran"
                available={a.hasAkta}
                onClick={() => onViewAkta(a)}
                uploadSlot={editing && (
                  <label
                    className={`profil__upload${busyId === a.id ? ' is-disabled' : ''}`}
                    title="Unggah / ganti akta (PDF/JPG/PNG, maks 10MB)"
                  >
                    {busyId === a.id ? <Loader2 size={14} className="profil__spin" /> : <Upload size={14} />}
                    <span>{a.hasAkta ? 'Ubah' : 'Unggah'}</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      hidden
                      disabled={busyId === a.id}
                      onChange={(e) => uploadAkta(a.id, e, a.nama ?? `Anak ke-${a.urutan}`)}
                    />
                  </label>
                )}
              />

              {editing && (
                <div className="profil__anak-actions">
                  <button type="button" className="profil__iconbtn" title="Edit" onClick={() => startEdit(a)} disabled={busyId === a.id}>
                    <Pencil size={15} />
                  </button>
                  {confirmId === a.id ? (
                    <>
                      <button
                        type="button"
                        className="profil__iconbtn profil__iconbtn--danger"
                        title="Konfirmasi hapus"
                        onClick={() => remove(a.id)}
                        disabled={busyId === a.id}
                      >
                        {busyId === a.id ? <Loader2 size={15} className="profil__spin" /> : <Trash2 size={15} />}
                      </button>
                      <button type="button" className="profil__iconbtn" title="Batal" onClick={() => setConfirmId(null)}>
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="profil__iconbtn profil__iconbtn--danger"
                      title="Hapus"
                      onClick={() => setConfirmId(a.id)}
                      disabled={busyId === a.id}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ),
        )}

        {editId === 'new' && <div className="profil__anak-item profil__anak-item--editing">{editForm}</div>}
      </div>

      {editing && editId !== 'new' && (
        <button type="button" className="profil__addbtn" onClick={startAdd}>
          <Plus size={16} /> Tambah Anak
        </button>
      )}
    </>
  )
}
