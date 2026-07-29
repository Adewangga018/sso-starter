import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Send, Loader2, ArrowLeft, Users, MessagesSquare, ExternalLink } from 'lucide-react'
import { useChat } from '../context/ChatContext'
import { api, ApiError } from '../lib/api'
import './ChatPanel.css'

function waktu(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = d.toDateString() === new Date().toDateString()
  const jam = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d)
  return sameDay ? jam : `${new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(d)} ${jam}`
}

export default function ChatPanel() {
  const { open, setOpen, inbox, refreshInbox } = useChat()
  const [sel, setSel] = useState(null) // {tipe, key, judul}
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const threadRef = useRef(null)

  const loadDetail = useCallback(async (s, quiet) => {
    if (!s) return
    if (!quiet) setLoading(true)
    try {
      const d = s.tipe === 'sesi' ? await api.getCoachingSesi(s.key) : await api.getCoachingRuang(s.key)
      setDetail({ tipe: s.tipe, ...d })
      refreshInbox() // membuka percakapan menandai sudah dibaca → segarkan badge
    } catch { /* abaikan */ }
    finally { if (!quiet) setLoading(false) }
  }, [refreshInbox])

  useEffect(() => { if (sel) loadDetail(sel) }, [sel, loadDetail])

  // Polling isi percakapan yang terbuka.
  useEffect(() => {
    if (!open || !sel) return
    const t = setInterval(() => loadDetail(sel, true), 12000)
    return () => clearInterval(t)
  }, [open, sel, loadDetail])

  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [detail?.pesan?.length, sel])

  // Tutup detail saat panel ditutup, supaya kembali ke daftar saat dibuka lagi.
  useEffect(() => { if (!open) { setSel(null); setDetail(null); setDraft('') } }, [open])

  async function kirim() {
    const isi = draft.trim()
    if (!isi || !sel) return
    setSending(true)
    try {
      if (sel.tipe === 'sesi') await api.kirimPesanSesi(sel.key, isi)
      else await api.kirimPesanRuang(sel.key, isi)
      setDraft('')
      await loadDetail(sel, true)
    } catch (err) { if (err instanceof ApiError) alert(err.message) }
    finally { setSending(false) }
  }

  if (!open) return null
  const sesi = inbox.sesi ?? []
  const ruang = inbox.ruang ?? []

  return (
    <div className="cw__scrim" onClick={() => setOpen(false)}>
      <aside className="cw" onClick={(e) => e.stopPropagation()}>
        <header className="cw__head">
          {sel ? (
            <button className="cw__icon" onClick={() => { setSel(null); setDetail(null) }} aria-label="Kembali"><ArrowLeft size={18} /></button>
          ) : <MessagesSquare size={18} />}
          <div className="cw__title">{sel ? (sel.judul) : 'Coaching'}</div>
          <Link to="/team/coaching" className="cw__icon" title="Buka di My Team" onClick={() => setOpen(false)}><ExternalLink size={16} /></Link>
          <button className="cw__icon" onClick={() => setOpen(false)} aria-label="Tutup"><X size={18} /></button>
        </header>

        {!sel ? (
          <div className="cw__list">
            {sesi.length === 0 && ruang.length === 0 && (
              <div className="cw__empty">Belum ada percakapan.<br /><Link to="/team/coaching" onClick={() => setOpen(false)}>Mulai coaching di My Team →</Link></div>
            )}
            {sesi.length > 0 && <div className="cw__grp">Sesi 1-on-1</div>}
            {sesi.map((s) => (
              <button key={s.id} className={`cw__item${s.belumDibaca ? ' cw__item--unread' : ''}`} onClick={() => setSel({ tipe: 'sesi', key: s.id, judul: s.lawanNama || s.lawanNik })}>
                <div className="cw__item-top"><span className="cw__nm">{s.lawanNama || s.lawanNik}</span><span className="cw__tm">{waktu(s.tglTerakhir)}</span></div>
                <div className="cw__last">{s.pesanTerakhir || <em>Belum ada pesan</em>}</div>
                {s.belumDibaca && <span className="cw__dot" />}
              </button>
            ))}
            {ruang.length > 0 && <div className="cw__grp">Ruang Tim</div>}
            {ruang.map((r) => (
              <button key={r.ownerNik} className={`cw__item${r.belumDibaca ? ' cw__item--unread' : ''}`} onClick={() => setSel({ tipe: 'ruang', key: r.ownerNik, judul: r.peran === 'Pemilik' ? 'Tim Saya' : `Tim ${r.ownerNama || r.ownerNik}` })}>
                <div className="cw__item-top"><span className="cw__nm"><Users size={13} /> {r.peran === 'Pemilik' ? 'Tim Saya' : `Tim ${r.ownerNama || r.ownerNik}`}</span><span className="cw__tm">{waktu(r.tglTerakhir)}</span></div>
                <div className="cw__last">{r.pesanTerakhir || <em>Belum ada pesan</em>}</div>
                {r.belumDibaca && <span className="cw__dot" />}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="cw__thread" ref={threadRef}>
              {loading && !detail ? <div className="cw__empty"><Loader2 className="cw__spin" size={18} /> Memuat…</div> : (
                (detail?.pesan ?? []).length === 0
                  ? <div className="cw__empty">Belum ada pesan. Mulai percakapan.</div>
                  : detail.pesan.map((p) => (
                    <div key={p.id} className={`cw__msg${p.saya ? ' cw__msg--me' : ''}`}>
                      <div className="cw__bubble">
                        {!p.saya && detail.tipe === 'ruang' && <div className="cw__sender">{p.namaPengirim || p.idPengirim}</div>}
                        <div className="cw__isi">{p.isi}</div>
                        <div className="cw__t">{waktu(p.tglKirim)}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
            {detail?.tipe === 'sesi' && detail.status === 'Selesai' ? (
              <div className="cw__closed">Sesi selesai. Buka di My Team untuk melanjutkan.</div>
            ) : (
              <div className="cw__composer">
                <textarea rows={1} value={draft} placeholder="Tulis pesan…" onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim() } }} />
                <button className="cw__send" onClick={kirim} disabled={sending || !draft.trim()}>{sending ? <Loader2 size={16} className="cw__spin" /> : <Send size={16} />}</button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
