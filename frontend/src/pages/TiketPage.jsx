import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ListChecks,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Search,
  Trash2,
  X,
  Ticket,
  Plane,
  Building2,
  Train,
  Bus,
  Ship,
  Clock,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Info,
  Tag,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './TiketPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Sesuai pilihan jenis tiket di EASy - backend menolak nilai lain.
const JENIS_OPTIONS = ['Bus', 'Hotel', 'Kapal Laut', 'Kereta Api', 'Pesawat']

function getTiketIcon(jenis) {
  switch (jenis) {
    case 'Pesawat':
      return <Plane size={11} />
    case 'Hotel':
      return <Building2 size={11} />
    case 'Kereta Api':
      return <Train size={11} />
    case 'Bus':
      return <Bus size={11} />
    case 'Kapal Laut':
      return <Ship size={11} />
    default:
      return <Ticket size={11} />
  }
}

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat (Draft)' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status & Sumber', className: 'tiket__col-status' },
  { key: 'kodeTiket', label: 'Kode Tiket & Input', className: 'tiket__col-kode' },
  { key: 'pemesanan', label: 'Rincian Pemesanan', className: 'tiket__col-pesan' },
  { key: 'keterangan', label: 'Keperluan / Keterangan', className: 'tiket__col-ket' },
]

const FILTER_PLACEHOLDER = 'Cari kode tiket, keterangan, atau jenis tiket...'

const pad = (n) => String(n).padStart(2, '0')

