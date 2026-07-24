import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { CheckCircle2, Eye, Plus, RotateCw, Search, Send, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { useDialog } from '../../components/DialogProvider'
import { statusClass } from './statusClass'
import './inovasi.css'

// Sumbang Gagasan. Karyawan mengirim latar belakang + masalah + solusi; dinilai
// Verifikator (Manager bagian) lalu disetujui GM Kompartemen (Asal & Tujuan).
// GM memilih metodologi (SS/GIO/5R). Setelah disetujui, Ketua mendaftarkan
// menjadi risalah dan mengisi Sekretaris/Anggota/Fasilitator sendiri.
// Untuk approver (Manager/GM) tampilan berupa "Persetujuan Gagasan" - hanya
// melihat & memproses, tanpa tombol buat gagasan.
export default function GagasanList() {
  const ctx = useOutletContext() || {}
  const isApprover = ctx.isApprover === true
  const peran = ctx.peran ?? 'Karyawan'
  const navigate = useNavigate()
  const dialog = useDialog()

  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)

  async function load() {
    try {
      const d = await api.listGagasan()
      setRows(d.items)
      setErr('')
    } catch (e) {
      if (isEmptyDataError(e)) { setRows([]); setErr(''); return }
      setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.')
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = rows ?? []
    // Approver hanya menampilkan gagasan yang perlu ia proses (bukan miliknya).
    if (isApprover) list = list.filter((r) => r.peranSaya !== 'Pengaju')
    if (!term) return list
    return list.filter((r) => [r.noRegistrasi, r.judul, r.status, r.namaDepartemenAsal, r.namaDepartemenTujuan, r.metodologi]
      .some((v) => (v ?? '').toString().toLowerCase().includes(term)))
  }, [rows, search, isApprover])

  async function del(row) {
    if (!(await dialog.confirm({ title: 'Hapus Gagasan', message: `Hapus gagasan "${row.judul}"?`, danger: true, confirmText: 'Hapus' }))) return
    try { await api.deleteGagasan(row.id); await load() } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal menghapus.') }
  }

  const judul = peran === 'Manager' ? 'Verifikasi Gagasan' : peran === 'GM' ? 'Persetujuan Gagasan' : 'Sumbang Gagasan'
  const subtitle = peran === 'Manager'
    ? 'Verifikasi gagasan yang diajukan bawahan Anda. Anda dapat menyetujui (meneruskan ke GM), meminta revisi, atau menolak.'
    : peran === 'GM'
      ? 'Setujui gagasan yang telah diverifikasi Manager dan pilih metodologinya (SS/GIO/5R). Anda dapat menyetujui, meminta revisi, atau menolak.'
      : 'Ajukan gagasan (latar belakang, masalah, solusi). Setelah dinilai Manager & disetujui GM Kompartemen, daftarkan menjadi risalah.'

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data gagasan...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">{judul}</h2>
      <p className="inv__subtitle">{subtitle}</p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__search">
          <span className="inv__search-icon"><Search size={16} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. registrasi, judul, status..." />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="inv__btn inv__btn--ghost" onClick={load} title="Muat ulang"><RotateCw size={15} /></button>
          {!isApprover && (
            <button type="button" className="inv__btn inv__btn--primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Sumbang Gagasan</button>
          )}
        </div>
      </div>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th>Status</th><th>No. Registrasi</th><th>Judul</th><th>Metodologi</th>
              <th>Dep. Asal</th><th>Dep. Tujuan</th><th>Peran</th><th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td className="inv__no-data" colSpan={8}>Belum ada gagasan.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td><span className={`inv__status ${statusClass(r.status)}`}>{r.status}</span></td>
                <td>{r.noRegistrasi ?? '-'}</td>
                <td style={{ maxWidth: 260 }}>{r.judul}</td>
                <td style={{ textAlign: 'center' }}>{r.metodologi ?? '-'}</td>
                <td>{r.namaDepartemenAsal ?? '-'}</td>
                <td>{r.namaDepartemenTujuan ?? <span style={{ color: '#9aa79d' }}>(sama)</span>}</td>
                <td>{r.peranSaya}</td>
                <td>
                  <div className="inv__row-actions" style={{ justifyContent: 'flex-end' }}>
                    {r.idGugus
                      ? <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '5px 10px' }} onClick={() => navigate(`/my-innovation/daftar/${r.idGugus}`)}>Buka Risalah</button>
                      : <button type="button" className="inv__icon-btn" title="Buka" onClick={() => setDetailId(r.id)}><Eye size={15} /></button>}
                    {r.peranSaya === 'Pengaju' && !r.idGugus && ['Dikirim', 'Revisi Verifikator', 'Revisi GM'].includes(r.status) && (
                      <button type="button" className="inv__icon-btn inv__icon-btn--danger" title="Hapus" onClick={() => del(r)}><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load() }} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} navigate={navigate} />}
    </div>
  )
}

