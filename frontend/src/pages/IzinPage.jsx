import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Search,
  Trash2,
  X,
  FileSignature,
  Clock,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  User,
  HeartPulse,
  FileText,
  FileQuestion,
  AlertCircle,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './IzinPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Mirrors the jenis_ijin values EASy allows - the backend rejects anything else.
const JENIS_OPTIONS = [
  'Datang Terlambat',
  'Sakit',
  'Tidak Masuk Kerja',
  'Pulang Lebih Awal',
  'Meninggalkan Pekerjaan',
  'Tidak Clocking In',
  'Tidak Clocking Out',
]

const KEPENTINGAN_OPTIONS = ['Dinas', 'Pribadi']

// Izin sakit mensyaratkan bukti surat dokter.
const JENIS_SAKIT = 'Sakit'
const BERKAS_EKSTENSI = ['pdf', 'png', 'jpg', 'jpeg']
const BERKAS_ACCEPT = '.pdf,.png,.jpg,.jpeg'

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat (Draft)' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'izin__col-status' },
  { key: 'kodeIjin', label: 'Kode Izin', className: 'izin__col-kode' },
  { key: 'jamMulai', label: 'Waktu Mulai', className: 'izin__col-jam' },
  { key: 'jamSelesai', label: 'Waktu Selesai', className: 'izin__col-jam' },
  { key: 'jenisIjin', label: 'Jenis & Kepentingan', className: 'izin__col-jenis-kep' },
  { key: 'keterangan', label: 'Keterangan', className: 'izin__col-ket' },
]

const FILTER_PLACEHOLDER = 'Cari kode izin, keterangan, jenis, atau status...'

