import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { CheckCircle2, Eye, Plus, RotateCw, Search, Send, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import PegawaiPicker from './PegawaiPicker'
import { statusClass } from './statusClass'
import './inovasi.css'

// Daftar Gagasan (Sumbang Gagasan). Pengaju mengirim judul + latar belakang;
// dinilai berjenjang (Fasilitator/Manager -> Verifikator/GM -> VP Asal -> VP
// Tujuan) lalu didaftarkan ke SERGIO (menjadi gugus SS/GIO).
export default function GagasanList() {
  const ctx = useOutletContext() || {}
  const jenis = ctx.jenis ?? 'SS'
  const navigate = useNavigate()

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
    const list = rows ?? []
    if (!term) return list
    return list.filter((r) => [r.noRegistrasi, r.judul, r.status, r.namaDepartemenAsal, r.namaDepartemenTujuan, r.metodologi]
      .some((v) => (v ?? '').toString().toLowerCase().includes(term)))
  }, [rows, search])

  async function del(row) {
    if (!confirm(`Hapus gagasan "${row.judul}"?`)) return
    try { await api.deleteGagasan(row.id); await load() } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal menghapus.') }
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data gagasan...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Daftar Gagasan (Sumbang Gagasan)</h2>
      <p className="inv__subtitle">Ajukan gagasan awal (judul & latar belakang). Setelah disetujui berjenjang, daftarkan menjadi risalah inovasi.</p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__search">
          <span className="inv__search-icon"><Search size={16} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. registrasi, judul, status..." />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="inv__btn inv__btn--ghost" onClick={load} title="Muat ulang"><RotateCw size={15} /></button>
          <button type="button" className="inv__btn inv__btn--primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Sumbang Gagasan</button>
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
                    {r.peranSaya === 'Pengaju' && !r.idGugus && ['Dikirim', 'Revisi Fasilitator', 'Revisi Verifikator'].includes(r.status) && (
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
      {detailId && <DetailModal id={detailId} jenis={jenis} onClose={() => setDetailId(null)} onChanged={load} navigate={navigate} />}
    </div>
  )
}

// ---------- Create ----------
function CreateModal({ onClose, onDone }) {
  const [form, setForm] = useState({ judul: '', latarBelakang: '', idDepartemenTujuan: '' })
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
        idDepartemenTujuan: form.idDepartemenTujuan ? Number(form.idDepartemenTujuan) : null,
      })
      onDone()
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Gagal menyimpan gagasan.') }
    finally { setSaving(false) }
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle(520)}>
        <ModalHead title="Sumbang Gagasan Baru" onClose={onClose} />
        <form onSubmit={submit}>
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Judul Usulan</span>
            <input value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} required placeholder="Judul gagasan" />
          </label>
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Gambaran / Latar Belakang (Kondisi Awal)</span>
            <textarea rows={4} value={form.latarBelakang} onChange={(e) => setForm({ ...form, latarBelakang: e.target.value })} placeholder="Uraikan kondisi awal / masalah." />
          </label>
          <label className="inv__field" style={{ marginBottom: 6 }}>
            <span>Departemen Tujuan (opsional)</span>
            <select value={form.idDepartemenTujuan} onChange={(e) => setForm({ ...form, idDepartemenTujuan: e.target.value })}>
              <option value="">-- Departemen sendiri --</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          </label>
          <p className="inv__hint" style={{ marginBottom: 12 }}>SS hanya untuk departemen sendiri. Memilih departemen lain berarti gagasan lintas departemen (hanya GIO / 5R).</p>
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
function DetailModal({ id, jenis, onClose, onChanged, navigate }) {
  const [g, setG] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState({ judul: '', latarBelakang: '' })
  const [metodologi, setMetodologi] = useState(jenis === 'GIO' ? 'GIO' : 'SS')
  const [fasil, setFasil] = useState(null)   // { nik, nama }
  const [pembina, setPembina] = useState(null)
  const [pickerFor, setPickerFor] = useState(null)  // 'fasil' | 'pembina' | null

  // Lintas departemen (dep. tujuan diisi) => SS tidak boleh; hanya GIO/5R.
  const lintasDept = Boolean(g?.namaDepartemenTujuan)
  const metodOptions = lintasDept ? ['GIO', '5R'] : ['SS', 'GIO', '5R']

  async function load() {
    try {
      const d = await api.getGagasan(id)
      setG(d)
      setEdit({ judul: d.judul, latarBelakang: d.latarBelakang ?? '' })
      if (d.metodologi) setMetodologi(d.metodologi)
      else if (d.namaDepartemenTujuan) setMetodologi('GIO')
      if (d.fasilitatorNik) setFasil({ nik: d.fasilitatorNik, nama: d.fasilitatorNama })
      if (d.pembinaNik) setPembina({ nik: d.pembinaNik, nama: d.pembinaNama })
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal memuat.') }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  async function saveEdit() {
    setBusy(true); setErr('')
    try { await api.updateGagasan(id, { judul: edit.judul, latarBelakang: edit.latarBelakang, idDepartemenTujuan: g.idDepartemenTujuan }); await load(); onChanged() }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal menyimpan.') } finally { setBusy(false) }
  }

  async function act(step, aksi) {
    const payload = { aksi, komentar: null, metodologi: null, fasilitatorNik: null, fasilitatorNama: null, pembinaNik: null, pembinaNama: null }
    if (aksi === 'Revisi' || aksi === 'Ditolak') { payload.komentar = window.prompt(`Komentar ${aksi.toLowerCase()}:`) ?? '' }
    if (aksi === 'Disetujui' && step.peran === 'Verifikator') {
      // GM menetapkan metodologi + Fasilitator (+ Pembina bila GIO).
      if (!fasil) { setErr('Pilih Fasilitator terlebih dahulu.'); return }
      if (metodologi === 'GIO' && !pembina) { setErr('Pilih Pembina untuk GIO terlebih dahulu.'); return }
      payload.metodologi = metodologi
      payload.fasilitatorNik = fasil.nik
      payload.fasilitatorNama = fasil.nama
      if (metodologi === 'GIO') { payload.pembinaNik = pembina.nik; payload.pembinaNama = pembina.nama }
    }
    setBusy(true); setErr('')
    try { await api.actGagasanApproval(id, payload); await load(); onChanged() }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal memproses.') } finally { setBusy(false) }
  }

  async function daftar() {
    const nama = window.prompt('Nama gugus untuk risalah:', g.judul?.slice(0, 40) || '')
    if (nama === null) return
    setBusy(true); setErr('')
    try {
      const res = await api.daftarGagasan(id, { metodologi: g.metodologi, namaGugus: nama })
      onChanged()
      navigate(`${res.base}/daftar/${res.idGugus}`)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal mendaftarkan.') } finally { setBusy(false) }
  }

  return (
    <>
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
            {(g.fasilitatorNama || g.pembinaNama) && (
              <div className="inv__meta">
                {g.fasilitatorNama && <span>Fasilitator: <b>{g.fasilitatorNama}</b></span>}
                {g.pembinaNama && <span>Pembina: <b>{g.pembinaNama}</b></span>}
              </div>
            )}

            {err && <div className="inv__banner inv__banner--err">{err}</div>}

            {g.bisaEdit ? (
              <div className="inv__card">
                <div className="inv__section-head"><span className="inv__section-tag">Isi</span><h3>Judul & Latar Belakang</h3></div>
                <label className="inv__field" style={{ marginBottom: 10 }}><span>Judul Usulan</span>
                  <input value={edit.judul} onChange={(e) => setEdit({ ...edit, judul: e.target.value })} /></label>
                <label className="inv__field" style={{ marginBottom: 10 }}><span>Latar Belakang</span>
                  <textarea rows={4} value={edit.latarBelakang} onChange={(e) => setEdit({ ...edit, latarBelakang: e.target.value })} /></label>
                <div className="inv__actions-bar"><button type="button" className="inv__btn inv__btn--primary" onClick={saveEdit} disabled={busy}>Simpan Perbaikan</button></div>
              </div>
            ) : (
              <div className="inv__card">
                <div className="inv__section-head"><span className="inv__section-tag">Isi</span><h3>{g.judul}</h3></div>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13.5 }}>{g.latarBelakang || '-'}</p>
              </div>
            )}

            <div className="inv__card">
              <div className="inv__section-head"><span className="inv__section-tag">Alur</span><h3>Penilaian Berjenjang</h3></div>
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
                        {a.peran === 'Verifikator' && (
                          <>
                            <label className="inv__field" style={{ marginBottom: 6 }}>
                              <span>Approve ke Metodologi</span>
                              <select value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
                                {metodOptions.map((o) => <option key={o} value={o}>{o === 'SS' ? 'SS (Sistem Saran)' : o === 'GIO' ? 'GIO (Gugus Inovasi Operasi)' : '5R'}</option>)}
                              </select>
                            </label>
                            {lintasDept && <div className="inv__hint" style={{ marginBottom: 6 }}>Gagasan lintas departemen - hanya bisa GIO / 5R.</div>}
                            <div className="inv__field" style={{ marginBottom: 6 }}>
                              <span>Fasilitator</span>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input readOnly value={fasil ? `${fasil.nama} (${fasil.nik})` : ''} placeholder="Belum dipilih" style={{ flex: 1 }} />
                                <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '6px 10px' }} onClick={() => setPickerFor('fasil')}>Cari</button>
                              </div>
                            </div>
                            {metodologi === 'GIO' && (
                              <div className="inv__field" style={{ marginBottom: 6 }}>
                                <span>Pembina (GIO)</span>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input readOnly value={pembina ? `${pembina.nama} (${pembina.nik})` : ''} placeholder="Belum dipilih" style={{ flex: 1 }} />
                                  <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '6px 10px' }} onClick={() => setPickerFor('pembina')}>Cari</button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
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
                <span>Gagasan disetujui. Daftarkan menjadi risalah {g.metodologi} - Ketua{g.fasilitatorNama ? ', Fasilitator' : ''}{g.pembinaNama ? ', Pembina' : ''} otomatis terisi; nama gugus & anggota (Sekretaris/Anggota) Anda lengkapi di form risalah.</span>
                <button type="button" className="inv__btn inv__btn--primary" onClick={daftar} disabled={busy}>Daftarkan ke SERGIO</button>
              </div>
            )}
          </div>
        )}
      </div>
    </Backdrop>
    <PegawaiPicker
      open={pickerFor !== null}
      onClose={() => setPickerFor(null)}
      onPick={(p) => { if (pickerFor === 'fasil') setFasil({ nik: p.nik, nama: p.nama }); else if (pickerFor === 'pembina') setPembina({ nik: p.nik, nama: p.nama }) }}
    />
    </>
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
