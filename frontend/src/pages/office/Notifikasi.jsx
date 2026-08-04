import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

// Menu Notifikasi meniru DOF: tiga penyaring berjumlah (All/Read/Unread), tombol
// "Tandai Sudah Dibaca", lalu daftar kartu pemberitahuan. Kartu yang belum dibaca
// diberi bingkai merah; mengklik kartu membuka suratnya sekaligus menandainya terbaca.
const FILTER = [
  { key: 'all', label: 'All', icon: InboxIcon, count: 'semua' },
  { key: 'read', label: 'Read', icon: MailOpen, count: 'dibaca' },
  { key: 'unread', label: 'Unread', icon: Mail, count: 'belumDibaca' },
]

const UKURAN_HALAMAN = [10, 25, 50, 100]
const COUNTS_KOSONG = { semua: 0, dibaca: 0, belumDibaca: 0 }

function formatTglJam(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d).replace(/\./g, ':')
}

// Baris "oleh 2125388 - BUDI SETIAWAN, S.Kom. - VP Teknologi Informasi PKG";
// ruas yang kosong dilewati agar tidak menyisakan tanda hubung menggantung.
function barisOleh(n) {
  const bagian = [n.olehNik, n.olehNama, n.olehJabatan].filter(Boolean)
  return bagian.length > 0 ? `oleh ${bagian.join(' - ')}` : 'oleh Sistem'
}

export default function Notifikasi() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [counts, setCounts] = useState(COUNTS_KOSONG)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [halaman, setHalaman] = useState(1)
  const [perHalaman, setPerHalaman] = useState(10)

  const muat = useCallback(async (f) => {
    setLoading(true); setError('')
    try {
      const d = await api.getNotifikasiOffice(f)
      setRows(d?.items ?? [])
      setCounts(d?.counts ?? COUNTS_KOSONG)
    } catch (err) {
      setRows([])
      setError(err instanceof ApiError ? err.message : 'Gagal memuat notifikasi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { muat(filter); setHalaman(1) }, [filter, muat])

  async function tandaiSemua() {
    setBusy(true)
    try {
      await api.bacaSemuaNotifikasiOffice()
      await muat(filter)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menandai notifikasi.')
    } finally {
      setBusy(false)
    }
  }

  // Membuka notifikasi menandainya terbaca lalu meloncat ke suratnya. Kegagalan
  // penandaan tidak boleh menahan navigasi — yang dicari pengguna adalah suratnya.
  async function buka(n) {
    if (!n.dibaca) {
      try { await api.bacaNotifikasiOffice(n.id) } catch { /* abaikan */ }
    }
    if (n.idSurat) {
      navigate(`/my-office/surat/${n.idSurat}`, {
        state: { asal: { to: '/my-office/notifikasi', label: 'Notifikasi' } },
      })
    }
    else muat(filter)
  }

  const totalHalaman = Math.max(1, Math.ceil(rows.length / perHalaman))
  const halamanAman = Math.min(halaman, totalHalaman)
  const mulai = (halamanAman - 1) * perHalaman
  const tampil = useMemo(
    () => rows.slice(mulai, mulai + perHalaman),
    [rows, mulai, perHalaman],
  )

  return (
    <div className="mo">
      <div className="mo__intro">
        <h2 className="mo__intro-title">Notifikasi</h2>
        <p className="mo__intro-sub">Pemberitahuan surat yang ditujukan atau menunggu tindakan Anda.</p>
      </div>

      <div className="mo-card">
        <div className="mo-notif__bar">
          <div className="mo-notif__filters" role="tablist">
            {FILTER.map((f) => {
              const Icon = f.icon
              const aktif = f.key === filter
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  className={`mo-notif__filter${aktif ? ' is-active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  <Icon size={15} /> {f.label} ({counts?.[f.count] ?? 0})
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="mo-btn mo-btn--soft"
            onClick={tandaiSemua}
            disabled={busy || loading || (counts?.belumDibaca ?? 0) === 0}
          >
            {busy ? <Loader2 size={15} className="mo__spin" /> : <CheckCheck size={15} />} Tandai Sudah Dibaca
          </button>
        </div>

        {error && <div className="mo__alert mo__alert--err">{error}</div>}

        {loading ? (
          <div className="mo__loading"><Loader2 className="mo__spin" size={20} /> Memuat…</div>
        ) : tampil.length === 0 ? (
          <div className="mo-empty2">
            {filter === 'unread' ? 'Tidak ada notifikasi yang belum dibaca.' : 'Belum ada notifikasi.'}
          </div>
        ) : (
          <div className="mo-notif__list">
            {tampil.map((n) => (
              <button
                type="button"
                key={n.id}
                className={`mo-notif${n.dibaca ? '' : ' is-baru'}`}
                onClick={() => buka(n)}
              >
                <span className="mo-notif__judul">{n.judul}</span>
                <span className="mo-notif__oleh">{barisOleh(n)}</span>
                <span className="mo-notif__tgl">{formatTglJam(n.dibuatPada)}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="mo-pager">
            <label className="mo-pager__size">
              Baris per Halaman:
              <select
                className="mo-select"
                value={perHalaman}
                onChange={(e) => setPerHalaman(Number(e.target.value))}
              >
                {UKURAN_HALAMAN.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="mo-pager__range">
              {mulai + 1}-{Math.min(mulai + perHalaman, rows.length)} dari {rows.length}
            </span>
            <div className="mo-pager__nav">
              <button
                type="button"
                className="mo-icon-btn"
                onClick={() => setHalaman((h) => Math.max(1, h - 1))}
                disabled={halamanAman <= 1}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className="mo-icon-btn"
                onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))}
                disabled={halamanAman >= totalHalaman}
                aria-label="Halaman berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