const pad = (n) => String(n).padStart(2, '0')

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateTimeSplit(value) {
  if (!value) return { date: '-', time: '' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: value, time: '' }
  return {
    date: `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

// The API hands back a full datetime; the form edits date and time separately.
function splitDateTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function today() {
  return isoDate(new Date())
}

// Izin boleh diajukan mulai H-1 (kemarin) dan ke depan tanpa batas atas.
function minTanggal() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return isoDate(d)
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = []
  if (currentPage <= 3) {
    pages.push(1, 2, 3, 4, '...', totalPages)
  } else if (currentPage >= totalPages - 2) {
    pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
  } else {
    pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
  }
  return pages
}

const emptyForm = {
  tglIjin: '',
  tglIjinSd: '',
  jamMulai: '',
  jamSelesai: '',
  jenisIjin: 'Datang Terlambat',
  kepentinganIjin: 'Pribadi',
  keterangan: '',
}

export default function IzinPage() {
  const dialog = useDialog()
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('dibuat')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'jamMulai', direction: 'desc' })

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [detailRow, setDetailRow] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Surat dokter: berkasnya belum diunggah ke server - lokasi penyimpanan yang dipakai EASy
  // belum diketahui, jadi untuk sekarang hanya dipilih & divalidasi di sisi klien.
  const [berkas, setBerkas] = useState(null)

  async function load() {
    try {
      const data = await api.getIzin()
      setRows(data.items)
      setLoadError('')
    } catch (err) {
      if (isEmptyDataError(err)) {
        setRows([])
        setLoadError('')
        return
      }
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data izin.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Ringkasan metrik statistik izin
  const stats = useMemo(() => {
    if (!rows || rows.length === 0) {
      return { total: 0, dibuat: 0, disetujui: 0, bulanIni: 0 }
    }
    const now = new Date()
    const curMonth = now.getMonth()
    const curYear = now.getFullYear()

    let dibuat = 0
    let disetujui = 0
    let bulanIni = 0

    for (const r of rows) {
      if (r.status === STATUS_DIBUAT) {
        dibuat++
      } else {
        disetujui++
      }

      if (r.jamMulai) {
        const d = new Date(r.jamMulai)
        if (!Number.isNaN(d.getTime()) && d.getMonth() === curMonth && d.getFullYear() === curYear) {
          bulanIni++
        }
      }
    }

    return {
      total: rows.length,
      dibuat,
      disetujui,
      bulanIni,
    }
  }, [rows])

  const tabRows = useMemo(() => {
    if (!rows) return []
    // "Di Setujui" holds everything an approver has already acted on - anything that has
    // moved on from the "Di Buat" state.
    return tab === 'dibuat'
      ? rows.filter((r) => r.status === STATUS_DIBUAT)
      : rows.filter((r) => r.status !== STATUS_DIBUAT)
  }, [rows, tab])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tabRows
    return tabRows.filter((r) =>
      [r.status, r.kodeIjin, r.keterangan, formatDateTime(r.jamMulai), formatDateTime(r.jamSelesai), r.jenisIjin, r.kepentinganIjin, r.source]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))
    )
  }, [tabRows, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const { key, direction } = sort
    const dir = direction === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let av = a[key]
      let bv = b[key]
      if (key === 'jamMulai' || key === 'jamSelesai') {
        av = new Date(av).getTime()
        bv = new Date(bv).getTime()
      } else {
        av = (av ?? '').toString().toLowerCase()
        bv = (bv ?? '').toString().toLowerCase()
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return list
  }, [filtered, sort])

  const totalEntries = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIdx = (currentPage - 1) * pageSize
  const pageRows = sorted.slice(startIdx, startIdx + pageSize)

  function toggleSort(key) {
    setSort((prev) => (prev.key !== key ? { key, direction: 'asc' } : { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  function switchTab(key) {
    setTab(key)
    setPage(1)
    setSearch('')
  }

  function openCreate() {
    const now = today()
    setEditing(null)
    setForm({ ...emptyForm, tglIjin: now, tglIjinSd: now })
    setBerkas(null)
    setFormError('')
    setModalOpen(true)
  }

  function pilihBerkas(e) {
    const file = e.target.files?.[0]
    if (!file) {
      setBerkas(null)
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!BERKAS_EKSTENSI.includes(ext)) {
      setFormError('Surat dokter harus berupa file PDF, PNG, JPG, atau JPEG.')
      e.target.value = ''
      setBerkas(null)
      return
    }

    setFormError('')
    setBerkas(file)
  }

  function openEdit(row) {
    const mulai = splitDateTime(row.jamMulai)
    const selesai = splitDateTime(row.jamSelesai)
    setEditing(row)
    setBerkas(null)
    setForm({
      tglIjin: mulai.date,
      tglIjinSd: selesai.date,
      jamMulai: mulai.time,
      jamSelesai: selesai.time,
      jenisIjin: row.jenisIjin ?? 'Datang Terlambat',
      kepentinganIjin: row.kepentinganIjin ?? 'Pribadi',
      keterangan: row.keterangan ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Keep "sampai" from drifting before the start date.
      if (key === 'tglIjin' && (!prev.tglIjinSd || prev.tglIjinSd < value)) {
        next.tglIjinSd = value
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const payload = {
        tglIjin: form.tglIjin,
        tglIjinSd: form.tglIjinSd,
        jamMulai: form.jamMulai,
        jamSelesai: form.jamSelesai,
        jenisIjin: form.jenisIjin,
        kepentinganIjin: form.kepentinganIjin,
        keterangan: form.keterangan,
      }
      let izinId
      if (editing) {
        await api.updateIzin(editing.id, payload)
        izinId = editing.id
      } else {
        // Diunggah setelah izin tersimpan, bukan sebelumnya: kode_ijin - yang dipakai sebagai
        // nama berkas - baru diterbitkan oleh trigger database saat baris izin dibuat.
        const created = await api.createIzin(payload)
        izinId = created.id
      }

      if (berkas && form.jenisIjin === JENIS_SAKIT) {
        await api.uploadSuratDokter(izinId, berkas)
      }

      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan izin.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!(await dialog.confirm({ title: 'Hapus Izin', message: `Hapus izin ${row.kodeIjin}?`, danger: true, confirmText: 'Hapus' }))) return
    try {
      await api.deleteIzin(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus izin.')
    }
  }

  // The letter is a standalone page so the browser's print dialog gets a clean document
  // (no sidebar/header). It registers the document for QR validation on open.
  function handlePrint(row) {
    window.open(`/cetak/izin/${row.id}`, '_blank', 'noopener')
  }

  if (loadError && !rows) {
    return (
      <div className="izin">
        <div className="izin__card izin__state-card">
          <AlertCircle size={40} className="izin__state-icon izin__state-icon--err" />
          <h4 className="izin__state-title">Gagal Memuat Data Izin</h4>
          <p className="izin__state-desc">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="izin">
        <div className="izin__card izin__state-card">
          <div className="izin__loading-spinner" />
          <h4 className="izin__state-title">Memuat Data Izin</h4>
          <p className="izin__state-desc">Sedang mengambil riwayat permohonan izin Anda...</p>
        </div>
      </div>
    )
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="izin">
      {/* Header Halaman */}
      <div className="izin__page-header">
        <div className="izin__page-header-info">
          <div className="izin__page-header-icon">
            <FileSignature size={24} />
          </div>
          <div>
            <h2 className="izin__page-title">Permohonan Surat Izin</h2>
            <p className="izin__page-subtitle">
              Pengajuan dan riwayat izin kerja, sakit, dinas, atau keperluan pribadi
            </p>
          </div>
        </div>
        <div className="izin__page-header-actions">
          {isDibuatTab && (
            <button type="button" className="izin__btn-primary" onClick={openCreate}>
              <Plus size={16} /> <span>Ajukan Izin Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Metrik Statistik */}
      <div className="izin__stats-grid">
        <div className="izin__stat-card">
          <div className="izin__stat-icon izin__stat-icon--total">
            <FileText size={18} />
          </div>
          <div className="izin__stat-body">
            <span className="izin__stat-label">Total Permohonan</span>
            <span className="izin__stat-val">{stats.total}</span>
          </div>
        </div>

        <div className="izin__stat-card">
          <div className="izin__stat-icon izin__stat-icon--draft">
            <Clock size={18} />
          </div>
          <div className="izin__stat-body">
            <span className="izin__stat-label">Di Buat (Draft)</span>
            <span className="izin__stat-val izin__stat-val--draft">{stats.dibuat}</span>
          </div>
        </div>

        <div className="izin__stat-card">
          <div className="izin__stat-icon izin__stat-icon--approved">
            <CheckCircle2 size={18} />
          </div>
          <div className="izin__stat-body">
            <span className="izin__stat-label">Persetujuan</span>
            <span className="izin__stat-val izin__stat-val--approved">{stats.disetujui}</span>
          </div>
        </div>

        <div className="izin__stat-card">
          <div className="izin__stat-icon izin__stat-icon--monthly">
            <Calendar size={18} />
          </div>
          <div className="izin__stat-body">
            <span className="izin__stat-label">Bulan Ini</span>
            <span className="izin__stat-val izin__stat-val--monthly">{stats.bulanIni}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="izin__card">
        {/* Tab Selector & Action Bar */}
        <div className="izin__nav-bar">
          <div className="izin__tabs">
            {TABS.map((t) => {
              const count = t.key === 'dibuat' ? stats.dibuat : stats.disetujui
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`izin__tab${tab === t.key ? ' izin__tab--active' : ''}`}
                  onClick={() => switchTab(t.key)}
                >
                  <span>{t.label}</span>
                  <span className="izin__tab-count">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="izin__nav-actions">
            <button
              type="button"
              className="izin__icon-btn izin__icon-btn--refresh"
              onClick={load}
              title="Muat ulang data"
              aria-label="Muat ulang data"
            >
              <RotateCw size={15} />
            </button>
          </div>
        </div>

        {loadError && <div className="izin__error">{loadError}</div>}

        {/* Toolbar Pencarian & Ukuran Halaman */}
        <div className="izin__toolbar">
          <div className="izin__search-box">
            <Search size={15} className="izin__search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder={FILTER_PLACEHOLDER}
            />
            {search && (
              <button
                type="button"
                className="izin__search-clear"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                aria-label="Bersihkan pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="izin__page-size-wrap">
            <span className="izin__page-size-label">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} baris
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabel Izin (Padat, Tanpa Scroll Horizontal Berlebih, Baris Bisa Diklik) */}
        <div className="izin__table-wrap">
          <table className="izin__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const isSorted = sort.key === col.key
                  return (
                    <th
                      key={col.key}
                      className={`${col.className} izin__th--sortable ${isSorted ? 'izin__th--active' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <div className="izin__th-content">
                        <span>{col.label}</span>
                        <span className="izin__sort-indicator">
                          {isSorted ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp size={12} className="izin__sort-icon--active" />
                            ) : (
                              <ArrowDown size={12} className="izin__sort-icon--active" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="izin__sort-icon--idle" />
                          )}
                        </span>
                      </div>
                    </th>
                  )
                })}
                <th className="izin__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="izin__no-data">
                    <div className="izin__empty-state">
                      <FileQuestion size={36} className="izin__empty-icon" />
                      <span className="izin__empty-title">Tidak ada permohonan izin</span>
                      <span className="izin__empty-sub">
                        {search
                          ? `Tidak ditemukan data yang sesuai dengan pencarian "${search}".`
                          : isDibuatTab
                          ? 'Belum ada draf pengajuan izin yang dibuat.'
                          : 'Belum ada riwayat izin yang telah diproses persetujuan.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const mulai = formatDateTimeSplit(row.jamMulai)
                  const selesai = formatDateTimeSplit(row.jamSelesai)
                  const isDibuat = row.status === STATUS_DIBUAT
                  const isSakit = (row.jenisIjin ?? '').toLowerCase().includes('sakit')
                  const isTerlambat =
                    (row.jenisIjin ?? '').toLowerCase().includes('terlambat') ||
                    (row.jenisIjin ?? '').toLowerCase().includes('awal')
                  const isDinas = (row.kepentinganIjin ?? '').toLowerCase() === 'dinas'

                  return (
                    <tr
                      key={row.id}
                      className="izin__row izin__row--clickable"
                      onClick={() => setDetailRow(row)}
                      title="Klik untuk melihat detail surat izin"
                    >
                      {/* Status */}
                      <td className="izin__col-status" data-label="Status">
                        <span
                          className={`izin__badge ${
                            isDibuat ? 'izin__badge--pending' : 'izin__badge--success'
                          }`}
                        >
                          {isDibuat ? <Clock size={11} /> : <CheckCircle2 size={11} />}
                          <span>{row.status}</span>
                        </span>
                      </td>

                      {/* Kode Izin */}
                      <td className="izin__col-kode" data-label="Kode Izin">
                        <span className="izin__kode-badge">{row.kodeIjin || '-'}</span>
                      </td>

                      {/* Jam Mulai */}
                      <td className="izin__col-jam" data-label="Waktu Mulai">
                        <div className="izin__datetime-cell">
                          <span className="izin__date-text">{mulai.date}</span>
                          {mulai.time && (
                            <span className="izin__time-tag">
                              <Clock size={10} /> {mulai.time}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jam Selesai */}
                      <td className="izin__col-jam" data-label="Waktu Selesai">
                        <div className="izin__datetime-cell">
                          <span className="izin__date-text">{selesai.date}</span>
                          {selesai.time && (
                            <span className="izin__time-tag">
                              <Clock size={10} /> {selesai.time}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jenis & Kepentingan (Digabung Secara Vertikal & Ringkas) */}
                      <td className="izin__col-jenis-kep" data-label="Jenis & Kepentingan">
                        <div className="izin__jenis-kepentingan">
                          <span
                            className={`izin__badge ${
                              isSakit
                                ? 'izin__badge--danger'
                                : isTerlambat
                                ? 'izin__badge--warning'
                                : 'izin__badge--purple'
                            } izin__badge--sm`}
                          >
                            {isSakit ? (
                              <HeartPulse size={11} />
                            ) : isTerlambat ? (
                              <Clock size={11} />
                            ) : (
                              <FileText size={11} />
                            )}
                            <span className="izin__badge-label-truncate">{row.jenisIjin}</span>
                          </span>

                          <div className="izin__sub-info">
                            <span
                              className={`izin__chip ${
                                isDinas ? 'izin__chip--dinas' : 'izin__chip--pribadi'
                              }`}
                            >
                              {isDinas ? <Briefcase size={10} /> : <User size={10} />}
                              <span>{row.kepentinganIjin || '-'}</span>
                            </span>
                            {row.source && <span className="izin__source-chip">{row.source}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="izin__col-ket" data-label="Keterangan">
                        <span className="izin__ket-text" title={row.keterangan}>
                          {row.keterangan || '-'}
                        </span>
                      </td>

                      {/* Aksi (Stop propagation agar tidak memicu click baris detail) */}
                      <td
                        className="izin__col-aksi"
                        data-label="Aksi"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="izin__row-actions">
                          {/* Cetak Surat Izin (hanya jika sudah disetujui atau bukan di tab draf) */}
                          {((row.status ?? '').toLowerCase().includes('setuju') || (row.statusPersetujuan ?? '').toLowerCase().includes('setuju') || !isDibuatTab) && row.kodeIjin && (
                            <button
                              type="button"
                              className="izin__row-btn izin__row-btn--print"
                              onClick={() => handlePrint(row)}
                              title="Cetak Surat Izin"
                              aria-label="Cetak Surat Izin"
                            >
                              <Printer size={14} />
                            </button>
                          )}
                          {isDibuatTab && (
                            <>
                              <button
                                type="button"
                                className="izin__row-btn izin__row-btn--edit"
                                onClick={() => openEdit(row)}
                                title="Ubah Draf Izin"
                                aria-label="Ubah Draf Izin"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="izin__row-btn izin__row-btn--delete"
                                onClick={() => handleDelete(row)}
                                title="Hapus Draf Izin"
                                aria-label="Hapus Draf Izin"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Paginasi */}
        <div className="izin__footer">
          <div className="izin__footer-info">
            {totalEntries === 0 ? (
              '0 entri permohonan'
            ) : (
              <>
                Menampilkan <strong>{startIdx + 1}</strong>–
                <strong>{Math.min(startIdx + pageSize, totalEntries)}</strong> dari{' '}
                <strong>{totalEntries}</strong> entri
              </>
            )}
          </div>

          <div className="izin__pagination">
            <button
              type="button"
              className="izin__page-nav"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={15} />
              <span className="izin__nav-text">Sebelumnya</span>
            </button>

            <div className="izin__page-numbers">
              {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="izin__page-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`izin__page-num ${currentPage === p ? 'is-active' : ''}`}
                    onClick={() => setPage(Number(p))}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="izin__page-nav"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Halaman berikutnya"
            >
              <span className="izin__nav-text">Berikutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Surat Izin (Muncul Saat Baris Diklik) */}
      {detailRow && (
        <div className="izin__modal-backdrop" onClick={() => setDetailRow(null)}>
          <div className="izin__modal izin__modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="izin__modal-header">
              <div className="izin__modal-header-title">
                <FileText size={18} />
                <h3>Detail Surat Izin {detailRow.kodeIjin ? `#${detailRow.kodeIjin}` : ''}</h3>
              </div>
              <button
                type="button"
                className="izin__modal-close"
                onClick={() => setDetailRow(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="izin__detail-body">
              {/* Top Status & Code Banner */}
              <div className="izin__detail-top">
                <div className="izin__detail-ident">
                  <span className="izin__detail-kode">{detailRow.kodeIjin || '-'}</span>
                  <span
                    className={`izin__badge ${
                      detailRow.status === STATUS_DIBUAT
                        ? 'izin__badge--pending'
                        : 'izin__badge--success'
                    }`}
                  >
                    {detailRow.status === STATUS_DIBUAT ? (
                      <Clock size={12} />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    <span>{detailRow.status}</span>
                  </span>
                </div>
                {detailRow.source && (
                  <span className="izin__source-chip">Sumber: {detailRow.source}</span>
                )}
              </div>

              {/* Detail Items Grid */}
              <div className="izin__detail-grid">
                <div className="izin__detail-item">
                  <span className="izin__detail-label">Jenis Izin</span>
                  <div className="izin__detail-val">
                    <span
                      className={`izin__badge ${
                        (detailRow.jenisIjin ?? '').toLowerCase().includes('sakit')
                          ? 'izin__badge--danger'
                          : (detailRow.jenisIjin ?? '').toLowerCase().includes('terlambat') ||
                            (detailRow.jenisIjin ?? '').toLowerCase().includes('awal')
                          ? 'izin__badge--warning'
                          : 'izin__badge--purple'
                      }`}
                    >
                      {(detailRow.jenisIjin ?? '').toLowerCase().includes('sakit') ? (
                        <HeartPulse size={12} />
                      ) : (detailRow.jenisIjin ?? '').toLowerCase().includes('terlambat') ||
                        (detailRow.jenisIjin ?? '').toLowerCase().includes('awal') ? (
                        <Clock size={12} />
                      ) : (
                        <FileText size={12} />
                      )}
                      <span>{detailRow.jenisIjin || '-'}</span>
                    </span>
                  </div>
                </div>

                <div className="izin__detail-item">
                  <span className="izin__detail-label">Kepentingan</span>
                  <div className="izin__detail-val">
                    <span
                      className={`izin__badge ${
                        (detailRow.kepentinganIjin ?? '').toLowerCase() === 'dinas'
                          ? 'izin__badge--dinas'
                          : 'izin__badge--pribadi'
                      }`}
                    >
                      {(detailRow.kepentinganIjin ?? '').toLowerCase() === 'dinas' ? (
                        <Briefcase size={12} />
                      ) : (
                        <User size={12} />
                      )}
                      <span>{detailRow.kepentinganIjin || '-'}</span>
                    </span>
                  </div>
                </div>

                <div className="izin__detail-item">
                  <span className="izin__detail-label">Waktu Mulai</span>
                  <div className="izin__detail-val izin__detail-val--date">
                    <Calendar size={13} />
                    <span>{formatDateTime(detailRow.jamMulai)}</span>
                  </div>
                </div>

                <div className="izin__detail-item">
                  <span className="izin__detail-label">Waktu Selesai</span>
                  <div className="izin__detail-val izin__detail-val--date">
                    <Calendar size={13} />
                    <span>{formatDateTime(detailRow.jamSelesai)}</span>
                  </div>
                </div>

                <div className="izin__detail-item izin__detail-item--full">
                  <span className="izin__detail-label">Keterangan / Alasan</span>
                  <div className="izin__detail-box">
                    {detailRow.keterangan ? (
                      <p className="izin__detail-desc">{detailRow.keterangan}</p>
                    ) : (
                      <span className="izin__dash">Tidak ada keterangan tambahan.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="izin__modal-footer izin__detail-footer">
              <div className="izin__detail-actions-left">
                {((detailRow.status ?? '').toLowerCase().includes('setuju') || (detailRow.statusPersetujuan ?? '').toLowerCase().includes('setuju') || detailRow.status !== STATUS_DIBUAT) && detailRow.kodeIjin && (
                  <button
                    type="button"
                    className="izin__btn-outline"
                    onClick={() => handlePrint(detailRow)}
                    title="Cetak Surat Izin"
                  >
                    <Printer size={15} /> <span>Cetak Dokumen</span>
                  </button>
                )}
                {detailRow.status === STATUS_DIBUAT && (
                  <>
                    <button
                      type="button"
                      className="izin__btn-outline izin__btn-outline--edit"
                      onClick={() => {
                        const row = detailRow
                        setDetailRow(null)
                        openEdit(row)
                      }}
                      title="Ubah Data Izin"
                    >
                      <Pencil size={14} /> <span>Ubah</span>
                    </button>
                    <button
                      type="button"
                      className="izin__btn-outline izin__btn-outline--danger"
                      onClick={() => {
                        const row = detailRow
                        setDetailRow(null)
                        handleDelete(row)
                      }}
                      title="Hapus Permohonan"
                    >
                      <Trash2 size={14} /> <span>Hapus</span>
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                className="izin__btn-secondary"
                onClick={() => setDetailRow(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengajuan / Edit Izin */}
      {modalOpen && (
        <div className="izin__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="izin__modal" onClick={(e) => e.stopPropagation()}>
            <div className="izin__modal-header">
              <div className="izin__modal-header-title">
                <FileSignature size={20} />
                <h3>{editing ? `Ubah Surat Izin #${editing.kodeIjin}` : 'Ajukan Surat Izin Baru'}</h3>
              </div>
              <button
                type="button"
                className="izin__modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className="izin__modal-body" onSubmit={handleSubmit}>
              <div className="izin__modal-grid">
                <label className="izin__field">
                  <span>Tgl Izin Mulai *</span>
                  <input
                    type="date"
                    value={form.tglIjin}
                    min={minTanggal()}
                    onChange={(e) => updateField('tglIjin', e.target.value)}
                    required
                  />
                </label>

                <label className="izin__field">
                  <span>Tgl Izin Selesai *</span>
                  <input
                    type="date"
                    value={form.tglIjinSd}
                    min={form.tglIjin || minTanggal()}
                    onChange={(e) => updateField('tglIjinSd', e.target.value)}
                    required
                  />
                </label>

                <label className="izin__field">
                  <span>Dari Jam *</span>
                  <input
                    type="time"
                    value={form.jamMulai}
                    onChange={(e) => updateField('jamMulai', e.target.value)}
                    required
                  />
                </label>

                <label className="izin__field">
                  <span>Sampai Jam *</span>
                  <input
                    type="time"
                    value={form.jamSelesai}
                    onChange={(e) => updateField('jamSelesai', e.target.value)}
                    required
                  />
                </label>

                <label className="izin__field">
                  <span>Jenis Izin *</span>
                  <select value={form.jenisIjin} onChange={(e) => updateField('jenisIjin', e.target.value)}>
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="izin__field">
                  <span>Kepentingan *</span>
                  <select
                    value={form.kepentinganIjin}
                    onChange={(e) => updateField('kepentinganIjin', e.target.value)}
                  >
                    {KEPENTINGAN_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="izin__field izin__field--full">
                  <span>Keterangan Alasan</span>
                  <textarea
                    rows={3}
                    value={form.keterangan}
                    maxLength={500}
                    placeholder="Tuliskan keterangan detail keperluan izin..."
                    onChange={(e) => updateField('keterangan', e.target.value)}
                  />
                </label>

                {form.jenisIjin === JENIS_SAKIT && (
                  <label className="izin__field izin__field--full izin__field--berkas">
                    <span>Foto / Dokumen Surat Dokter</span>
                    <div className="izin__berkas-upload-box">
                      <input type="file" accept={BERKAS_ACCEPT} onChange={pilihBerkas} />
                      <div className="izin__berkas-hint">
                        Format file yang didukung: PDF, PNG, JPG, atau JPEG.
                        {berkas ? (
                          <div className="izin__berkas-selected">
                            Berkas terpilih: <strong>{berkas.name}</strong>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {formError && <div className="izin__error">{formError}</div>}

              <div className="izin__modal-footer">
                <button
                  type="button"
                  className="izin__btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="izin__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Ajukan Permohonan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