// ---------- Create ----------
function CreateModal({ onClose, onDone }) {
  const [form, setForm] = useState({ judul: '', latarBelakang: '', masalah: '', solusi: '', idDepartemenTujuan: '' })
  const [depts, setDepts] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { api.listDepartemenInovasi().then(setDepts).catch(() => setDepts([])) }, [])

  async function submit(e) {
    e.preventDefault()
    setErr(''); setSaving(true)
    try {
      await api.createGagasan({
        judul: form.judul,
        latarBelakang: form.latarBelakang,
        masalah: form.masalah,
        solusi: form.solusi,
        idDepartemenTujuan: form.idDepartemenTujuan ? Number(form.idDepartemenTujuan) : null,
      })
      onDone()
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Gagal menyimpan gagasan.') }
    finally { setSaving(false) }
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle(560, true)}>
        <ModalHead title="Sumbang Gagasan Baru" onClose={onClose} />
        <form onSubmit={submit} style={{ overflowY: 'auto' }}>
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Judul Usulan</span>
            <input value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} required placeholder="Judul gagasan" />
          </label>
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Latar Belakang</span>
            <textarea rows={3} value={form.latarBelakang} onChange={(e) => setForm({ ...form, latarBelakang: e.target.value })} placeholder="Kondisi awal / konteks." />
          </label>
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Masalah</span>
            <textarea rows={3} value={form.masalah} onChange={(e) => setForm({ ...form, masalah: e.target.value })} placeholder="Pokok masalah yang ingin diperbaiki." />
          </label>
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Solusi Masalah</span>
            <textarea rows={3} value={form.solusi} onChange={(e) => setForm({ ...form, solusi: e.target.value })} placeholder="Usulan solusi." />
          </label>
          <label className="inv__field" style={{ marginBottom: 6 }}>
            <span>Departemen Tujuan (opsional)</span>
            <select value={form.idDepartemenTujuan} onChange={(e) => setForm({ ...form, idDepartemenTujuan: e.target.value })}>
              <option value="">-- Departemen sendiri --</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          </label>
          <p className="inv__hint" style={{ marginBottom: 12 }}>Memilih departemen lain = gagasan lintas departemen. Bila lintas kompartemen, GM kompartemen tujuan ikut menyetujui.</p>
          {err && <div className="inv__banner inv__banner--err">{err}</div>}
          <div className="inv__actions-bar" style={{ marginTop: 8 }}>
            <button type="button" className="inv__btn inv__btn--ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="inv__btn inv__btn--primary" disabled={saving}><Send size={15} /> {saving ? 'Mengirim...' : 'Kirim Gagasan'}</button>
          </div>
        </form>
      </div>
    </Backdrop>
  )
}

