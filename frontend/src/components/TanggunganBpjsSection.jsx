import { useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'

// Pendaftaran mandiri (My Personal > Profil) untuk anggota keluarga lain yang
// diikutsertakan BPJS Kesehatan (di luar diri sendiri) - dibaca formula Potongan
// BPJS Kesehatan di Payroll. Base 1% dari Pendapatan Dasar SELALU dipotong; tiap
// anggota keluarga lain yang didaftarkan di sini menambah 1% lagi (tanpa batas gratis).
export default function TanggunganBpjsSection() {
  const [data, setData] = useState(undefined) // undefined = memuat, null = gagal muat
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({ jumlahTanggungan: '', keterangan: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)

  async function load() {
    try {
      const d = await api.getTanggunganBpjs()
      setData(d)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat data tanggungan.' })
      setData(null)
    }
  }

  useEffect(() => { load() }, [])

  function startEdit() {
    setForm({
      jumlahTanggungan: data?.jumlahTanggungan ? String(data.jumlahTanggungan) : '',
      keterangan: data?.keterangan ?? '',
    })
    setError('')
    setConfirmDelete(false)
    setEditing(true)
  }

  async function save() {
    const n = Number(form.jumlahTanggungan)
    if (!n || n <= 0) {
      setError('Jumlah anggota keluarga lain yang diikutsertakan harus minimal 1.')
      return
    }
    setSaving(true); setError('')
    try {
      await api.simpanTanggunganBpjs({ jumlahTanggungan: n, keterangan: form.keterangan.trim() || null })
      setEditing(false)
      await load()
      setMsg({ type: 'ok', text: 'Pendaftaran tanggungan tersimpan.' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true); setMsg(null)
    try {
      await api.hapusTanggunganBpjs()
      setConfirmDelete(false)
      await load()
      setMsg({ type: 'ok', text: 'Pendaftaran tanggungan dihapus.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profil__subsection">
      <div className="profil__subsection-title">Anggota Keluarga Lain BPJS Kesehatan</div>
      <p className="profil__hint">
        Potongan BPJS Kesehatan (1% dari Pendapatan Dasar) selalu berlaku untuk Anda. Kalau
        ada anggota keluarga lain (pasangan dan/atau anak) yang ikut diikutsertakan di BPJS
        Kesehatan perusahaan, daftarkan jumlahnya di sini - tiap orang menambah potongan 1%
        lagi, otomatis terhitung di slip gaji.
      </p>

      {msg && <div className={`profil__alert profil__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {data === undefined ? (
        <div className="profil__empty-inline"><Loader2 size={14} className="profil__spin" /> Memuat…</div>
      ) : editing ? (
        <div className="profil__anak-form">
          <input
            className="profil__input" type="number" min="1"
            placeholder="Jumlah anggota keluarga lain (min. 1)"
            value={form.jumlahTanggungan}
            onChange={(e) => setForm((f) => ({ ...f, jumlahTanggungan: e.target.value }))}
          />
          <input
            className="profil__input"
            placeholder="Keterangan (opsional, mis. nama-nama anggota keluarga)"
            value={form.keterangan}
            onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
          />
          <div className="profil__anak-form-actions">
            <button type="button" className="profil__btn profil__btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
              Batal
            </button>
            <button type="button" className="profil__btn" onClick={save} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
          {error && <div className="profil__alert profil__alert--err">{error}</div>}
        </div>
      ) : data?.jumlahTanggungan ? (
        <div className="profil__anak-item">
          <div className="profil__grid">
            <div className="info-row">
              <div className="info-row__label">Jumlah Anggota Keluarga Lain</div>
              <div className="info-row__value">{data.jumlahTanggungan}</div>
            </div>
            <div className="info-row">
              <div className="info-row__label">Keterangan</div>
              <div className="info-row__value">{data.keterangan ?? '-'}</div>
            </div>
          </div>
          <div className="profil__anak-actions">
            <button type="button" className="profil__iconbtn" title="Ubah" onClick={startEdit} disabled={saving}>
              <Pencil size={15} />
            </button>
            {confirmDelete ? (
              <>
                <button
                  type="button" className="profil__iconbtn profil__iconbtn--danger" title="Konfirmasi hapus"
                  onClick={remove} disabled={saving}
                >
                  {saving ? <Loader2 size={15} className="profil__spin" /> : <Trash2 size={15} />}
                </button>
                <button type="button" className="profil__iconbtn" title="Batal" onClick={() => setConfirmDelete(false)}>
                  <X size={15} />
                </button>
              </>
            ) : (
              <button
                type="button" className="profil__iconbtn profil__iconbtn--danger" title="Hapus"
                onClick={() => setConfirmDelete(true)} disabled={saving}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" className="profil__addbtn" onClick={startEdit}>
          Daftarkan Anggota Keluarga Lain
        </button>
      )}
    </div>
  )
}
