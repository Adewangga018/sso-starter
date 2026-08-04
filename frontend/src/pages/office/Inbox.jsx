import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Eye,
  Loader2,
  Mail,
  MailCheck,
  MailOpen,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import TablePager from './TablePager'
import { potongHalaman } from './tablePaging'
import './office.css'

// Kotak masuk meniru menu Inbox DOF: satu deret tab berikonta + badge jumlah, kotak
// pencarian, tombol muat ulang, lalu tabel yang tiap kolomnya bisa diurutkan.
// Tab "Belum Dibaca"/"Dibaca" memotret status baca surat final yang ditujukan ke saya,
// sedangkan tiga tab lainnya memotret posisi surat pada alurnya.
const TABS = [
  { key: 'belum-dibaca', label: 'Belum Dibaca', icon: Mail, count: 'belumDibaca' },
  { key: 'dibaca', label: 'Dibaca', icon: MailOpen, count: 'dibaca' },
  { key: 'dalam-proses', label: 'Dalam Proses', icon: Clock, count: 'dalamProses' },
  { key: 'selesai', label: 'Selesai', icon: MailCheck, count: 'selesai' },
  { key: 'dibatalkan', label: 'Dibatalkan', icon: XCircle, count: 'dibatalkan' },
]

const KOLOM = [
  { key: 'nomor', label: 'No Surat' },
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'judul', label: 'Judul Surat' },
  { key: 'pengirim', label: 'Pengirim' },
  { key: 'approver', label: 'Approver' },
  { key: 'keterangan', label: 'Keterangan' },
]

const COUNTS_KOSONG = { belumDibaca: 0, dibaca: 0, dalamProses: 0, selesai: 0, dibatalkan: 0 }

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// Badge tab: >99 ditulis "99+" seperti DOF supaya lebar tab tetap rapi.
function formatJumlah(n) {
  return n > 99 ? '99+' : String(n ?? 0)
}

// Nomor surat ditampilkan "Jenis - Nomor" seperti DOF; surat yang belum bernomor
// cukup jenisnya saja. Nama panjang jenis dipakai bila master mengenali kodenya.
function nomorSurat(row) {
  const jenis = row.jenisNama || row.jenis
  return row.nomor ? `${jenis} - ${row.nomor}` : jenis
}

// Nilai yang dipakai untuk mengurutkan tiap kolom.
function nilaiUrut(row, kolom) {
  switch (kolom) {
    case 'nomor': return nomorSurat(row).toLowerCase()
    case 'tanggal': return row.tanggalSurat ?? row.dibuatPada ?? ''
    case 'judul': return (row.judul ?? '').toLowerCase()
    case 'pengirim': return (row.pengirim ?? '').toLowerCase()
    case 'approver': return (row.approver ?? '').toLowerCase()
    case 'keterangan': return (row.keterangan ?? '').toLowerCase()
    default: return ''
  }
}

