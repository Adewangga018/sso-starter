import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Check, Pencil, Plus, RotateCw, Search, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './UmdlPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'umdl__col-status' },
  { key: 'tglUmdl', label: 'Tgl UMDL', className: 'umdl__col-tgl' },
  { key: 'kodeUmdl', label: 'Kode UMDL', className: 'umdl__col-kode' },
  { key: 'keterangan', label: 'Keterangan', className: 'umdl__col-ket' },
]

const FILTER_PLACEHOLDER = 'Cari kode UMDL, kode izin, atau keterangan...'

const pad = (n) => String(n).padStart(2, '0')

function formatTanggal(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

function formatJam(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const emptyForm = { idIjin: null, kodeIjin: '', tglUmdl: '', keterangan: '' }

export default function UmdlPage() {
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('dibuat')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'tglUmdl', direction: 'desc' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRows, setPickerRows] = useState([])
  const [pickerError, setPickerError] = useState('')

  async function load() {
    try {
      const data = await api.getUmdl()
      setRows(data.items)
      setLoadError('')
    } catch (err) {
      if (isEmptyDataError(err)) {
        setRows([])
        setLoadError('')
        return
      }
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data UMDL.')
    }
  }

  useEffect(() => {
    load()
  }, [])

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
      [r.status, r.kodeUmdl, r.kodeIjin, r.keterangan, r.source]
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
      if (key === 'tglUmdl') {
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
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      idIjin: null,
      kodeIjin: row.kodeIjin ?? '',
      tglUmdl: isoDate(new Date(row.tglUmdl)),
      keterangan: row.keterangan ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function openPicker() {
    setPickerOpen(true)
    setPickerError('')
    try {
      const hasil = await api.cariIjinUmdl()
      setPickerRows(hasil)
    } catch (err) {
      setPickerRows([])
      setPickerError(err instanceof ApiError ? err.message : 'Gagal memuat surat izin.')
    }
  }

  // Tanggal UMDL mengikuti tanggal izinnya - itu hari saat dinas luar benar-benar terjadi.
  function pickIjin(izin) {
    setForm((prev) => ({
      ...prev,
      idIjin: izin.idIjin,
      kodeIjin: izin.kodeIjin,
      tglUmdl: isoDate(new Date(izin.tglIjin)),
      keterangan: prev.keterangan || izin.keterangan || '',
    }))
    setPickerOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!editing && !form.idIjin) {
      setFormError('Pilih surat izin terlebih dahulu.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        idIjin: form.idIjin ?? 0,
        tglUmdl: form.tglUmdl,
        keterangan: form.keterangan,
      }
      if (editing) {
        await api.updateUmdl(editing.id, payload)
      } else {
        await api.createUmdl(payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan UMDL.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!confirm(`Hapus UMDL ${row.kodeUmdl}?`)) return
    try {
      await api.deleteUmdl(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus UMDL.')
    }
  }

  if (loadError && !rows) {
    return <div className="umdl__empty">{loadError}</div>
  }

  if (!rows) {
    return <div className="umdl__empty">Memuat data UMDL...</div>
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="umdl">
      <h2 className="umdl__page-title">Uang Makan Dinas Luar</h2>

      <div className="umdl__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`umdl__tab${tab === t.key ? ' umdl__tab--active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="umdl__actionbar">
        <div className="umdl__filter">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={FILTER_PLACEHOLDER}
          />
          <span className="umdl__filter-icon">
            <Search size={16} />
          </span>
        </div>
        <div className="umdl__actionbar-buttons">
          {isDibuatTab && (
            <button type="button" className="umdl__icon-btn umdl__icon-btn--add" onClick={openCreate} title="Ajukan UMDL">
              <Plus size={18} />
            </button>
          )}
          <button type="button" className="umdl__icon-btn umdl__icon-btn--refresh" onClick={load} title="Muat ulang">
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      <div className="umdl__card">
        {loadError && <div className="umdl__error">{loadError}</div>}

        <div className="umdl__toolbar">
          <label className="umdl__page-size">
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

          <label className="umdl__search">
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

        <div className="umdl__table-wrap">
          <table className="umdl__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`${col.className} umdl__th--sortable`} onClick={() => toggleSort(col.key)}>
                    <span className="umdl__th-content">
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="umdl__sort-icon--idle" />
                      )}
                    </span>
                  </th>
                ))}
                {isDibuatTab && <th className="umdl__col-aksi">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + (isDibuatTab ? 1 : 0)} className="umdl__no-data">
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id}>
                  <td className="umdl__col-status">
                    <span className={`umdl__status${row.status === STATUS_DIBUAT ? '' : ' umdl__status--done'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="umdl__col-tgl">{formatTanggal(row.tglUmdl)}</td>
                  <td className="umdl__col-kode">
                    <div>{row.kodeUmdl}</div>
                    {row.kodeIjin && <div className="umdl__source">Izin: {row.kodeIjin}</div>}
                  </td>
                  <td className="umdl__col-ket">{row.keterangan}</td>
                  {isDibuatTab && (
                    <td className="umdl__col-aksi">
                      <div className="umdl__row-actions">
                        <button type="button" className="umdl__row-btn umdl__row-btn--edit" onClick={() => openEdit(row)} title="Ubah">
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="umdl__row-btn umdl__row-btn--delete" onClick={() => handleDelete(row)} title="Hapus">
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

        <div className="umdl__footer">
          <div>
            {totalEntries === 0
              ? 'Menampilkan 0 entri'
              : `Menampilkan ${startIdx + 1} sampai ${Math.min(startIdx + pageSize, totalEntries)} dari ${totalEntries} entri`}
          </div>
          <div className="umdl__pagination">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Sebelumnya
            </button>
            <span className="umdl__page-indicator">{currentPage}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="umdl__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="umdl__modal" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <h3>{editing ? `UMDL # ${editing.kodeUmdl}` : 'Ajukan UMDL'}</h3>
              <button type="button" className="umdl__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="umdl__modal-body" onSubmit={handleSubmit}>
              <label className="umdl__field">
                <span>No. Surat Ijin</span>
                <div className="umdl__nik">
                  <input type="text" value={form.kodeIjin} placeholder="Pilih surat izin..." readOnly />
                  {/* Surat izin asal tidak bisa diganti saat mengubah: izin itulah yang
                      menentukan hak uang makannya. */}
                  {!editing && (
                    <button type="button" onClick={openPicker} title="Cari data surat ijin">
                      <Search size={16} />
                    </button>
                  )}
                </div>
              </label>

              <label className="umdl__field">
                <span>Tgl UMDL</span>
                <input
                  type="date"
                  value={form.tglUmdl}
                  onChange={(e) => setForm((p) => ({ ...p, tglUmdl: e.target.value }))}
                  required
                />
              </label>

              <label className="umdl__field umdl__field--textarea">
                <span>Keterangan</span>
                <textarea
                  rows={3}
                  value={form.keterangan}
                  maxLength={254}
                  onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))}
                />
              </label>

              <div className="umdl__window-hint">
                UMDL hanya bisa diajukan dari surat izin berjenis <b>Meninggalkan Pekerjaan</b> dengan
                kepentingan <b>Dinas</b>. Satu surat izin hanya bisa dipakai sekali.
              </div>

              {formError && <div className="umdl__error">{formError}</div>}

              <div className="umdl__modal-footer">
                <button type="submit" className="umdl__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="umdl__modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="umdl__modal umdl__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <h3>Cari Data Surat Ijin</h3>
              <button type="button" className="umdl__modal-close" onClick={() => setPickerOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <div className="umdl__peserta">
              {pickerError && <div className="umdl__error">{pickerError}</div>}

              <table className="umdl__table umdl__table--peserta">
                <thead>
                  <tr>
                    <th>Kode Ijin</th>
                    <th>Kepentingan</th>
                    <th>Keterangan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pickerRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="umdl__no-data">
                        Tidak ada surat izin yang memenuhi syarat. Izin harus berjenis &quot;Meninggalkan
                        Pekerjaan&quot; dengan kepentingan &quot;Dinas&quot; dan belum dipakai untuk UMDL lain.
                      </td>
                    </tr>
                  )}
                  {pickerRows.map((i) => (
                    <tr key={i.idIjin}>
                      <td>
                        <div>{i.kodeIjin}</div>
                        <div className="umdl__source">{formatTanggal(i.tglIjin)}</div>
                      </td>
                      <td>
                        <div>{i.kepentinganIjin}</div>
                        <div>{i.jenisIjin}</div>
                        <div className="umdl__source">
                          jam : {formatJam(i.tglIjin)} s.d {formatJam(i.jamSelesai)}
                        </div>
                      </td>
                      <td>{i.keterangan}</td>
                      <td>
                        <button
                          type="button"
                          className="umdl__row-btn umdl__row-btn--pick"
                          onClick={() => pickIjin(i)}
                          title="Pilih surat izin ini"
                        >
                          <Check size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
