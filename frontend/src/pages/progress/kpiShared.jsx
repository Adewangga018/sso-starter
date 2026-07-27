import { useState } from 'react'
import { X, Loader2, Pencil, Trash2, Gauge } from 'lucide-react'
import './KpiPage.css'

export const fmt = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n ?? 0)

export function StatusBadge({ status }) {
  const map = { Berjalan: 'run', Tercapai: 'ok', 'Tidak Tercapai': 'no', Dibatalkan: 'off' }
  return <span className={`kpi__st kpi__st--${map[status] || 'off'}`}>{status}</span>
}

// Kartu KPI. actions (opsional) memunculkan tombol kelola (Ubah / Nilai / Hapus).
export function KpiCard({ kpi, actions }) {
  const persen = Math.min(100, Math.max(0, kpi.persen ?? 0))
  const barClass = kpi.persen >= 100 ? 'ok' : kpi.persen >= 60 ? 'mid' : 'low'
  return (
    <div className="kpi__card">
      <div className="kpi__card-head">
        <div>
          <div className="kpi__judul">{kpi.judul}</div>
          <div className="kpi__meta">
            <span className="kpi__periode">{kpi.periode}</span>
            {kpi.level === 'Perusahaan'
              ? <span className="kpi__tag kpi__tag--corp">Perusahaan</span>
              : kpi.namaPemilik && <span className="kpi__tag">{kpi.namaPemilik}</span>}
            {kpi.bobot != null && <span className="kpi__tag kpi__tag--bobot">Bobot {fmt(kpi.bobot)}%</span>}
            {kpi.idParent && <span className="kpi__tag kpi__tag--link">turunan</span>}
          </div>
        </div>
        <StatusBadge status={kpi.status} />
      </div>

      {kpi.deskripsi && <p className="kpi__desk">{kpi.deskripsi}</p>}

      <div className="kpi__nums">
        <div><span>Realisasi</span><b>{fmt(kpi.realisasi)}{kpi.satuan ? ` ${kpi.satuan}` : ''}</b></div>
        <div><span>Target</span><b>{fmt(kpi.target)}{kpi.satuan ? ` ${kpi.satuan}` : ''}</b></div>
        <div><span>Capaian</span><b>{fmt(kpi.persen)}%</b></div>
      </div>

      <div className="kpi__bar"><div className={`kpi__bar-fill kpi__bar-fill--${barClass}`} style={{ width: `${persen}%` }} /></div>

      {kpi.catatan && <p className="kpi__catatan">“{kpi.catatan}”</p>}

      {actions && (
        <div className="kpi__actions">
          {actions.onNilai && <button type="button" className="kpi__btn" onClick={actions.onNilai}><Gauge size={14} /> Nilai</button>}
          {actions.onEdit && <button type="button" className="kpi__btn kpi__btn--ghost" onClick={actions.onEdit}><Pencil size={14} /> Ubah</button>}
          {actions.onDelete && <button type="button" className="kpi__btn kpi__btn--danger" onClick={actions.onDelete}><Trash2 size={14} /></button>}
        </div>
      )}
    </div>
  )
}

const EMPTY = { periode: String(new Date().getFullYear()), judul: '', deskripsi: '', satuan: '', target: '', bobot: '', idParent: '' }

// Modal buat/ubah definisi KPI. parentOptions: array {id, judul} untuk kaitan induk (opsional).
export function KpiFormModal({ title, initial, parentOptions = [], onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(initial
      ? {
          periode: initial.periode ?? EMPTY.periode,
          judul: initial.judul ?? '',
          deskripsi: initial.deskripsi ?? '',
          satuan: initial.satuan ?? '',
          target: initial.target ?? '',
          bobot: initial.bobot ?? '',
          idParent: initial.idParent ?? '',
        }
      : {}),
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.judul.trim()) { setErr('Judul KPI wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        periode: form.periode.trim() || String(new Date().getFullYear()),
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim() || null,
        satuan: form.satuan.trim() || null,
        target: Number(form.target || 0),
        bobot: form.bobot === '' ? null : Number(form.bobot),
        idParent: form.idParent === '' ? null : Number(form.idParent),
      })
    } catch (e2) {
      setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false)
    }
  }

  return (
    <div className="kpi__overlay" onClick={onClose}>
      <form className="kpi__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="kpi__modal-head"><h3>{title}</h3><button type="button" className="kpi__x" onClick={onClose}><X size={18} /></button></div>
        <div className="kpi__modal-body">
          {err && <div className="kpi__err">{err}</div>}
          <label className="kpi__f kpi__f--full">Judul KPI<input value={form.judul} onChange={set('judul')} placeholder="mis. Penurunan komplain pelanggan" /></label>
          <label className="kpi__f kpi__f--full">Deskripsi<textarea rows={2} value={form.deskripsi} onChange={set('deskripsi')} /></label>
          <label className="kpi__f">Periode<input value={form.periode} onChange={set('periode')} placeholder="2026" /></label>
          <label className="kpi__f">Satuan<input value={form.satuan} onChange={set('satuan')} placeholder="%, Rp, unit…" /></label>
          <label className="kpi__f">Target<input type="number" step="any" value={form.target} onChange={set('target')} /></label>
          <label className="kpi__f">Bobot (%)<input type="number" step="any" value={form.bobot} onChange={set('bobot')} placeholder="opsional" /></label>
          {parentOptions.length > 0 && (
            <label className="kpi__f kpi__f--full">Kaitkan ke KPI induk (opsional)
              <select value={form.idParent} onChange={set('idParent')}>
                <option value="">— Tidak dikaitkan —</option>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.judul}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="kpi__modal-foot">
          <button type="button" className="kpi__btn kpi__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="kpi__btn" disabled={saving}>{saving ? <Loader2 size={15} className="kpi__spin" /> : null} Simpan</button>
        </div>
      </form>
    </div>
  )
}

// Modal penilaian realisasi.
export function NilaiModal({ kpi, onClose, onSubmit }) {
  const [realisasi, setRealisasi] = useState(kpi.realisasi ?? '')
  const [status, setStatus] = useState(kpi.status ?? 'Berjalan')
  const [catatan, setCatatan] = useState(kpi.catatan ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await onSubmit({ realisasi: Number(realisasi || 0), status, catatan: catatan.trim() || null })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <div className="kpi__overlay" onClick={onClose}>
      <form className="kpi__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="kpi__modal-head"><h3>Nilai: {kpi.judul}</h3><button type="button" className="kpi__x" onClick={onClose}><X size={18} /></button></div>
        <div className="kpi__modal-body">
          {err && <div className="kpi__err">{err}</div>}
          <label className="kpi__f">Realisasi{kpi.satuan ? ` (${kpi.satuan})` : ''}<input type="number" step="any" value={realisasi} onChange={(e) => setRealisasi(e.target.value)} /></label>
          <label className="kpi__f">Target<input value={fmt(kpi.target)} disabled /></label>
          <label className="kpi__f kpi__f--full">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['Berjalan', 'Tercapai', 'Tidak Tercapai', 'Dibatalkan'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="kpi__f kpi__f--full">Catatan penilaian<textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} /></label>
        </div>
        <div className="kpi__modal-foot">
          <button type="button" className="kpi__btn kpi__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="kpi__btn" disabled={saving}>{saving ? <Loader2 size={15} className="kpi__spin" /> : null} Simpan</button>
        </div>
      </form>
    </div>
  )
}