// Dipakai dua menu: "Inbox" (semua keterlibatan) dan "Inbox CC Otomatis" (cc=true,
// hanya surat tembusan). Keduanya identik selain sumber data & judulnya, jadi satu
// komponen saja — lihat InboxCc.jsx.
export default function Inbox({
  cc = false,
  judul = 'Kotak Masuk',
  subjudul = 'Surat yang ditujukan, ditembuskan, atau menunggu tindakan Anda.',
}) {
  const [tab, setTab] = useState('belum-dibaca')
  const [counts, setCounts] = useState(COUNTS_KOSONG)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cari, setCari] = useState('')
  const [urut, setUrut] = useState({ kolom: 'tanggal', naik: false })
  const [perHalaman, setPerHalaman] = useState(10)
  const [halaman, setHalaman] = useState(1)
  // Dinaikkan tiap tombol muat ulang ditekan agar efek pengambilan data berjalan lagi.
  const [muatUlang, setMuatUlang] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    const ambil = cc ? api.getInboxCcOffice : api.getInboxOffice
    ambil(tab)
      .then((d) => {
        if (!alive) return
        setRows(d?.items ?? [])
        setCounts(d?.counts ?? COUNTS_KOSONG)
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setRows([])
        setError(err instanceof ApiError ? err.message : 'Gagal memuat kotak masuk.')
        setLoading(false)
      })
    return () => { alive = false }
  }, [cc, tab, muatUlang])

  const gantiTab = useCallback((key) => {
    setTab(key)
    setCari('')
    setHalaman(1)
  }, [])

  const gantiUrut = useCallback((kolom) => {
    setUrut((prev) => (prev.kolom === kolom ? { kolom, naik: !prev.naik } : { kolom, naik: true }))
  }, [])

  // Pencarian & pengurutan dikerjakan di sisi klien atas data tab yang sedang terbuka.
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const hasil = q
      ? rows.filter((r) => KOLOM.some((k) => String(nilaiUrut(r, k.key)).includes(q)))
      : rows.slice()
    const arah = urut.naik ? 1 : -1
    return hasil.sort((a, b) => {
      const va = nilaiUrut(a, urut.kolom)
      const vb = nilaiUrut(b, urut.kolom)
      if (va === vb) return 0
      return va > vb ? arah : -arah
    })
  }, [rows, cari, urut])

  const tabAktif = TABS.find((t) => t.key === tab) ?? TABS[0]

  // Potong hasil (yang sudah disaring & diurutkan) ke halaman berjalan.
  const halamanIni = potongHalaman(tampil, halaman, perHalaman)

  // Pencarian/pengurutan bisa memperkecil hasil sampai halaman berjalan tak ada lagi.
  useEffect(() => { setHalaman(1) }, [cari, urut, perHalaman])

  return (
    <div className="mo">
      <div className="mo__intro">
        <h2 className="mo__intro-title">{judul}</h2>
        <p className="mo__intro-sub">{subjudul}</p>
      </div>

      <div className="mo-inbox__tabs" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon
          const jumlah = counts?.[t.count] ?? 0
          const aktif = t.key === tab
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={aktif}
              className={`mo-inbox__tab${aktif ? ' is-active' : ''}`}
              onClick={() => gantiTab(t.key)}
            >
              <span className="mo-inbox__tab-icon">
                <Icon size={26} strokeWidth={1.6} />
                {jumlah > 0 && (
                  <span className={`mo-inbox__badge${t.key === 'belum-dibaca' ? ' mo-inbox__badge--alert' : ''}`}>
                    {formatJumlah(jumlah)}
                  </span>
                )}
              </span>
              <span className="mo-inbox__tab-label">{t.label}</span>
            </button>
          )
        })}
      </div>

      {error && <div className="mo__alert mo__alert--err">{error}</div>}

      <div className="mo-card">
        <div className="mo-inbox__bar">
          <div className="mo-inbox__search">
            <Search size={16} />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder={`Cari ${tabAktif.label.toLowerCase()}`}
              aria-label={`Cari ${tabAktif.label.toLowerCase()}`}
            />
          </div>
          <button
            type="button"
            className="mo-inbox__refresh"
            onClick={() => setMuatUlang((n) => n + 1)}
            disabled={loading}
            title="Muat ulang"
            aria-label="Muat ulang"
          >
            <RefreshCw size={16} className={loading ? 'mo__spin' : undefined} />
          </button>
        </div>

        {loading ? (
          <div className="mo__loading"><Loader2 className="mo__spin" size={20} /> Memuat…</div>
        ) : (
          <div className="mo-table-wrap">
            <table className="mo-table mo-inbox__table">
              <thead>
                <tr>
                  {KOLOM.map((k) => (
                    <th key={k.key}>
                      <button type="button" className="mo-inbox__sort" onClick={() => gantiUrut(k.key)}>
                        {k.label}
                        <span className="mo-inbox__sort-icons">
                          <ArrowUp size={11} className={urut.kolom === k.key && urut.naik ? 'is-on' : undefined} />
                          <ArrowDown size={11} className={urut.kolom === k.key && !urut.naik ? 'is-on' : undefined} />
                        </span>
                      </button>
                    </th>
                  ))}
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {tampil.length === 0 && (
                  <tr>
                    <td colSpan={KOLOM.length + 1} className="mo-empty">
                      {cari.trim()
                        ? `Tidak ada surat yang cocok dengan “${cari.trim()}”.`
                        : `Belum ada surat pada ${tabAktif.label.toLowerCase()}.`}
                    </td>
                  </tr>
                )}
                {halamanIni.map((s) => (
                  <tr key={s.id} className={s.dibaca ? undefined : 'is-baru'}>
                    <td>{nomorSurat(s)}</td>
                    <td>{formatTgl(s.tanggalSurat ?? s.dibuatPada)}</td>
                    <td className="mo-td-judul">{s.judul}</td>
                    <td className="mo-inbox__td-wrap">{s.pengirim || '-'}</td>
                    <td className="mo-inbox__td-wrap">{s.approver || '-'}</td>
                    <td className="mo-inbox__td-wrap">{s.keterangan}</td>
                    <td>
                      <Link
                        to={`/my-office/surat/${s.id}`}
                        state={{ asal: { to: cc ? '/my-office/inbox-cc' : '/my-office/inbox', label: judul } }}
                        className="mo-icon-btn"
                        title="Lihat detail"
                      >
                        <Eye size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <TablePager
            total={tampil.length}
            halaman={halaman}
            perHalaman={perHalaman}
            onHalaman={setHalaman}
            onPerHalaman={setPerHalaman}
          />
        )}
      </div>
    </div>
  )
}
