import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  Smartphone,
  Calendar,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  CalendarX2,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './AbsensiPage.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

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

// Jadwal kerja standar Senin-Jumat (sama dengan GajiService.JamMasukStandar/JamPulangStandar
// di backend - dipakai di sana utk hitung Potongan Presensi "Datang Terlambat"/"Pulang Lebih
// Awal"). Dipakai di sini murni utk tampilan label "Tepat waktu", tidak memengaruhi hitungan.
const JAM_MASUK_STANDAR = '07:00'
const JAM_PULANG_STANDAR = '16:00'

function isTepatWaktu(row, weekend, hasCatatan) {
  if (weekend || hasCatatan || !row.checkIn || !row.checkOut) return false
  return formatJam(row.checkIn) <= JAM_MASUK_STANDAR && formatJam(row.checkOut) >= JAM_PULANG_STANDAR
}

// Catatan legacy (vw_web_sdm_absensi.catatan_mangkir) utk Datang Terlambat/Pulang Lebih Awal
// menyertakan nominal potongan, mis. "Datang Terlambat (Rp 25.000)" - tidak relevan buat
// karyawan lihat nominal potongannya sendiri di log ini, jadi bagian "(Rp ...)"-nya dibuang
// khusus utk tampilan (tidak mengubah data / perhitungan potongan presensi di Payroll).
function cleanCatatan(text) {
  if (!text) return text
  return text.replace(/\(\s*Rp\.?\s?[\d.,]+\s*\)/gi, '').trim()
}

function inRange(tanggal, mulai, selesai) {
  const d = new Date(tanggal).setHours(0, 0, 0, 0)
  const start = new Date(mulai).setHours(0, 0, 0, 0)
  const end = new Date(selesai).setHours(0, 0, 0, 0)
  return d >= start && d <= end
}

// Cuti Nasional/Cuti Bersama yang diinput Admin SDM (lihat CutiController - sama dgn yang
// dipakai halaman Cuti) - dicocokkan ke tanggal baris log absensi ini.
function cutiLabelFor(tanggal, cuti) {
  if (!cuti) return null
  if ((cuti.cutiNasionalList ?? []).some((c) => inRange(tanggal, c.tglMulai, c.tglSelesai))) return 'Cuti Nasional'
  if ((cuti.cutiBersamaList ?? []).some((c) => inRange(tanggal, c.tglMulai, c.tglSelesai))) return 'Cuti Bersama'
  return null
}

// "09:53:40" -> "09:53"; nilai vw yang sudah "HH:mm" dibiarkan apa adanya.
function formatJam(value) {
  if (!value) return value
  const m = String(value).match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : value
}