function formatTanggal(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function today() {
  return isoDate(new Date())
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

const emptyRincian = { jenisTiket: 'Pesawat', tglIn: '', tglOut: '', keterangan: '' }

export default function TiketPage() {
  const dialog = useDialog()
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('dibuat')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'tglInput', direction: 'desc' })

  // Detail Modal State (Clickable Row)
  const [detailModalRow, setDetailModalRow] = useState(null)

  // Form Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [keterangan, setKeterangan] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Rincian Modal State
  const [detailFor, setDetailFor] = useState(null)
  const [rincian, setRincian] = useState([])
  const [rincianForm, setRincianForm] = useState(emptyRincian)
  const [rincianError, setRincianError] = useState('')
  const [editingRincian, setEditingRincian] = useState(null)

  async function load() {
    try {
      const data = await api.getTiket()
      setRows(data.items)
      setLoadError('')
    } catch (err) {
      if (isEmptyDataError(err)) {
        setRows([])
        setLoadError('')
        return
      }
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data pemesanan tiket.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Ringkasan metrik statistik Pemesanan Tiket
  const stats = useMemo(() => {
    if (!rows || rows.length === 0) {
      return { total: 0, dibuat: 0, persetujuan: 0, bulanIni: 0 }
    }
    const now = new Date()
    const curMonth = now.getMonth()
    const curYear = now.getFullYear()

    let dibuat = 0
    let persetujuan = 0
    let bulanIni = 0

    for (const r of rows) {
      if (r.status === STATUS_DIBUAT) {
        dibuat++
      } else {
        persetujuan++
      }
      if (r.tglInput) {
        const d = new Date(r.tglInput)
        if (!Number.isNaN(d.getTime()) && d.getMonth() === curMonth && d.getFullYear() === curYear) {
          bulanIni++
        }
      }
    }

    return {
      total: rows.length,
      dibuat,
      persetujuan,
      bulanIni,
    }
  }, [rows])

  const tabRows = useMemo(() => {
    if (!rows) return []
    return tab === 'dibuat'
      ? rows.filter((r) => r.status === STATUS_DIBUAT)
      : rows.filter((r) => r.status !== STATUS_DIBUAT)
  }, [rows, tab])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tabRows
    return tabRows.filter((r) =>
      [r.status, r.kodeTiket, r.keterangan, r.source, ...(r.pemesanan ?? [])]
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
      if (key === 'tglInput') {
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
    setEditing(null)
    setKeterangan('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setKeterangan(row.keterangan ?? '')
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (editing) {
        await api.updateTiket(editing.id, { keterangan })
        setModalOpen(false)
        await load()
      } else {
        const created = await api.createTiket({ keterangan })
        setModalOpen(false)
        await load()
        openDetail(created)
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan pemesanan tiket.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (
      !(await dialog.confirm({
        title: 'Hapus Tiket',
        message: `Hapus pemesanan tiket ${row.kodeTiket}? Seluruh rinciannya ikut terhapus.`,
        danger: true,
        confirmText: 'Hapus',
      }))
    )
      return
    try {
      await api.deleteTiket(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus pemesanan tiket.')
    }
  }

  function resetRincianForm() {
    setEditingRincian(null)
    setRincianForm({ ...emptyRincian, tglIn: today(), tglOut: today() })
  }

  async function openDetail(row) {
    setDetailFor(row)
    resetRincianForm()
    setRincianError('')
    try {
      setRincian(await api.getTiketDetail(row.id))
    } catch (err) {
      setRincianError(err instanceof ApiError ? err.message : 'Gagal memuat rincian.')
    }
  }

  function openEditRincian(r) {
    setEditingRincian(r)
    setRincianForm({
      jenisTiket: r.jenisTiket,
      tglIn: isoDate(new Date(r.tglIn)),
      tglOut: isoDate(new Date(r.tglOut)),
      keterangan: r.keterangan,
    })
    setRincianError('')
  }

  async function handleSubmitRincian(e) {
    e.preventDefault()
    setRincianError('')
    try {
      if (editingRincian) {
        await api.updateTiketRincian(detailFor.id, editingRincian.idDet, rincianForm)
      } else {
        await api.addTiketRincian(detailFor.id, rincianForm)
      }
      setRincian(await api.getTiketDetail(detailFor.id))
      resetRincianForm()
      await load()
    } catch (err) {
      setRincianError(
        err instanceof ApiError ? err.message : `Gagal ${editingRincian ? 'mengubah' : 'menambah'} rincian.`
      )
    }
  }

  async function handleDeleteRincian(idDet) {
    try {
      await api.deleteTiketRincian(detailFor.id, idDet)
      setRincian(await api.getTiketDetail(detailFor.id))
      if (editingRincian?.idDet === idDet) resetRincianForm()
      await load()
    } catch (err) {
      setRincianError(err instanceof ApiError ? err.message : 'Gagal menghapus rincian.')
    }
  }

  function updateRincian(key, value) {
    setRincianForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'tglIn' && (!prev.tglOut || prev.tglOut < value)) {
        next.tglOut = value
      }
      return next
    })
  }

  function handlePrint(row) {
    window.open(`/cetak/tiket/${row.id}`, '_blank', 'noopener')
  }

  if (loadError && !rows) {
    return (
      <div className="tiket">
        <div className="tiket__card tiket__state-card">
          <Info size={36} className="tiket__state-icon tiket__state-icon--err" />
          <h4 className="tiket__state-title">Gagal Memuat Data Tiket</h4>
          <p className="tiket__state-desc">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="tiket">
        <div className="tiket__card tiket__state-card">
          <div className="tiket__loading-spinner" />
          <h4 className="tiket__state-title">Memuat Data Tiket</h4>
          <p className="tiket__state-desc">Sedang mengambil riwayat pemesanan tiket Anda...</p>
        </div>
      </div>
    )
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="tiket">
      {/* Header Halaman */}
      <div className="tiket__page-header">
        <div className="tiket__page-header-info">
          <div className="tiket__page-header-icon">
            <Ticket size={24} />
          </div>
          <div>
            <h2 className="tiket__page-title">Pemesanan Tiket & Hotel</h2>
            <p className="tiket__page-subtitle">
              Pemesanan tiket transportasi dinas (Pesawat, Kereta Api, Bus, Kapal) dan akomodasi hotel
            </p>
          </div>
        </div>
        <div className="tiket__page-header-actions">
          {isDibuatTab && (
            <button type="button" className="tiket__btn-primary" onClick={openCreate}>
              <Plus size={16} /> <span>Pesan Tiket Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Metrik Statistik */}
      <div className="tiket__stats-grid">
        <div className="tiket__stat-card">
          <div className="tiket__stat-icon tiket__stat-icon--total">
            <Ticket size={18} />
          </div>
          <div className="tiket__stat-body">
            <span className="tiket__stat-label">Total Pemesanan</span>
            <span className="tiket__stat-val">{stats.total}</span>
          </div>
        </div>

        <div className="tiket__stat-card">
          <div className="tiket__stat-icon tiket__stat-icon--draft">
            <Clock size={18} />
          </div>
          <div className="tiket__stat-body">
            <span className="tiket__stat-label">Di Buat (Draft)</span>
            <span className="tiket__stat-val tiket__stat-val--draft">{stats.dibuat}</span>
          </div>
        </div>

        <div className="tiket__stat-card">
          <div className="tiket__stat-icon tiket__stat-icon--approved">
            <CheckCircle2 size={18} />
          </div>
          <div className="tiket__stat-body">
            <span className="tiket__stat-label">Persetujuan</span>
            <span className="tiket__stat-val tiket__stat-val--approved">{stats.persetujuan}</span>
          </div>
        </div>

        <div className="tiket__stat-card">
          <div className="tiket__stat-icon tiket__stat-icon--monthly">
            <Calendar size={18} />
          </div>
          <div className="tiket__stat-body">
            <span className="tiket__stat-label">Bulan Ini</span>
            <span className="tiket__stat-val tiket__stat-val--monthly">{stats.bulanIni}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="tiket__card">
        {/* Tab Selector & Navigation */}
        <div className="tiket__nav-bar">
          <div className="tiket__tabs">
            {TABS.map((t) => {
              const count = t.key === 'dibuat' ? stats.dibuat : stats.total - stats.dibuat
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`tiket__tab${tab === t.key ? ' tiket__tab--active' : ''}`}
                  onClick={() => switchTab(t.key)}
                >
                  <span>{t.label}</span>
                  <span className="tiket__tab-count">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="tiket__nav-actions">
            <button
              type="button"
              className="tiket__icon-btn"
              onClick={load}
              title="Muat ulang data"
              aria-label="Muat ulang data"
            >
              <RotateCw size={15} />
            </button>
          </div>
        </div>

        {loadError && <div className="tiket__error">{loadError}</div>}

        {/* Toolbar Pencarian & Ukuran Halaman */}
        <div className="tiket__toolbar">
          <div className="tiket__search-box">
            <Search size={15} className="tiket__search-icon" />
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
                className="tiket__search-clear"
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

          <div className="tiket__page-size-wrap">
            <span className="tiket__page-size-label">Tampilkan:</span>
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

        {/* Tabel Pemesanan Tiket (Padat, Pas Layar, Baris Bisa Diklik) */}
        <div className="tiket__table-wrap">
          <table className="tiket__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const isSorted = sort.key === col.key
                  return (
                    <th
                      key={col.key}
                      className={`${col.className} tiket__th--sortable ${isSorted ? 'tiket__th--active' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <div className="tiket__th-content">
                        <span>{col.label}</span>
                        <span className="tiket__sort-indicator">
                          {isSorted ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp size={12} className="tiket__sort-icon--active" />
                            ) : (
                              <ArrowDown size={12} className="tiket__sort-icon--active" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="tiket__sort-icon--idle" />
                          )}
                        </span>
                      </div>
                    </th>
                  )
                })}
                <th className="tiket__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="tiket__no-data">
                    <div className="tiket__empty-state">
                      <FileQuestion size={36} className="tiket__empty-icon" />
                      <span className="tiket__empty-title">Tidak ada permohonan tiket</span>
                      <span className="tiket__empty-sub">
                        {search
                          ? `Tidak ditemukan data tiket yang sesuai dengan "${search}".`
                          : isDibuatTab
                          ? 'Belum ada draf pemesanan tiket yang dibuat.'
                          : 'Belum ada tiket yang telah diproses persetujuan.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const isDibuat = row.status === STATUS_DIBUAT

                  return (
                    <tr
                      key={row.id}
                      className="tiket__row tiket__row--clickable"
                      onClick={() => setDetailModalRow(row)}
                      title="Klik untuk melihat detail pemesanan tiket"
                    >
                      {/* Status & Sumber */}
                      <td className="tiket__col-status" data-label="Status & Sumber">
                        <div className="tiket__status-group">
                          <span
                            className={`tiket__badge ${
                              isDibuat ? 'tiket__badge--pending' : 'tiket__badge--success'
                            } tiket__badge--sm`}
                          >
                            {row.status}
                          </span>
                          {row.source && <span className="tiket__source-badge">{row.source}</span>}
                        </div>
                      </td>

                      {/* Kode Tiket & Input */}
                      <td className="tiket__col-kode" data-label="Kode Tiket">
                        <div className="tiket__kode-cell">
                          <span className="tiket__kode-badge">{row.kodeTiket || '-'}</span>
                          <span className="tiket__tgl-input">
                            <Calendar size={10} /> {formatTanggal(row.tglInput)}
                          </span>
                        </div>
                      </td>

                      {/* Rincian Pemesanan */}
                      <td className="tiket__col-pesan" data-label="Rincian Pemesanan">
                        <div className="tiket__pesan-cell">
                          {row.pemesanan?.length ? (
                            <div className="tiket__pesan-list">
                              {row.pemesanan.map((item, idx) => (
                                <div key={idx} className="tiket__pesan-chip">
                                  <Ticket size={11} className="tiket__pesan-icon" />
                                  <span className="tiket__pesan-text">{item}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="tiket__dash">Belum ada rincian tiket</span>
                          )}
                        </div>
                      </td>

                      {/* Keperluan / Keterangan */}
                      <td className="tiket__col-ket" data-label="Keterangan">
                        <div className="tiket__ket-cell">
                          <span className="tiket__ket-text">{row.keterangan || '-'}</span>
                        </div>
                      </td>

                      {/* Aksi */}
                      <td
                        className="tiket__col-aksi"
                        data-label="Aksi"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="tiket__row-actions">
                          {/* Cetak Tiket (hanya jika sudah disetujui atau bukan di tab draf) */}
                          {((row.status ?? '').toLowerCase().includes('setuju') || !isDibuatTab) && (
                            <button
                              type="button"
                              className="tiket__row-btn tiket__row-btn--print"
                              onClick={() => handlePrint(row)}
                              title="Cetak Surat Pemesanan Tiket"
                              aria-label="Cetak Surat Pemesanan Tiket"
                            >
                              <Printer size={14} />
                            </button>
                          )}

                          {isDibuatTab && (
                            <>
                              {/* Rincian Tiket */}
                              <button
                                type="button"
                                className="tiket__row-btn tiket__row-btn--detail"
                                onClick={() => openDetail(row)}
                                title="Kelola Rincian Tiket"
                                aria-label="Kelola Rincian Tiket"
                              >
                                <ListChecks size={14} />
                              </button>

                              {/* Ubah */}
                              <button
                                type="button"
                                className="tiket__row-btn tiket__row-btn--edit"
                                onClick={() => openEdit(row)}
                                title="Ubah Keterangan"
                                aria-label="Ubah Keterangan"
                              >
                                <Pencil size={14} />
                              </button>

                              {/* Hapus */}
                              <button
                                type="button"
                                className="tiket__row-btn tiket__row-btn--delete"
                                onClick={() => handleDelete(row)}
                                title="Hapus Pemesanan"
                                aria-label="Hapus Pemesanan"
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
        <div className="tiket__footer">
          <div className="tiket__footer-info">
            {totalEntries === 0 ? (
              '0 entri tiket'
            ) : (
              <>
                Menampilkan <strong>{startIdx + 1}</strong>–
                <strong>{Math.min(startIdx + pageSize, totalEntries)}</strong> dari{' '}
                <strong>{totalEntries}</strong> entri
              </>
            )}
          </div>

          <div className="tiket__pagination">
            <button
              type="button"
              className="tiket__page-nav"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={15} />
              <span className="tiket__nav-text">Sebelumnya</span>
            </button>

            <div className="tiket__page-numbers">
              {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="tiket__page-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`tiket__page-num ${currentPage === p ? 'is-active' : ''}`}
                    onClick={() => setPage(Number(p))}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="tiket__page-nav"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Halaman berikutnya"
            >
              <span className="tiket__nav-text">Berikutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Pemesanan Tiket (Muncul Saat Baris Diklik) */}
      {detailModalRow && (
        <div className="tiket__modal-backdrop" onClick={() => setDetailModalRow(null)}>
          <div className="tiket__modal tiket__modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="tiket__modal-header">
              <div className="tiket__modal-header-title">
                <Ticket size={18} />
                <h3>Detail Pemesanan Tiket {detailModalRow.kodeTiket ? `#${detailModalRow.kodeTiket}` : ''}</h3>
              </div>
              <button
                type="button"
                className="tiket__modal-close"
                onClick={() => setDetailModalRow(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="tiket__detail-body">
              {/* Top Status & Code Banner */}
              <div className="tiket__detail-top">
                <div className="tiket__detail-ident">
                  <span className="tiket__detail-kode">{detailModalRow.kodeTiket || '-'}</span>
                  {detailModalRow.source && (
                    <span className="tiket__chip tiket__chip--source">Sumber: {detailModalRow.source}</span>
                  )}
                </div>
                <span
                  className={`tiket__badge ${
                    detailModalRow.status === STATUS_DIBUAT ? 'tiket__badge--pending' : 'tiket__badge--success'
                  }`}
                >
                  {detailModalRow.status}
                </span>
              </div>

              {/* Detail Items Grid */}
              <div className="tiket__detail-grid">
                <div className="tiket__detail-item">
                  <span className="tiket__detail-label">Tanggal Input</span>
                  <div className="tiket__detail-val">
                    <Calendar size={13} />
                    <span>{formatTanggal(detailModalRow.tglInput)}</span>
                  </div>
                </div>

                <div className="tiket__detail-item">
                  <span className="tiket__detail-label">Jumlah Tiket / Item</span>
                  <div className="tiket__detail-val">
                    <Tag size={13} />
                    <span>{detailModalRow.pemesanan?.length || 0} item pesanan</span>
                  </div>
                </div>

                <div className="tiket__detail-item tiket__detail-item--full">
                  <span className="tiket__detail-label">Rincian Pemesanan Tiket & Hotel</span>
                  <div className="tiket__detail-box">
                    {detailModalRow.pemesanan?.length ? (
                      <ul className="tiket__detail-pesan-list">
                        {detailModalRow.pemesanan.map((item, idx) => (
                          <li key={idx}>
                            <Ticket size={13} className="tiket__detail-pesan-icon" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="tiket__dash">Belum ada rincian tiket atau hotel.</span>
                    )}
                  </div>
                </div>

                <div className="tiket__detail-item tiket__detail-item--full">
                  <span className="tiket__detail-label">Keterangan / Keperluan Dinas</span>
                  <div className="tiket__detail-box">
                    {detailModalRow.keterangan ? (
                      <p className="tiket__detail-desc">{detailModalRow.keterangan}</p>
                    ) : (
                      <span className="tiket__dash">Tidak ada keterangan tambahan.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="tiket__modal-footer tiket__detail-footer">
              <div className="tiket__detail-actions-left">
                {((detailModalRow.status ?? '').toLowerCase().includes('setuju') || detailModalRow.status !== STATUS_DIBUAT) && (
                  <button
                    type="button"
                    className="tiket__btn-outline tiket__btn-outline--print"
                    onClick={() => handlePrint(detailModalRow)}
                    title="Cetak Surat"
                  >
                    <Printer size={14} /> <span>Cetak Surat</span>
                  </button>
                )}
                {detailModalRow.status === STATUS_DIBUAT && (
                  <button
                    type="button"
                    className="tiket__btn-outline tiket__btn-outline--pesan"
                    onClick={() => {
                      const row = detailModalRow
                      setDetailModalRow(null)
                      openDetail(row)
                    }}
                    title="Kelola Rincian"
                  >
                    <ListChecks size={14} /> <span>Kelola Rincian</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="tiket__btn-secondary"
                onClick={() => setDetailModalRow(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Pengajuan / Edit Pemesanan Tiket */}
      {modalOpen && (
        <div className="tiket__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="tiket__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tiket__modal-header">
              <div className="tiket__modal-header-title">
                <Ticket size={18} />
                <h3>{editing ? `Ubah Pemesanan Tiket #${editing.kodeTiket}` : 'Ajukan Pemesanan Tiket'}</h3>
              </div>
              <button
                type="button"
                className="tiket__modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form className="tiket__modal-body" onSubmit={handleSubmit}>
              <label className="tiket__field tiket__field--full">
                <span>Keterangan / Keperluan Pemesanan *</span>
                <textarea
                  rows={4}
                  value={keterangan}
                  maxLength={254}
                  placeholder="Mis. Tiket perjalanan dinas audit kantor cabang Surabaya..."
                  onChange={(e) => setKeterangan(e.target.value)}
                  required
                />
              </label>

              <div className="tiket__hint-card">
                <Info size={15} />
                <span>
                  Setelah pemesanan dibuat, Anda dapat menambahkan rincian tiket spesifik (Pesawat, Kereta, Bus, Hotel) beserta tanggal dan rutenya.
                </span>
              </div>

              {formError && <div className="tiket__error">{formError}</div>}

              <div className="tiket__modal-footer">
                <button
                  type="button"
                  className="tiket__btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="tiket__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan & Tambah Rincian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rincian Tiket & Hotel */}
      {detailFor && (
        <div className="tiket__modal-backdrop" onClick={() => setDetailFor(null)}>
          <div className="tiket__modal tiket__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="tiket__modal-header">
              <div className="tiket__modal-header-title">
                <Ticket size={18} />
                <h3>Rincian Tiket & Akomodasi #{detailFor.kodeTiket}</h3>
              </div>
              <button
                type="button"
                className="tiket__modal-close"
                onClick={() => setDetailFor(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Tambah/Ubah Rincian */}
            <form className="tiket__modal-body tiket__rincian-form" onSubmit={handleSubmitRincian}>
              <div className="tiket__modal-grid">
                <label className="tiket__field">
                  <span>Jenis Tiket / Akomodasi *</span>
                  <select
                    value={rincianForm.jenisTiket}
                    onChange={(e) => updateRincian('jenisTiket', e.target.value)}
                  >
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="tiket__field">
                  <span>Tanggal Tiket IN / Check-In *</span>
                  <input
                    type="date"
                    value={rincianForm.tglIn}
                    onChange={(e) => updateRincian('tglIn', e.target.value)}
                    required
                  />
                </label>

                <label className="tiket__field">
                  <span>Tanggal Tiket OUT / Check-Out *</span>
                  <input
                    type="date"
                    value={rincianForm.tglOut}
                    min={rincianForm.tglIn}
                    onChange={(e) => updateRincian('tglOut', e.target.value)}
                    required
                  />
                </label>

                <label className="tiket__field tiket__field--full">
                  <span>Keterangan Rute / Nama Hotel *</span>
                  <textarea
                    rows={2}
                    value={rincianForm.keterangan}
                    maxLength={254}
                    placeholder="Mis. Rute Surabaya - Jakarta (Pagi) / Hotel Santika Premiere"
                    onChange={(e) => updateRincian('keterangan', e.target.value)}
                    required
                  />
                </label>
              </div>

              {rincianError && <div className="tiket__error">{rincianError}</div>}

              <div className="tiket__modal-footer tiket__rincian-form-foot">
                {editingRincian && (
                  <button type="button" className="tiket__btn-secondary" onClick={resetRincianForm}>
                    Batal Ubah
                  </button>
                )}
                <button type="submit" className="tiket__submit">
                  {editingRincian ? (
                    <>
                      <Pencil size={14} /> <span>Simpan Perubahan</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> <span>Tambah Rincian Tiket</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Tabel Daftar Rincian */}
            <div className="tiket__rincian-table-wrap">
              <table className="tiket__table tiket__table--rincian">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Jenis</th>
                    <th style={{ width: '18%' }}>Tgl IN</th>
                    <th style={{ width: '18%' }}>Tgl OUT</th>
                    <th style={{ width: '28%' }}>Keterangan / Rute</th>
                    <th style={{ width: '14%', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rincian.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="tiket__no-data">
                        Belum ada rincian tiket. Dokumen pemesanan belum dapat dicetak sebelum ada rincian.
                      </td>
                    </tr>
                  ) : (
                    rincian.map((r) => (
                      <tr
                        key={r.idDet}
                        className={editingRincian?.idDet === r.idDet ? 'tiket__row--editing' : undefined}
                      >
                        <td>
                          <span className="tiket__jenis-chip">
                            {getTiketIcon(r.jenisTiket)}
                            <span>{r.jenisTiket}</span>
                          </span>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTanggal(r.tglIn)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTanggal(r.tglOut)}</td>
                        <td>
                          <b>{r.keterangan || '-'}</b>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="tiket__row-actions">
                            <button
                              type="button"
                              className="tiket__row-btn tiket__row-btn--edit"
                              onClick={() => openEditRincian(r)}
                              title="Ubah rincian"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="tiket__row-btn tiket__row-btn--delete"
                              onClick={() => handleDeleteRincian(r.idDet)}
                              title="Hapus rincian"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="tiket__modal-footer">
              <button
                type="button"
                className="tiket__btn-secondary"
                onClick={() => setDetailFor(null)}
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
