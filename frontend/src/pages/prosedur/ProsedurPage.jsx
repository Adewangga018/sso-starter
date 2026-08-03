import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Plus, Search, FileText, BookOpen, ClipboardList, FileSpreadsheet, Eye, CheckCircle2,
  X, History, Pencil, Trash2, Users, UploadCloud, ShieldCheck, Download, Layers, Building2, Lock, Globe2,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import PdfPopupModal from '../../components/PdfPopupModal'
import './ProsedurPage.css'

const JENIS = ['SOP', 'Kebijakan', 'Instruksi Kerja', 'Formulir']
const JENIS_ICON = { SOP: FileText, Kebijakan: BookOpen, 'Instruksi Kerja': ClipboardList, Formulir: FileSpreadsheet }
const JENIS_COLOR = { SOP: 'green', Kebijakan: 'navy', 'Instruksi Kerja': 'gold', Formulir: 'grey' }

const tgl = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}
const shortKomp = (n) => (n || '').replace(/^Kompartemen\s+/i, '')

function JenisBadge({ jenis }) {
  return <span className={`pr__badge pr__badge--${JENIS_COLOR[jenis] || 'grey'}`}>{jenis}</span>
}

function LingkupBadge({ lingkup, unit }) {
  if (lingkup === 'Unit') {
    return <span className="pr__chip pr__chip--priv" title={`Privasi unit: ${unit || '—'}`}><Lock size={11} /> Privasi Unit</span>
  }
  return <span className="pr__chip pr__chip--umum" title="Dokumen terpusat, dibaca semua karyawan"><Globe2 size={11} /> Terpusat</span>
}

function Cakupan({ semua, kompartemen, className = '' }) {
  if (semua) return <span className={`pr__chip pr__chip--all ${className}`}><Layers size={11} /> Semua Kompartemen</span>
  if (!kompartemen?.length) return null
  return (
    <span className={`pr__chips ${className}`}>
      {kompartemen.map((k) => <span key={k} className="pr__chip" title={k}><Layers size={11} /> {shortKomp(k)}</span>)}
    </span>
  )
}

const EMPTY_FORM = {
  kode: '', judul: '', jenis: 'SOP', unit: '', kategori: '', deskripsi: '',
  semuaKompartemen: true, kompartemen: [], lingkup: 'Umum', tglBerlaku: '', ringkasan: '', file: null,
}

