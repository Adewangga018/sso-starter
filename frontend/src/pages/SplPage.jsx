import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Pencil, Plus, RotateCw, Search, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './SplPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const JENIS_OPTIONS = ['Biasa', 'Mengganti', 'Crash Program']

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'spl__col-status' },
  { key: 'kodeSpl', label: 'Kode SPL', className: 'spl__col-kode' },
  { key: 'keterangan', label: 'Keterangan', className: 'spl__col-ket' },
  { key: 'jamMulai', label: 'Jam Mulai', className: 'spl__col-jam' },
  { key: 'jamSelesai', label: 'Jam Selesai', className: 'spl__col-jam' },
  { key: 'jenisSpl', label: 'Jenis SPL', className: 'spl__col-jenis' },
]

const FILTER_PLACEHOLDER = 'Cari kode SPL, keterangan, atau jenis SPL...'

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// The API hands back a full datetime; the form edits date and time separately.
function splitDateTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function addDays(isoDate, days) {
  if (!isoDate) return ''
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const emptyForm = { mulaiTgl: '', sampaiTgl: '', jamMulai: '', jamSelesai: '', jenisSpl: 'Biasa', keterangan: '' }

export default function SplPage() {
  const [rows, setRows] = useState(null)
  const [window_, setWindow] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [tab, setTab] = useState('dibuat')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'jamMulai', direction: 'desc' })

  const [modalOpen, setModalOpen] = useState(false)
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
    if (!confirm(`Hapus SPL ${row.kodeSpl}?`)) return
    try {
      await api.deleteSpl(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus SPL.')
    }
  }

  if (loadError && !rows) {
    return <div className="spl__empty">{loadError}</div>
  }

  if (!rows) {
    return <div className="spl__empty">Memuat data SPL...</div>
  }

  const isDibuatTab = tab === 'dibuat'
  const minDate = window_?.minDate ?? ''
  const maxDate = window_?.maxDate ?? ''

  return (
    <div className="spl">
      <h2 className="spl__page-title">Surat Perintah Lembur</h2>

      <div className="spl__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`spl__tab${tab === t.key ? ' spl__tab--active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="spl__actionbar">
        <div className="spl__filter">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={FILTER_PLACEHOLDER}
          />
          <span className="spl__filter-icon">
            <Search size={16} />
          </span>
        </div>
        <div className="spl__actionbar-buttons">
          {isDibuatTab && (
            <button type="button" className="spl__icon-btn spl__icon-btn--add" onClick={openCreate} title="Ajukan SPL">
              <Plus size={18} />
            </button>
          )}
          <button type="button" className="spl__icon-btn spl__icon-btn--refresh" onClick={load} title="Muat ulang">
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      <div className="spl__card">
        {loadError && <div className="spl__error">{loadError}</div>}

        <div className="spl__toolbar">
          <label className="spl__page-size">
            Tampilkan
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            entri
          </label>

          <label className="spl__search">
            Cari:
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>

        <div className="spl__table-wrap">
          <table className="spl__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`${col.className} spl__th--sortable`} onClick={() => toggleSort(col.key)}>
                    <span className="spl__th-content">
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="spl__sort-icon--idle" />
                      )}
                    </span>
                  </th>
                ))}
                {isDibuatTab && <th className="spl__col-aksi">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + (isDibuatTab ? 1 : 0)} className="spl__no-data">
                    Tidak ada data yang cocok.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id}>
                  <td className="spl__col-status">
                    <span className={`spl__status${row.status === STATUS_DIBUAT ? '' : ' spl__status--done'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="spl__col-kode">{row.kodeSpl}</td>
                  <td className="spl__col-ket">{row.keterangan}</td>
                  <td className="spl__col-jam">{formatDateTime(row.jamMulai)}</td>
                  <td className="spl__col-jam">{formatDateTime(row.jamSelesai)}</td>
                  <td className="spl__col-jenis">
                    <div>{row.jenisSpl}</div>
                    <div className="spl__source">{row.source}</div>
                  </td>
                  {isDibuatTab && (
                    <td className="spl__col-aksi">
                      <div className="spl__row-actions">
                        <button type="button" className="spl__row-btn spl__row-btn--edit" onClick={() => openEdit(row)} title="Ubah">
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="spl__row-btn spl__row-btn--delete" onClick={() => handleDelete(row)} title="Hapus">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="spl__footer">
          <div>
            {totalEntries === 0
              ? 'Menampilkan 0 entri'
              : `Menampilkan ${startIdx + 1} sampai ${Math.min(startIdx + pageSize, totalEntries)} dari ${totalEntries} entri`}
          </div>
          <div className="spl__pagination">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Sebelumnya
            </button>
            <span className="spl__page-indicator">{currentPage}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="spl__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="spl__modal" onClick={(e) => e.stopPropagation()}>
            <div className="spl__modal-header">
              <h3>{editing ? `SPL # ${editing.kodeSpl}` : 'Ajukan SPL'}</h3>
              <button type="button" className="spl__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="spl__modal-body" onSubmit={handleSubmit}>
              <label className="spl__field">
                <span>Mulai Tgl</span>
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
                <span>Sampai Tgl</span>
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
                <span>Jam Mulai</span>
                <input
                  type="time"
                  value={form.jamMulai}
                  onChange={(e) => updateField('jamMulai', e.target.value)}
                  required
                />
              </label>

              <label className="spl__field">
                <span>Jam Selesai</span>
                <input
                  type="time"
                  value={form.jamSelesai}
                  onChange={(e) => updateField('jamSelesai', e.target.value)}
                  required
                />
              </label>

              <label className="spl__field">
                <span>Jenis SPL</span>
                <select value={form.jenisSpl} onChange={(e) => updateField('jenisSpl', e.target.value)}>
                  {JENIS_OPTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </label>

              <label className="spl__field spl__field--textarea">
                <span>Keterangan</span>
                <textarea
                  rows={3}
                  value={form.keterangan}
                  maxLength={254}
                  onChange={(e) => updateField('keterangan', e.target.value)}
                />
              </label>

              <div className="spl__window-hint">
                Tanggal lembur hanya bisa diajukan untuk hari ini atau hari sebelumnya
                {minDate && maxDate ? ` (${formatDateOnly(minDate)} s/d ${formatDateOnly(maxDate)})` : ''}.
              </div>

              {formError && <div className="spl__error">{formError}</div>}

              <div className="spl__modal-footer">
                <button type="submit" className="spl__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateOnly(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}
