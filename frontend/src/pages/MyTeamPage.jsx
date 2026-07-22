import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Briefcase, Building2, CheckCircle2, ChevronUp, CircleDashed, CircleSlash,
  Clock, ClipboardList, Loader2, Plus, Trash2, UserCheck, Users2, UserX, X,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './MyTeamPage.css'

const COLUMNS = [
  { status: 'Baru', label: 'Baru', icon: CircleDashed },
  { status: 'Dikerjakan', label: 'Dikerjakan', icon: Clock },
  { status: 'Selesai', label: 'Selesai', icon: CheckCircle2 },
  { status: 'Batal', label: 'Dibatalkan', icon: X },
]

function formatTanggal(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)
}

function initial(name) {
  return name?.charAt(0)?.toUpperCase() ?? '?'
}

function Person({ m, showHadir, compact }) {
  return (
    <div className={`mt-person${compact ? ' mt-person--compact' : ''}${m.terisi ? '' : ' mt-person--empty'}`}>
      <div className="mt-person__avatar">{m.terisi ? initial(m.nama) : <UserX size={16} />}</div>
      <div className="mt-person__info">
        <div className="mt-person__name">{m.terisi ? m.nama : 'Formasi kosong'}</div>
        <div className="mt-person__role">{m.jabatan}</div>
        {!compact && (
          <div className="mt-person__chips">
            {m.band && <span className="mt-chip">Band {m.band}</span>}
            {m.jg != null && <span className="mt-chip">JG {m.jg}</span>}
            {m.unit && <span className="mt-chip mt-chip--muted"><Building2 size={11} /> {m.unit}</span>}
          </div>
        )}
      </div>
      {showHadir && m.terisi && (
        <span className={`mt-dot${m.hadirHariIni ? ' is-on' : ''}`} title={m.hadirHariIni ? 'Hadir hari ini' : 'Belum absen'} />
      )}
    </div>
  )
}