export default function ProsedurPage() {
  const [data, setData] = useState({ items: [], isAdmin: false, jumlahBelumAck: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [q, setQ] = useState('')
  const [jenis, setJenis] = useState('')
  const [komp, setKomp] = useState('')
  const [lingkup, setLingkup] = useState('')
  const [opsi, setOpsi] = useState({ departemen: [], kompartemen: [] })
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [modal, setModal] = useState(null)   // {mode:'buat'} | {mode:'versi', dok} | {mode:'ubah', dok}
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [ackList, setAckList] = useState(null)
  const [preview, setPreview] = useState({ open: false })

  const load = useCallback(async (term, jn, kp, lk) => {
    setLoading(true)
    try { setData(await api.getProsedurList(term, jn, kp, lk)); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], isAdmin: false, jumlahBelumAck: 0 })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat dokumen.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load('', '', '', '') }, [load])
  useEffect(() => { api.getProsedurOpsi().then(setOpsi).catch(() => {}) }, [])

  const isAdmin = data.isAdmin

  // ---- preview (inline, seperti dokumen My Personal) ----
  async function openPreview(versiId, filename, title) {
    if (preview.doc?.url) URL.revokeObjectURL(preview.doc.url)
    setPreview({ open: true, loading: true, doc: null, error: '', versiId, filename, title })
    try {
      const doc = await api.getProsedurFile(versiId)
      setPreview((p) => ({ ...p, loading: false, doc }))
    } catch {
      setPreview((p) => ({ ...p, loading: false, error: 'Gagal memuat dokumen.' }))
    }
  }
  function closePreview() {
    if (preview.doc?.url) URL.revokeObjectURL(preview.doc.url)
    setPreview({ open: false })
  }
  async function unduh() {
    try { await api.unduhProsedurFile(preview.versiId, preview.filename) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal mengunduh.' }) }
  }

  async function openDetail(id) {
    setDetailLoading(true); setDetail({ id })
    try { setDetail(await api.getProsedurDetail(id)) }
    catch { setMsg({ t: 'err', m: 'Gagal memuat detail.' }); setDetail(null) }
    finally { setDetailLoading(false) }
  }
  async function ack(id) {
    try { await api.ackProsedur(id); setMsg({ t: 'ok', m: 'Terima kasih, dokumen ditandai sudah Anda baca.' }); await load(q, jenis, komp, lingkup); if (detail?.id === id) openDetail(id) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }
  async function del(dok) {
    if (!window.confirm(`Hapus dokumen "${dok.judul}" beserta seluruh versinya?`)) return
    try { await api.hapusProsedur(dok.id); setMsg({ t: 'ok', m: 'Dokumen dihapus.' }); setDetail(null); await load(q, jenis, komp, lingkup) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }
  async function setStatus(versiId, status) {
    try { await api.statusVersiProsedur(versiId, status); await openDetail(detail.id); await load(q, jenis, komp, lingkup) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }
  async function viewAck(id) {
    try { setAckList({ loading: true }); setAckList({ rows: await api.getProsedurAck(id) }) }
    catch { setMsg({ t: 'err', m: 'Gagal memuat daftar.' }); setAckList(null) }
  }

  function openForm(mode, dok) {
    const lingkupBuat = isAdmin ? 'Umum' : 'Unit'   // pimpinan unit non-admin hanya buat Unit
    setForm({
      ...EMPTY_FORM,
      lingkup: mode === 'buat' ? lingkupBuat : (dok?.lingkup || 'Umum'),
      ...(mode === 'ubah' && dok ? {
        kode: dok.kode, judul: dok.judul, jenis: dok.jenis, unit: dok.unit || '',
        kategori: dok.kategori || '', deskripsi: dok.deskripsi || '',
        semuaKompartemen: dok.semuaKompartemen ?? true, kompartemen: dok.kompartemen || [],
      } : {}),
    })
    setModal({ mode, dok })
  }

  function toggleKomp(name) {
    setForm((f) => ({
      ...f,
      kompartemen: f.kompartemen.includes(name) ? f.kompartemen.filter((k) => k !== name) : [...f.kompartemen, name],
    }))
  }

  async function submitForm(e) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      if (modal.mode === 'ubah') {
        await api.ubahProsedur(modal.dok.id, {
          kode: form.kode.trim(), judul: form.judul.trim(), jenis: form.jenis,
          unit: form.unit.trim() || null, kategori: form.kategori.trim() || null, deskripsi: form.deskripsi.trim() || null,
          semuaKompartemen: form.semuaKompartemen, kompartemen: form.semuaKompartemen ? [] : form.kompartemen,
        })
      } else {
        if (!form.file) { setMsg({ t: 'err', m: 'Berkas dokumen wajib diunggah.' }); setSaving(false); return }
        const fd = new FormData()
        fd.append('file', form.file)
        if (form.tglBerlaku) fd.append('tglBerlaku', form.tglBerlaku)
        if (form.ringkasan.trim()) fd.append('ringkasan', form.ringkasan.trim())
        if (modal.mode === 'buat') {
          fd.append('kode', form.kode.trim()); fd.append('judul', form.judul.trim()); fd.append('jenis', form.jenis)
          fd.append('lingkup', form.lingkup)
          if (form.kategori.trim()) fd.append('kategori', form.kategori.trim())
          if (form.deskripsi.trim()) fd.append('deskripsi', form.deskripsi.trim())
          // Unit & cakupan kompartemen hanya untuk dokumen terpusat; dok Unit di-scope otomatis.
          if (form.lingkup !== 'Unit') {
            if (form.unit.trim()) fd.append('unit', form.unit.trim())
            fd.append('semuaKompartemen', String(form.semuaKompartemen))
            if (!form.semuaKompartemen) form.kompartemen.forEach((k) => fd.append('kompartemen', k))
          }
          await api.buatProsedur(fd)
        } else {
          await api.tambahVersiProsedur(modal.dok.id, fd)
        }
      }
      setModal(null); setMsg({ t: 'ok', m: 'Tersimpan.' })
      await load(q, jenis, komp, lingkup)
      if (detail?.id && (modal.mode !== 'buat')) openDetail(detail.id)
    } catch (err) {
      setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="pr">
      <div className="pr__head">
        <div>
          <h2 className="pr__title"><FileText size={20} /> SOP & Kebijakan</h2>
          <p className="pr__sub">Repository terpusat + dokumen privasi unit — selalu versi terbaru.{data.jumlahBelumAck > 0 && <> <b className="pr__belum">{data.jumlahBelumAck} dokumen belum Anda baca</b>.</>}</p>
        </div>
        {(isAdmin || data.canUploadUnit) && <button type="button" className="pr__btn" onClick={() => openForm('buat')}><Plus size={15} /> Tambah Dokumen</button>}
      </div>

      <div className="pr__tools">
        <form className="pr__searchwrap" onSubmit={(e) => { e.preventDefault(); load(q, jenis, komp, lingkup) }}>
          <Search size={16} />
          <input className="pr__search" placeholder="Cari kode / judul / kategori / unit…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="pr__select" value={lingkup} onChange={(e) => { setLingkup(e.target.value); load(q, jenis, komp, e.target.value) }}>
          <option value="">Semua lingkup</option>
          <option value="Umum">Terpusat</option>
          <option value="Unit">Privasi Unit</option>
        </select>
        <select className="pr__select" value={jenis} onChange={(e) => { setJenis(e.target.value); load(q, e.target.value, komp, lingkup) }}>
          <option value="">Semua jenis</option>
          {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <select className="pr__select" value={komp} onChange={(e) => { setKomp(e.target.value); load(q, jenis, e.target.value, lingkup) }}>
          <option value="">Semua kompartemen</option>
          {opsi.kompartemen.map((k) => <option key={k} value={k}>{shortKomp(k)}</option>)}
        </select>
      </div>

      {msg && <div className={`pr__msg pr__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="pr__loading"><Loader2 className="pr__spin" size={22} /> Memuat…</div>
        : error ? <div className="pr__alert">{error}</div>
        : data.items.length === 0 ? <div className="pr__empty">Belum ada dokumen{jenis ? ` jenis ${jenis}` : ''}{komp ? ` untuk ${shortKomp(komp)}` : ''}{q ? ` untuk "${q}"` : ''}.</div>
        : (
          <div className="pr__grid">
            {data.items.map((d) => {
              const Icon = JENIS_ICON[d.jenis] || FileText
              const color = JENIS_COLOR[d.jenis] || 'grey'
              return (
                <article key={d.id} className={`pr__card pr__card--${color}`}>
                  <div className="pr__card-top">
                    <span className={`pr__card-ico pr__card-ico--${color}`}><Icon size={20} /></span>
                    <JenisBadge jenis={d.jenis} />
                    {d.idVersiBerlaku != null && d.sudahAck && <span className="pr__card-read" title="Sudah Anda baca"><CheckCircle2 size={16} /></span>}
                  </div>
                  <h3 className="pr__card-title" title={d.judul}>{d.judul}</h3>
                  <div className="pr__card-kode">{d.kode}</div>
                  <div className="pr__card-scope">
                    <LingkupBadge lingkup={d.lingkup} unit={d.unit} />
                    {d.unit && <span className="pr__chip pr__chip--unit" title={d.unit}><Building2 size={11} /> {d.unit}</span>}
                    {d.lingkup !== 'Unit' && <Cakupan semua={d.semuaKompartemen} kompartemen={d.kompartemen} />}
                  </div>
                  <div className="pr__card-meta">
                    <span>{d.versiBerlaku ? `v${d.versiBerlaku}` : 'Belum ada versi berlaku'}</span>
                    {d.tglBerlaku && <span>· berlaku {tgl(d.tglBerlaku)}</span>}
                  </div>
                  <div className="pr__card-foot">
                    {d.idVersiBerlaku == null ? <span className="pr__muted">—</span>
                      : d.sudahAck ? <span className="pr__ack"><CheckCircle2 size={14} /> Sudah dibaca</span>
                      : <button type="button" className="pr__mini" onClick={() => ack(d.id)}>Baca & pahami</button>}
                    <div className="pr__card-act">
                      {d.idVersiBerlaku != null && <button type="button" className="pr__ibtn" title="Lihat berkas" onClick={() => openPreview(d.idVersiBerlaku, d.namaFile, `${d.kode} · ${d.judul}`)}><Eye size={15} /></button>}
                      <button type="button" className="pr__ibtn" title="Detail & versi" onClick={() => openDetail(d.id)}><History size={15} /></button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

      {/* Detail modal */}
      {detail && (
        <div className="pr__overlay" onClick={() => setDetail(null)}>
          <div className="pr__modal pr__modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="pr__modal-head">
              <h3>{detailLoading || !detail.kode ? 'Memuat…' : `${detail.kode} · ${detail.judul}`}</h3>
              <button type="button" className="pr__x" onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            {detailLoading || !detail.kode ? <div className="pr__loading"><Loader2 className="pr__spin" size={20} /> Memuat…</div> : (
              <div className="pr__modal-body">
                <div className="pr__meta">
                  <JenisBadge jenis={detail.jenis} />
                  <LingkupBadge lingkup={detail.lingkup} unit={detail.unit} />
                  {detail.unit && <span className="pr__chip pr__chip--unit"><Building2 size={11} /> {detail.unit}</span>}
                  {detail.lingkup !== 'Unit' && <Cakupan semua={detail.semuaKompartemen} kompartemen={detail.kompartemen} />}
                  {detail.kategori && <span className="pr__tag pr__tag--k">{detail.kategori}</span>}
                </div>
                {detail.deskripsi && <p className="pr__desk">{detail.deskripsi}</p>}

                {detail.idVersiBerlaku != null && (
                  <div className="pr__berlaku">
                    <div>
                      <b>Versi berlaku: v{detail.versiBerlaku}</b>
                      {detail.bisaKelola && <span className="pr__muted"> · {detail.jumlahAckBerlaku} orang sudah baca</span>}
                    </div>
                    <div className="pr__berlaku-act">
                      <button type="button" className="pr__btn pr__btn--ghost" onClick={() => openPreview(detail.idVersiBerlaku, null, `${detail.kode} · ${detail.judul}`)}><Eye size={14} /> Lihat berkas</button>
                      {detail.sudahAckBerlaku
                        ? <span className="pr__ack"><CheckCircle2 size={15} /> Sudah Anda baca</span>
                        : <button type="button" className="pr__btn" onClick={() => ack(detail.id)}><ShieldCheck size={15} /> Saya sudah baca & paham</button>}
                    </div>
                  </div>
                )}

                <div className="pr__vhead">
                  <span><History size={14} /> Riwayat Versi <span className="pr__muted">(versi lama tetap bisa dibuka)</span></span>
                  {detail.bisaKelola && (
                    <div className="pr__vhead-act">
                      <button type="button" className="pr__btn pr__btn--ghost" onClick={() => openForm('versi', detail)}><UploadCloud size={14} /> Tambah Versi</button>
                      <button type="button" className="pr__btn pr__btn--ghost" onClick={() => openForm('ubah', detail)}><Pencil size={14} /> Ubah</button>
                      <button type="button" className="pr__btn pr__btn--ghost" onClick={() => viewAck(detail.id)}><Users size={14} /> Daftar Baca</button>
                      <button type="button" className="pr__btn pr__btn--danger" onClick={() => del(detail)}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                <table className="pr__vtable">
                  <thead><tr><th>Versi</th><th>Status</th><th>Berlaku</th><th>Penerbit</th><th>Perubahan</th><th></th></tr></thead>
                  <tbody>
                    {detail.versi.map((v) => (
                      <tr key={v.id}>
                        <td>v{v.versi}</td>
                        <td><span className={`pr__st pr__st--${v.status === 'Berlaku' ? 'ok' : v.status === 'Ditarik' ? 'no' : 'off'}`}>{v.status}</span></td>
                        <td className="pr__muted">{tgl(v.tglBerlaku)}</td>
                        <td className="pr__muted">{v.namaPenerbit || '—'}</td>
                        <td className="pr__muted">{v.ringkasan || '—'}{detail.bisaKelola ? ` · ${v.jumlahAck} baca` : ''}</td>
                        <td>
                          <div className="pr__rowact">
                            <button type="button" className="pr__ibtn" title="Lihat (termasuk versi usang)" onClick={() => openPreview(v.id, v.namaFile, `${detail.kode} · v${v.versi}`)}><Eye size={14} /></button>
                            {detail.bisaKelola && v.status !== 'Berlaku' && <button type="button" className="pr__mini" onClick={() => setStatus(v.id, 'Berlaku')}>Berlakukan</button>}
                            {detail.bisaKelola && v.status === 'Berlaku' && <button type="button" className="pr__mini pr__mini--no" onClick={() => setStatus(v.id, 'Ditarik')}>Tarik</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form modal (buat / versi / ubah) */}
      {modal && (
        <div className="pr__overlay" onClick={() => setModal(null)}>
          <form className="pr__modal" onClick={(e) => e.stopPropagation()} onSubmit={submitForm}>
            <div className="pr__modal-head">
              <h3>{modal.mode === 'buat' ? 'Tambah Dokumen' : modal.mode === 'versi' ? `Tambah Versi — ${modal.dok.kode}` : 'Ubah Dokumen'}</h3>
              <button type="button" className="pr__x" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="pr__modal-body">
              <div className="pr__fgrid">
                {modal.mode !== 'versi' && (
                  <>
                    {modal.mode === 'buat' && isAdmin && data.canUploadUnit && (
                      <label className="pr__f pr__f--full">Lingkup dokumen
                        <select value={form.lingkup} onChange={setF('lingkup')}>
                          <option value="Umum">Terpusat (dibaca semua karyawan)</option>
                          <option value="Unit">Privasi Unit ({data.unitPengguna || 'unit Anda'})</option>
                        </select>
                      </label>
                    )}
                    {form.lingkup === 'Unit' && (
                      <div className="pr__f pr__f--full pr__privnote">
                        <Lock size={13} /> Dokumen privasi unit — hanya anggota <b>{data.unitPengguna || 'departemen Anda'}</b> dan Admin Kepatuhan yang dapat mengakses.
                      </div>
                    )}
                    <label className="pr__f">Kode / Nomor<input value={form.kode} onChange={setF('kode')} placeholder="SOP-SDM-001" /></label>
                    <label className="pr__f">Jenis
                      <select value={form.jenis} onChange={setF('jenis')}>{JENIS.map((j) => <option key={j}>{j}</option>)}</select>
                    </label>
                    <label className="pr__f pr__f--full">Judul<input value={form.judul} onChange={setF('judul')} /></label>
                    {form.lingkup !== 'Unit' && (
                      <label className="pr__f">Unit / Departemen
                        <select value={form.unit} onChange={setF('unit')}>
                          <option value="">— pilih departemen —</option>
                          {opsi.departemen.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="pr__f">Kategori<input value={form.kategori} onChange={setF('kategori')} placeholder="tag pencarian" /></label>
                    <label className="pr__f pr__f--full">Deskripsi<textarea rows={2} value={form.deskripsi} onChange={setF('deskripsi')} /></label>

                    {form.lingkup !== 'Unit' && (
                      <div className="pr__f pr__f--full">
                        Berlaku untuk kompartemen
                        <label className="pr__check">
                          <input type="checkbox" checked={form.semuaKompartemen} onChange={(e) => setForm((f) => ({ ...f, semuaKompartemen: e.target.checked }))} />
                          Semua kompartemen
                        </label>
                        {!form.semuaKompartemen && (
                          <div className="pr__komplist">
                            {opsi.kompartemen.length === 0 && <span className="pr__muted">Memuat daftar kompartemen…</span>}
                            {opsi.kompartemen.map((k) => (
                              <label key={k} className="pr__kompitem">
                                <input type="checkbox" checked={form.kompartemen.includes(k)} onChange={() => toggleKomp(k)} />
                                {shortKomp(k)}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {modal.mode !== 'ubah' && (
                  <>
                    <label className="pr__f">Tgl Berlaku<input type="date" value={form.tglBerlaku} onChange={setF('tglBerlaku')} /></label>
                    <label className="pr__f">{modal.mode === 'versi' ? 'Ringkasan perubahan' : 'Ringkasan (opsional)'}<input value={form.ringkasan} onChange={setF('ringkasan')} /></label>
                    <label className="pr__f pr__f--full">Berkas (PDF/dokumen)
                      <input type="file" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
                    </label>
                  </>
                )}
              </div>
            </div>
            <div className="pr__modal-foot">
              <button type="button" className="pr__btn pr__btn--ghost" onClick={() => setModal(null)}>Batal</button>
              <button type="submit" className="pr__btn" disabled={saving}>{saving ? <Loader2 size={15} className="pr__spin" /> : null} Simpan</button>
            </div>
          </form>
        </div>
      )}

      {/* Daftar baca (admin) */}
      {ackList && (
        <div className="pr__overlay" onClick={() => setAckList(null)}>
          <div className="pr__modal" onClick={(e) => e.stopPropagation()}>
            <div className="pr__modal-head"><h3>Sudah Membaca (versi berlaku)</h3><button type="button" className="pr__x" onClick={() => setAckList(null)}><X size={18} /></button></div>
            <div className="pr__modal-body">
              {ackList.loading ? <div className="pr__loading"><Loader2 className="pr__spin" size={18} /> Memuat…</div>
                : (ackList.rows?.length ?? 0) === 0 ? <div className="pr__empty">Belum ada yang membaca.</div>
                : <table className="pr__vtable"><thead><tr><th>Nama</th><th>NIK</th><th>Tanggal</th></tr></thead><tbody>
                    {ackList.rows.map((r) => <tr key={r.nik}><td>{r.nama || '—'}</td><td className="pr__muted">{r.nik}</td><td className="pr__muted">{tgl(r.tgl)}</td></tr>)}
                  </tbody></table>}
            </div>
          </div>
        </div>
      )}

      {/* Pratinjau berkas (inline, seperti dokumen My Personal) */}
      <PdfPopupModal
        open={preview.open}
        onClose={closePreview}
        title={preview.title || 'Dokumen'}
        loading={preview.loading}
        doc={preview.doc}
        error={preview.error}
        footer={preview.doc?.url && (
          <button type="button" className="pr__btn" onClick={unduh}><Download size={15} /> Unduh</button>
        )}
      />
    </div>
  )
}
