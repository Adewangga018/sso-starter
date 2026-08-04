import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  History,
  Loader2,
  Network,
  Paperclip,
  PenLine,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import TablePager from './TablePager'
import { potongHalaman } from './tablePaging'
import './office.css'

// Halaman detail surat mengikuti DOF: satu surat, empat tab —
// Detail Surat (isi & lampiran), Tindak Lanjut (disposisi), Riwayat (jejak akses
// & alur), Hirarki (rantai drafter -> reviewer -> approver -> penerima).
const TABS = [
  { key: 'detail', label: 'Detail Surat', icon: PenLine },
  { key: 'tindak-lanjut', label: 'Tindak Lanjut', icon: ArrowRight },
  { key: 'riwayat', label: 'Riwayat', icon: History },
  { key: 'hirarki', label: 'Hirarki', icon: Network },
]

const KETERANGAN_TL = ['Diteruskan', 'Disposisi', 'Tanggapan', 'Selesai']

// Warna simpul hirarki mengikuti legenda DOF.
const PERAN_TONE = {
  Drafter: 'ungu',
  Reviewer: 'biru',
  Approver: 'hijau',
  Signer: 'hijau',
  Tujuan: 'kuning',
  CC: 'abu',
}

function formatSize(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function StatusBadge({ status }) {
  const slug = status.toLowerCase().replace(/\s+/g, '-')
  return <span className={`mo-status mo-status--${slug}`}>{status}</span>
}

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

function formatTglJam(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

function inisial(nama) {
  if (!nama) return '?'
  return nama.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// Pemilih satu pegawai untuk tujuan tindak lanjut.
function PegawaiTunggal({ nilai, onChange }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try { setResults(await api.cariPegawaiOffice(q.trim())) }
      catch { /* abaikan */ }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [q])

  if (nilai) {
    return (
      <div className="mo-chips">
        <span className="mo-chip2">
          <span>{nilai.nama}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Hapus"><X size={12} /></button>
        </span>
      </div>
    )
  }

  return (
    <div className="mo-picker">
      <div className="mo-picker__input">
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NIK…" />
        {loading && <Loader2 size={15} className="mo__spin" />}
      </div>
      {results.length > 0 && (
        <div className="mo-picker__results">
          {results.map((p) => (
            <button
              type="button"
              key={p.nik}
              className="mo-picker__result"
              onClick={() => { onChange(p); setQ(''); setResults([]) }}
            >
              <span className="mo-picker__name">{p.nama}</span>
              <span className="mo-picker__meta">{p.nik}{p.jabatan ? ` · ${p.jabatan}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Tombol "Kembali" harus memulangkan ke daftar tempat surat ini dibuka — halaman
// pemanggil mengirim asalnya lewat router state. Tanpa itu, surat yang dibuka dari
// Inbox/Inbox CC Otomatis akan memulangkan ke Daftar Surat, yang bagi penerima
// tembusan justru kosong (Daftar Surat hanya memuat surat yang ia buat sendiri).
const ASAL_DEFAULT = { to: '/my-office/daftar', label: 'Daftar Surat' }

export default function SuratDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const asal = location.state?.asal ?? ASAL_DEFAULT
  const [tab, setTab] = useState('detail')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [komentar, setKomentar] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  // Isi tab Tindak Lanjut & Hirarki diambil terpisah, hanya saat tabnya dibuka.
  const [tl, setTl] = useState(null)
  const [hirarki, setHirarki] = useState(null)
  const [tlForm, setTlForm] = useState({ keterangan: 'Diteruskan', untuk: null, catatan: '' })
  const [cariRiwayat, setCariRiwayat] = useState('')
  const [halRiwayat, setHalRiwayat] = useState(1)
  const [perRiwayat, setPerRiwayat] = useState(10)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setData(await api.getSuratDetail(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat surat.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const loadTl = useCallback(async () => {
    try { setTl(await api.getTindakLanjutSurat(id)) }
    catch { setTl([]) }
  }, [id])

  useEffect(() => {
    if (tab === 'tindak-lanjut' && tl === null) loadTl()
    if (tab === 'hirarki' && hirarki === null) {
      api.getHirarkiSurat(id).then((d) => setHirarki(d?.nodes ?? [])).catch(() => setHirarki([]))
    }
  }, [tab, tl, hirarki, id, loadTl])

  async function act(fn, okText) {
    setBusy(true); setMsg(null)
    try {
      await fn(id)
      setMsg({ type: 'ok', text: okText })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    } finally {
      setBusy(false)
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg(null)
    try {
      await api.uploadLampiranSurat(id, file)
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengunggah lampiran.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onDeleteLamp(lampId) {
    try {
      await api.hapusLampiranSurat(id, lampId)
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus lampiran.' })
    }
  }

  async function onDownload(l) {
    try {
      await api.unduhLampiranSurat(id, l.id, l.namaFile)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengunduh lampiran.' })
    }
  }

  async function doPengesahan(aksi) {
    setBusy(true); setMsg(null)
    try {
      await api.aksiPengesahanSurat(id, { aksi, komentar: komentar.trim() || null })
      setKomentar('')
      const label = aksi === 'Setujui' ? 'disetujui' : aksi === 'Tolak' ? 'ditolak' : 'diminta revisi'
      setMsg({ type: 'ok', text: `Surat ${label}.` })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    } finally {
      setBusy(false)
    }
  }

  async function kirimTindakLanjut() {
    const perluTujuan = tlForm.keterangan === 'Diteruskan' || tlForm.keterangan === 'Disposisi'
    if (perluTujuan && !tlForm.untuk) {
      setMsg({ type: 'err', text: 'Pilih pegawai tujuan tindak lanjut.' }); return
    }
    setBusy(true); setMsg(null)
    try {
      await api.tambahTindakLanjutSurat(id, {
        keterangan: tlForm.keterangan,
        untukNik: tlForm.untuk?.nik ?? null,
        untukNama: tlForm.untuk?.nama ?? null,
        catatan: tlForm.catatan.trim() || null,
      })
      setTlForm({ keterangan: 'Diteruskan', untuk: null, catatan: '' })
      setMsg({ type: 'ok', text: 'Tindak lanjut dicatat.' })
      await loadTl()
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mencatat tindak lanjut.' })
    } finally {
      setBusy(false)
    }
  }

  const riwayatTampil = useMemo(() => {
    const q = cariRiwayat.trim().toLowerCase()
    const rows = data?.riwayat ?? []
    if (!q) return rows
    return rows.filter((r) =>
      [r.aksi, r.olehNama, r.catatan].some((v) => (v ?? '').toLowerCase().includes(q)))
  }, [data, cariRiwayat])

  // Pencarian bisa memperkecil hasil sampai halaman berjalan tak ada lagi.
  useEffect(() => { setHalRiwayat(1) }, [cariRiwayat, perRiwayat])

  if (loading) return <div className="mo"><div className="mo__loading"><Loader2 className="mo__spin" size={20} /> Memuat…</div></div>
  if (error) return <div className="mo"><div className="mo__alert mo__alert--err">{error}</div></div>
  if (!data) return null

  const reviewer = data.penanggungJawab.filter((p) => p.peran === 'Reviewer')
  const approver = data.penanggungJawab.filter((p) => p.peran === 'Approver')
  const tujuan = data.distribusi.filter((d) => d.tipe === 'Tujuan')
  const cc = data.distribusi.filter((d) => d.tipe === 'CC')
  const bisaAksi = data.isPembuat && (data.status === 'Draft' || data.status === 'Revisi')
  const perluTujuanTl = tlForm.keterangan === 'Diteruskan' || tlForm.keterangan === 'Disposisi'
  // Rantai persetujuan digambar menurun; penerima berjajar di baris bawah.
  const rantai = (hirarki ?? []).filter((n) => n.peran !== 'Tujuan' && n.peran !== 'CC')
  const penerima = (hirarki ?? []).filter((n) => n.peran === 'Tujuan' || n.peran === 'CC')

  return (
    <div className="mo">
      <button type="button" className="mo__back" onClick={() => navigate(asal.to)}>
        <ArrowLeft size={16} /> {asal.label}
      </button>

      <div className="mo__head-row">
        <div>
          <h2 className="mo__intro-title">{data.judul}</h2>
          <p className="mo__intro-sub">
            {data.jenisNama || data.jenis}{data.nomor ? ` · ${data.nomor}` : ''} · Dibuat {formatTgl(data.dibuatPada)}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="mo-tabs" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab}
              className={`mo-tab${t.key === tab ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {msg && <div className={`mo__alert mo__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* ---------- Tab 1: Detail Surat ---------- */}
      {tab === 'detail' && (
        <>
          <div className="mo-card">
            <div className="mo-card__head">Informasi Surat</div>
            <div className="mo-detail-grid">
              <div><span>No Surat</span><b>{data.nomor || 'Belum terbit'}</b></div>
              <div><span>Jenis</span><b>{data.jenisNama ? `${data.jenis} · ${data.jenisNama}` : data.jenis}</b></div>
              <div><span>Bagian</span><b>{data.bagianNama ? `${data.kodeBagian} · ${data.bagianNama}` : (data.kodeBagian || '-')}</b></div>
              <div><span>Sifat</span><b>{data.sifat}</b></div>
              <div><span>Kecepatan</span><b>{data.kecepatan}</b></div>
              <div><span>Tanggal Surat</span><b>{formatTgl(data.tanggalSurat)}</b></div>
              <div><span>Pembuat</span><b>{data.pembuatNama || data.pembuatNik}</b></div>
              {data.berlakuMulai && <div><span>Berlaku</span><b>{formatTgl(data.berlakuMulai)} – {formatTgl(data.berlakuSampai)}</b></div>}
              {data.kodeKlasifikasi && (
                <div className="mo-detail--full">
                  <span>Klasifikasi Masalah</span>
                  <b>{data.kodeKlasifikasi}{data.klasifikasi ? ` · ${data.klasifikasi}` : ''}</b>
                </div>
              )}
              {data.keterangan && <div className="mo-detail--full"><span>Keterangan</span><b>{data.keterangan}</b></div>}
            </div>
          </div>

          <div className="mo-card">
            <div className="mo-card__head">Penanggung Jawab</div>
            <div className="mo-pjcols">
              <div>
                <div className="mo-pjcols__title">Reviewer</div>
                {reviewer.length === 0 ? <div className="mo-empty2">—</div> : reviewer.map((p) => (
                  <div className="mo-person2" key={p.id}>
                    <div><div className="mo-person2__name">{p.nama || p.nik}</div><div className="mo-person2__meta">{p.jabatan || p.nik}</div></div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
              <div>
                <div className="mo-pjcols__title">Approver</div>
                {approver.length === 0 ? <div className="mo-empty2">—</div> : approver.map((p) => (
                  <div className="mo-person2" key={p.id}>
                    <div><div className="mo-person2__name">{p.nama || p.nik}</div><div className="mo-person2__meta">{p.jabatan || p.nik}</div></div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(tujuan.length > 0 || cc.length > 0) && (
            <div className="mo-card">
              <div className="mo-card__head">Distribusi</div>
              <div className="mo-pjcols">
                <div>
                  <div className="mo-pjcols__title">Tujuan</div>
                  {tujuan.length === 0 ? <div className="mo-empty2">—</div> : tujuan.map((d) => (
                    <div className="mo-person2" key={d.id}><div><div className="mo-person2__name">{d.nama || d.nik}</div><div className="mo-person2__meta">{d.jabatan || d.nik}</div></div></div>
                  ))}
                </div>
                <div>
                  <div className="mo-pjcols__title">Tembusan (CC)</div>
                  {cc.length === 0 ? <div className="mo-empty2">—</div> : cc.map((d) => (
                    <div className="mo-person2" key={d.id}><div><div className="mo-person2__name">{d.nama || d.nik}</div><div className="mo-person2__meta">{d.jabatan || d.nik}</div></div></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mo-card">
            <div className="mo-card__head mo-card__head--split">
              <span>Lampiran</span>
              {bisaAksi && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    onChange={onUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  />
                  <button type="button" className="mo-btn mo-btn--soft" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 size={15} className="mo__spin" /> : <Upload size={15} />} Tambah Lampiran
                  </button>
                </>
              )}
            </div>
            {data.lampiran.length === 0 ? (
              <div className="mo-empty2">Belum ada lampiran.</div>
            ) : (
              <div className="mo-lamp-list">
                {data.lampiran.map((l) => (
                  <div className="mo-lamp" key={l.id}>
                    <Paperclip size={15} />
                    <button type="button" className="mo-lamp__name" onClick={() => onDownload(l)} title="Unduh">{l.namaFile}</button>
                    {l.ukuran ? <span className="mo-lamp__size">{formatSize(l.ukuran)}</span> : null}
                    {bisaAksi && (
                      <button type="button" className="mo-lamp__del" onClick={() => onDeleteLamp(l.id)} title="Hapus"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.aksiPeran && (
            <div className="mo-card">
              <div className="mo-card__head">Tindakan {data.aksiPeran}</div>
              <textarea
                className="mo-approve__note"
                rows={2}
                placeholder="Komentar (opsional)…"
                value={komentar}
                onChange={(e) => setKomentar(e.target.value)}
              />
              <div className="mo-actions">
                <button type="button" className="mo-btn mo-btn--ghost" onClick={() => doPengesahan('Tolak')} disabled={busy}>Tolak</button>
                <button type="button" className="mo-btn mo-btn--soft" onClick={() => doPengesahan('Revisi')} disabled={busy}>Minta Revisi</button>
                <button type="button" className="mo-btn" onClick={() => doPengesahan('Setujui')} disabled={busy}>
                  {busy ? <Loader2 size={16} className="mo__spin" /> : <CheckCircle2 size={16} />} Setujui
                </button>
              </div>
            </div>
          )}

          {bisaAksi && (
            <div className="mo-actions">
              <button type="button" className="mo-btn mo-btn--ghost" onClick={() => act(api.batalSurat, 'Surat dibatalkan.')} disabled={busy}>
                <X size={16} /> Batalkan
              </button>
              <button type="button" className="mo-btn" onClick={() => act(api.kirimSurat, 'Surat dikirim ke reviewer.')} disabled={busy}>
                {busy ? <Loader2 size={16} className="mo__spin" /> : <Send size={16} />} Kirim ke Reviewer
              </button>
            </div>
          )}
        </>
      )}

      {/* ---------- Tab 2: Tindak Lanjut ---------- */}
      {tab === 'tindak-lanjut' && (
        <>
          {data.bolehTindakLanjut && (
            <div className="mo-card">
              <div className="mo-card__head">Catat Tindak Lanjut</div>
              <div className="mo-form-grid">
                <div className="mo-field">
                  <label className="mo-field__label">Keterangan</label>
                  <select
                    value={tlForm.keterangan}
                    onChange={(e) => setTlForm((f) => ({ ...f, keterangan: e.target.value }))}
                  >
                    {KETERANGAN_TL.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="mo-field">
                  <label className="mo-field__label">
                    Untuk{!perluTujuanTl && <span className="mo-field__hint"> (opsional)</span>}
                  </label>
                  <PegawaiTunggal nilai={tlForm.untuk} onChange={(p) => setTlForm((f) => ({ ...f, untuk: p }))} />
                </div>
                <div className="mo-field mo-field--full">
                  <label className="mo-field__label">Catatan <span className="mo-field__hint">(opsional)</span></label>
                  <textarea
                    rows={3}
                    value={tlForm.catatan}
                    onChange={(e) => setTlForm((f) => ({ ...f, catatan: e.target.value }))}
                    placeholder="Instruksi atau tanggapan…"
                  />
                </div>
              </div>
              <div className="mo-actions">
                <button type="button" className="mo-btn" onClick={kirimTindakLanjut} disabled={busy}>
                  {busy ? <Loader2 size={16} className="mo__spin" /> : <ArrowRight size={16} />} Simpan
                </button>
              </div>
            </div>
          )}

          <div className="mo-card">
            <div className="mo-card__head">Riwayat Tindak Lanjut</div>
            <div className="mo-table-wrap">
              <table className="mo-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Dari</th>
                    <th>Untuk</th>
                    <th>Catatan</th>
                    <th>Lampiran</th>
                  </tr>
                </thead>
                <tbody>
                  {tl === null && <tr><td colSpan={6} className="mo-empty">Memuat…</td></tr>}
                  {tl !== null && tl.length === 0 && (
                    <tr><td colSpan={6} className="mo-empty">Belum ada riwayat tindak lanjut.</td></tr>
                  )}
                  {(tl ?? []).map((r) => (
                    <tr key={r.id}>
                      <td>{formatTglJam(r.tgl)}</td>
                      <td>{r.keterangan}</td>
                      <td className="mo-inbox__td-wrap">{r.dari || '-'}</td>
                      <td className="mo-inbox__td-wrap">{r.untuk || '-'}</td>
                      <td className="mo-inbox__td-wrap">{r.catatan || '-'}</td>
                      <td>{r.namaLampiran || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ---------- Tab 3: Riwayat ---------- */}
      {tab === 'riwayat' && (
        <div className="mo-card">
          <div className="mo-inbox__bar">
            <div className="mo-inbox__search">
              <Search size={16} />
              <input
                type="search"
                value={cariRiwayat}
                onChange={(e) => setCariRiwayat(e.target.value)}
                placeholder="Cari riwayat dokumen"
                aria-label="Cari riwayat dokumen"
              />
            </div>
          </div>
          <div className="mo-table-wrap">
            <table className="mo-table">
              <thead>
                <tr><th>Tanggal</th><th>Status</th><th>Oleh</th><th>Catatan</th></tr>
              </thead>
              <tbody>
                {riwayatTampil.length === 0 && (
                  <tr><td colSpan={4} className="mo-empty">
                    {cariRiwayat.trim() ? 'Tidak ada riwayat yang cocok.' : 'Belum ada riwayat.'}
                  </td></tr>
                )}
                {potongHalaman(riwayatTampil, halRiwayat, perRiwayat).map((r) => (
                  <tr key={r.id}>
                    <td>{formatTglJam(r.tgl)}</td>
                    <td>{r.aksi}</td>
                    <td className="mo-inbox__td-wrap">{r.olehNama || '-'}</td>
                    <td className="mo-inbox__td-wrap">{r.catatan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Jejak akses satu surat bisa ratusan baris (tiap buka/unduh tercatat). */}
          <TablePager
            total={riwayatTampil.length}
            halaman={halRiwayat}
            perHalaman={perRiwayat}
            onHalaman={setHalRiwayat}
            onPerHalaman={setPerRiwayat}
          />
        </div>
      )}

      {/* ---------- Tab 4: Hirarki ---------- */}
      {tab === 'hirarki' && (
        <div className="mo-card">
          <div className="mo-legend mo-hir__legend">
            {Object.entries(PERAN_TONE).filter(([p]) => p !== 'Signer').map(([peran, tone]) => (
              <span className="mo-legend__item" key={peran}>
                <i className={`mo-hir__dot mo-hir__dot--${tone}`} /> {peran}
              </span>
            ))}
          </div>

          {hirarki === null ? (
            <div className="mo__loading"><Loader2 className="mo__spin" size={20} /> Memuat…</div>
          ) : hirarki.length === 0 ? (
            <div className="mo-empty2">Belum ada alur untuk surat ini.</div>
          ) : (
            <>
              <div className="mo-hir__chain">
                {rantai.map((n, i) => (
                  <div className="mo-hir__step" key={`${n.peran}-${n.nik}-${i}`}>
                    <div className={`mo-hir__node mo-hir__node--${PERAN_TONE[n.peran] || 'abu'}`}>
                      <div className="mo-hir__head">
                        <span className="mo-hir__ava">{inisial(n.nama || n.nik)}</span>
                        <span className="mo-hir__tag">
                          {n.peran}{n.urutan > 0 ? ` ${n.urutan}` : ''}
                        </span>
                      </div>
                      <div className="mo-hir__nama">{n.nama || n.nik}</div>
                      <div className="mo-hir__meta">{n.status}{n.tgl ? ` · ${formatTglJam(n.tgl)}` : ''}</div>
                    </div>
                    {i < rantai.length - 1 && <div className="mo-hir__arrow" aria-hidden="true" />}
                  </div>
                ))}
              </div>

              {penerima.length > 0 && (
                <>
                  <div className="mo-hir__split">Penerima</div>
                  <div className="mo-hir__row">
                    {penerima.map((n, i) => (
                      <div
                        className={`mo-hir__node mo-hir__node--${PERAN_TONE[n.peran] || 'abu'}`}
                        key={`${n.peran}-${n.nik}-${i}`}
                      >
                        <div className="mo-hir__head">
                          <span className="mo-hir__ava">{inisial(n.nama || n.nik)}</span>
                          <span className="mo-hir__tag">{n.peran === 'CC' ? 'CC SURAT' : 'TUJUAN'}</span>
                        </div>
                        <div className="mo-hir__nama">{n.nama || n.nik}</div>
                        <div className="mo-hir__meta">{n.jabatan || n.nik}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
