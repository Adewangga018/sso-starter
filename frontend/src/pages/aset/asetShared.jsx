import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import './AsetPage.css'

export const rupiah = (n) => (n == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n))
export const tgl = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export function KondisiBadge({ kondisi }) {
  const map = { Baik: 'ok', 'Rusak Ringan': 'warn', 'Rusak Berat': 'bad', Hilang: 'bad' }
  return <span className={`aset__badge aset__badge--${map[kondisi] || 'off'}`}>{kondisi}</span>
}
export function StatusBadge({ status }) {
  const map = { Aktif: 'ok', Dipinjam: 'info', Perbaikan: 'warn', Dihapus: 'off' }
  return <span className={`aset__badge aset__badge--${map[status] || 'off'}`}>{status}</span>
}
export function MaintStatusBadge({ status }) {
  const map = { Terjadwal: 'info', Selesai: 'ok', Batal: 'off' }
  return <span className={`aset__badge aset__badge--${map[status] || 'off'}`}>{status}</span>
}

function Modal({ title, onClose, children, onSubmit, saving, err }) {
  return (
    <div className="aset__overlay" onClick={onClose}>
      <form className="aset__modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <div className="aset__modal-head"><h3>{title}</h3><button type="button" className="aset__x" onClick={onClose}><X size={18} /></button></div>
        <div className="aset__modal-body">
          {err && <div className="aset__err">{err}</div>}
          {children}
        </div>
        <div className="aset__modal-foot">
          <button type="button" className="aset__btn aset__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="aset__btn" disabled={saving}>{saving ? <Loader2 size={15} className="aset__spin" /> : null} Simpan</button>
        </div>
      </form>
    </div>
  )
}

const EMPTY_ASET = { kode: '', nama: '', kategori: '', merk: '', nomorSeri: '', lokasi: '', idPic: '', namaPic: '', kondisi: 'Baik', status: 'Aktif', nilai: '', tglPerolehan: '', catatan: '' }

export function AsetFormModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_ASET, ...pick(initial, EMPTY_ASET) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.kode.trim() || !form.nama.trim()) { setErr('Kode & nama aset wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        ...form,
        kode: form.kode.trim(), nama: form.nama.trim(),
        kategori: n(form.kategori), merk: n(form.merk), nomorSeri: n(form.nomorSeri),
        lokasi: n(form.lokasi), idPic: n(form.idPic), namaPic: n(form.namaPic), catatan: n(form.catatan),
        nilai: form.nilai === '' ? null : Number(form.nilai),
        tglPerolehan: form.tglPerolehan || null,
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title={initial ? 'Ubah Aset' : 'Tambah Aset'} onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f">Kode<input value={form.kode} onChange={set('kode')} placeholder="AST-001" /></label>
      <label className="aset__f">Kategori<input value={form.kategori} onChange={set('kategori')} placeholder="Elektronik, Kendaraan…" /></label>
      <label className="aset__f aset__f--full">Nama<input value={form.nama} onChange={set('nama')} /></label>
      <label className="aset__f">Merk / Model<input value={form.merk} onChange={set('merk')} /></label>
      <label className="aset__f">Nomor Seri<input value={form.nomorSeri} onChange={set('nomorSeri')} /></label>
      <label className="aset__f">Lokasi<input value={form.lokasi} onChange={set('lokasi')} /></label>
      <label className="aset__f">Penanggung Jawab (nama)<input value={form.namaPic} onChange={set('namaPic')} /></label>
      <label className="aset__f">NIK PIC<input value={form.idPic} onChange={set('idPic')} placeholder="opsional" /></label>
      <label className="aset__f">Kondisi
        <select value={form.kondisi} onChange={set('kondisi')}>{['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Status
        <select value={form.status} onChange={set('status')}>{['Aktif', 'Dipinjam', 'Perbaikan', 'Dihapus'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Nilai (Rp)<input type="number" step="any" value={form.nilai} onChange={set('nilai')} /></label>
      <label className="aset__f">Tgl Perolehan<input type="date" value={form.tglPerolehan} onChange={set('tglPerolehan')} /></label>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} /></label>
    </Modal>
  )
}

const EMPTY_MAINT = { jenis: 'Rutin', tglJadwal: '', tglSelesai: '', status: 'Terjadwal', pelaksana: '', biaya: '', catatan: '' }

export function MaintenanceFormModal({ initial, namaAset, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_MAINT, ...pick(initial, EMPTY_MAINT) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.tglJadwal) { setErr('Tanggal jadwal wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        jenis: form.jenis, tglJadwal: form.tglJadwal, tglSelesai: form.tglSelesai || null,
        status: form.status, pelaksana: n(form.pelaksana), catatan: n(form.catatan),
        biaya: form.biaya === '' ? null : Number(form.biaya),
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title={`${initial ? 'Ubah' : 'Tambah'} Maintenance${namaAset ? ` — ${namaAset}` : ''}`} onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f">Jenis
        <select value={form.jenis} onChange={set('jenis')}>{['Rutin', 'Perbaikan', 'Inspeksi'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Status
        <select value={form.status} onChange={set('status')}>{['Terjadwal', 'Selesai', 'Batal'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Tgl Jadwal<input type="date" value={form.tglJadwal} onChange={set('tglJadwal')} /></label>
      <label className="aset__f">Tgl Selesai<input type="date" value={form.tglSelesai} onChange={set('tglSelesai')} /></label>
      <label className="aset__f">Pelaksana / Vendor<input value={form.pelaksana} onChange={set('pelaksana')} /></label>
      <label className="aset__f">Biaya (Rp)<input type="number" step="any" value={form.biaya} onChange={set('biaya')} /></label>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} /></label>
    </Modal>
  )
}

// util: ambil hanya key milik template, ubah null→'' agar cocok untuk input terkontrol
function pick(src, template) {
  if (!src) return {}
  const out = {}
  for (const k of Object.keys(template)) {
    const v = src[k]
    if (v === undefined) continue
    out[k] = v == null ? '' : v
  }
  return out
}
const n = (s) => (typeof s === 'string' && s.trim() === '' ? null : s)
