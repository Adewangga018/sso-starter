import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import { ArrowUp, ArrowDown, ArrowUpDown, ListChecks, Pencil, Plus, Printer, RotateCw, Search, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './TiketPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Sesuai pilihan jenis tiket di EASy - backend menolak nilai lain.
const JENIS_OPTIONS = ['Bus', 'Hotel', 'Kapal Laut', 'Kereta Api', 'Pesawat']

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'tiket__col-status' },
  { key: 'tglInput', label: 'Tgl Input', className: 'tiket__col-tgl' },
  { key: 'kodeTiket', label: 'Kode Tiket', className: 'tiket__col-kode' },
  { key: 'pemesanan', label: 'Pemesanan', className: 'tiket__col-pesan' },
  { key: 'keterangan', label: 'Keterangan', className: 'tiket__col-ket' },
  { key: 'source', label: 'Sumber Data', className: 'tiket__col-source' },
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

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [keterangan, setKeterangan] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Rincian hanya bisa ditambahkan setelah pemesanannya ada: baris rincian mengacu ke id-nya.
  const [detailFor, setDetailFor] = useState(null)
  const [rincian, setRincian] = useState([])
  const [rincianForm, setRincianForm] = useState(emptyRincian)
  const [rincianError, setRincianError] = useState('')

  // Rincian yang sedang diubah; null berarti form dipakai untuk menambah baris baru.
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
        // Tanpa rincian, pemesanan tidak bisa dicetak - jadi langsung buka rinciannya.
        openDetail(created)
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan pemesanan tiket.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!(await dialog.confirm({ title: 'Hapus Tiket', message: `Hapus pemesanan tiket ${row.kodeTiket}? Seluruh rinciannya ikut terhapus.`, danger: true, confirmText: 'Hapus' }))) return
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

  // Form yang sama dipakai untuk menambah dan mengubah - membuat form kedua hanya akan
  // menduplikasi validasi dan aturan tanggalnya.
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
      // Kalau baris yang dihapus sedang diubah, form harus dikosongkan - kalau tidak,
      // menyimpan akan menembak baris yang sudah tidak ada.
      if (editingRincian?.idDet === idDet) resetRincianForm()
      await load()
    } catch (err) {
      setRincianError(err instanceof ApiError ? err.message : 'Gagal menghapus rincian.')
    }
  }

  function updateRincian(key, value) {
    setRincianForm((prev) => {
      const next = { ...prev, [key]: value }
      // Tanggal OUT tidak boleh mendahului tanggal IN.
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
    return <div className="tiket__empty">{loadError}</div>
  }

  if (!rows) {
    return <div className="tiket__empty">Memuat data pemesanan tiket...</div>
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="tiket">
      <h2 className="tiket__page-title">Pemesanan Tiket</h2>

      <div className="tiket__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tiket__tab${tab === t.key ? ' tiket__tab--active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tiket__actionbar">
        <div className="tiket__filter">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={FILTER_PLACEHOLDER}
          />
          <span className="tiket__filter-icon">
            <Search size={16} />
          </span>
        </div>
        <div className="tiket__actionbar-buttons">
          {isDibuatTab && (
            <button type="button" className="tiket__icon-btn tiket__icon-btn--add" onClick={openCreate} title="Ajukan pemesanan tiket">
              <Plus size={18} />
            </button>
          )}
          <button type="button" className="tiket__icon-btn tiket__icon-btn--refresh" onClick={load} title="Muat ulang">
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      <div className="tiket__card">
        {loadError && <div className="tiket__error">{loadError}</div>}

        <div className="tiket__toolbar">
          <label className="tiket__page-size">
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

          <label className="tiket__search">
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

        <div className="tiket__table-wrap">
          <table className="tiket__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`${col.className} tiket__th--sortable`} onClick={() => toggleSort(col.key)}>
                    <span className="tiket__th-content">
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="tiket__sort-icon--idle" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="tiket__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="tiket__no-data">
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {/* data-label pada tiap <td> dipakai CSS (@media max-width: 720px)
                  sebagai judul baris ketika tabel berubah menjadi kartu bertumpuk
                  di ponsel - di lebar itu <thead> disembunyikan. */}
              {pageRows.map((row) => (
                <tr key={row.id}>
                  <td className="tiket__col-status" data-label="Status">
                    <span className={`tiket__status${row.status === STATUS_DIBUAT ? '' : ' tiket__status--done'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="tiket__col-tgl" data-label="Tgl Input">{formatTanggal(row.tglInput)}</td>
                  <td className="tiket__col-kode" data-label="Kode Tiket">{row.kodeTiket}</td>
                  <td className="tiket__col-pesan" data-label="Pemesanan">
                    {row.pemesanan?.length ? (
                      <ol className="tiket__list">
                        {row.pemesanan.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ol>
                    ) : (
                      <span className="tiket__source">Belum ada rincian</span>
                    )}
                  </td>
                  <td className="tiket__col-ket" data-label="Keterangan">{row.keterangan}</td>
                  <td className="tiket__col-source" data-label="Sumber Data">{row.source}</td>
                  <td className="tiket__col-aksi" data-label="Aksi">
                    <div className="tiket__row-actions">
                      <button
                        type="button"
                        className="tiket__row-btn tiket__row-btn--print"
                        onClick={() => handlePrint(row)}
                        title="Cetak pemesanan tiket"
                      >
                        <Printer size={15} />
                      </button>
                      {isDibuatTab && (
                        <>
                          <button
                            type="button"
                            className="tiket__row-btn tiket__row-btn--detail"
                            onClick={() => openDetail(row)}
                            title="Rincian pemesanan"
                          >
                            <ListChecks size={15} />
                          </button>
                          <button type="button" className="tiket__row-btn tiket__row-btn--edit" onClick={() => openEdit(row)} title="Ubah">
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="tiket__row-btn tiket__row-btn--delete" onClick={() => handleDelete(row)} title="Hapus">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tiket__footer">
          <div>
            {totalEntries === 0
              ? 'Menampilkan 0 entri'
              : `Menampilkan ${startIdx + 1} sampai ${Math.min(startIdx + pageSize, totalEntries)} dari ${totalEntries} entri`}
          </div>
          <div className="tiket__pagination">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Sebelumnya
            </button>
            <span className="tiket__page-indicator">{currentPage}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="tiket__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="tiket__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tiket__modal-header">
              <h3>{editing ? `Pemesanan Tiket # ${editing.kodeTiket}` : 'Ajukan Pemesanan Tiket'}</h3>
              <button type="button" className="tiket__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="tiket__modal-body" onSubmit={handleSubmit}>
              <label className="tiket__field tiket__field--textarea">
                <span>Keterangan</span>
                <textarea
                  rows={4}
                  value={keterangan}
                  maxLength={254}
                  onChange={(e) => setKeterangan(e.target.value)}
                  required
                />
              </label>

              {formError && <div className="tiket__error">{formError}</div>}

              <div className="tiket__modal-footer">
                <button type="submit" className="tiket__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailFor && (
        <div className="tiket__modal-backdrop" onClick={() => setDetailFor(null)}>
          <div className="tiket__modal tiket__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="tiket__modal-header">
              <h3>Rincian Pemesanan Tiket # {detailFor.kodeTiket}</h3>
              <button type="button" className="tiket__modal-close" onClick={() => setDetailFor(null)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="tiket__modal-body" onSubmit={handleSubmitRincian}>
              <label className="tiket__field">
                <span>Jenis Tiket</span>
                <select value={rincianForm.jenisTiket} onChange={(e) => updateRincian('jenisTiket', e.target.value)}>
                  {JENIS_OPTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </label>

              <label className="tiket__field">
                <span>Tgl Tiket IN</span>
                <input
                  type="date"
                  value={rincianForm.tglIn}
                  onChange={(e) => updateRincian('tglIn', e.target.value)}
                  required
                />
              </label>

              <label className="tiket__field">
                <span>Tgl Tiket OUT</span>
                <input
                  type="date"
                  value={rincianForm.tglOut}
                  min={rincianForm.tglIn}
                  onChange={(e) => updateRincian('tglOut', e.target.value)}
                  required
                />
              </label>

              <label className="tiket__field tiket__field--textarea">
                <span>Keterangan</span>
                <textarea
                  rows={3}
                  value={rincianForm.keterangan}
                  maxLength={254}
                  onChange={(e) => updateRincian('keterangan', e.target.value)}
                  // placeholder="Mis. rute Surabaya - Jakarta PP"
                  required
                />
              </label>

              {rincianError && <div className="tiket__error">{rincianError}</div>}

              <div className="tiket__modal-footer">
                {editingRincian && (
                  <button type="button" className="tiket__cancel" onClick={resetRincianForm}>
                    Batal
                  </button>
                )}
                <button type="submit" className="tiket__submit">
                  {editingRincian ? (
                    <>
                      <Pencil size={15} /> Simpan Perubahan
                    </>
                  ) : (
                    <>
                      <Plus size={15} /> Tambah Rincian
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="tiket__peserta">
              <table className="tiket__table tiket__table--peserta">
                <thead>
                  <tr>
                    <th>Jenis</th>
                    <th>Tgl IN</th>
                    <th>Tgl OUT</th>
                    <th>Keterangan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rincian.length === 0 && (
                    <tr>
                      <td colSpan={5} className="tiket__no-data">
                        Belum ada rincian. Pemesanan tidak bisa dicetak sebelum ada rincian.
                      </td>
                    </tr>
                  )}
                  {rincian.map((r) => (
                    <tr key={r.idDet} className={editingRincian?.idDet === r.idDet ? 'tiket__row--editing' : undefined}>
                      <td>{r.jenisTiket}</td>
                      <td>{formatTanggal(r.tglIn)}</td>
                      <td>{formatTanggal(r.tglOut)}</td>
                      <td>{r.keterangan}</td>
                      <td>
                        <div className="tiket__row-actions">
                          <button
                            type="button"
                            className="tiket__row-btn tiket__row-btn--edit"
                            onClick={() => openEditRincian(r)}
                            title="Ubah rincian"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="tiket__row-btn tiket__row-btn--delete"
                            onClick={() => handleDeleteRincian(r.idDet)}
                            title="Hapus rincian"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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
