import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import { ArrowUp, ArrowDown, ArrowUpDown, Camera, Check, ListChecks, Pencil, Plus, Printer, RotateCw, Search, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import DinasKameraCapture from '../components/DinasKameraCapture'
import './SppdPage.css'

// SPPD hanya utk jarak >150km (Pulang-Pergi) - di bawah itu diajukan lewat UMDL. Cuma satu
// nilai valid, jadi tidak perlu dropdown pilihan, langsung dikunci di form.
const RENTANG_KM_SPPD = '>150'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const JENIS_OPTIONS = ['Dalam Negeri', 'Luar Negeri']
const KENDARAAN_OPTIONS = ['Umum', 'Kendaraan Dinas', 'Lain-lain']
const POSISI_OPTIONS = ['Ketua', 'Anggota']

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'sppd__col-status' },
  { key: 'tglInput', label: 'Tgl Input', className: 'sppd__col-tgl' },
  { key: 'kodeSppd', label: 'Kode SPPD', className: 'sppd__col-kode' },
  { key: 'tujuan', label: 'Tujuan', className: 'sppd__col-tujuan' },
  { key: 'namaKaryawan', label: 'Nama Karyawan', className: 'sppd__col-nama' },
  { key: 'tugas', label: 'Tugas yang dilaksanakan', className: 'sppd__col-tugas' },
  { key: 'tglBerangkat', label: 'Tgl Berangkat', className: 'sppd__col-tgl' },
  { key: 'tglPulang', label: 'Tgl Pulang', className: 'sppd__col-tgl' },
  { key: 'kendaraan', label: 'Transportasi', className: 'sppd__col-kendaraan' },
]