// ---------- Detail + Approval + Daftar ----------
function DetailModal({ id, onClose, onChanged, navigate }) {
  const dialog = useDialog()
  const [g, setG] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState({ judul: '', latarBelakang: '', masalah: '', solusi: '' })
  const [metodologi, setMetodologi] = useState('SS')

  // Lintas departemen => SS tidak boleh (SS anggota satu departemen); hanya GIO/5R.
  const lintasDept = Boolean(g?.namaDepartemenTujuan)
  const metodOptions = lintasDept ? ['GIO', '5R'] : ['SS', 'GIO', '5R']

  async function load() {
    try {
      const d = await api.getGagasan(id)
      setG(d)
      setEdit({ judul: d.judul, latarBelakang: d.latarBelakang ?? '', masalah: d.masalah ?? '', solusi: d.solusi ?? '' })
      if (d.metodologi) setMetodologi(d.metodologi)
      else if (d.namaDepartemenTujuan) setMetodologi('GIO')
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal memuat.') }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  async function saveEdit() {
    setBusy(true); setErr('')
    try {
      await api.updateGagasan(id, { judul: edit.judul, latarBelakang: edit.latarBelakang, masalah: edit.masalah, solusi: edit.solusi, idDepartemenTujuan: g.idDepartemenTujuan })
      await load(); onChanged()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal menyimpan.') } finally { setBusy(false) }
  }

  async function act(step, aksi) {
    const payload = { aksi, komentar: null, metodologi: null }
    if (aksi === 'Revisi' || aksi === 'Ditolak') {
      const komentar = await dialog.prompt({
        title: aksi === 'Revisi' ? 'Minta Revisi Gagasan' : 'Tolak Gagasan',
        label: `Komentar ${aksi.toLowerCase()}${aksi === 'Ditolak' ? '' : ' (jelaskan yang perlu diperbaiki)'}:`,
        multiline: true,
        confirmText: aksi === 'Revisi' ? 'Kirim Revisi' : 'Tolak',
      })
      if (komentar === null) return
      payload.komentar = komentar
    }
    if (aksi === 'Disetujui' && step.peran === 'GM Kompartemen Asal') payload.metodologi = metodologi
    setBusy(true); setErr('')
    try { await api.actGagasanApproval(id, payload); await load(); onChanged() }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal memproses.') } finally { setBusy(false) }
  }

  async function daftar() {
    const nama = await dialog.prompt({
      title: 'Daftarkan Inovasi',
      label: 'Nama gugus untuk risalah:',
      defaultValue: g.judul?.slice(0, 40) || '',
      required: true,
      confirmText: 'Daftarkan',
    })
    if (nama === null) return
    setBusy(true); setErr('')
    try {
      const res = await api.daftarGagasan(id, { metodologi: g.metodologi, namaGugus: nama })
      onChanged()
      navigate(`${res.base}/daftar/${res.idGugus}`)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal mendaftarkan.') } finally { setBusy(false) }
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle(640, true)}>
        <ModalHead title="Detail Gagasan" onClose={onClose} />
        {!g ? <p className="inv__subtitle">Memuat...</p> : (
          <div style={{ overflowY: 'auto' }}>
            <div className="inv__meta">
              <span>No. Reg: <b>{g.noRegistrasi ?? '-'}</b></span>
              <span>Status: <span className={`inv__status ${statusClass(g.status)}`}>{g.status}</span></span>
              {g.metodologi && <span>Metodologi: <b>{g.metodologi}</b></span>}
            </div>
            <div className="inv__meta">
              <span>Dep. Asal: <b>{g.namaDepartemenAsal ?? '-'}</b></span>
              <span>Dep. Tujuan: <b>{g.namaDepartemenTujuan ?? '(sama)'}</b></span>
            </div>

            {err && <div className="inv__banner inv__banner--err">{err}</div>}

            {g.bisaEdit ? (
              <div className="inv__card">
                <div className="inv__section-head"><span className="inv__section-tag">Isi</span><h3>Perbaikan Gagasan</h3></div>
                <label className="inv__field" style={{ marginBottom: 10 }}><span>Judul Usulan</span>
                  <input value={edit.judul} onChange={(e) => setEdit({ ...edit, judul: e.target.value })} /></label>
                <label className="inv__field" style={{ marginBottom: 10 }}><span>Latar Belakang</span>
                  <textarea rows={3} value={edit.latarBelakang} onChange={(e) => setEdit({ ...edit, latarBelakang: e.target.value })} /></label>
                <label className="inv__field" style={{ marginBottom: 10 }}><span>Masalah</span>
                  <textarea rows={3} value={edit.masalah} onChange={(e) => setEdit({ ...edit, masalah: e.target.value })} /></label>
                <label className="inv__field" style={{ marginBottom: 10 }}><span>Solusi Masalah</span>
                  <textarea rows={3} value={edit.solusi} onChange={(e) => setEdit({ ...edit, solusi: e.target.value })} /></label>
                <div className="inv__actions-bar"><button type="button" className="inv__btn inv__btn--primary" onClick={saveEdit} disabled={busy}>Simpan Perbaikan</button></div>
              </div>
            ) : (
              <div className="inv__card">
                <div className="inv__section-head"><span className="inv__section-tag">Isi</span><h3>{g.judul}</h3></div>
                <Field label="Latar Belakang" value={g.latarBelakang} />
                <Field label="Masalah" value={g.masalah} />
                <Field label="Solusi Masalah" value={g.solusi} />
              </div>
            )}

            <div className="inv__card">
              <div className="inv__section-head"><span className="inv__section-tag">Alur</span><h3>Penilaian Berjenjang</h3></div>
              <p className="inv__hint">Verifikator (Manager bagian) &rarr; GM Kompartemen Asal (memilih metodologi){lintasDept ? ' → GM Kompartemen Tujuan' : ''}.</p>
              <div className="inv__sign-grid">
                {g.approval.map((a) => (
                  <div className="inv__sign" key={a.id}>
                    <div className="inv__sign-role">{a.peran}</div>
                    <div className="inv__sign-name">{a.nama ?? '(belum ditetapkan)'}</div>
                    <span className={`inv__status ${statusClass(a.status === 'Disetujui' ? 'Divalidasi' : a.status === 'Menunggu' ? 'Dikirim' : a.status === 'Revisi' ? 'Revisi' : a.status)}`}>{a.status}</span>
                    {a.metodologi && <div className="inv__hint" style={{ marginTop: 4 }}>Metodologi: <b>{a.metodologi}</b></div>}
                    {a.komentar && <div className="inv__hint" style={{ marginTop: 4 }}>&ldquo;{a.komentar}&rdquo;</div>}
                    {a.bisaSaya && (
                      <div className="inv__sign-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        {a.peran === 'GM Kompartemen Asal' && (
                          <label className="inv__field" style={{ marginBottom: 6 }}>
                            <span>Approve ke Metodologi</span>
                            <select value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
                              {metodOptions.map((o) => <option key={o} value={o}>{o === 'SS' ? 'SS (Sistem Saran)' : o === 'GIO' ? 'GIO (Gugus Inovasi Operasi)' : '5R'}</option>)}
                            </select>
                          </label>
                        )}
                        {a.peran === 'GM Kompartemen Asal' && lintasDept && <div className="inv__hint" style={{ marginBottom: 6 }}>Lintas departemen - hanya bisa GIO / 5R.</div>}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className="inv__btn inv__btn--primary" style={{ padding: '6px 12px' }} disabled={busy} onClick={() => act(a, 'Disetujui')}><CheckCircle2 size={14} /> Setujui</button>
                          <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '6px 12px' }} disabled={busy} onClick={() => act(a, 'Revisi')}>Revisi</button>
                          <button type="button" className="inv__btn inv__btn--danger" style={{ padding: '6px 12px' }} disabled={busy} onClick={() => act(a, 'Ditolak')}>Tolak</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {g.siapDaftar && (
              <div className="inv__banner inv__banner--ok" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>Gagasan disetujui. Daftarkan menjadi risalah {g.metodologi}. Anda (Ketua) akan mengisi nama gugus, Sekretaris, Anggota, dan Fasilitator di form risalah.</span>
                <button type="button" className="inv__btn inv__btn--primary" onClick={daftar} disabled={busy}>Daftarkan Inovasi</button>
              </div>
            )}
          </div>
        )}
      </div>
    </Backdrop>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--inv-green-dark)' }}>{label}</div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{value || '-'}</div>
    </div>
  )
}

// ---------- small helpers ----------
function Backdrop({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,22,0.45)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
function modalStyle(w, tall) {
  return { background: '#fff', borderRadius: 14, width: `min(${w}px, 94vw)`, maxHeight: tall ? '88vh' : undefined, display: 'flex', flexDirection: 'column', padding: 20 }
}
function ModalHead({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
      <button type="button" className="inv__icon-btn" onClick={onClose}><X size={16} /></button>
    </div>
  )
}
