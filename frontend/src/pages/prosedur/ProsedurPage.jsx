import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Plus, Search, FileText, Eye, CheckCircle2, X, History,
  Pencil, Trash2, Users, UploadCloud, ShieldCheck,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import './ProsedurPage.css'

const JENIS = ['SOP', 'Kebijakan', 'Instruksi Kerja', 'Formulir']
const tgl = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}
function JenisBadge({ jenis }) {
  const map = { SOP: 'green', Kebijakan: 'navy', 'Instruksi Kerja': 'gold', Formulir: 'grey' }
  return <span className={`pr__badge pr__badge--${map[jenis] || 'grey'}`}>{jenis}</span>
}

async function lihatBerkas(versiId) {
  try { const { url } = await api.getProsedurFile(versiId); window.open(url, '_blank', 'noopener') }
  catch { alert('Gagal membuka berkas.') }
}

const EMPTY_FORM = { kode: '', judul: '', jenis: 'SOP', unit: '', kategori: '', deskripsi: '', tglBerlaku: '', ringkasan: '', file: null }

export default function ProsedurPage() {
  const [data, setData] = useState({ items: [], isAdmin: false, jumlahBelumAck: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [q, setQ] = useState('')
  const [jenis, setJenis] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [modal, setModal] = useState(null)   // {mode:'buat'} | {mode:'versi', dok} | {mode:'ubah', dok}
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [ackList, setAckList] = useState(null)

  const load = useCallback(async (term, jn) => {
    setLoading(true)
    try { setData(await api.getProsedurList(term, jn)); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], isAdmin: false, jumlahBelumAck: 0 })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat dokumen.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load('', '') }, [load])

  const isAdmin = data.isAdmin

  async function openDetail(id) {
    setDetailLoading(true); setDetail({ id })
    try { setDetail(await api.getProsedurDetail(id)) }
    catch { setMsg({ t: 'err', m: 'Gagal memuat detail.' }); setDetail(null) }
    finally { setDetailLoading(false) }
  }
  async function ack(id) {
    try { await api.ackProsedur(id); setMsg({ t: 'ok', m: 'Terima kasih, dokumen ditandai sudah Anda baca.' }); await load(q, jenis); if (detail?.id === id) openDetail(id) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }
  async function del(dok) {
    if (!window.confirm(`Hapus dokumen "${dok.judul}" beserta seluruh versinya?`)) return
    try { await api.hapusProsedur(dok.id); setMsg({ t: 'ok', m: 'Dokumen dihapus.' }); setDetail(null); await load(q, jenis) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }
  async function setStatus(versiId, status) {
    try { await api.statusVersiProsedur(versiId, status); await openDetail(detail.id); await load(q, jenis) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }
  async function viewAck(id) {
    try { setAckList({ loading: true }); setAckList({ rows: await api.getProsedurAck(id) }) }
    catch { setMsg({ t: 'err', m: 'Gagal memuat daftar.' }); setAckList(null) }
  }

  function openForm(mode, dok) {
    setForm({ ...EMPTY_FORM, ...(mode === 'ubah' && dok ? { kode: dok.kode, judul: dok.judul, jenis: dok.jenis, unit: dok.unit || '', kategori: dok.kategori || '', deskripsi: dok.deskripsi || '' } : {}) })
    setModal({ mode, dok })
  }
  async function submitForm(e) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      if (modal.mode === 'ubah') {
        await api.ubahProsedur(modal.dok.id, { kode: form.kode.trim(), judul: form.judul.trim(), jenis: form.jenis, unit: form.unit.trim() || null, kategori: form.kategori.trim() || null, deskripsi: form.deskripsi.trim() || null })
      } else {
        if (!form.file) { setMsg({ t: 'err', m: 'Berkas dokumen wajib diunggah.' }); setSaving(false); return }
        const fd = new FormData()
        fd.append('file', form.file)
        if (form.tglBerlaku) fd.append('tglBerlaku', form.tglBerlaku)
        if (form.ringkasan.trim()) fd.append('ringkasan', form.ringkasan.trim())
        if (modal.mode === 'buat') {
          fd.append('kode', form.kode.trim()); fd.append('judul', form.judul.trim()); fd.append('jenis', form.jenis)
          if (form.unit.trim()) fd.append('unit', form.unit.trim())
          if (form.kategori.trim()) fd.append('kategori', form.kategori.trim())
          if (form.deskripsi.trim()) fd.append('deskripsi', form.deskripsi.trim())
          await api.buatProsedur(fd)
        } else {
          await api.tambahVersiProsedur(modal.dok.id, fd)
        }
      }
      setModal(null); setMsg({ t: 'ok', m: 'Tersimpan.' })
      await load(q, jenis)
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
          <p className="pr__sub">Repository dokumen resmi perusahaan — selalu versi terbaru.{data.jumlahBelumAck > 0 && <> <b className="pr__belum">{data.jumlahBelumAck} dokumen belum Anda baca</b>.</>}</p>
        </div>
        {isAdmin && <button type="button" className="pr__btn" onClick={() => openForm('buat')}><Plus size={15} /> Tambah Dokumen</button>}
      </div>

      <div className="pr__tools">
        <form className="pr__searchwrap" onSubmit={(e) => { e.preventDefault(); load(q, jenis) }}>
          <Search size={16} />
          <input className="pr__search" placeholder="Cari kode / judul / kategori / unit…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="pr__select" value={jenis} onChange={(e) => { setJenis(e.target.value); load(q, e.target.value) }}>
          <option value="">Semua jenis</option>
          {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {msg && <div className={`pr__msg pr__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="pr__loading"><Loader2 className="pr__spin" size={22} /> Memuat…</div>
        : error ? <div className="pr__alert">{error}</div>
        : data.items.length === 0 ? <div className="pr__empty">Belum ada dokumen{jenis ? ` jenis ${jenis}` : ''}{q ? ` untuk "${q}"` : ''}.</div>
        : (
          <div className="pr__tablewrap">
            <table className="pr__table">
              <thead><tr><th>Kode</th><th>Judul</th><th>Jenis</th><th>Unit</th><th>Versi</th><th>Berlaku</th><th>Status Baca</th><th></th></tr></thead>
              <tbody>
                {data.items.map((d) => (
                  <tr key={d.id}>
                    <td className="pr__kode">{d.kode}</td>
                    <td>{d.judul}</td>
                    <td><JenisBadge jenis={d.jenis} /></td>
                    <td className="pr__muted">{d.unit || '—'}</td>
                    <td className="pr__muted">{d.versiBerlaku ? `v${d.versiBerlaku}` : '—'}</td>
                    <td className="pr__muted">{tgl(d.tglBerlaku)}</td>
                    <td>
                      {d.idVersiBerlaku == null ? <span className="pr__muted">—</span>
                        : d.sudahAck ? <span className="pr__ack"><CheckCircle2 size={14} /> Sudah dibaca</span>
                        : <button type="button" className="pr__mini" onClick={() => ack(d.id)}>Baca & pahami</button>}
                    </td>
                    <td>
                      <div className="pr__rowact">
                        {d.idVersiBerlaku != null && <button type="button" className="pr__ibtn" title="Lihat berkas" onClick={() => lihatBerkas(d.idVersiBerlaku)}><Eye size={15} /></button>}
                        <button type="button" className="pr__ibtn" title="Detail & versi" onClick={() => openDetail(d.id)}><History size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  {detail.unit && <span className="pr__tag">{detail.unit}</span>}
                  {detail.kategori && <span className="pr__tag pr__tag--k">{detail.kategori}</span>}
                </div>
                {detail.deskripsi && <p className="pr__desk">{detail.deskripsi}</p>}

                {detail.idVersiBerlaku != null && (
                  <div className="pr__berlaku">
                    <div>
                      <b>Versi berlaku: v{detail.versiBerlaku}</b>
                      {isAdmin && <span className="pr__muted"> · {detail.jumlahAckBerlaku} orang sudah baca</span>}
                    </div>
                    <div className="pr__berlaku-act">
                      <button type="button" className="pr__btn pr__btn--ghost" onClick={() => lihatBerkas(detail.idVersiBerlaku)}><Eye size={14} /> Lihat berkas</button>
                      {detail.sudahAckBerlaku
                        ? <span className="pr__ack"><CheckCircle2 size={15} /> Sudah Anda baca</span>
                        : <button type="button" className="pr__btn" onClick={() => ack(detail.id)}><ShieldCheck size={15} /> Saya sudah baca & paham</button>}
                    </div>
                  </div>
                )}

                <div className="pr__vhead">
                  <span><History size={14} /> Riwayat Versi</span>
                  {isAdmin && (
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
                        <td className="pr__muted">{v.ringkasan || '—'}{isAdmin ? ` · ${v.jumlahAck} baca` : ''}</td>
                        <td>
                          <div className="pr__rowact">
                            <button type="button" className="pr__ibtn" title="Lihat" onClick={() => lihatBerkas(v.id)}><Eye size={14} /></button>
                            {isAdmin && v.status !== 'Berlaku' && <button type="button" className="pr__mini" onClick={() => setStatus(v.id, 'Berlaku')}>Berlakukan</button>}
                            {isAdmin && v.status === 'Berlaku' && <button type="button" className="pr__mini pr__mini--no" onClick={() => setStatus(v.id, 'Ditarik')}>Tarik</button>}
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
            <div className="pr__modal-body pr__fgrid">
              {modal.mode !== 'versi' && (
                <>
                  <label className="pr__f">Kode / Nomor<input value={form.kode} onChange={setF('kode')} placeholder="SOP-SDM-001" /></label>
                  <label className="pr__f">Jenis
                    <select value={form.jenis} onChange={setF('jenis')}>{JENIS.map((j) => <option key={j}>{j}</option>)}</select>
                  </label>
                  <label className="pr__f pr__f--full">Judul<input value={form.judul} onChange={setF('judul')} /></label>
                  <label className="pr__f">Unit / Departemen<input value={form.unit} onChange={setF('unit')} placeholder="opsional" /></label>
                  <label className="pr__f">Kategori<input value={form.kategori} onChange={setF('kategori')} placeholder="tag pencarian" /></label>
                  <label className="pr__f pr__f--full">Deskripsi<textarea rows={2} value={form.deskripsi} onChange={setF('deskripsi')} /></label>
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
    </div>
  )
}
