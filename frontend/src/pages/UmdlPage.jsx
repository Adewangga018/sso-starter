import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/DialogProvider'
import { ArrowUp, ArrowDown, ArrowUpDown, Camera, Check, ListChecks, Pencil, Plus, RotateCw, Search, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import DinasKameraCapture from '../components/DinasKameraCapture'
import './UmdlPage.css'

// Badge status persetujuan MANAGER real-time (approval.pengajuan) - beda dari status
// legacy (Di Buat/dst, dipakai memilah tab) - diminta 2026-08-24.
function StatusPersetujuanBadge({ status }) {
  if (!status) return <span className="umdl__appr umdl__appr--none">-</span>
  const cls = status === 'Disetujui' ? 'umdl__appr--ok' : status === 'Ditolak' ? 'umdl__appr--reject' : 'umdl__appr--wait'
  return <span className={`umdl__appr ${cls}`}>{status}</span>
}

// Sesuai aturan: UMDL hanya utk jarak <75km atau 75-150km (Pulang-Pergi). Di atas itu
// wajib lewat SPPD - jadi opsi >150km SENGAJA tidak muncul di sini.
const RENTANG_KM_OPTIONS = [
  { value: '<75', label: '< 75 km (Pulang-Pergi)' },
  { value: '75-150', label: '75 - 150 km (Pulang-Pergi)' },
]

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status', className: 'umdl__col-status' },
  { key: 'statusPersetujuan', label: 'Persetujuan', className: 'umdl__col-appr' },
  { key: 'tglUmdl', label: 'Tgl UMDL', className: 'umdl__col-tgl' },
  { key: 'kodeUmdl', label: 'Kode UMDL', className: 'umdl__col-kode' },
  { key: 'keterangan', label: 'Keterangan', className: 'umdl__col-ket' },
  { key: 'peserta', label: 'Ketua & Anggota', className: 'umdl__col-peserta' },
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

const emptyForm = { idIjin: null, kodeIjin: '', tglUmdl: '', keterangan: '', rentangKm: '', bukti: null }
const emptyUmdlPeserta = { nik: '', nama: '', posisi: 'Anggota' }
const POSISI_OPTIONS = ['Ketua', 'Anggota']

export default function UmdlPage() {
  const dialog = useDialog()
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

  // Rincian (ketua/anggota) - mirror SppdPage, diminta 2026-08-24. Modal terpisah dari
  // "Cari Data Surat Ijin" (pickerOpen di atas) - butuh state pencarian pegawai sendiri.
  const [detailFor, setDetailFor] = useState(null)
  // Peserta (bukan pembuat) boleh buka Rincian ini juga, tapi read-only - diminta 2026-08-24.
  const [detailBolehUbah, setDetailBolehUbah] = useState(true)
  const [peserta, setPeserta] = useState([])
  const [pesertaForm, setPesertaForm] = useState(emptyUmdlPeserta)
  const [pesertaError, setPesertaError] = useState('')
  const [editingPeserta, setEditingPeserta] = useState(null)

  const [pesertaPickerOpen, setPesertaPickerOpen] = useState(false)
  const [pesertaPickerQuery, setPesertaPickerQuery] = useState('')
  const [pesertaPickerRows, setPesertaPickerRows] = useState([])

  const [buktiPreview, setBuktiPreview] = useState(null) // { url } | null

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
      [r.status, r.statusPersetujuan, r.kodeUmdl, r.kodeIjin, r.keterangan, r.source, ...(r.peserta ?? []).map((p) => p.nama)]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))
    )
  }, [tabRows, search])

  const sortValue = (row, key) => {
    if (key === 'peserta') return (row.peserta ?? []).map((p) => p.nama).join(', ')
    return row[key]
  }

  const sorted = useMemo(() => {
    const list = [...filtered]
    const { key, direction } = sort
    const dir = direction === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let av = sortValue(a, key)
      let bv = sortValue(b, key)
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
      rentangKm: row.rentangKm ?? '',
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
    if (!form.rentangKm) {
      setFormError('Pilih rentang jarak (km) terlebih dahulu.')
      return
    }
    if (!editing && !form.bukti) {
      setFormError('Ambil foto bukti lokasi dinas terlebih dahulu.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        idIjin: form.idIjin ?? 0,
        tglUmdl: form.tglUmdl,
        keterangan: form.keterangan,
        rentangKm: form.rentangKm,
        foto: form.bukti?.foto ?? null,
        lat: form.bukti?.lat ?? 0,
        lng: form.bukti?.lng ?? 0,
        accuracy: form.bukti?.accuracy ?? null,
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
    if (!(await dialog.confirm({ title: 'Hapus UMDL', message: `Hapus UMDL ${row.kodeUmdl}?`, danger: true, confirmText: 'Hapus' }))) return
    try {
      await api.deleteUmdl(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus UMDL.')
    }
  }

  // --- Rincian ketua/anggota (mirror SppdPage) ---

  function resetPesertaForm() {
    setEditingPeserta(null)
    setPesertaForm(emptyUmdlPeserta)
  }

  async function openDetail(row, bolehUbah = true) {
    setDetailFor(row)
    setDetailBolehUbah(bolehUbah)
    resetPesertaForm()
    setPesertaError('')
    try {
      setPeserta(await api.getUmdlDetail(row.id))
    } catch (err) {
      setPesertaError(err instanceof ApiError ? err.message : 'Gagal memuat peserta.')
    }
  }

  function openEditPeserta(p) {
    setEditingPeserta(p)
    setPesertaForm({ nik: p.nik, nama: p.nama ?? '', posisi: p.posisi })
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
      const payload = { nik: pesertaForm.nik, posisi: pesertaForm.posisi }
      if (editingPeserta) {
        await api.updateUmdlPeserta(detailFor.id, editingPeserta.idDet, payload)
      } else {
        await api.addUmdlPeserta(detailFor.id, payload)
      }
      setPeserta(await api.getUmdlDetail(detailFor.id))
      resetPesertaForm()
      await load()
    } catch (err) {
      setPesertaError(err instanceof ApiError ? err.message : `Gagal ${editingPeserta ? 'mengubah' : 'menambah'} peserta.`)
    }
  }

  async function handleDeletePeserta(idDet) {
    try {
      await api.deleteUmdlPeserta(detailFor.id, idDet)
      setPeserta(await api.getUmdlDetail(detailFor.id))
      if (editingPeserta?.idDet === idDet) resetPesertaForm()
      await load()
    } catch (err) {
      setPesertaError(err instanceof ApiError ? err.message : 'Gagal menghapus peserta.')
    }
  }

  async function openPesertaPicker() {
    setPesertaPickerOpen(true)
    setPesertaPickerQuery('')
    try {
      setPesertaPickerRows(await api.cariPegawaiUmdl(''))
    } catch {
      setPesertaPickerRows([])
    }
  }

  async function runPesertaPicker(q) {
    setPesertaPickerQuery(q)
    try {
      setPesertaPickerRows(await api.cariPegawaiUmdl(q))
    } catch {
      setPesertaPickerRows([])
    }
  }

  function pickPesertaPegawai(p) {
    setPesertaForm((prev) => ({ ...prev, nik: p.nik, nama: p.nama }))
    setPesertaPickerOpen(false)
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
              {/* data-label pada tiap <td> dipakai CSS (@media max-width: 720px)
                  sebagai judul baris ketika tabel berubah menjadi kartu bertumpuk
                  di ponsel - di lebar itu <thead> disembunyikan. */}
              {pageRows.map((row) => {
                const bolehUbah = row.peranSaya === 'Pembuat'
                return (
                <tr key={row.id}>
                  <td className="umdl__col-status" data-label="Status">
                    <span className={`umdl__status${row.status === STATUS_DIBUAT ? '' : ' umdl__status--done'}`}>
                      {row.status}
                    </span>
                    {!bolehUbah && <span className="umdl__peran">Saya: {row.peranSaya}</span>}
                  </td>
                  <td className="umdl__col-appr" data-label="Persetujuan">
                    <StatusPersetujuanBadge status={row.statusPersetujuan} />
                  </td>
                  <td className="umdl__col-tgl" data-label="Tgl UMDL">{formatTanggal(row.tglUmdl)}</td>
                  <td className="umdl__col-kode" data-label="Kode UMDL">
                    <div>{row.kodeUmdl}</div>
                    {row.kodeIjin && <div className="umdl__source">Izin: {row.kodeIjin}</div>}
                  </td>
                  <td className="umdl__col-ket" data-label="Keterangan">{row.keterangan}</td>
                  <td className="umdl__col-peserta" data-label="Ketua & Anggota">
                    {row.peserta?.length ? (
                      <ol className="umdl__list">
                        {row.peserta.map((p) => (
                          <li key={p.idDet}>{p.nama ?? p.nik} <span className="umdl__peserta-posisi">({p.posisi})</span></li>
                        ))}
                      </ol>
                    ) : '-'}
                  </td>
                  {isDibuatTab && (
                    <td className="umdl__col-aksi" data-label="Aksi">
                      <div className="umdl__row-actions">
                        {row.fotoUrl && (
                          <button type="button" className="umdl__row-btn umdl__row-btn--camera" onClick={() => viewBukti(row)} title="Lihat foto bukti dinas">
                            <Camera size={16} />
                          </button>
                        )}
                        <button type="button" className="umdl__row-btn umdl__row-btn--detail" onClick={() => openDetail(row)} title="Rincian ketua/anggota">
                          <ListChecks size={16} />
                        </button>
                        <button type="button" className="umdl__row-btn umdl__row-btn--edit" onClick={() => openEdit(row)} title="Ubah">
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="umdl__row-btn umdl__row-btn--delete" onClick={() => handleDelete(row)} title="Hapus">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )})}
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

              <label className="umdl__field">
                <span>Rentang Jarak (km)</span>
                <select
                  value={form.rentangKm}
                  onChange={(e) => setForm((p) => ({ ...p, rentangKm: e.target.value }))}
                  required
                >
                  <option value="" disabled>Pilih rentang jarak...</option>
                  {RENTANG_KM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <div className="umdl__window-hint">
                UMDL hanya bisa diajukan dari surat izin berjenis <b>Meninggalkan Pekerjaan</b> dengan
                kepentingan <b>Dinas</b>. Satu surat izin hanya bisa dipakai sekali. Jarak di atas 150 km
                wajib diajukan lewat <b>SPPD</b>.
              </div>

              {editing && editing.fotoUrl && !form.bukti && (
                <div className="umdl__window-hint">
                  Foto bukti sudah tersimpan. Ambil foto baru di bawah hanya jika ingin menggantinya.
                </div>
              )}
              <DinasKameraCapture value={form.bukti} onChange={(v) => setForm((p) => ({ ...p, bukti: v }))} />

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

      {detailFor && (
        <div className="umdl__modal-backdrop" onClick={() => setDetailFor(null)}>
          <div className="umdl__modal umdl__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <h3>Rincian UMDL # {detailFor.kodeUmdl}</h3>
              <button type="button" className="umdl__modal-close" onClick={() => setDetailFor(null)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            {!detailBolehUbah && (
              <p className="umdl__window-hint" style={{ margin: '0 22px 8px' }}>
                Anda ditambahkan sbg peserta di UMDL ini (bukan pembuatnya) - daftar di bawah untuk dilihat saja.
              </p>
            )}

            {detailBolehUbah && (
            <form className="umdl__modal-body" onSubmit={handleSubmitPeserta}>
              <label className="umdl__field">
                <span>NIK</span>
                <div className="umdl__nik">
                  <input type="text" value={pesertaForm.nama ? `${pesertaForm.nik} - ${pesertaForm.nama}` : ''} placeholder="Pilih pegawai..." readOnly />
                  {!editingPeserta && (
                    <button type="button" onClick={openPesertaPicker} title="Cari data pegawai">
                      <Search size={16} />
                    </button>
                  )}
                </div>
              </label>

              <label className="umdl__field">
                <span>Posisi</span>
                <select value={pesertaForm.posisi} onChange={(e) => setPesertaForm((p) => ({ ...p, posisi: e.target.value }))}>
                  {POSISI_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>

              {pesertaError && <div className="umdl__error">{pesertaError}</div>}

              <div className="umdl__modal-footer">
                {editingPeserta && (
                  <button type="button" className="umdl__cancel" onClick={resetPesertaForm}>Batal</button>
                )}
                <button type="submit" className="umdl__submit">
                  {editingPeserta ? (<><Pencil size={15} /> Simpan Perubahan</>) : (<><Plus size={15} /> Tambah Peserta</>)}
                </button>
              </div>
            </form>
            )}

            <div className="umdl__peserta">
              <table className="umdl__table umdl__table--peserta">
                <thead>
                  <tr>
                    <th>Posisi</th>
                    <th>NIK</th>
                    <th>Nama</th>
                    {detailBolehUbah && <th>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {peserta.length === 0 && (
                    <tr>
                      <td colSpan={detailBolehUbah ? 4 : 3} className="umdl__no-data">Belum ada ketua/anggota ditambahkan.</td>
                    </tr>
                  )}
                  {peserta.map((p) => (
                    <tr key={p.idDet} className={editingPeserta?.idDet === p.idDet ? 'umdl__row--editing' : undefined}>
                      <td>{p.posisi}</td>
                      <td>{p.nik}</td>
                      <td>{p.nama ?? '-'}</td>
                      {detailBolehUbah && (
                        <td>
                          <div className="umdl__row-actions">
                            <button type="button" className="umdl__row-btn umdl__row-btn--edit" onClick={() => openEditPeserta(p)} title="Ubah peserta">
                              <Pencil size={16} />
                            </button>
                            <button type="button" className="umdl__row-btn umdl__row-btn--delete" onClick={() => handleDeletePeserta(p.idDet)} title="Hapus peserta">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pesertaPickerOpen && (
        <div className="umdl__modal-backdrop" onClick={() => setPesertaPickerOpen(false)}>
          <div className="umdl__modal umdl__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <h3>Cari Data Pegawai</h3>
              <button type="button" className="umdl__modal-close" onClick={() => setPesertaPickerOpen(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>

            <div className="umdl__modal-body">
              <label className="umdl__field">
                <span>Cari</span>
                <input
                  type="text"
                  value={pesertaPickerQuery}
                  onChange={(e) => runPesertaPicker(e.target.value)}
                  placeholder="Ketik NIK atau nama..."
                  autoFocus
                />
              </label>
            </div>

            <div className="umdl__peserta">
              <table className="umdl__table umdl__table--peserta">
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
                  {pesertaPickerRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="umdl__no-data">Tidak ada pegawai yang cocok.</td>
                    </tr>
                  )}
                  {pesertaPickerRows.map((p) => (
                    <tr key={p.nik}>
                      <td>{p.nik}</td>
                      <td>{p.nama}</td>
                      <td>{p.wilayah}</td>
                      <td>{p.unitKerja}</td>
                      <td>
                        <button type="button" className="umdl__row-btn umdl__row-btn--pick" onClick={() => pickPesertaPegawai(p)} title="Pilih pegawai ini">
                          <Check size={16} />
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
        <div className="umdl__modal-backdrop" onClick={closeBuktiPreview}>
          <div className="umdl__modal" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <h3>Foto Bukti Dinas</h3>
              <button type="button" className="umdl__modal-close" onClick={closeBuktiPreview} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <div className="umdl__modal-body">
              <img src={buktiPreview.url} alt="Foto bukti dinas" style={{ width: '100%', borderRadius: 10 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
