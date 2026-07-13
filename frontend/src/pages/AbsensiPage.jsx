import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './AbsensiPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const COLUMNS = [
  { key: 'tanggal', label: 'Tanggal', className: 'absensi__col-tanggal' },
  { key: 'namaHari', label: 'Hari', className: 'absensi__col-hari' },
  { key: 'checkIn', label: 'Jam Masuk', className: 'absensi__col-jam' },
  { key: 'checkOut', label: 'Jam Keluar', className: 'absensi__col-jam' },
  { key: 'catatanMangkir', label: 'Keterangan', sortable: false, className: 'absensi__col-ket' },
]

function isWeekend(namaHari) {
  const v = (namaHari ?? '').trim().toLowerCase()
  return v === 'sabtu' || v === 'minggu'
}

function formatTanggal(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${date.getFullYear()}`
}

export default function AbsensiPage() {
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'tanggal', direction: 'desc' })

  useEffect(() => {
    let cancelled = false
    api
      .getAbsensi()
      .then((data) => {
        if (cancelled) return
        const withSeq = data.map((row, idx) => ({ ...row, _seq: data.length - idx }))
        setRows(withSeq)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data absensi.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      [formatTanggal(r.tanggal), r.namaHari, r.checkIn, r.checkOut, r.catatanMangkir]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const { key, direction } = sort
    const dir = direction === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let av = a[key]
      let bv = b[key]
      if (key === 'tanggal') {
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

  function toggleSort(key, sortable) {
    if (sortable === false) return
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  function handleSearchChange(value) {
    setSearch(value)
    setPage(1)
  }

  function handlePageSizeChange(value) {
    setPageSize(Number(value))
    setPage(1)
  }

  if (loadError) {
    return <div className="absensi__empty">{loadError}</div>
  }

  if (!rows) {
    return <div className="absensi__empty">Memuat data absensi...</div>
  }

  return (
    <div className="absensi">
      <div className="absensi__card">
        <div className="absensi__section-title">Log Absensi</div>

        <div className="absensi__toolbar">
          <label className="absensi__page-size">
            Tampilkan
            <select value={pageSize} onChange={(e) => handlePageSizeChange(e.target.value)}>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            entri
          </label>

          <label className="absensi__search">
            Cari:
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari log absensi..."
            />
          </label>
        </div>

        <div className="absensi__table-wrap">
          <table className="absensi__table">
            <thead>
              <tr>
                <th className="absensi__col-num">No</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.className}${col.sortable === false ? '' : ' absensi__th--sortable'}`}
                    onClick={() => toggleSort(col.key, col.sortable)}
                  >
                    <span className="absensi__th-content">
                      {col.label}
                      {col.sortable !== false &&
                        (sort.key === col.key ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp size={13} />
                          ) : (
                            <ArrowDown size={13} />
                          )
                        ) : (
                          <ArrowUpDown size={13} className="absensi__sort-icon--idle" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="absensi__no-data">
                    Tidak ada data yang cocok.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => {
                const weekend = isWeekend(row.namaHari)
                const hasCatatan = Boolean((row.catatanMangkir ?? '').trim())
                return (
                  <tr key={`${row.tanggal}-${row._seq}`}>
                    <td>{row._seq}.</td>
                    <td>
                      {weekend ? (
                        <span className="absensi__badge absensi__badge--red">{formatTanggal(row.tanggal)}</span>
                      ) : (
                        formatTanggal(row.tanggal)
                      )}
                    </td>
                    <td>
                      {weekend ? (
                        <span className="absensi__badge absensi__badge--red absensi__badge--hari">
                          {row.namaHari}
                        </span>
                      ) : (
                        row.namaHari ?? '-'
                      )}
                    </td>
                    <td>
                      {weekend ? (
                        <span className="absensi__badge absensi__badge--red">{row.checkIn ?? '-'}</span>
                      ) : (
                        row.checkIn ?? '-'
                      )}
                    </td>
                    <td>
                      {weekend ? (
                        <span className="absensi__badge absensi__badge--red">{row.checkOut ?? '-'}</span>
                      ) : hasCatatan ? (
                        <span className="absensi__badge absensi__badge--yellow">{row.checkOut ?? '-'}</span>
                      ) : (
                        row.checkOut ?? '-'
                      )}
                    </td>
                    <td className="absensi__col-ket">
                      {hasCatatan && (
                        <span className="absensi__badge absensi__badge--yellow">{row.catatanMangkir}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="absensi__footer">
          <div className="absensi__footer-info">
            {totalEntries === 0
              ? 'Menampilkan 0 entri'
              : `Menampilkan ${startIdx + 1} sampai ${Math.min(startIdx + pageSize, totalEntries)} dari ${totalEntries} entri`}
          </div>
          <div className="absensi__pagination">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Sebelumnya
            </button>
            <span className="absensi__page-indicator">
              {currentPage} / {totalPages}
            </span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
