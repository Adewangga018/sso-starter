import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
  Clock,
  Clock3,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  FileText,
  AlertCircle,
  Timer,
  Flame,
  Layers,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './SplPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const JENIS_OPTIONS = ['Biasa', 'Mengganti', 'Crash Program']

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat (Draft)' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'spl__col-status' },
  { key: 'kodeSpl', label: 'Kode SPL', className: 'spl__col-kode' },
  { key: 'jamMulai', label: 'Waktu Mulai', className: 'spl__col-jam' },
  { key: 'jamSelesai', label: 'Waktu Selesai', className: 'spl__col-jam' },
  { key: 'jenisSpl', label: 'Jenis SPL', className: 'spl__col-jenis' },
  { key: 'keterangan', label: 'Keterangan', className: 'spl__col-ket' },
]

const FILTER_PLACEHOLDER = 'Cari kode SPL, keterangan, jenis, atau status...'

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

function addDays(isoDate, days) {
  if (!isoDate) return ''
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function calculateDuration(mulaiIso, selesaiIso) {
  if (!mulaiIso || !selesaiIso) return null
  const m = new Date(mulaiIso)
  const s = new Date(selesaiIso)
  if (Number.isNaN(m.getTime()) || Number.isNaN(s.getTime())) return null
  const diffMs = s.getTime() - m.getTime()
  if (diffMs <= 0) return null
  const totalMins = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours > 0 && mins > 0) return `${hours} jam ${mins} menit`
  if (hours > 0) return `${hours} jam`
  return `${mins} menit`
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

const emptyForm = { mulaiTgl: '', sampaiTgl: '', jamMulai: '', jamSelesai: '', jenisSpl: 'Biasa', keterangan: '' }

export default function SplPage() {
  const dialog = useDialog()
  const [rows, setRows] = useState(null)
  const [window_, setWindow] = useState(null)
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

  async function load() {
    try {
      const data = await api.getSpl()
      setRows(data.items)
      setWindow(data.window)
      setLoadError('')
    } catch (err) {
      if (isEmptyDataError(err)) {
        setRows([])
        setLoadError('')
        return
      }
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data SPL.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Ringkasan metrik statistik SPL
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
    // "Persetujuan" holds everything an approver has already acted on - approved or rejected -
    // which is simply anything no longer sitting in the "Di Buat" state.
    return tab === 'dibuat'
      ? rows.filter((r) => r.status === STATUS_DIBUAT)
      : rows.filter((r) => r.status !== STATUS_DIBUAT)
  }, [rows, tab])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tabRows
    return tabRows.filter((r) =>
      [r.status, r.kodeSpl, r.keterangan, formatDateTime(r.jamMulai), formatDateTime(r.jamSelesai), r.jenisSpl, r.source]
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
    const defaultDate = window_?.maxDate ?? ''
    setEditing(null)
    setForm({ ...emptyForm, mulaiTgl: defaultDate, sampaiTgl: defaultDate })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(row) {
    const mulai = splitDateTime(row.jamMulai)
    const selesai = splitDateTime(row.jamSelesai)
    setEditing(row)
    setForm({
      mulaiTgl: mulai.date,
      sampaiTgl: selesai.date,
      jamMulai: mulai.time,
      jamSelesai: selesai.time,
      jenisSpl: row.jenisSpl ?? 'Biasa',
      keterangan: row.keterangan ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Keep "sampai" anchored to "mulai": same day by default, at most the next day.
      if (key === 'mulaiTgl') {
        if (!prev.sampaiTgl || prev.sampaiTgl < value || prev.sampaiTgl > addDays(value, 1)) {
          next.sampaiTgl = value
        }
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
        mulaiTgl: form.mulaiTgl,
        sampaiTgl: form.sampaiTgl,
        jamMulai: form.jamMulai,
        jamSelesai: form.jamSelesai,
        jenisSpl: form.jenisSpl,
        keterangan: form.keterangan,
      }
      if (editing) {
        await api.updateSpl(editing.id, payload)
      } else {
        await api.createSpl(payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan SPL.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!(await dialog.confirm({ title: 'Hapus SPL', message: `Hapus SPL ${row.kodeSpl}?`, danger: true, confirmText: 'Hapus' }))) return
    try {
      await api.deleteSpl(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus SPL.')
    }
  }

  if (loadError && !rows) {
    return (
      <div className="spl">
        <div className="spl__card spl__state-card">
          <AlertCircle size={40} className="spl__state-icon spl__state-icon--err" />
          <h4 className="spl__state-title">Gagal Memuat Data SPL</h4>
          <p className="spl__state-desc">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="spl">
        <div className="spl__card spl__state-card">
          <div className="spl__loading-spinner" />
          <h4 className="spl__state-title">Memuat Data SPL</h4>
          <p className="spl__state-desc">Sedang mengambil riwayat perintah lembur Anda...</p>
        </div>
      </div>
    )
  }

  const isDibuatTab = tab === 'dibuat'
  const minDate = window_?.minDate ?? ''
  const maxDate = window_?.maxDate ?? ''

  return (
    <div className="spl">
      {/* Header Halaman */}
      <div className="spl__page-header">
        <div className="spl__page-header-info">
          <div className="spl__page-header-icon">
            <Clock3 size={24} />
          </div>
          <div>
            <h2 className="spl__page-title">Surat Perintah Lembur (SPL)</h2>
            <p className="spl__page-subtitle">
              Pengajuan dan riwayat lembur kerja, program khusus, dan penggantian jam kerja
            </p>
          </div>
        </div>
        <div className="spl__page-header-actions">
          {isDibuatTab && (
            <button type="button" className="spl__btn-primary" onClick={openCreate}>
              <Plus size={16} /> <span>Ajukan SPL Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Metrik Statistik */}
      <div className="spl__stats-grid">
        <div className="spl__stat-card">
          <div className="spl__stat-icon spl__stat-icon--total">
            <Timer size={18} />
          </div>
          <div className="spl__stat-body">
            <span className="spl__stat-label">Total Pengajuan</span>
            <span className="spl__stat-val">{stats.total}</span>
          </div>
        </div>

        <div className="spl__stat-card">
          <div className="spl__stat-icon spl__stat-icon--draft">
            <Clock size={18} />
          </div>
          <div className="spl__stat-body">
            <span className="spl__stat-label">Di Buat (Draft)</span>
            <span className="spl__stat-val spl__stat-val--draft">{stats.dibuat}</span>
          </div>
        </div>

        <div className="spl__stat-card">
          <div className="spl__stat-icon spl__stat-icon--approved">
            <CheckCircle2 size={18} />
          </div>
          <div className="spl__stat-body">
            <span className="spl__stat-label">Persetujuan</span>
            <span className="spl__stat-val spl__stat-val--approved">{stats.disetujui}</span>
          </div>
        </div>

        <div className="spl__stat-card">
          <div className="spl__stat-icon spl__stat-icon--monthly">
            <Calendar size={18} />
          </div>
          <div className="spl__stat-body">
            <span className="spl__stat-label">Bulan Ini</span>
            <span className="spl__stat-val spl__stat-val--monthly">{stats.bulanIni}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="spl__card">
        {/* Tab Selector & Action Bar */}
        <div className="spl__nav-bar">
          <div className="spl__tabs">
            {TABS.map((t) => {
              const count = t.key === 'dibuat' ? stats.dibuat : stats.disetujui
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`spl__tab${tab === t.key ? ' spl__tab--active' : ''}`}
                  onClick={() => switchTab(t.key)}
                >
                  <span>{t.label}</span>
                  <span className="spl__tab-count">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="spl__nav-actions">
            <button
              type="button"
              className="spl__icon-btn spl__icon-btn--refresh"
              onClick={load}
              title="Muat ulang data"
              aria-label="Muat ulang data"
            >
              <RotateCw size={15} />
            </button>
          </div>
        </div>

        {loadError && <div className="spl__error">{loadError}</div>}

        {/* Toolbar Pencarian & Ukuran Halaman */}
        <div className="spl__toolbar">
          <div className="spl__search-box">
            <Search size={15} className="spl__search-icon" />
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
                className="spl__search-clear"
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

          <div className="spl__page-size-wrap">
            <span className="spl__page-size-label">Tampilkan:</span>
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

        {/* Tabel SPL (Padat, Tanpa Scroll Horizontal Berlebih, Baris Bisa Diklik) */}
        <div className="spl__table-wrap">
          <table className="spl__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const isSorted = sort.key === col.key
                  return (
                    <th
                      key={col.key}
                      className={`${col.className} spl__th--sortable ${isSorted ? 'spl__th--active' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <div className="spl__th-content">
                        <span>{col.label}</span>
                        <span className="spl__sort-indicator">
                          {isSorted ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp size={12} className="spl__sort-icon--active" />
                            ) : (
                              <ArrowDown size={12} className="spl__sort-icon--active" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="spl__sort-icon--idle" />
                          )}
                        </span>
                      </div>
                    </th>
                  )
                })}
                {isDibuatTab && <th className="spl__col-aksi">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + (isDibuatTab ? 1 : 0)} className="spl__no-data">
                    <div className="spl__empty-state">
                      <FileQuestion size={36} className="spl__empty-icon" />
                      <span className="spl__empty-title">Tidak ada permohonan lembur</span>
                      <span className="spl__empty-sub">
                        {search
                          ? `Tidak ditemukan data yang sesuai dengan pencarian "${search}".`
                          : isDibuatTab
                          ? 'Belum ada draf pengajuan SPL yang dibuat.'
                          : 'Belum ada riwayat SPL yang telah diproses persetujuan.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const mulai = formatDateTimeSplit(row.jamMulai)
                  const selesai = formatDateTimeSplit(row.jamSelesai)
                  const isDibuat = row.status === STATUS_DIBUAT
                  const jenisLower = (row.jenisSpl ?? '').toLowerCase()
                  const isCrash = jenisLower.includes('crash')
                  const isMengganti = jenisLower.includes('ganti')

                  return (
                    <tr
                      key={row.id}
                      className="spl__row spl__row--clickable"
                      onClick={() => setDetailRow(row)}
                      title="Klik untuk melihat detail surat perintah lembur"
                    >
                      {/* Status */}
                      <td className="spl__col-status" data-label="Status">
                        <span
                          className={`spl__badge ${
                            isDibuat ? 'spl__badge--pending' : 'spl__badge--success'
                          }`}
                        >
                          {isDibuat ? <Clock size={11} /> : <CheckCircle2 size={11} />}
                          <span>{row.status}</span>
                        </span>
                      </td>

                      {/* Kode SPL */}
                      <td className="spl__col-kode" data-label="Kode SPL">
                        <span className="spl__kode-badge">{row.kodeSpl || '-'}</span>
                      </td>

                      {/* Jam Mulai */}
                      <td className="spl__col-jam" data-label="Waktu Mulai">
                        <div className="spl__datetime-cell">
                          <span className="spl__date-text">{mulai.date}</span>
                          {mulai.time && (
                            <span className="spl__time-tag">
                              <Clock size={10} /> {mulai.time}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jam Selesai */}
                      <td className="spl__col-jam" data-label="Waktu Selesai">
                        <div className="spl__datetime-cell">
                          <span className="spl__date-text">{selesai.date}</span>
                          {selesai.time && (
                            <span className="spl__time-tag">
                              <Clock size={10} /> {selesai.time}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jenis SPL */}
                      <td className="spl__col-jenis" data-label="Jenis SPL">
                        <div className="spl__jenis-wrapper">
                          <span
                            className={`spl__badge ${
                              isCrash
                                ? 'spl__badge--crash'
                                : isMengganti
                                ? 'spl__badge--replace'
                                : 'spl__badge--regular'
                            } spl__badge--sm`}
                          >
                            {isCrash ? (
                              <Flame size={11} />
                            ) : isMengganti ? (
                              <Layers size={11} />
                            ) : (
                              <Timer size={11} />
                            )}
                            <span>{row.jenisSpl}</span>
                          </span>
                          {row.source && <span className="spl__source-chip">{row.source}</span>}
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="spl__col-ket" data-label="Keterangan">
                        <span className="spl__ket-text" title={row.keterangan}>
                          {row.keterangan || '-'}
                        </span>
                      </td>

                      {/* Aksi (Stop propagation agar tidak memicu modal detail) */}
                      {isDibuatTab && (
                        <td
                          className="spl__col-aksi"
                          data-label="Aksi"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="spl__row-actions">
                            <button
                              type="button"
                              className="spl__row-btn spl__row-btn--edit"
                              onClick={() => openEdit(row)}
                              title="Ubah Draf SPL"
                              aria-label="Ubah Draf SPL"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="spl__row-btn spl__row-btn--delete"
                              onClick={() => handleDelete(row)}
                              title="Hapus Draf SPL"
                              aria-label="Hapus Draf SPL"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Paginasi */}
        <div className="spl__footer">
          <div className="spl__footer-info">
            {totalEntries === 0 ? (
              '0 entri lembur'
            ) : (
              <>
                Menampilkan <strong>{startIdx + 1}</strong>–
                <strong>{Math.min(startIdx + pageSize, totalEntries)}</strong> dari{' '}
                <strong>{totalEntries}</strong> entri
              </>
            )}
          </div>

          <div className="spl__pagination">
            <button
              type="button"
              className="spl__page-nav"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={15} />
              <span className="spl__nav-text">Sebelumnya</span>
            </button>

            <div className="spl__page-numbers">
              {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="spl__page-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`spl__page-num ${currentPage === p ? 'is-active' : ''}`}
                    onClick={() => setPage(Number(p))}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="spl__page-nav"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Halaman berikutnya"
            >
              <span className="spl__nav-text">Berikutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Surat Perintah Lembur (Muncul Saat Baris Diklik) */}
      {detailRow && (
        <div className="spl__modal-backdrop" onClick={() => setDetailRow(null)}>
          <div className="spl__modal spl__modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="spl__modal-header">
              <div className="spl__modal-header-title">
                <Clock3 size={18} />
                <h3>Detail Surat Perintah Lembur {detailRow.kodeSpl ? `#${detailRow.kodeSpl}` : ''}</h3>
              </div>
              <button
                type="button"
                className="spl__modal-close"
                onClick={() => setDetailRow(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="spl__detail-body">
              {/* Top Status & Code Banner */}
              <div className="spl__detail-top">
                <div className="spl__detail-ident">
                  <span className="spl__detail-kode">{detailRow.kodeSpl || '-'}</span>
                  <span
                    className={`spl__badge ${
                      detailRow.status === STATUS_DIBUAT
                        ? 'spl__badge--pending'
                        : 'spl__badge--success'
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
                  <span className="spl__source-chip">Sumber: {detailRow.source}</span>
                )}
              </div>

              {/* Detail Items Grid */}
              <div className="spl__detail-grid">
                <div className="spl__detail-item">
                  <span className="spl__detail-label">Jenis Lembur</span>
                  <div className="spl__detail-val">
                    <span
                      className={`spl__badge ${
                        (detailRow.jenisSpl ?? '').toLowerCase().includes('crash')
                          ? 'spl__badge--crash'
                          : (detailRow.jenisSpl ?? '').toLowerCase().includes('ganti')
                          ? 'spl__badge--replace'
                          : 'spl__badge--regular'
                      }`}
                    >
                      {(detailRow.jenisSpl ?? '').toLowerCase().includes('crash') ? (
                        <Flame size={12} />
                      ) : (detailRow.jenisSpl ?? '').toLowerCase().includes('ganti') ? (
                        <Layers size={12} />
                      ) : (
                        <Timer size={12} />
                      )}
                      <span>{detailRow.jenisSpl || '-'}</span>
                    </span>
                  </div>
                </div>

                <div className="spl__detail-item">
                  <span className="spl__detail-label">Estimasi Durasi</span>
                  <div className="spl__detail-val">
                    <Clock3 size={13} />
                    <span>
                      {calculateDuration(detailRow.jamMulai, detailRow.jamSelesai) || '-'}
                    </span>
                  </div>
                </div>

                <div className="spl__detail-item">
                  <span className="spl__detail-label">Waktu Mulai</span>
                  <div className="spl__detail-val spl__detail-val--date">
                    <Calendar size={13} />
                    <span>{formatDateTime(detailRow.jamMulai)}</span>
                  </div>
                </div>

                <div className="spl__detail-item">
                  <span className="spl__detail-label">Waktu Selesai</span>
                  <div className="spl__detail-val spl__detail-val--date">
                    <Calendar size={13} />
                    <span>{formatDateTime(detailRow.jamSelesai)}</span>
                  </div>
                </div>

                <div className="spl__detail-item spl__detail-item--full">
                  <span className="spl__detail-label">Keterangan Tugas / Pekerjaan</span>
                  <div className="spl__detail-box">
                    {detailRow.keterangan ? (
                      <p className="spl__detail-desc">{detailRow.keterangan}</p>
                    ) : (
                      <span className="spl__dash">Tidak ada rincian tugas tambahan.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="spl__modal-footer spl__detail-footer">
              <div className="spl__detail-actions-left">
                {detailRow.status === STATUS_DIBUAT && (
                  <>
                    <button
                      type="button"
                      className="spl__btn-outline spl__btn-outline--edit"
                      onClick={() => {
                        const row = detailRow
                        setDetailRow(null)
                        openEdit(row)
                      }}
                      title="Ubah Data SPL"
                    >
                      <Pencil size={14} /> <span>Ubah</span>
                    </button>
                    <button
                      type="button"
                      className="spl__btn-outline spl__btn-outline--danger"
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
                className="spl__btn-secondary"
                onClick={() => setDetailRow(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Pengajuan / Edit SPL */}
      {modalOpen && (
        <div className="spl__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="spl__modal" onClick={(e) => e.stopPropagation()}>
            <div className="spl__modal-header">
              <div className="spl__modal-header-title">
                <FileText size={18} />
                <h3>{editing ? `Ubah SPL #${editing.kodeSpl}` : 'Ajukan Surat Perintah Lembur'}</h3>
              </div>
              <button
                type="button"
                className="spl__modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className="spl__modal-body" onSubmit={handleSubmit}>
              <div className="spl__modal-grid">
                <label className="spl__field">
                  <span>Mulai Tgl *</span>
                  <input
                    type="date"
                    value={form.mulaiTgl}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => updateField('mulaiTgl', e.target.value)}
                    required
                  />
                </label>

                <label className="spl__field">
                  <span>Sampai Tgl *</span>
                  <input
                    type="date"
                    value={form.sampaiTgl}
                    min={form.mulaiTgl || minDate}
                    max={form.mulaiTgl ? addDays(form.mulaiTgl, 1) : maxDate}
                    onChange={(e) => updateField('sampaiTgl', e.target.value)}
                    required
                  />
                </label>

                <label className="spl__field">
                  <span>Jam Mulai *</span>
                  <input
                    type="time"
                    value={form.jamMulai}
                    onChange={(e) => updateField('jamMulai', e.target.value)}
                    required
                  />
                </label>

                <label className="spl__field">
                  <span>Jam Selesai *</span>
                  <input
                    type="time"
                    value={form.jamSelesai}
                    onChange={(e) => updateField('jamSelesai', e.target.value)}
                    required
                  />
                </label>

                <label className="spl__field spl__field--full">
                  <span>Jenis Lembur (SPL) *</span>
                  <select value={form.jenisSpl} onChange={(e) => updateField('jenisSpl', e.target.value)}>
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="spl__field spl__field--full">
                  <span>Keterangan Tugas Lembur *</span>
                  <textarea
                    rows={3}
                    value={form.keterangan}
                    maxLength={254}
                    placeholder="Tuliskan rincian tugas atau aktivitas lembur yang dikerjakan..."
                    onChange={(e) => updateField('keterangan', e.target.value)}
                    required
                  />
                </label>
              </div>

              {formError && <div className="spl__error">{formError}</div>}

              <div className="spl__modal-footer">
                <button
                  type="button"
                  className="spl__btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="spl__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Ajukan SPL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
