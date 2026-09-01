import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Camera,
  Check,
  ListChecks,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Search,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  Plane,
  Car,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Info,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import DinasKameraCapture from '../components/DinasKameraCapture'
import './SppdPage.css'

// Badge status persetujuan MANAGER real-time
function StatusPersetujuanBadge({ status }) {
  if (!status) return <span className="sppd__appr sppd__appr--none">-</span>
  const s = (status ?? '').toLowerCase()
  if (s.includes('setuju')) {
    return (
      <span className="sppd__appr sppd__appr--ok">
        <CheckCircle2 size={11} />
        <span>{status}</span>
      </span>
    )
  }
  if (s.includes('tolak')) {
    return (
      <span className="sppd__appr sppd__appr--reject">
        <AlertCircle size={11} />
        <span>{status}</span>
      </span>
    )
  }
  return (
    <span className="sppd__appr sppd__appr--wait">
      <Clock size={11} />
      <span>{status}</span>
    </span>
  )
}

const RENTANG_KM_SPPD = '>150'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const JENIS_OPTIONS = ['Dalam Negeri', 'Luar Negeri']
const KENDARAAN_OPTIONS = ['Umum', 'Kendaraan Dinas', 'Lain-lain']
const POSISI_OPTIONS = ['Ketua', 'Anggota']

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat (Draft)' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status & Approval', className: 'sppd__col-status' },
  { key: 'kodeSppd', label: 'Kode SPPD', className: 'sppd__col-kode' },
  { key: 'tujuan', label: 'Tujuan & Transportasi', className: 'sppd__col-tujuan' },
  { key: 'tglBerangkat', label: 'Jadwal Perjalanan', className: 'sppd__col-jadwal' },
  { key: 'namaKaryawan', label: 'Peserta & Tugas', className: 'sppd__col-peserta' },
]

const FILTER_PLACEHOLDER = 'Cari kode SPPD, tujuan, nama peserta, atau jenis...'

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