const FILTER_PLACEHOLDER = 'Cari kode SPPD, tujuan, atau nama karyawan...'

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

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Rincian (peserta) - a separate modal, because travellers can only be attached after the
  // SPPD exists: the detail rows key off its id.
  const [detailFor, setDetailFor] = useState(null)
  const [peserta, setPeserta] = useState([])
  const [pesertaForm, setPesertaForm] = useState(emptyPeserta)
  const [pesertaError, setPesertaError] = useState('')

  // Peserta yang sedang diubah; null berarti form dipakai untuk menambah orang baru.
  const [editingPeserta, setEditingPeserta] = useState(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerRows, setPickerRows] = useState([])

  const [buktiPreview, setBuktiPreview] = useState(null) // { url } | null

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
      [r.status, r.kodeSppd, r.tujuan, ...(r.namaKaryawan ?? []), ...(r.tugas ?? []), r.kendaraan, r.jenis]
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

  // Foto perlu Bearer token (bukan <img src> biasa) - diambil sbg blob, ditampilkan di modal
  // preview, lalu object URL-nya di-revoke saat modal ditutup.
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
      // Pulang tidak boleh mendahului berangkat.
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
        // Sebuah SPPD tanpa peserta tidak bisa dicetak, jadi langsung buka rincian peserta.
        openDetail(created)
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan SPPD.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!(await dialog.confirm({ title: 'Hapus SPPD', message: `Hapus SPPD ${row.kodeSppd}? Seluruh peserta di dalamnya ikut terhapus.`, danger: true, confirmText: 'Hapus' }))) return
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

  async function openDetail(row) {
    setDetailFor(row)
    resetPesertaForm()
    setPesertaError('')
    try {
      setPeserta(await api.getSppdDetail(row.id))
    } catch (err) {
      setPesertaError(err instanceof ApiError ? err.message : 'Gagal memuat peserta.')
    }
  }

  // Form yang sama dipakai untuk menambah dan mengubah. Pegawainya tidak bisa diganti saat
  // mengubah - itu sama saja dengan menghapus lalu menambah orang lain.
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
      setPesertaError(
        err instanceof ApiError ? err.message : `Gagal ${editingPeserta ? 'mengubah' : 'menambah'} peserta.`
      )
    }
  }

  async function handleDeletePeserta(idDet) {
    try {
      await api.deleteSppdPeserta(detailFor.id, idDet)
      setPeserta(await api.getSppdDetail(detailFor.id))
      // Kalau baris yang dihapus sedang diubah, form dikosongkan - kalau tidak, menyimpan
      // akan menembak baris yang sudah tidak ada.
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
    return <div className="sppd__empty">{loadError}</div>
  }

  if (!rows) {
    return <div className="sppd__empty">Memuat data SPPD...</div>
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="sppd">
      <h2 className="sppd__page-title">Surat Perintah Perjalanan Dinas</h2>

      <div className="sppd__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`sppd__tab${tab === t.key ? ' sppd__tab--active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sppd__actionbar">
        <div className="sppd__filter">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={FILTER_PLACEHOLDER}
          />
          <span className="sppd__filter-icon">
            <Search size={16} />
          </span>
        </div>
        <div className="sppd__actionbar-buttons">
          {isDibuatTab && (
            <button type="button" className="sppd__icon-btn sppd__icon-btn--add" onClick={openCreate} title="Ajukan SPPD">
              <Plus size={18} />
            </button>
          )}
          <button type="button" className="sppd__icon-btn sppd__icon-btn--refresh" onClick={load} title="Muat ulang">
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      <div className="sppd__card">
        {loadError && <div className="sppd__error">{loadError}</div>}

        <div className="sppd__toolbar">
          <label className="sppd__page-size">
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

          <label className="sppd__search">
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

        <div className="sppd__table-wrap">
          <table className="sppd__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={`${col.className} sppd__th--sortable`} onClick={() => toggleSort(col.key)}>
                    <span className="sppd__th-content">
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="sppd__sort-icon--idle" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="sppd__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="sppd__no-data">
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {/* data-label pada tiap <td> dipakai CSS (@media max-width: 720px)
                  sebagai judul baris ketika tabel berubah menjadi kartu bertumpuk
                  di ponsel - di lebar itu <thead> disembunyikan. */}
              {pageRows.map((row) => (
                <tr key={row.id}>
                  <td className="sppd__col-status" data-label="Status">
                    <span className={`sppd__status${row.status === STATUS_DIBUAT ? '' : ' sppd__status--done'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="sppd__col-tgl" data-label="Tgl Input">{formatTanggal(row.tglInput)}</td>
                  <td className="sppd__col-kode" data-label="Kode SPPD">
                    <div>{row.kodeSppd}</div>
                    <div className="sppd__source">{row.jenis}</div>
                  </td>
                  <td className="sppd__col-tujuan" data-label="Tujuan">{row.tujuan}</td>
                  <td className="sppd__col-nama" data-label="Nama Karyawan">
                    {row.namaKaryawan?.length ? (
                      <ol className="sppd__list">
                        {row.namaKaryawan.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ol>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="sppd__col-tugas" data-label="Tugas yang dilaksanakan">
                    {row.tugas?.length ? (
                      <ol className="sppd__list">
                        {row.tugas.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ol>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="sppd__col-tgl" data-label="Tgl Berangkat">{formatTanggal(row.tglBerangkat)}</td>
                  <td className="sppd__col-tgl" data-label="Tgl Pulang">{formatTanggal(row.tglPulang)}</td>
                  <td className="sppd__col-kendaraan" data-label="Transportasi">{row.kendaraan}</td>
                  <td className="sppd__col-aksi" data-label="Aksi">
                    <div className="sppd__row-actions">
                      {row.fotoUrl && (
                        <button
                          type="button"
                          className="sppd__row-btn"
                          onClick={() => viewBukti(row)}
                          title="Lihat foto bukti dinas"
                        >
                          <Camera size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="sppd__row-btn sppd__row-btn--print"
                        onClick={() => handlePrint(row)}
                        title="Cetak SPPD"
                      >
                        <Printer size={15} />
                      </button>
                      {isDibuatTab && (
                        <>
                          <button
                            type="button"
                            className="sppd__row-btn sppd__row-btn--detail"
                            onClick={() => openDetail(row)}
                            title="Rincian peserta"
                          >
                            <ListChecks size={15} />
                          </button>
                          <button type="button" className="sppd__row-btn sppd__row-btn--edit" onClick={() => openEdit(row)} title="Ubah">
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="sppd__row-btn sppd__row-btn--delete" onClick={() => handleDelete(row)} title="Hapus">
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

        <div className="sppd__footer">
          <div>
            {totalEntries === 0
              ? 'Menampilkan 0 entri'
              : `Menampilkan ${startIdx + 1} sampai ${Math.min(startIdx + pageSize, totalEntries)} dari ${totalEntries} entri`}
          </div>
          <div className="sppd__pagination">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Sebelumnya
            </button>
            <span className="sppd__page-indicator">{currentPage}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="sppd__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="sppd__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <h3>{editing ? `SPPD # ${editing.kodeSppd}` : 'Ajukan SPPD'}</h3>
              <button type="button" className="sppd__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="sppd__modal-body" onSubmit={handleSubmit}>
              <label className="sppd__field">
                <span>Tanggal Berangkat</span>
                <input
                  type="date"
                  value={form.tglBerangkat}
                  onChange={(e) => updateField('tglBerangkat', e.target.value)}
                  required
                />
              </label>

              <label className="sppd__field">
                <span>Tanggal Pulang</span>
                <input
                  type="date"
                  value={form.tglPulang}
                  min={form.tglBerangkat}
                  onChange={(e) => updateField('tglPulang', e.target.value)}
                  required
                />
              </label>

              <label className="sppd__field">
                <span>Lokasi</span>
                <select value={form.jenis} onChange={(e) => updateField('jenis', e.target.value)}>
                  {JENIS_OPTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sppd__field">
                <span>Tujuan SPPD</span>
                <input
                  type="text"
                  value={form.tujuan}
                  maxLength={255}
                  onChange={(e) => updateField('tujuan', e.target.value)}
                  required
                />
              </label>

              <label className="sppd__field sppd__field--textarea">
                <span>Keterangan</span>
                <textarea
                  rows={3}
                  value={form.keterangan}
                  maxLength={254}
                  onChange={(e) => updateField('keterangan', e.target.value)}
                  required
                />
              </label>

              <label className="sppd__field">
                <span>Transportasi</span>
                <select value={form.kendaraan} onChange={(e) => updateField('kendaraan', e.target.value)}>
                  {KENDARAAN_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sppd__window-hint">
                SPPD hanya utk jarak lebih dari <b>150 km (Pulang-Pergi)</b>. Jarak di bawah itu
                diajukan lewat <b>UMDL</b>.
              </div>

              {editing && editing.fotoUrl && !form.bukti && (
                <div className="sppd__window-hint">
                  Foto bukti sudah tersimpan. Ambil foto baru di bawah hanya jika ingin menggantinya.
                </div>
              )}
              <DinasKameraCapture value={form.bukti} onChange={(v) => setForm((p) => ({ ...p, bukti: v }))} />

              {formError && <div className="sppd__error">{formError}</div>}

              <div className="sppd__modal-footer">
                <button type="submit" className="sppd__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailFor && (
        <div className="sppd__modal-backdrop" onClick={() => setDetailFor(null)}>
          <div className="sppd__modal sppd__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <h3>Rincian SPPD # {detailFor.kodeSppd}</h3>
              <button type="button" className="sppd__modal-close" onClick={() => setDetailFor(null)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <form className="sppd__modal-body" onSubmit={handleSubmitPeserta}>
              <label className="sppd__field">
                <span>NIK</span>
                <div className="sppd__nik">
                  <input type="text" value={pesertaForm.nama ? `${pesertaForm.nik} - ${pesertaForm.nama}` : ''} placeholder="Pilih pegawai..." readOnly />
                  {/* Saat mengubah, pegawainya tidak bisa diganti - hanya posisi & tugas. */}
                  {!editingPeserta && (
                    <button type="button" onClick={openPicker} title="Cari data pegawai">
                      <Search size={16} />
                    </button>
                  )}
                </div>
              </label>

              <label className="sppd__field">
                <span>Posisi</span>
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

              <label className="sppd__field sppd__field--textarea">
                <span>Tugas</span>
                <textarea
                  rows={3}
                  value={pesertaForm.tugas}
                  maxLength={500}
                  onChange={(e) => setPesertaForm((p) => ({ ...p, tugas: e.target.value }))}
                  required
                />
              </label>

              {pesertaError && <div className="sppd__error">{pesertaError}</div>}

              <div className="sppd__modal-footer">
                {editingPeserta && (
                  <button type="button" className="sppd__cancel" onClick={resetPesertaForm}>
                    Batal
                  </button>
                )}
                <button type="submit" className="sppd__submit">
                  {editingPeserta ? (
                    <>
                      <Pencil size={15} /> Simpan Perubahan
                    </>
                  ) : (
                    <>
                      <Plus size={15} /> Tambah Peserta
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="sppd__peserta">
              <table className="sppd__table sppd__table--peserta">
                <thead>
                  <tr>
                    <th>Posisi</th>
                    <th>NIK</th>
                    <th>Nama</th>
                    <th>Tugas</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {peserta.length === 0 && (
                    <tr>
                      <td colSpan={5} className="sppd__no-data">
                        Belum ada peserta. SPPD tidak bisa dicetak sebelum ada peserta.
                      </td>
                    </tr>
                  )}
                  {peserta.map((p) => (
                    <tr key={p.idDet} className={editingPeserta?.idDet === p.idDet ? 'sppd__row--editing' : undefined}>
                      <td>{p.posisi}</td>
                      <td>{p.nik}</td>
                      <td>{p.nama ?? '-'}</td>
                      <td>{p.tugas}</td>
                      <td>
                        <div className="sppd__row-actions">
                          <button
                            type="button"
                            className="sppd__row-btn sppd__row-btn--edit"
                            onClick={() => openEditPeserta(p)}
                            title="Ubah peserta"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="sppd__row-btn sppd__row-btn--delete"
                            onClick={() => handleDeletePeserta(p.idDet)}
                            title="Hapus peserta"
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

      {pickerOpen && (
        <div className="sppd__modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="sppd__modal sppd__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <h3>Cari Data Pegawai</h3>
              <button type="button" className="sppd__modal-close" onClick={() => setPickerOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <div className="sppd__modal-body">
              <label className="sppd__field">
                <span>Cari</span>
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => runPicker(e.target.value)}
                  placeholder="Ketik NIK atau nama..."
                  autoFocus
                />
              </label>
            </div>

            <div className="sppd__peserta">
              <table className="sppd__table sppd__table--peserta">
                <thead>
                  <tr>
                    <th>NIK</th>
                    <th>Nama</th>
                    <th>Wilayah</th>
                    <th>Unit Kerja</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pickerRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="sppd__no-data">
                        Tidak ada pegawai yang cocok.
                      </td>
                    </tr>
                  )}
                  {pickerRows.map((p) => (
                    <tr key={p.nik}>
                      <td>{p.nik}</td>
                      <td>{p.nama}</td>
                      <td>{p.wilayah}</td>
                      <td>{p.unitKerja}</td>
                      <td>
                        <button
                          type="button"
                          className="sppd__row-btn sppd__row-btn--pick"
                          onClick={() => pickPegawai(p)}
                          title="Pilih pegawai ini"
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

      {buktiPreview && (
        <div className="sppd__modal-backdrop" onClick={closeBuktiPreview}>
          <div className="sppd__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sppd__modal-header">
              <h3>Foto Bukti Dinas</h3>
              <button type="button" className="sppd__modal-close" onClick={closeBuktiPreview} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <div className="sppd__modal-body">
              <img src={buktiPreview.url} alt="Foto bukti dinas" style={{ width: '100%', borderRadius: 10 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