export default function MyTeamPage() {
  const [semua, setSemua] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [tab, setTab] = useState('saya') // 'saya' | 'diberikan'
  const [dragId, setDragId] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ idPenerima: '', judul: '', deskripsi: '', tenggat: '' })
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async (s) => {
    setLoading(true)
    setError('')
    try {
      const d = await api.getMyTeam(s)
      setData(d)
      setTab((prev) => (prev === 'diberikan' && !d.punyaTim ? 'saya' : d.punyaTim && prev === 'saya' && (d.tugasUntukSaya?.length ?? 0) === 0 ? 'diberikan' : prev))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data tim.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload(semua) }, [semua, reload])

  // Pindahkan status tugas (drag & drop) — optimistis, revert bila gagal.
  async function moveTask(id, newStatus) {
    setDragId(null); setDragOver(null)
    let changed = false
    setData((d) => {
      const upd = (list) => (list ?? []).map((t) => {
        if (t.id === id && t.status !== newStatus) { changed = true; return { ...t, status: newStatus } }
        return t
      })
      return { ...d, tugasUntukSaya: upd(d.tugasUntukSaya), tugasDiberikan: upd(d.tugasDiberikan) }
    })
    if (!changed) return
    try {
      await api.ubahStatusTugas(id, newStatus)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengubah status.' })
      reload(semua)
    }
  }

  async function submitTugas(e) {
    e.preventDefault()
    if (!form.judul.trim() || !form.idPenerima) {
      setMsg({ type: 'err', text: 'Judul dan penerima wajib diisi.' })
      return
    }
    setSaving(true); setMsg(null)
    try {
      await api.beriTugas({
        idPenerima: form.idPenerima,
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim() || null,
        tenggat: form.tenggat || null,
      })
      setForm({ idPenerima: '', judul: '', deskripsi: '', tenggat: '' })
      setFormOpen(false)
      setTab('diberikan')
      await reload(semua)
      setMsg({ type: 'ok', text: 'Tugas berhasil dikirim.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengirim tugas.' })
    } finally {
      setSaving(false)
    }
  }

  async function deleteTugas(id) {
    try {
      await api.hapusTugas(id)
      await reload(semua)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus tugas.' })
    }
  }

  const anggotaTerisi = (data?.anggota ?? []).filter((a) => a.terisi)
  const tugasSaya = data?.tugasUntukSaya ?? []
  const tugasDiberikan = data?.tugasDiberikan ?? []
  const tasks = tab === 'diberikan' ? tugasDiberikan : tugasSaya
  const canManage = tab === 'diberikan'
  const aktif = (list) => list.filter((t) => t.status === 'Baru' || t.status === 'Dikerjakan').length

  const tiles = data?.punyaTim
    ? [
      { icon: Users2, label: 'Anggota Tim', value: data.jumlahAnggota },
      { icon: UserCheck, label: 'Hadir Hari Ini', value: data.jumlahHadir, tone: 'ok' },
      { icon: CircleSlash, label: 'Formasi Kosong', value: data.jumlahKosong, tone: data.jumlahKosong ? 'gold' : null },
      { icon: ClipboardList, label: 'Tugas Berjalan', value: aktif(tugasDiberikan), tone: 'gold' },
    ]
    : [
      { icon: Users2, label: 'Rekan Setim', value: data?.rekanSetim?.length ?? 0 },
      { icon: ClipboardList, label: 'Tugas untuk Saya', value: tugasSaya.length },
      { icon: Clock, label: 'Sedang Dikerjakan', value: tugasSaya.filter((t) => t.status === 'Dikerjakan').length, tone: 'gold' },
      { icon: CheckCircle2, label: 'Selesai', value: tugasSaya.filter((t) => t.status === 'Selesai').length, tone: 'ok' },
    ]

  return (
    <div className="mt">
      <Link to="/dashboard" className="mt__back"><ArrowLeft size={16} /> Dashboard</Link>

      {/* Hero */}
      <header className="mt__hero">
        <div className="mt__hero-main">
          <div className="mt__hero-icon"><Users2 size={26} /></div>
          <div>
            <h1>My Team</h1>
            <p>Pantau tim & kelola tugas dalam satu layar.</p>
          </div>
        </div>
        {data?.jabatanSaya && (
          <div className="mt__hero-meta">
            <div className="mt__hero-pos">
              <Briefcase size={14} />
              <span>{data.jabatanSaya}</span>
              {data.bandSaya && <span className="mt__hero-badge">Band {data.bandSaya}</span>}
              {data.jgSaya != null && <span className="mt__hero-badge">JG {data.jgSaya}</span>}
            </div>
            {data.atasan && (
              <div className="mt__hero-atasan">
                <ChevronUp size={14} /> Atasan: <b>{data.atasan.nama ?? 'belum terisi'}</b>
                <span className="mt__hero-atasan-role">· {data.atasan.jabatan}</span>
              </div>
            )}
          </div>
        )}
      </header>

      {error && <div className="mt__alert mt__alert--err">{error}</div>}
      {msg && <div className={`mt__alert mt__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {loading ? (
        <div className="mt__loading"><Loader2 className="mt__spin" size={22} /> Memuat…</div>
      ) : !data ? null : (
        <>
          {/* Stat tiles */}
          <div className="mt__stats">
            {tiles.map((t) => (
              <div className={`mt-stat${t.tone ? ` mt-stat--${t.tone}` : ''}`} key={t.label}>
                <div className="mt-stat__icon"><t.icon size={20} /></div>
                <div>
                  <div className="mt-stat__value">{t.value}</div>
                  <div className="mt-stat__label">{t.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt__grid">
            {/* People column */}
            <aside className="mt__people">
              {data.punyaTim && (
                <div className="mt-panel">
                  <div className="mt-panel__head">
                    <span><Users2 size={15} /> Tim Saya</span>
                    <div className="mt-seg">
                      <button type="button" className={!semua ? 'is-active' : ''} onClick={() => setSemua(false)}>Langsung</button>
                      <button type="button" className={semua ? 'is-active' : ''} onClick={() => setSemua(true)}>Semua</button>
                    </div>
                  </div>
                  <div className="mt-panel__body">
                    {data.anggota.length === 0 && <div className="mt-empty">Belum ada bawahan.</div>}
                    {data.anggota.map((m) => <Person key={m.idJabatan} m={m} showHadir />)}
                  </div>
                </div>
              )}

              {data.rekanSetim?.length > 0 && (
                <div className="mt-panel">
                  <div className="mt-panel__head"><span><Users2 size={15} /> Rekan Setim</span></div>
                  <div className="mt-panel__body">
                    {data.rekanSetim.map((m) => <Person key={m.idJabatan} m={m} showHadir compact />)}
                  </div>
                </div>
              )}

              {!data.punyaTim && !data.rekanSetim?.length && (
                <div className="mt-panel"><div className="mt-empty">Belum ada anggota atau rekan tim.</div></div>
              )}
            </aside>

            {/* Kanban board */}
            <main className="mt__board">
              <div className="mt-board__head">
                <div className="mt-tabs">
                  <button type="button" className={tab === 'saya' ? 'is-active' : ''} onClick={() => setTab('saya')}>
                    Tugas untuk Saya <span className="mt-tabs__count">{tugasSaya.length}</span>
                  </button>
                  {data.punyaTim && (
                    <button type="button" className={tab === 'diberikan' ? 'is-active' : ''} onClick={() => setTab('diberikan')}>
                      Saya Berikan <span className="mt-tabs__count">{tugasDiberikan.length}</span>
                    </button>
                  )}
                </div>
                {data.punyaTim && (
                  <button type="button" className="mt-btn" onClick={() => setFormOpen((v) => !v)}>
                    <Plus size={15} /> Beri Tugas
                  </button>
                )}
              </div>

              <div className="mt-kanban">
                {COLUMNS.map((col) => {
                  const items = tasks.filter((t) => t.status === col.status)
                  return (
                    <div
                      key={col.status}
                      className={`mt-col mt-col--${col.status.toLowerCase()}${dragOver === col.status ? ' is-over' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(col.status) }}
                      onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
                      onDrop={(e) => { e.preventDefault(); const id = Number(e.dataTransfer.getData('text/plain')); moveTask(id, col.status) }}
                    >
                      <div className="mt-col__head">
                        <span className="mt-col__title"><col.icon size={14} /> {col.label}</span>
                        <span className="mt-col__count">{items.length}</span>
                      </div>
                      <div className="mt-col__body">
                        {items.map((t) => (
                          <article
                            key={t.id}
                            className={`mt-task${dragId === t.id ? ' is-dragging' : ''}`}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id) }}
                            onDragEnd={() => setDragId(null)}
                          >
                            <div className="mt-task__top">
                              <span className="mt-task__title">{t.judul}</span>
                              {canManage && (
                                <button type="button" className="mt-task__del" title="Hapus" onClick={() => deleteTugas(t.id)}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            {t.deskripsi && <div className="mt-task__desc">{t.deskripsi}</div>}
                            <div className="mt-task__foot">
                              <span className="mt-task__who">
                                <span className="mt-task__avatar">{initial(canManage ? t.namaPenerima : t.namaPemberi)}</span>
                                <span className="mt-task__whoname">{canManage ? (t.namaPenerima ?? t.idPenerima) : (t.namaPemberi ?? t.idPemberi)}</span>
                              </span>
                              {t.tenggat && <span className="mt-task__due"><Clock size={11} /> {formatTanggal(t.tenggat)}</span>}
                            </div>
                          </article>
                        ))}
                        {items.length === 0 && <div className="mt-col__empty">—</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-hint">Seret kartu antar kolom untuk mengubah status.</p>
            </main>
          </div>

          {!data.dalamStruktur && (
            <div className="mt__note">
              Akun Anda belum tertaut pada struktur jabatan — bagian tim akan tampil setelah HR/SDM menautkan jabatan Anda.
            </div>
          )}

          {formOpen && (
            <div className="mt-modal__overlay" onClick={() => setFormOpen(false)}>
              <div className="mt-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mt-modal__head">
                  <h3><Plus size={18} /> Beri Tugas</h3>
                  <button type="button" className="mt-modal__close" onClick={() => setFormOpen(false)} aria-label="Tutup"><X size={18} /></button>
                </div>
                <form className="mt-modal__form" onSubmit={submitTugas}>
                  <label>
                    Anggota tim
                    <select value={form.idPenerima} onChange={(e) => setForm((f) => ({ ...f, idPenerima: e.target.value }))} required>
                      <option value="">— pilih anggota tim —</option>
                      {anggotaTerisi.map((a) => <option key={a.idKaryawan} value={a.idKaryawan}>{a.nama} · {a.jabatan}</option>)}
                    </select>
                  </label>
                  <label>
                    Judul tugas
                    <input placeholder="mis. Susun laporan bulanan" value={form.judul} onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))} required />
                  </label>
                  <label>
                    Deskripsi <span className="mt-modal__opt">(opsional)</span>
                    <textarea rows={3} placeholder="Rincian tugas…" value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} />
                  </label>
                  <label>
                    Tenggat <span className="mt-modal__opt">(opsional)</span>
                    <input type="date" value={form.tenggat} onChange={(e) => setForm((f) => ({ ...f, tenggat: e.target.value }))} />
                  </label>
                  <div className="mt-modal__actions">
                    <button type="button" className="mt-btn mt-btn--ghost" onClick={() => setFormOpen(false)}>Batal</button>
                    <button type="submit" className="mt-btn" disabled={saving}>{saving ? 'Mengirim…' : 'Kirim Tugas'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
