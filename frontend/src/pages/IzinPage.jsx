import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import { ArrowUp, ArrowDown, ArrowUpDown, Pencil, Plus, Printer, RotateCw, Search, Trash2, X } from 'lucide-react'
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
  { key: 'dibuat', label: 'Di Buat' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'izin__col-status' },
  { key: 'kodeIjin', label: 'Kode Izin', className: 'izin__col-kode' },
  { key: 'keterangan', label: 'Keterangan', className: 'izin__col-ket' },
  { key: 'jamMulai', label: 'Jam Mulai', className: 'izin__col-jam' },
  { key: 'jamSelesai', label: 'Jam Selesai', className: 'izin__col-jam' },
  { key: 'jenisIjin', label: 'Jenis', className: 'izin__col-jenis' },
  { key: 'kepentinganIjin', label: 'Kepentingan', className: 'izin__col-kepentingan' },
]

const FILTER_PLACEHOLDER = 'Cari kode izin, keterangan, atau jenis izin...'

const pad = (n) => String(n).padStart(2, '0')

function formatDateOnly(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

  const [modalOpen, setModalOpen] = useState(false)
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
    return <div className="izin__empty">{loadError}</div>
  }

  if (!rows) {
    return <div className="izin__empty">Memuat data izin...</div>
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="izin">
      <h2 className="izin__page-title">Surat Izin</h2>

      <div className="izin__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`izin__tab${tab === t.key ? ' izin__tab--active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="izin__actionbar">
        <div className="izin__filter">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={FILTER_PLACEHOLDER}
          />
          <span className="izin__filter-icon">
            <Search size={16} />
          </span>
        </div>
        <div className="izin__actionbar-buttons">
          {isDibuatTab && (
            <button type="button" className="izin__icon-btn izin__icon-btn--add" onClick={openCreate} title="Ajukan Izin">
              <Plus size={18} />
            </button>
          )}
          <button type="button" className="izin__icon-btn izin__icon-btn--refresh" onClick={load} title="Muat ulang">
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      <div className="izin__card">
        {loadError && <div className="izin__error">{loadError}</div>}

        <div className="izin__toolbar">
          <label className="izin__page-size">
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

          <label className="izin__search">
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

        <div className="izin__table-wrap">
          <table className="izin__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`${col.className} izin__th--sortable`} onClick={() => toggleSort(col.key)}>
                    <span className="izin__th-content">
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="izin__sort-icon--idle" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="izin__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="izin__no-data">
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {/* data-label pada tiap <td> dipakai CSS (@media max-width: 720px)
                  sebagai judul baris ketika tabel berubah menjadi kartu bertumpuk
                  di ponsel - di lebar itu <thead> disembunyikan. */}
              {pageRows.map((row) => (
                <tr key={row.id}>
                  <td className="izin__col-status" data-label="Status">
                    <span className={`izin__status${row.status === STATUS_DIBUAT ? '' : ' izin__status--done'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="izin__col-kode" data-label="Kode Izin">{row.kodeIjin}</td>
                  <td className="izin__col-ket" data-label="Keterangan">{row.keterangan}</td>
                  <td className="izin__col-jam" data-label="Jam Mulai">{formatDateTime(row.jamMulai)}</td>
                  <td className="izin__col-jam" data-label="Jam Selesai">{formatDateTime(row.jamSelesai)}</td>
                  <td className="izin__col-jenis" data-label="Jenis">
                    <div>{row.jenisIjin}</div>
                    <div className="izin__source">{row.source}</div>
                  </td>
                  <td className="izin__col-kepentingan" data-label="Kepentingan">{row.kepentinganIjin}</td>
                  <td className="izin__col-aksi" data-label="Aksi">
                    <div className="izin__row-actions">
                      <button
                        type="button"
                        className="izin__row-btn izin__row-btn--print"
                        onClick={() => handlePrint(row)}
                        disabled={!row.kodeIjin}
                        title="Cetak surat izin"
                      >
                        <Printer size={15} />
                      </button>
                      {isDibuatTab && (
                        <>
                          <button type="button" className="izin__row-btn izin__row-btn--edit" onClick={() => openEdit(row)} title="Ubah">
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="izin__row-btn izin__row-btn--delete" onClick={() => handleDelete(row)} title="Hapus">
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

        <div className="izin__footer">
          <div>
            {totalEntries === 0
              ? 'Menampilkan 0 entri'
              : `Menampilkan ${startIdx + 1} sampai ${Math.min(startIdx + pageSize, totalEntries)} dari ${totalEntries} entri`}
          </div>
          <div className="izin__pagination">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Sebelumnya
            </button>
            <span className="izin__page-indicator">{currentPage}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="izin__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="izin__modal" onClick={(e) => e.stopPropagation()}>
            <div className="izin__modal-header">
              <h3>{editing ? `Surat Izin # ${editing.kodeIjin}` : 'Ajukan Izin'}</h3>
              <button type="button" className="izin__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="izin__modal-body" onSubmit={handleSubmit}>
              <label className="izin__field">
                <span>Tgl Ijin</span>
                <input
                  type="date"
                  value={form.tglIjin}
                  min={minTanggal()}
                  onChange={(e) => updateField('tglIjin', e.target.value)}
                  required
                />
              </label>

              <label className="izin__field">
                <span>Sampai Tgl</span>
                <input
                  type="date"
                  value={form.tglIjinSd}
                  min={form.tglIjin || minTanggal()}
                  onChange={(e) => updateField('tglIjinSd', e.target.value)}
                  required
                />
              </label>

              <label className="izin__field">
                <span>Dari Jam</span>
                <input
                  type="time"
                  value={form.jamMulai}
                  onChange={(e) => updateField('jamMulai', e.target.value)}
                  required
                />
              </label>

              <label className="izin__field">
                <span>Sampai Jam</span>
                <input
                  type="time"
                  value={form.jamSelesai}
                  onChange={(e) => updateField('jamSelesai', e.target.value)}
                  required
                />
              </label>

              <label className="izin__field">
                <span>Jenis Ijin</span>
                <select value={form.jenisIjin} onChange={(e) => updateField('jenisIjin', e.target.value)}>
                  {JENIS_OPTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </label>

              <label className="izin__field">
                <span>Kepentingan</span>
                <select value={form.kepentinganIjin} onChange={(e) => updateField('kepentinganIjin', e.target.value)}>
                  {KEPENTINGAN_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>

              <label className="izin__field izin__field--textarea">
                <span>Keterangan</span>
                <textarea
                  rows={3}
                  value={form.keterangan}
                  maxLength={500}
                  onChange={(e) => updateField('keterangan', e.target.value)}
                />
              </label>

              {form.jenisIjin === JENIS_SAKIT && (
                <label className="izin__field izin__field--berkas">
                  <span>Foto Surat Dokter</span>
                  <div>
                    <input type="file" accept={BERKAS_ACCEPT} onChange={pilihBerkas} />
                    <div className="izin__berkas-hint">
                      Format PDF, PNG, JPG, atau JPEG.
                      {berkas
                        ? ` Terpilih: ${berkas.name}. Berkas belum terkirim ke server — unggahan menyusul.`
                        : ''}
                    </div>
                  </div>
                </label>
              )}

              {/* <div className="izin__window-hint">
                Izin bisa diajukan mulai H-1 ({formatDateOnly(minTanggal())}) dan untuk tanggal seterusnya.
              </div> */}

              {formError && <div className="izin__error">{formError}</div>}

              <div className="izin__modal-footer">
                <button type="submit" className="izin__submit" disabled={saving}>
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