function formatTanggal(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${date.getFullYear()}`
}

// Bulan (1-12) & tahun sebuah baris; null bila tanggalnya tidak terbaca.
function periodeBaris(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return { bulan: date.getMonth() + 1, tahun: date.getFullYear() }
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

export default function AbsensiPage() {
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: 'tanggal', direction: 'desc' })
  // Log ditampilkan per bulan. '' pada bulan = seluruh bulan pada tahun terpilih.
  const [bulan, setBulan] = useState('')
  const [tahun, setTahun] = useState('')
  // Daftar Cuti Nasional/Cuti Bersama (Admin SDM) - dipakai utk label Keterangan; gagal
  // memuatnya bukan error fatal, label itu cuma tidak tampil.
  const [cuti, setCuti] = useState(null)

  useEffect(() => {
    api.getCuti().then(setCuti).catch(() => {})
  }, [])

  const loadRows = useCallback(() => {
    setLoadError('')
    return api
      .getAbsensi()
      .then((data) => {
        const withSeq = data.map((row, idx) => ({ ...row, _seq: data.length - idx }))
        setRows(withSeq)
      })
      .catch((err) => {
        if (isEmptyDataError(err)) {
          setRows([])
          return
        }
        setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data absensi.')
      })
  }, [])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  // Tahun yang benar-benar punya data, terbaru di atas.
  const tahunOptions = useMemo(() => {
    const set = new Set()
    for (const r of rows ?? []) {
      const p = periodeBaris(r.tanggal)
      if (p) set.add(p.tahun)
    }
    return [...set].sort((a, b) => b - a)
  }, [rows])

  // Setelah data termuat, buka pada bulan berjalan bila ada datanya; jika tidak,
  // pada bulan terbaru yang tersedia. Dijalankan sekali saja - tanpa penanda ini
  // pilihan "Semua Tahun" dari pengguna akan langsung tertimpa lagi.
  const periodeAwalDipasang = useRef(false)
  useEffect(() => {
    if (periodeAwalDipasang.current || !rows?.length) return
    const periode = rows.map((r) => periodeBaris(r.tanggal)).filter(Boolean)
    if (periode.length === 0) return
    periodeAwalDipasang.current = true
    const now = new Date()
    const adaSekarang = periode.some((p) => p.tahun === now.getFullYear() && p.bulan === now.getMonth() + 1)
    if (adaSekarang) {
      setTahun(now.getFullYear())
      setBulan(now.getMonth() + 1)
      return
    }
    const terbaru = periode.reduce((a, b) => (b.tahun > a.tahun || (b.tahun === a.tahun && b.bulan > a.bulan) ? b : a))
    setTahun(terbaru.tahun)
    setBulan(terbaru.bulan)
  }, [rows])

  const filtered = useMemo(() => {
    if (!rows) return []
    const term = search.trim().toLowerCase()
    return rows.filter((r) => {
      const p = periodeBaris(r.tanggal)
      if (tahun !== '' && p?.tahun !== Number(tahun)) return false
      if (bulan !== '' && p?.bulan !== Number(bulan)) return false
      if (!term) return true
      return [formatTanggal(r.tanggal), r.namaHari, r.checkIn, r.checkOut, r.catatanMangkir]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))
    })
  }, [rows, search, bulan, tahun])

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

  // Ringkasan statistik cepat untuk periode terpilih
  const stats = useMemo(() => {
    if (!filtered || filtered.length === 0) {
      return { total: 0, tepatWaktu: 0, catatan: 0, weekendOrCuti: 0 }
    }
    let tepatWaktu = 0
    let catatan = 0
    let weekendOrCuti = 0

    for (const row of filtered) {
      const weekend = isWeekend(row.namaHari)
      const catatanBersih = cleanCatatan(row.catatanMangkir)
      const hasCatatan = Boolean(catatanBersih)
      const cutiLabel = !hasCatatan ? cutiLabelFor(row.tanggal, cuti) : null

      if (hasCatatan) {
        catatan++
      } else if (weekend || cutiLabel) {
        weekendOrCuti++
      } else if (isTepatWaktu(row, weekend, hasCatatan)) {
        tepatWaktu++
      }
    }

    return {
      total: filtered.length,
      tepatWaktu,
      catatan,
      weekendOrCuti,
    }
  }, [filtered, cuti])

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

  function handlePeriodeChange(setter, value) {
    setter(value === '' ? '' : Number(value))
    setPage(1)
  }

  // Label periode untuk ringkasan di bawah tabel.
  const labelPeriode = tahun === ''
    ? 'seluruh periode'
    : bulan === '' ? `tahun ${tahun}` : `${BULAN[Number(bulan) - 1]} ${tahun}`

  return (
    <div className="absensi">
      {/* Banner Aplikasi Mobile */}
      <div className="absensi__card absensi__app-card">
        <div className="absensi__app-icon">
          <Smartphone size={24} />
        </div>
        <div className="absensi__app-info">
          <div className="absensi__app-header">
            <span className="absensi__app-badge">Aplikasi Resmi</span>
            <h3 className="absensi__app-title">MyGCS Absensi Mobile</h3>
          </div>
          <p className="absensi__app-desc">
            Absen masuk & keluar wajib melalui aplikasi mobile ini dengan verifikasi GPS terenkripsi dari perangkat Anda.
          </p>
        </div>
        <div className="absensi__app-actions">
          <a
            className="absensi__app-btn"
            href="https://play.google.com/store/apps/details?id=com.gresik.gcs.myabsensi"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download size={16} /> Unduh di Play Store
          </a>
          <span className="absensi__app-note">Versi iOS segera hadir lewat TestFlight.</span>
        </div>
      </div>

      {loadError ? (
        <div className="absensi__card absensi__state-card">
          <AlertCircle size={40} className="absensi__state-icon absensi__state-icon--err" />
          <h4 className="absensi__state-title">Gagal Memuat Data</h4>
          <p className="absensi__state-desc">{loadError}</p>
        </div>
      ) : !rows ? (
        <div className="absensi__card absensi__state-card">
          <div className="absensi__loading-spinner" />
          <h4 className="absensi__state-title">Memuat Data Absensi</h4>
          <p className="absensi__state-desc">Sedang mengambil riwayat kehadiran Anda...</p>
        </div>
      ) : (
        <div className="absensi__card absensi__main-card">
          {/* Header Card */}
          <div className="absensi__header">
            <div className="absensi__header-main">
              <div className="absensi__header-title-row">
                <div className="absensi__header-icon">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h2 className="absensi__title">Log Absensi & Kehadiran</h2>
                  <p className="absensi__subtitle">
                    Riwayat presensi harian untuk periode <span className="absensi__highlight">{labelPeriode}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Statistics Summary */}
          <div className="absensi__stats-grid">
            <div className="absensi__stat-card">
              <div className="absensi__stat-icon absensi__stat-icon--total">
                <CalendarDays size={18} />
              </div>
              <div className="absensi__stat-body">
                <span className="absensi__stat-label">Total Hari</span>
                <span className="absensi__stat-val">{stats.total}</span>
              </div>
            </div>

            <div className="absensi__stat-card">
              <div className="absensi__stat-icon absensi__stat-icon--ontime">
                <CheckCircle2 size={18} />
              </div>
              <div className="absensi__stat-body">
                <span className="absensi__stat-label">Tepat Waktu</span>
                <span className="absensi__stat-val absensi__stat-val--ontime">{stats.tepatWaktu}</span>
              </div>
            </div>

            <div className="absensi__stat-card">
              <div className="absensi__stat-icon absensi__stat-icon--late">
                <AlertCircle size={18} />
              </div>
              <div className="absensi__stat-body">
                <span className="absensi__stat-label">Catatan / Mangkir</span>
                <span className="absensi__stat-val absensi__stat-val--late">{stats.catatan}</span>
              </div>
            </div>

            <div className="absensi__stat-card">
              <div className="absensi__stat-icon absensi__stat-icon--holiday">
                <Calendar size={18} />
              </div>
              <div className="absensi__stat-body">
                <span className="absensi__stat-label">Akhir Pekan / Cuti</span>
                <span className="absensi__stat-val absensi__stat-val--holiday">{stats.weekendOrCuti}</span>
              </div>
            </div>
          </div>

          {/* Filter & Toolbar Controls */}
          <div className="absensi__controls">
            <div className="absensi__filters">
              <div className="absensi__select-group">
                <span className="absensi__group-label">
                  <Filter size={13} /> Filter Periode
                </span>
                <div className="absensi__select-wrap">
                  <select
                    value={bulan}
                    onChange={(e) => handlePeriodeChange(setBulan, e.target.value)}
                    aria-label="Pilih Bulan"
                  >
                    <option value="">Semua Bulan</option>
                    {BULAN.map((nama, i) => (
                      <option key={nama} value={i + 1}>
                        {nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="absensi__select-wrap">
                  <select
                    value={tahun}
                    onChange={(e) => handlePeriodeChange(setTahun, e.target.value)}
                    aria-label="Pilih Tahun"
                  >
                    <option value="">Semua Tahun</option>
                    {tahunOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="absensi__search-row">
              <div className="absensi__search-box">
                <Search size={15} className="absensi__search-icon" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Cari tanggal, hari, jam, keterangan..."
                />
                {search && (
                  <button
                    type="button"
                    className="absensi__search-clear"
                    onClick={() => handleSearchChange('')}
                    aria-label="Bersihkan pencarian"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="absensi__page-size-wrap">
                <span className="absensi__page-size-label">Baris:</span>
                <select value={pageSize} onChange={(e) => handlePageSizeChange(e.target.value)}>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabel Absensi */}
          <div className="absensi__table-wrap">
            <table className="absensi__table">
              <thead>
                <tr>
                  <th className="absensi__col-num">No</th>
                  {COLUMNS.map((col) => {
                    const isSorted = sort.key === col.key
                    return (
                      <th
                        key={col.key}
                        className={`${col.className}${col.sortable === false ? '' : ' absensi__th--sortable'} ${isSorted ? 'absensi__th--active' : ''}`}
                        onClick={() => toggleSort(col.key, col.sortable)}
                      >
                        <div className="absensi__th-content">
                          <span>{col.label}</span>
                          {col.sortable !== false && (
                            <span className="absensi__sort-indicator">
                              {isSorted ? (
                                sort.direction === 'asc' ? (
                                  <ArrowUp size={13} className="absensi__sort-icon--active" />
                                ) : (
                                  <ArrowDown size={13} className="absensi__sort-icon--active" />
                                )
                              ) : (
                                <ArrowUpDown size={13} className="absensi__sort-icon--idle" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="absensi__no-data">
                      <div className="absensi__empty-state">
                        <CalendarX2 size={36} className="absensi__empty-icon" />
                        <span className="absensi__empty-title">Tidak ada data absensi</span>
                        <span className="absensi__empty-sub">
                          Tidak ditemukan catatan absensi pada {labelPeriode}
                          {search ? ` dengan kata kunci "${search}"` : ''}.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, i) => {
                    const weekend = isWeekend(row.namaHari)
                    const catatanBersih = cleanCatatan(row.catatanMangkir)
                    const hasCatatan = Boolean(catatanBersih)
                    const cutiLabel = !hasCatatan ? cutiLabelFor(row.tanggal, cuti) : null
                    const tepatWaktu = isTepatWaktu(row, weekend, hasCatatan)

                    return (
                      <tr
                        key={`${row.tanggal}-${row._seq}`}
                        className={`absensi__row ${weekend ? 'absensi__row--weekend' : ''}`}
                      >
                        <td className="absensi__cell-num">
                          <span className="absensi__num-badge">{startIdx + i + 1}</span>
                        </td>
                        <td className="absensi__cell-tanggal">
                          <span className="absensi__date-text">{formatTanggal(row.tanggal)}</span>
                        </td>
                        <td className="absensi__cell-hari">
                          {weekend ? (
                            <span className="absensi__badge absensi__badge--weekend">{row.namaHari}</span>
                          ) : (
                            <span className="absensi__day-text">{row.namaHari ?? '-'}</span>
                          )}
                        </td>
                        <td className="absensi__cell-jam">
                          {row.checkIn ? (
                            <span className={`absensi__time ${weekend ? 'absensi__time--weekend' : 'absensi__time--in'}`}>
                              <Clock size={12} className="absensi__time-icon" />
                              {formatJam(row.checkIn)}
                            </span>
                          ) : (
                            <span className="absensi__dash">-</span>
                          )}
                        </td>
                        <td className="absensi__cell-jam">
                          {row.checkOut ? (
                            <span
                              className={`absensi__time ${
                                weekend
                                  ? 'absensi__time--weekend'
                                  : hasCatatan
                                  ? 'absensi__time--warn'
                                  : 'absensi__time--out'
                              }`}
                            >
                              <Clock size={12} className="absensi__time-icon" />
                              {formatJam(row.checkOut)}
                            </span>
                          ) : (
                            <span className="absensi__dash">-</span>
                          )}
                        </td>
                        <td className="absensi__col-ket absensi__cell-ket">
                          {hasCatatan ? (
                            <span className="absensi__badge absensi__badge--warning" title={catatanBersih}>
                              <AlertCircle size={13} />
                              <span className="absensi__badge-text">{catatanBersih}</span>
                            </span>
                          ) : cutiLabel ? (
                            <span className="absensi__badge absensi__badge--info">
                              <Calendar size={13} />
                              <span className="absensi__badge-text">{cutiLabel}</span>
                            </span>
                          ) : weekend ? (
                            <span className="absensi__badge absensi__badge--weekend">
                              <span>Akhir Pekan</span>
                            </span>
                          ) : tepatWaktu ? (
                            <span className="absensi__badge absensi__badge--success">
                              <Check size={13} />
                              <span>Tepat waktu</span>
                            </span>
                          ) : (
                            <span className="absensi__dash">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer & Pagination */}
          <div className="absensi__footer">
            <div className="absensi__footer-info">
              {totalEntries === 0 ? (
                `0 entri pada ${labelPeriode}`
              ) : (
                <>
                  Menampilkan <strong>{startIdx + 1}</strong>–
                  <strong>{Math.min(startIdx + pageSize, totalEntries)}</strong> dari{' '}
                  <strong>{totalEntries}</strong> entri ({labelPeriode})
                </>
              )}
            </div>

            <div className="absensi__pagination">
              <button
                type="button"
                className="absensi__page-nav"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={16} />
                <span className="absensi__nav-text">Sebelumnya</span>
              </button>

              <div className="absensi__page-numbers">
                {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="absensi__page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`absensi__page-num ${currentPage === p ? 'is-active' : ''}`}
                      onClick={() => setPage(Number(p))}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                className="absensi__page-nav"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Halaman berikutnya"
              >
                <span className="absensi__nav-text">Berikutnya</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
