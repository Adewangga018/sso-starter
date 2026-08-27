import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Download, Smartphone } from 'lucide-react'
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
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  // Daftar Cuti Nasional/Cuti Bersama (Admin SDM) - dipakai utk label Keterangan; gagal
  // memuatnya bukan error fatal, label itu cuma tidak tampil.
  const [cuti, setCuti] = useState(null)

  useEffect(() => {
    api.getCuti().then(setCuti).catch(() => {})
  }, [])

  async function handleDownloadApp() {
    setDownloading(true)
    setDownloadError('')
    try {
      await api.unduhAppAndroid()
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Gagal mengunduh aplikasi.')
    } finally {
      setDownloading(false)
    }
  }

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
      <div className="absensi__card absensi__app-card">
        <div className="absensi__app-icon">
          <Smartphone size={22} />
        </div>
        <div className="absensi__app-info">
          <div className="absensi__section-title">Aplikasi MyGCS Absensi</div>
          <p className="absensi__app-desc">
            Absen masuk/keluar sekarang wajib lewat aplikasi mobile ini (bukan lagi dari halaman
            web) - lokasi GPS Anda diverifikasi langsung oleh perangkat agar tidak bisa
            direkayasa (fake GPS).
          </p>
          {downloadError && <div className="absensi__app-error">{downloadError}</div>}
        </div>
        <div className="absensi__app-actions">
          <button type="button" className="absensi__app-btn" onClick={handleDownloadApp} disabled={downloading}>
            <Download size={15} /> {downloading ? 'Menyiapkan...' : 'Unduh untuk Android'}
          </button>
          <span className="absensi__app-note">Versi iOS menyusul lewat TestFlight.</span>
        </div>
      </div>

      {loadError ? (
        <div className="absensi__card">
          <div className="absensi__section-title">Log Absensi</div>
          <div className="absensi__empty">{loadError}</div>
        </div>
      ) : !rows ? (
        <div className="absensi__card">
          <div className="absensi__section-title">Log Absensi</div>
          <div className="absensi__empty">Memuat data absensi...</div>
        </div>
      ) : (
      <div className="absensi__card">
        <div className="absensi__section-title">Log Absensi</div>

        <div className="absensi__periode">
          <label className="absensi__filter">
            Bulan
            <select value={bulan} onChange={(e) => handlePeriodeChange(setBulan, e.target.value)}>
              <option value="">Semua Bulan</option>
              {BULAN.map((nama, i) => (
                <option key={nama} value={i + 1}>
                  {nama}
                </option>
              ))}
            </select>
          </label>

          <label className="absensi__filter">
            Tahun
            <select value={tahun} onChange={(e) => handlePeriodeChange(setTahun, e.target.value)}>
              <option value="">Semua Tahun</option>
              {tahunOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

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
                    Tidak ada data absensi pada {labelPeriode}.
                  </td>
                </tr>
              )}
              {pageRows.map((row, i) => {
                const weekend = isWeekend(row.namaHari)
                const catatanBersih = cleanCatatan(row.catatanMangkir)
                const hasCatatan = Boolean(catatanBersih)
                const cutiLabel = !hasCatatan ? cutiLabelFor(row.tanggal, cuti) : null
                return (
                  <tr key={`${row.tanggal}-${row._seq}`}>
                    {/* Nomor urut mengikuti baris yang tampil, bukan urutan global,
                        agar tetap mulai dari 1 pada tiap bulan yang dipilih. */}
                    <td>{startIdx + i + 1}</td>
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
                        <span className="absensi__badge absensi__badge--red">{formatJam(row.checkIn) ?? '-'}</span>
                      ) : (
                        formatJam(row.checkIn) ?? '-'
                      )}
                    </td>
                    <td>
                      {weekend ? (
                        <span className="absensi__badge absensi__badge--red">{formatJam(row.checkOut) ?? '-'}</span>
                      ) : hasCatatan ? (
                        <span className="absensi__badge absensi__badge--yellow">{formatJam(row.checkOut) ?? '-'}</span>
                      ) : (
                        formatJam(row.checkOut) ?? '-'
                      )}
                    </td>
                    <td className="absensi__col-ket">
                      {hasCatatan ? (
                        <span className="absensi__badge absensi__badge--yellow">{catatanBersih}</span>
                      ) : cutiLabel ? (
                        <span className="absensi__badge absensi__badge--green">{cutiLabel}</span>
                      ) : weekend ? (
                        <span className="absensi__badge absensi__badge--red">Akhir Pekan</span>
                      ) : (
                        isTepatWaktu(row, weekend, hasCatatan) && (
                          <span className="absensi__badge absensi__badge--green">Tepat waktu</span>
                        )
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
              ? `Menampilkan 0 entri pada ${labelPeriode}`
              : `Menampilkan ${startIdx + 1} sampai ${Math.min(startIdx + pageSize, totalEntries)} dari ${totalEntries} entri pada ${labelPeriode}`}
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
      )}
    </div>
  )
}