function hitungHariPerjalanan(tglBerangkat, tglPulang) {
  if (!tglBerangkat || !tglPulang) return null
  const a = new Date(tglBerangkat)
  const b = new Date(tglPulang)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null
  const diffTime = Math.abs(b.getTime() - a.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return `${diffDays} hari`
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
  tglBerangkat: '',
  tglPulang: '',
  jenis: 'Dalam Negeri',
  tujuan: '',
  keterangan: '',
  kendaraan: 'Umum',
  bukti: null,
}

const emptyPeserta = { nik: '', nama: '', posisi: 'Ketua', tugas: '' }

export default function SppdPage() {
  const dialog = useDialog()
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('dibuat')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'tglInput', direction: 'desc' })

  // Modal State
  const [detailModalRow, setDetailModalRow] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Rincian Peserta Modal
  const [detailFor, setDetailFor] = useState(null)
  const [detailBolehUbah, setDetailBolehUbah] = useState(true)
  const [peserta, setPeserta] = useState([])
  const [pesertaForm, setPesertaForm] = useState(emptyPeserta)
  const [pesertaError, setPesertaError] = useState('')
  const [editingPeserta, setEditingPeserta] = useState(null)

  // Pegawai Picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerRows, setPickerRows] = useState([])

  // Bukti Preview
  const [buktiPreview, setBuktiPreview] = useState(null)

  async function load() {
    try {
      const data = await api.getSppd()
      setRows(data.items)
      setLoadError('')
    } catch (err) {
      if (isEmptyDataError(err)) {
        setRows([])
        setLoadError('')
        return
      }
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data SPPD.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Ringkasan metrik statistik SPPD
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
      }
      if ((r.statusPersetujuan ?? '').toLowerCase().includes('setuju')) {
        disetujui++
      }
      if (r.tglBerangkat) {
        const d = new Date(r.tglBerangkat)
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
    return tab === 'dibuat'
      ? rows.filter((r) => r.status === STATUS_DIBUAT)
      : rows.filter((r) => r.status !== STATUS_DIBUAT)
  }, [rows, tab])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tabRows
    return tabRows.filter((r) =>
      [r.status, r.statusPersetujuan, r.kodeSppd, r.tujuan, ...(r.namaKaryawan ?? []), ...(r.tugas ?? []), r.kendaraan, r.jenis]
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
      if (key === 'tglInput' || key === 'tglBerangkat' || key === 'tglPulang') {
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
    setForm({ ...emptyForm, tglBerangkat: now, tglPulang: now })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      tglBerangkat: isoDate(new Date(row.tglBerangkat)),
      tglPulang: isoDate(new Date(row.tglPulang)),
      jenis: row.jenis ?? 'Dalam Negeri',
      tujuan: row.tujuan ?? '',
      keterangan: row.keterangan ?? '',
      kendaraan: row.kendaraan ?? 'Umum',
      bukti: null,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function viewBukti(row) {
    try {
      const { url } = await api.getBlob(row.fotoUrl)
      setBuktiPreview({ url })
    } catch (err) {
      await dialog.alert({
        message: err instanceof ApiError ? err.message : 'Gagal memuat foto bukti dinas.',
      })
    }
  }

  function closeBuktiPreview() {
    if (buktiPreview?.url) URL.revokeObjectURL(buktiPreview.url)
    setBuktiPreview(null)
  }

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'tglBerangkat' && (!prev.tglPulang || prev.tglPulang < value)) {
        next.tglPulang = value
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!editing && !form.bukti) {
      setFormError('Ambil foto bukti lokasi dinas terlebih dahulu.')
      return
    }

    setSaving(true)
    try {
      const { bukti, ...rest } = form
      const payload = {
        ...rest,
        rentangKm: RENTANG_KM_SPPD,
        foto: bukti?.foto ?? null,
        lat: bukti?.lat ?? 0,
        lng: bukti?.lng ?? 0,
        accuracy: bukti?.accuracy ?? null,
      }
      if (editing) {
        await api.updateSppd(editing.id, payload)
        setModalOpen(false)
        await load()
      } else {
        const created = await api.createSppd(payload)
        setModalOpen(false)
        await load()
        openDetail(created)
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan SPPD.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (
      !(await dialog.confirm({
        title: 'Hapus SPPD',
        message: `Hapus SPPD ${row.kodeSppd}? Seluruh peserta di dalamnya ikut terhapus.`,
        danger: true,
        confirmText: 'Hapus',
      }))
    )
      return
    try {
      await api.deleteSppd(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus SPPD.')
    }
  }

  function resetPesertaForm() {
    setEditingPeserta(null)
    setPesertaForm(emptyPeserta)
  }

  async function openDetail(row, bolehUbah = true) {
    setDetailFor(row)
    setDetailBolehUbah(bolehUbah)
    resetPesertaForm()
    setPesertaError('')
    try {
      setPeserta(await api.getSppdDetail(row.id))
    } catch (err) {
      setPesertaError(err instanceof ApiError ? err.message : 'Gagal memuat peserta.')
    }
  }

  function openEditPeserta(p) {
    setEditingPeserta(p)
    setPesertaForm({ nik: p.nik, nama: p.nama ?? '', posisi: p.posisi, tugas: p.tugas })
    setPesertaError('')
  }

  async function handleSubmitPeserta(e) {
    e.preventDefault()
    setPesertaError('')

    if (!pesertaForm.nik) {
      setPesertaError('Pilih pegawai terlebih dahulu.')
      return
    }

    try {
      const payload = { nik: pesertaForm.nik, posisi: pesertaForm.posisi, tugas: pesertaForm.tugas }
      if (editingPeserta) {
        await api.updateSppdPeserta(detailFor.id, editingPeserta.idDet, payload)
      } else {
        await api.addSppdPeserta(detailFor.id, payload)
      }
      setPeserta(await api.getSppdDetail(detailFor.id))
      resetPesertaForm()
      await load()
    } catch (err) {
      setPesertaError(err instanceof ApiError ? err.message : `Gagal ${editingPeserta ? 'mengubah' : 'menambah'} peserta.`)
    }
  }

  async function handleDeletePeserta(idDet) {
    try {
      await api.deleteSppdPeserta(detailFor.id, idDet)
      setPeserta(await api.getSppdDetail(detailFor.id))
      if (editingPeserta?.idDet === idDet) resetPesertaForm()
      await load()
    } catch (err) {
      setPesertaError(err instanceof ApiError ? err.message : 'Gagal menghapus peserta.')
    }
  }

  async function openPicker() {
    setPickerOpen(true)
    setPickerQuery('')
    try {
      setPickerRows(await api.cariPegawai(''))
    } catch {
      setPickerRows([])
    }
  }

  async function runPicker(q) {
    setPickerQuery(q)
    try {
      setPickerRows(await api.cariPegawai(q))
    } catch {
      setPickerRows([])
    }
  }

  function pickPegawai(p) {
    setPesertaForm((prev) => ({ ...prev, nik: p.nik, nama: p.nama }))
    setPickerOpen(false)
  }

  function handlePrint(row) {
    window.open(`/cetak/sppd/${row.id}`, '_blank', 'noopener')
  }

  if (loadError && !rows) {
    return (
      <div className="sppd">
        <div className="sppd__card sppd__state-card">
          <AlertCircle size={36} className="sppd__state-icon sppd__state-icon--err" />
          <h4 className="sppd__state-title">Gagal Memuat Data SPPD</h4>
          <p className="sppd__state-desc">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="sppd">
        <div className="sppd__card sppd__state-card">
          <div className="sppd__loading-spinner" />
          <h4 className="sppd__state-title">Memuat Data SPPD</h4>
          <p className="sppd__state-desc">Sedang mengambil riwayat surat perintah perjalanan dinas Anda...</p>
        </div>
      </div>
    )
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="sppd">
      {/* Header Halaman */}
      <div className="sppd__page-header">
        <div className="sppd__page-header-info">
          <div className="sppd__page-header-icon">
            <Plane size={24} />
          </div>
          <div>
            <h2 className="sppd__page-title">Surat Perintah Perjalanan Dinas (SPPD)</h2>
            <p className="sppd__page-subtitle">
              Pengajuan tugas perjalanan dinas jarak jauh (&gt;150 km PP), alokasi tim peserta, dan cetak surat dinas resmi
            </p>
          </div>
        </div>
        <div className="sppd__page-header-actions">
          {isDibuatTab && (
            <button type="button" className="sppd__btn-primary" onClick={openCreate}>
              <Plus size={16} /> <span>Ajukan SPPD Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Metrik Statistik */}
      <div className="sppd__stats-grid">
        <div className="sppd__stat-card">
          <div className="sppd__stat-icon sppd__stat-icon--total">
            <Plane size={18} />
          </div>
          <div className="sppd__stat-body">
            <span className="sppd__stat-label">Total SPPD</span>
            <span className="sppd__stat-val">{stats.total}</span>
          </div>
        </div>

        <div className="sppd__stat-card">
          <div className="sppd__stat-icon sppd__stat-icon--draft">
            <Clock size={18} />
          </div>
          <div className="sppd__stat-body">
            <span className="sppd__stat-label">Di Buat (Draft)</span>
            <span className="sppd__stat-val sppd__stat-val--draft">{stats.dibuat}</span>
          </div>
        </div>

        <div className="sppd__stat-card">
          <div className="sppd__stat-icon sppd__stat-icon--approved">
            <CheckCircle2 size={18} />
          </div>
          <div className="sppd__stat-body">
            <span className="sppd__stat-label">Disetujui Manager</span>
            <span className="sppd__stat-val sppd__stat-val--approved">{stats.disetujui}</span>
          </div>
        </div>

        <div className="sppd__stat-card">
          <div className="sppd__stat-icon sppd__stat-icon--monthly">
            <Calendar size={18} />
          </div>
          <div className="sppd__stat-body">
            <span className="sppd__stat-label">Bulan Ini</span>
            <span className="sppd__stat-val sppd__stat-val--monthly">{stats.bulanIni}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="sppd__card">
        {/* Tab Selector & Navigation */}
        <div className="sppd__nav-bar">
          <div className="sppd__tabs">
            {TABS.map((t) => {
              const count = t.key === 'dibuat' ? stats.dibuat : stats.total - stats.dibuat
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`sppd__tab${tab === t.key ? ' sppd__tab--active' : ''}`}
                  onClick={() => switchTab(t.key)}
                >
                  <span>{t.label}</span>
                  <span className="sppd__tab-count">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="sppd__nav-actions">
            <button
              type="button"
              className="sppd__icon-btn sppd__icon-btn--refresh"
              onClick={load}
              title="Muat ulang data"
              aria-label="Muat ulang data"
            >
              <RotateCw size={15} />
            </button>
          </div>
        </div>

        {loadError && <div className="sppd__error">{loadError}</div>}

        {/* Toolbar Pencarian & Ukuran Halaman */}
        <div className="sppd__toolbar">
          <div className="sppd__search-box">
            <Search size={15} className="sppd__search-icon" />
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
                className="sppd__search-clear"
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

          <div className="sppd__page-size-wrap">
            <span className="sppd__page-size-label">Tampilkan:</span>
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

        {/* Tabel SPPD (Padat, Pas Layar, Baris Bisa Diklik) */}
        <div className="sppd__table-wrap">
          <table className="sppd__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const isSorted = sort.key === col.key
                  return (
                    <th
                      key={col.key}
                      className={`${col.className} sppd__th--sortable ${isSorted ? 'sppd__th--active' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <div className="sppd__th-content">
                        <span>{col.label}</span>
                        <span className="sppd__sort-indicator">
                          {isSorted ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp size={12} className="sppd__sort-icon--active" />
                            ) : (
                              <ArrowDown size={12} className="sppd__sort-icon--active" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="sppd__sort-icon--idle" />
                          )}
                        </span>
                      </div>
                    </th>
                  )
                })}
                <th className="sppd__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="sppd__no-data">
                    <div className="sppd__empty-state">
                      <FileQuestion size={36} className="sppd__empty-icon" />
                      <span className="sppd__empty-title">Tidak ada data SPPD</span>
                      <span className="sppd__empty-sub">
                        {search
                          ? `Tidak ditemukan surat perintah perjalanan dinas yang cocok dengan "${search}".`
                          : isDibuatTab
                          ? 'Belum ada draf pengajuan SPPD yang dibuat.'
                          : 'Belum ada SPPD yang telah diproses persetujuan.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const bolehUbah = row.peranSaya === 'Pembuat'
                  const isDibuat = row.status === STATUS_DIBUAT
                  const durasi = hitungHariPerjalanan(row.tglBerangkat, row.tglPulang)

                  return (
                    <tr
                      key={row.id}
                      className="sppd__row sppd__row--clickable"
                      onClick={() => setDetailModalRow(row)}
                      title="Klik untuk melihat detail lengkap SPPD"
                    >
                      {/* Status & Approval */}
                      <td className="sppd__col-status" data-label="Status">
                        <div className="sppd__status-group">
                          <span
                            className={`sppd__badge ${
                              isDibuat ? 'sppd__badge--pending' : 'sppd__badge--success'
                            } sppd__badge--sm`}
                          >
                            {row.status}
                          </span>
                          <StatusPersetujuanBadge status={row.statusPersetujuan} />
                          {!bolehUbah && row.peranSaya && (
                            <span className="sppd__peran-tag">Saya: {row.peranSaya}</span>
                          )}
                        </div>
                      </td>

                      {/* Kode SPPD & Tgl Input */}
                      <td className="sppd__col-kode" data-label="Kode SPPD">
                        <div className="sppd__kode-cell">
                          <span className="sppd__kode-badge">{row.kodeSppd || '-'}</span>
                          <span className="sppd__tgl-input">Input: {formatTanggal(row.tglInput)}</span>
                        </div>
                      </td>

                      {/* Tujuan & Transportasi */}
                      <td className="sppd__col-tujuan" data-label="Tujuan">
                        <div className="sppd__tujuan-cell">
                          <div className="sppd__tujuan-top">
                            <MapPin size={12} className="sppd__tujuan-icon" />
                            <span className="sppd__tujuan-text">{row.tujuan || '-'}</span>
                          </div>
                          <div className="sppd__tujuan-meta">
                            <span className="sppd__chip sppd__chip--jenis">{row.jenis}</span>
                            <span className="sppd__chip sppd__chip--trans">
                              <Car size={10} /> {row.kendaraan}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Jadwal Perjalanan */}
                      <td className="sppd__col-jadwal" data-label="Jadwal Perjalanan">
                        <div className="sppd__jadwal-cell">
                          <div className="sppd__jadwal-row">
                            <Calendar size={11} className="sppd__jadwal-icon" />
                            <span className="sppd__date-val">{formatTanggal(row.tglBerangkat)}</span>
                          </div>
                          <div className="sppd__jadwal-sub">
                            <span className="sppd__date-end">s/d {formatTanggal(row.tglPulang)}</span>
                            {durasi && <span className="sppd__durasi-tag">({durasi})</span>}
                          </div>
                        </div>
                      </td>

                      {/* Peserta & Tugas */}
                      <td className="sppd__col-peserta" data-label="Peserta & Tugas">
                        <div className="sppd__peserta-cell">
                          {row.namaKaryawan?.length ? (
                            <div className="sppd__peserta-names">
                              <Users size={11} className="sppd__peserta-icon" />
                              <span className="sppd__peserta-text" title={row.namaKaryawan.join(', ')}>
                                {row.namaKaryawan.join(', ')}
                              </span>
                            </div>
                          ) : (
                            <span className="sppd__dash">Belum ada peserta</span>
                          )}
                          {row.tugas?.length > 0 && (
                            <span className="sppd__tugas-preview" title={row.tugas.join('; ')}>
                              {row.tugas.join('; ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aksi */}
                      <td
                        className="sppd__col-aksi"
                        data-label="Aksi"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="sppd__row-actions">
                          {/* Cetak Document (hanya jika sudah disetujui atau bukan di tab draf) */}
                          {((row.statusPersetujuan ?? '').toLowerCase().includes('setuju') || (row.status ?? '').toLowerCase().includes('setuju') || !isDibuatTab) && row.kodeSppd && (
                            <button
                              type="button"
                              className="sppd__row-btn sppd__row-btn--print"
                              onClick={() => handlePrint(row)}
                              title="Cetak Dokumen SPPD"
                              aria-label="Cetak Dokumen SPPD"
                            >
                              <Printer size={14} />
                            </button>
                          )}

                          {/* Foto Bukti */}
                          {row.fotoUrl && (
                            <button
                              type="button"
                              className="sppd__row-btn sppd__row-btn--camera"
                              onClick={() => viewBukti(row)}
                              title="Lihat Foto Bukti Lokasi"
                              aria-label="Lihat Foto Bukti Lokasi"
                            >
                              <Camera size={14} />
                            </button>
                          )}

                          {/* Rincian Peserta */}
                          <button
                            type="button"
                            className="sppd__row-btn sppd__row-btn--detail"
                            onClick={() => openDetail(row, bolehUbah)}
                            title="Kelola Daftar Peserta SPPD"
                            aria-label="Kelola Daftar Peserta SPPD"
                          >
                            <ListChecks size={14} />
                          </button>

                          {/* Ubah & Hapus (Draft Tab) */}
                          {isDibuatTab && bolehUbah && (
                            <>
                              <button
                                type="button"
                                className="sppd__row-btn sppd__row-btn--edit"
                                onClick={() => openEdit(row)}
                                title="Ubah SPPD"
                                aria-label="Ubah SPPD"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="sppd__row-btn sppd__row-btn--delete"
                                onClick={() => handleDelete(row)}
                                title="Hapus SPPD"
                                aria-label="Hapus SPPD"
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
        <div className="sppd__footer">
          <div className="sppd__footer-info">
            {totalEntries === 0 ? (
              '0 entri SPPD'
            ) : (
              <>
                Menampilkan <strong>{startIdx + 1}</strong>–
                <strong>{Math.min(startIdx + pageSize, totalEntries)}</strong> dari{' '}
                <strong>{totalEntries}</strong> entri
              </>
            )}
          </div>

          <div className="sppd__pagination">
            <button
              type="button"
              className="sppd__page-nav"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={15} />
              <span className="sppd__nav-text">Sebelumnya</span>
            </button>

            <div className="sppd__page-numbers">
              {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="sppd__page-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`sppd__page-num ${currentPage === p ? 'is-active' : ''}`}
                    onClick={() => setPage(Number(p))}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="sppd__page-nav"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Halaman berikutnya"
            >
              <span className="sppd__nav-text">Berikutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Lengkap SPPD (Muncul Saat Baris Diklik) */}
      {detailModalRow && (
        <div className="sppd__modal-backdrop" onClick={() => setDetailModalRow(null)}>
          <div className="sppd__modal sppd__modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <div className="sppd__modal-header-title">
                <Plane size={18} />
                <h3>Detail Surat Perintah Perjalanan Dinas {detailModalRow.kodeSppd ? `#${detailModalRow.kodeSppd}` : ''}</h3>
              </div>
              <button
                type="button"
                className="sppd__modal-close"
                onClick={() => setDetailModalRow(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sppd__detail-body">
              {/* Top Status & Code Banner */}
              <div className="sppd__detail-top">
                <div className="sppd__detail-ident">
                  <span className="sppd__detail-kode">{detailModalRow.kodeSppd || '-'}</span>
                  <span className="sppd__chip sppd__chip--jenis">{detailModalRow.jenis}</span>
                  <span
                    className={`sppd__badge ${
                      detailModalRow.status === STATUS_DIBUAT ? 'sppd__badge--pending' : 'sppd__badge--success'
                    }`}
                  >
                    {detailModalRow.status}
                  </span>
                </div>
                <StatusPersetujuanBadge status={detailModalRow.statusPersetujuan} />
              </div>

              {/* Detail Items Grid */}
              <div className="sppd__detail-grid">
                <div className="sppd__detail-item">
                  <span className="sppd__detail-label">Tujuan Perjalanan</span>
                  <div className="sppd__detail-val">
                    <MapPin size={13} />
                    <span>{detailModalRow.tujuan || '-'}</span>
                  </div>
                </div>

                <div className="sppd__detail-item">
                  <span className="sppd__detail-label">Transportasi</span>
                  <div className="sppd__detail-val">
                    <Car size={13} />
                    <span>{detailModalRow.kendaraan || '-'}</span>
                  </div>
                </div>

                <div className="sppd__detail-item">
                  <span className="sppd__detail-label">Tanggal Berangkat</span>
                  <div className="sppd__detail-val sppd__detail-val--date">
                    <Calendar size={13} />
                    <span>{formatTanggal(detailModalRow.tglBerangkat)}</span>
                  </div>
                </div>

                <div className="sppd__detail-item">
                  <span className="sppd__detail-label">Tanggal Pulang</span>
                  <div className="sppd__detail-val sppd__detail-val--date">
                    <Calendar size={13} />
                    <span>{formatTanggal(detailModalRow.tglPulang)} ({hitungHariPerjalanan(detailModalRow.tglBerangkat, detailModalRow.tglPulang)})</span>
                  </div>
                </div>

                <div className="sppd__detail-item sppd__detail-item--full">
                  <span className="sppd__detail-label">Daftar Anggota / Peserta Perjalanan</span>
                  <div className="sppd__detail-box">
                    {detailModalRow.namaKaryawan?.length ? (
                      <ul className="sppd__detail-peserta-list">
                        {detailModalRow.namaKaryawan.map((nama, idx) => (
                          <li key={idx}>
                            <b>{nama}</b> {detailModalRow.tugas?.[idx] ? `— ${detailModalRow.tugas[idx]}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="sppd__dash">Belum ada rincian peserta.</span>
                    )}
                  </div>
                </div>

                <div className="sppd__detail-item sppd__detail-item--full">
                  <span className="sppd__detail-label">Keterangan / Tujuan Tugas</span>
                  <div className="sppd__detail-box">
                    {detailModalRow.keterangan ? (
                      <p className="sppd__detail-desc">{detailModalRow.keterangan}</p>
                    ) : (
                      <span className="sppd__dash">Tidak ada keterangan tambahan.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sppd__modal-footer sppd__detail-footer">
              <div className="sppd__detail-actions-left">
                {((detailModalRow.statusPersetujuan ?? '').toLowerCase().includes('setuju') || (detailModalRow.status ?? '').toLowerCase().includes('setuju') || detailModalRow.status !== STATUS_DIBUAT) && detailModalRow.kodeSppd && (
                  <button
                    type="button"
                    className="sppd__btn-outline sppd__btn-outline--print"
                    onClick={() => handlePrint(detailModalRow)}
                    title="Cetak SPPD"
                  >
                    <Printer size={14} /> <span>Cetak Dokumen</span>
                  </button>
                )}
                {detailModalRow.fotoUrl && (
                  <button
                    type="button"
                    className="sppd__btn-outline sppd__btn-outline--photo"
                    onClick={() => viewBukti(detailModalRow)}
                    title="Lihat Foto Bukti"
                  >
                    <Camera size={14} /> <span>Foto Lokasi</span>
                  </button>
                )}
                <button
                  type="button"
                  className="sppd__btn-outline sppd__btn-outline--peserta"
                  onClick={() => {
                    const row = detailModalRow
                    const bolehUbah = row.peranSaya === 'Pembuat'
                    setDetailModalRow(null)
                    openDetail(row, bolehUbah)
                  }}
                  title="Kelola Peserta"
                >
                  <ListChecks size={14} /> <span>Kelola Peserta</span>
                </button>
              </div>
              <button
                type="button"
                className="sppd__btn-secondary"
                onClick={() => setDetailModalRow(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Pengajuan / Edit SPPD */}
      {modalOpen && (
        <div className="sppd__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="sppd__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <div className="sppd__modal-header-title">
                <Plane size={18} />
                <h3>{editing ? `Ubah SPPD #${editing.kodeSppd}` : 'Ajukan SPPD Baru'}</h3>
              </div>
              <button
                type="button"
                className="sppd__modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form className="sppd__modal-body" onSubmit={handleSubmit}>
              <div className="sppd__modal-grid">
                <label className="sppd__field">
                  <span>Tanggal Berangkat *</span>
                  <input
                    type="date"
                    value={form.tglBerangkat}
                    onChange={(e) => updateField('tglBerangkat', e.target.value)}
                    required
                  />
                </label>

                <label className="sppd__field">
                  <span>Tanggal Pulang *</span>
                  <input
                    type="date"
                    value={form.tglPulang}
                    min={form.tglBerangkat}
                    onChange={(e) => updateField('tglPulang', e.target.value)}
                    required
                  />
                </label>

                <label className="sppd__field">
                  <span>Cakupan Lokasi *</span>
                  <select value={form.jenis} onChange={(e) => updateField('jenis', e.target.value)}>
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sppd__field">
                  <span>Transportasi *</span>
                  <select value={form.kendaraan} onChange={(e) => updateField('kendaraan', e.target.value)}>
                    {KENDARAAN_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sppd__field sppd__field--full">
                  <span>Tujuan Lokasi SPPD *</span>
                  <input
                    type="text"
                    value={form.tujuan}
                    maxLength={255}
                    placeholder="mis. Kantor Cabang Bandung, Jawa Barat"
                    onChange={(e) => updateField('tujuan', e.target.value)}
                    required
                  />
                </label>

                <label className="sppd__field sppd__field--full">
                  <span>Keterangan Tugas / Keperluan *</span>
                  <textarea
                    rows={3}
                    value={form.keterangan}
                    maxLength={254}
                    placeholder="Tuliskan rincian tugas dan agenda perjalanan dinas..."
                    onChange={(e) => updateField('keterangan', e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="sppd__hint-card">
                <Info size={15} />
                <span>
                  SPPD hanya untuk perjalanan dinas jarak jauh <b>lebih dari 150 km (PP)</b>. Perjalanan dinas di bawah jarak tersebut diajukan melalui modul <b>UMDL</b>.
                </span>
              </div>

              {editing && editing.fotoUrl && !form.bukti && (
                <div className="sppd__hint-card sppd__hint-card--info">
                  <Camera size={15} />
                  <span>Foto bukti dinas sebelumnya sudah tersimpan. Ambil foto baru di bawah hanya bila ingin menggantinya.</span>
                </div>
              )}

              <DinasKameraCapture value={form.bukti} onChange={(v) => setForm((p) => ({ ...p, bukti: v }))} />

              {formError && <div className="sppd__error">{formError}</div>}

              <div className="sppd__modal-footer">
                {editing && (
                  <button
                    type="button"
                    className="sppd__btn-secondary"
                    onClick={() => handlePrint(editing)}
                  >
                    <Printer size={15} /> <span>Cetak</span>
                  </button>
                )}
                <button
                  type="button"
                  className="sppd__btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="sppd__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan & Kelola Peserta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rincian Peserta */}
      {detailFor && (
        <div className="sppd__modal-backdrop" onClick={() => setDetailFor(null)}>
          <div className="sppd__modal sppd__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <div className="sppd__modal-header-title">
                <Users size={18} />
                <h3>Kelola Peserta SPPD #{detailFor.kodeSppd}</h3>
              </div>
              <button
                type="button"
                className="sppd__modal-close"
                onClick={() => setDetailFor(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {!detailBolehUbah && (
              <div className="sppd__hint-card sppd__hint-card--info" style={{ margin: '14px 18px 0' }}>
                <Info size={15} />
                <span>Anda terdaftar sebagai peserta pada SPPD ini (bukan pembuat) — daftar peserta di bawah bersifat hanya-baca (*read-only*).</span>
              </div>
            )}

            {detailBolehUbah && (
              <form className="sppd__modal-body sppd__peserta-form" onSubmit={handleSubmitPeserta}>
                <div className="sppd__modal-grid">
                  <label className="sppd__field">
                    <span>Pilih Pegawai *</span>
                    <div className="sppd__nik-picker">
                      <input
                        type="text"
                        value={pesertaForm.nama ? `${pesertaForm.nik} - ${pesertaForm.nama}` : ''}
                        placeholder="Klik tombol cari untuk memilih..."
                        readOnly
                      />
                      {!editingPeserta && (
                        <button
                          type="button"
                          className="sppd__picker-btn"
                          onClick={openPicker}
                          title="Cari Pegawai"
                        >
                          <Search size={15} />
                        </button>
                      )}
                    </div>
                  </label>

                  <label className="sppd__field">
                    <span>Posisi Tim *</span>
                    <select
                      value={pesertaForm.posisi}
                      onChange={(e) => setPesertaForm((p) => ({ ...p, posisi: e.target.value }))}
                    >
                      {POSISI_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="sppd__field sppd__field--full">
                    <span>Rincian Tugas yang Dilaksanakan *</span>
                    <textarea
                      rows={2}
                      value={pesertaForm.tugas}
                      maxLength={500}
                      placeholder="Tuliskan peran dan tugas spesifik peserta ini dalam dinas..."
                      onChange={(e) => setPesertaForm((p) => ({ ...p, tugas: e.target.value }))}
                      required
                    />
                  </label>
                </div>

                {pesertaError && <div className="sppd__error">{pesertaError}</div>}

                <div className="sppd__modal-footer sppd__peserta-form-foot">
                  {editingPeserta && (
                    <button type="button" className="sppd__btn-secondary" onClick={resetPesertaForm}>
                      Batal Ubah
                    </button>
                  )}
                  <button type="submit" className="sppd__submit">
                    {editingPeserta ? (
                      <>
                        <Pencil size={14} /> <span>Simpan Perubahan Peserta</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> <span>Tambahkan ke SPPD</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Tabel Daftar Peserta */}
            <div className="sppd__peserta-table-wrap">
              <table className="sppd__table sppd__table--peserta">
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>Posisi</th>
                    <th style={{ width: '18%' }}>NIK</th>
                    <th style={{ width: '25%' }}>Nama</th>
                    <th style={{ width: '32%' }}>Tugas</th>
                    {detailBolehUbah && <th style={{ width: '10%' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {peserta.length === 0 ? (
                    <tr>
                      <td colSpan={detailBolehUbah ? 5 : 4} className="sppd__no-data">
                        Belum ada peserta terdaftar. Tambahkan minimal 1 peserta agar SPPD dapat dicetak.
                      </td>
                    </tr>
                  ) : (
                    peserta.map((p) => (
                      <tr key={p.idDet} className={editingPeserta?.idDet === p.idDet ? 'sppd__row--editing' : undefined}>
                        <td>
                          <span
                            className={`sppd__badge ${
                              p.posisi === 'Ketua' ? 'sppd__badge--primary' : 'sppd__badge--neutral'
                            } sppd__badge--sm`}
                          >
                            {p.posisi}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.nik}</td>
                        <td>
                          <b>{p.nama ?? '-'}</b>
                        </td>
                        <td>{p.tugas}</td>
                        {detailBolehUbah && (
                          <td>
                            <div className="sppd__row-actions">
                              <button
                                type="button"
                                className="sppd__row-btn sppd__row-btn--edit"
                                onClick={() => openEditPeserta(p)}
                                title="Ubah peserta"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="sppd__row-btn sppd__row-btn--delete"
                                onClick={() => handleDeletePeserta(p.idDet)}
                                title="Hapus peserta"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="sppd__modal-footer">
              <button
                type="button"
                className="sppd__btn-secondary"
                onClick={() => setDetailFor(null)}
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Picker Pegawai */}
      {pickerOpen && (
        <div className="sppd__modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="sppd__modal sppd__modal--picker" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <div className="sppd__modal-header-title">
                <Users size={18} />
                <h3>Pilih Pegawai</h3>
              </div>
              <button
                type="button"
                className="sppd__modal-close"
                onClick={() => setPickerOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sppd__modal-body" style={{ paddingBottom: '8px' }}>
              <div className="sppd__search-box" style={{ maxWidth: 'none' }}>
                <Search size={15} className="sppd__search-icon" />
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => runPicker(e.target.value)}
                  placeholder="Ketik NIK, nama, atau unit kerja pegawai..."
                  autoFocus
                />
              </div>
            </div>

            <div className="sppd__picker-table-wrap">
              <table className="sppd__table sppd__table--picker">
                <thead>
                  <tr>
                    <th>NIK</th>
                    <th>Nama</th>
                    <th>Wilayah</th>
                    <th>Unit Kerja</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Pilih</th>
                  </tr>
                </thead>
                <tbody>
                  {pickerRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="sppd__no-data">
                        Tidak ada data pegawai yang sesuai pencarian.
                      </td>
                    </tr>
                  ) : (
                    pickerRows.map((p) => (
                      <tr key={p.nik} className="sppd__row--picker" onClick={() => pickPegawai(p)}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.nik}</td>
                        <td>
                          <b>{p.nama}</b>
                        </td>
                        <td>{p.wilayah || '-'}</td>
                        <td>{p.unitKerja || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="sppd__row-btn sppd__row-btn--pick"
                            onClick={(e) => {
                              e.stopPropagation()
                              pickPegawai(p)
                            }}
                            title="Pilih pegawai ini"
                          >
                            <Check size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Bukti Foto Dinas */}
      {buktiPreview && (
        <div className="sppd__modal-backdrop" onClick={closeBuktiPreview}>
          <div className="sppd__modal sppd__modal--photo" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <div className="sppd__modal-header-title">
                <Camera size={18} />
                <h3>Foto Bukti Lokasi Dinas</h3>
              </div>
              <button
                type="button"
                className="sppd__modal-close"
                onClick={closeBuktiPreview}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <div className="sppd__modal-body" style={{ textAlign: 'center', padding: '16px' }}>
              <img
                src={buktiPreview.url}
                alt="Foto bukti lokasi dinas"
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
