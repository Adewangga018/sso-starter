import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2, Plus, Send, X, MessagesSquare, Users, Target,
  CheckSquare, Square, CheckCircle2, RotateCcw, ListChecks, Download, ShieldCheck,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './CoachingPage.css'

function waktu(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const jam = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d)
  if (sameDay) return jam
  return `${new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d)} ${jam}`
}

function PeranTag({ peran }) {
  const mgr = peran === 'Atasan' || peran === 'Anggota'
  return <span className={`co__tag${mgr ? ' co__tag--up' : ' co__tag--down'}`}>{peran}</span>
}

export default function CoachingPage() {
  const [inbox, setInbox] = useState({ sesi: [], ruang: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sel, setSel] = useState(null)        // {tipe:'sesi'|'ruang', key}
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [tlOpen, setTlOpen] = useState(false)
  const [tlDraft, setTlDraft] = useState('')
  const [modal, setModal] = useState(null)     // {lawan:[], target, topik}
  const [downloading, setDownloading] = useState(null) // "tipe:key" yang sedang diunduh
  const [adminMode, setAdminMode] = useState(false)
  const [adminList, setAdminList] = useState(null)
  const threadRef = useRef(null)

  const loadInbox = useCallback(async () => {
    try { setInbox(await api.getCoachingInbox()); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setInbox({ sesi: [], ruang: [] })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat percakapan.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { loadInbox() }, [loadInbox])

  const loadDetail = useCallback(async (s, quiet) => {
    if (!s) return
    if (!quiet) setDetailLoading(true)
    try {
      const d = s.tipe === 'sesi' ? await api.getCoachingSesi(s.key) : await api.getCoachingRuang(s.key)
      setDetail({ tipe: s.tipe, ...d })
    } catch (err) {
      if (!quiet) setError(err instanceof ApiError ? err.message : 'Gagal memuat percakapan.')
    } finally { if (!quiet) setDetailLoading(false) }
  }, [])

  useEffect(() => { if (sel) { setTlOpen(false); loadDetail(sel) } else setDetail(null) }, [sel, loadDetail])

  // Polling ringan: segarkan percakapan terbuka & daftar secara berkala.
  useEffect(() => {
    if (!sel) return
    const t = setInterval(() => { loadDetail(sel, true); loadInbox() }, 15000)
    return () => clearInterval(t)
  }, [sel, loadDetail, loadInbox])

  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [detail?.pesan?.length, sel])

  async function kirim() {
    const isi = draft.trim()
    if (!isi || !sel) return
    setSending(true)
    try {
      if (sel.tipe === 'sesi') await api.kirimPesanSesi(sel.key, isi)
      else await api.kirimPesanRuang(sel.key, isi)
      setDraft('')
      await loadDetail(sel, true)
      loadInbox()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal mengirim.') }
    finally { setSending(false) }
  }

  // Unduh transkrip PDF (peserta: coaching sendiri; Admin SDM: siapa pun).
  async function unduh(tipe, key) {
    setDownloading(`${tipe}:${key}`)
    try {
      if (tipe === 'sesi') await api.downloadCoachingSesi(key)
      else await api.downloadCoachingRuang(key)
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal mengunduh transkrip.') }
    finally { setDownloading(null) }
  }

  const loadAdmin = useCallback(async () => {
    try { setAdminList(await api.getCoachingAdminSemua()) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat daftar coaching.') }
  }, [])
  useEffect(() => { if (adminMode && !adminList) loadAdmin() }, [adminMode, adminList, loadAdmin])

  async function openNew() {
    try {
      const lawan = await api.getCoachingLawanBicara()
      setModal({ lawan, target: lawan[0]?.nik || '', topik: '' })
    } catch { setError('Gagal memuat kandidat lawan bicara.') }
  }
  async function buatSesi(e) {
    e.preventDefault()
    if (!modal.target || !modal.topik.trim()) return
    try {
      const { id } = await api.buatCoachingSesi({ targetNik: modal.target, topik: modal.topik.trim() })
      setModal(null)
      await loadInbox()
      setSel({ tipe: 'sesi', key: id })
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal membuat sesi.') }
  }

  async function toggleTl(tl) {
    await api.statusTindakLanjut(tl.id, tl.status === 'Selesai' ? 'Terbuka' : 'Selesai')
    loadDetail(sel, true)
  }
  async function addTl() {
    if (!tlDraft.trim()) return
    await api.tambahTindakLanjut(sel.key, tlDraft.trim())
    setTlDraft(''); loadDetail(sel, true)
  }
  async function toggleSesiStatus() {
    await api.statusSesi(sel.key, detail.status === 'Selesai' ? 'Berjalan' : 'Selesai')
    loadDetail(sel, true); loadInbox()
  }

  const isSel = (tipe, key) => sel?.tipe === tipe && sel?.key === key

  return (
    <div className="co">
      <aside className="co__list">
        {inbox.isAdminSdm && (
          <button type="button" className={`co__admintoggle${adminMode ? ' is-on' : ''}`} onClick={() => { setAdminMode((v) => !v); setSel(null) }}>
            <ShieldCheck size={15} /> {adminMode ? '← Coaching Saya' : 'Semua Coaching (Admin SDM)'}
          </button>
        )}
        {adminMode ? (
          <div className="co__admin-hint">Menampilkan seluruh coaching karyawan di panel kanan. Klik <b>PDF</b> untuk mengunduh transkrip.</div>
        ) : (
        <>
        <button type="button" className="co__new" onClick={openNew}><Plus size={16} /> Sesi Coaching Baru</button>

        {loading ? <div className="co__loading"><Loader2 className="co__spin" size={18} /> Memuat…</div> : (
          <>
            <div className="co__group">Sesi 1-on-1</div>
            {inbox.sesi.length === 0 && <div className="co__empty-sm">Belum ada sesi.</div>}
            {inbox.sesi.map((s) => (
              <button type="button" key={s.id} className={`co__item${isSel('sesi', s.id) ? ' co__item--active' : ''}`} onClick={() => setSel({ tipe: 'sesi', key: s.id })}>
                <div className="co__item-top">
                  <span className="co__item-nama">{s.lawanNama || s.lawanNik}</span>
                  <PeranTag peran={s.peranLawan} />
                </div>
                <div className="co__item-sub">{s.topik}</div>
                <div className="co__item-last">{s.pesanTerakhir || <em>Belum ada pesan</em>}</div>
                {s.status === 'Selesai' && <span className="co__done">Selesai</span>}
              </button>
            ))}

            <div className="co__group">Ruang Tim</div>
            {inbox.ruang.length === 0 && <div className="co__empty-sm">Tidak ada ruang tim.</div>}
            {inbox.ruang.map((r) => (
              <button type="button" key={r.ownerNik} className={`co__item${isSel('ruang', r.ownerNik) ? ' co__item--active' : ''}`} onClick={() => setSel({ tipe: 'ruang', key: r.ownerNik })}>
                <div className="co__item-top">
                  <span className="co__item-nama"><Users size={13} /> {r.peran === 'Pemilik' ? 'Tim Saya' : `Tim ${r.ownerNama || r.ownerNik}`}</span>
                  <span className="co__count">{r.jumlahAnggota}</span>
                </div>
                <div className="co__item-last">{r.pesanTerakhir || <em>Belum ada pesan</em>}</div>
              </button>
            ))}
          </>
        )}
        </>
        )}
      </aside>

      <section className="co__main">
        {error && <div className="co__err">{error}</div>}
        {adminMode ? (
          !adminList ? (
            <div className="co__loading"><Loader2 className="co__spin" size={22} /> Memuat…</div>
          ) : (
            <div className="co__admin">
              <h3 className="co__admin-title"><ShieldCheck size={16} /> Semua Coaching — Admin SDM</h3>
              <div className="co__admin-group">Sesi 1-on-1 ({adminList.sesi.length})</div>
              {adminList.sesi.length === 0 && <div className="co__empty-sm">Belum ada sesi.</div>}
              {adminList.sesi.map((it) => (
                <div key={`s${it.idSesi}`} className="co__admin-row">
                  <div className="co__admin-main">
                    <div className="co__admin-judul">{it.judul}</div>
                    <div className="co__admin-sub">{it.topik} · {it.status} · {it.jumlahPesan} pesan{it.tglTerakhir ? ` · ${waktu(it.tglTerakhir)}` : ''}</div>
                  </div>
                  <button type="button" className="co__btn co__btn--ghost" disabled={downloading === `sesi:${it.idSesi}`} onClick={() => unduh('sesi', it.idSesi)}>
                    {downloading === `sesi:${it.idSesi}` ? <Loader2 size={15} className="co__spin" /> : <Download size={15} />} PDF
                  </button>
                </div>
              ))}
              <div className="co__admin-group">Ruang Tim ({adminList.ruang.length})</div>
              {adminList.ruang.length === 0 && <div className="co__empty-sm">Belum ada ruang tim.</div>}
              {adminList.ruang.map((it) => (
                <div key={`r${it.ownerNik}`} className="co__admin-row">
                  <div className="co__admin-main">
                    <div className="co__admin-judul">{it.judul}</div>
                    <div className="co__admin-sub">{it.jumlahPesan} pesan{it.tglTerakhir ? ` · ${waktu(it.tglTerakhir)}` : ''}</div>
                  </div>
                  <button type="button" className="co__btn co__btn--ghost" disabled={downloading === `ruang:${it.ownerNik}`} onClick={() => unduh('ruang', it.ownerNik)}>
                    {downloading === `ruang:${it.ownerNik}` ? <Loader2 size={15} className="co__spin" /> : <Download size={15} />} PDF
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
        <>{/* mode normal */}
        {!sel ? (
          <div className="co__placeholder"><MessagesSquare size={40} /><p>Pilih percakapan, atau mulai sesi coaching baru dengan atasan/bawahan Anda.</p></div>
        ) : detailLoading || !detail ? (
          <div className="co__loading"><Loader2 className="co__spin" size={22} /> Memuat…</div>
        ) : (
          <>
            <header className="co__head">
              <div>
                <div className="co__head-title">
                  {detail.tipe === 'sesi'
                    ? <>{detail.lawanNama || detail.lawanNik} <PeranTag peran={detail.peranLawan} /></>
                    : <><Users size={16} /> {detail.peran === 'Pemilik' ? 'Tim Saya' : `Tim ${detail.ownerNama || detail.ownerNik}`}</>}
                </div>
                <div className="co__head-sub">
                  {detail.tipe === 'sesi'
                    ? <><Target size={13} /> {detail.topik}</>
                    : <><Users size={13} /> <span>{detail.anggota.map((a) => a.nama).join(', ')} <span className="co__head-count">· {detail.anggota.length} anggota</span></span></>}
                </div>
              </div>
              <div className="co__head-act">
                {detail.tipe === 'sesi' && (
                  <>
                  <button type="button" className="co__btn co__btn--ghost" onClick={() => setTlOpen((v) => !v)}>
                    <ListChecks size={15} /> Tindak Lanjut ({detail.tindakLanjut.length})
                  </button>
                  <button type="button" className="co__btn co__btn--ghost" onClick={toggleSesiStatus}>
                    {detail.status === 'Selesai' ? <><RotateCcw size={15} /> Buka lagi</> : <><CheckCircle2 size={15} /> Selesaikan</>}
                  </button>
                  </>
                )}
                <button type="button" className="co__btn co__btn--ghost" disabled={downloading === `${sel.tipe}:${sel.key}`} onClick={() => unduh(sel.tipe, sel.key)} title="Unduh transkrip PDF">
                  {downloading === `${sel.tipe}:${sel.key}` ? <Loader2 size={15} className="co__spin" /> : <Download size={15} />} Download
                </button>
              </div>
            </header>

            {detail.tipe === 'sesi' && tlOpen && (
              <div className="co__tl">
                <div className="co__tl-head">Tindak Lanjut / Action Item</div>
                {detail.tindakLanjut.length === 0 && <div className="co__empty-sm">Belum ada tindak lanjut.</div>}
                {detail.tindakLanjut.map((tl) => (
                  <button type="button" key={tl.id} className="co__tl-item" onClick={() => toggleTl(tl)}>
                    {tl.status === 'Selesai' ? <CheckSquare size={16} className="co__tl-done" /> : <Square size={16} />}
                    <span className={tl.status === 'Selesai' ? 'co__tl-strike' : ''}>{tl.isi}</span>
                  </button>
                ))}
                <div className="co__tl-add">
                  <input value={tlDraft} onChange={(e) => setTlDraft(e.target.value)} placeholder="Tambah action item…" onKeyDown={(e) => e.key === 'Enter' && addTl()} />
                  <button type="button" className="co__btn" onClick={addTl}><Plus size={15} /></button>
                </div>
              </div>
            )}

            <div className="co__thread" ref={threadRef}>
              {detail.pesan.length === 0 && <div className="co__placeholder co__placeholder--sm"><p>Belum ada pesan. Mulai percakapan.</p></div>}
              {detail.pesan.map((p) => (
                <div key={p.id} className={`co__msg${p.saya ? ' co__msg--me' : ''}`}>
                  <div className="co__bubble">
                    {!p.saya && <div className="co__msg-nama">{p.namaPengirim || p.idPengirim}</div>}
                    <div className="co__msg-isi">{p.isi}</div>
                    <div className="co__msg-time">{waktu(p.tglKirim)}</div>
                  </div>
                </div>
              ))}
            </div>

            {detail.tipe === 'sesi' && detail.status === 'Selesai' ? (
              <div className="co__closed">Sesi ditandai selesai. Buka lagi untuk melanjutkan percakapan.</div>
            ) : (
              <div className="co__composer">
                <textarea
                  value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} placeholder="Tulis pesan…"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim() } }}
                />
                <button type="button" className="co__send" onClick={kirim} disabled={sending || !draft.trim()}>
                  {sending ? <Loader2 size={17} className="co__spin" /> : <Send size={17} />}
                </button>
              </div>
            )}
          </>
        )}
        </>
        )}
      </section>

      {modal && (
        <div className="co__overlay" onClick={() => setModal(null)}>
          <form className="co__modal" onClick={(e) => e.stopPropagation()} onSubmit={buatSesi}>
            <div className="co__modal-head"><h3>Sesi Coaching Baru</h3><button type="button" className="co__x" onClick={() => setModal(null)}><X size={18} /></button></div>
            <div className="co__modal-body">
              {modal.lawan.length === 0 ? (
                <p className="co__empty-sm">Tidak ada atasan/bawahan langsung yang bisa diajak sesi coaching.</p>
              ) : (
                <>
                  <label className="co__f">Dengan
                    <select value={modal.target} onChange={(e) => setModal((m) => ({ ...m, target: e.target.value }))}>
                      {modal.lawan.map((l) => <option key={l.nik} value={l.nik}>{l.nama} — {l.peran}{l.jabatan ? ` (${l.jabatan})` : ''}</option>)}
                    </select>
                  </label>
                  <label className="co__f">Topik
                    <input value={modal.topik} onChange={(e) => setModal((m) => ({ ...m, topik: e.target.value }))} placeholder="mis. Pengembangan kompetensi Q3" />
                  </label>
                </>
              )}
            </div>
            <div className="co__modal-foot">
              <button type="button" className="co__btn co__btn--ghost" onClick={() => setModal(null)}>Batal</button>
              <button type="submit" className="co__btn" disabled={!modal.target || !modal.topik.trim()}>Mulai Sesi</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
