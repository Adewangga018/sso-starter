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
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Info,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import DinasKameraCapture from '../components/DinasKameraCapture'
import './UmdlPage.css'

// Badge status persetujuan MANAGER real-time
function StatusPersetujuanBadge({ status }) {
  if (!status) return <span className="umdl__appr umdl__appr--none">-</span>
  const s = (status ?? '').toLowerCase()
  if (s.includes('setuju')) {
    return (
      <span className="umdl__appr umdl__appr--ok">
        <CheckCircle2 size={11} />
        <span>{status}</span>
      </span>
    )
  }
  if (s.includes('tolak')) {
    return (
      <span className="umdl__appr umdl__appr--reject">
        <AlertCircle size={11} />
        <span>{status}</span>
      </span>
    )
  }
  return (
    <span className="umdl__appr umdl__appr--wait">
      <Clock size={11} />
      <span>{status}</span>
    </span>
  )
}

const RENTANG_KM_OPTIONS = [
  { value: '<75', label: '< 75 km (Pulang-Pergi)' },
  { value: '75-150', label: '75 - 150 km (Pulang-Pergi)' },
]

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const STATUS_DIBUAT = 'Di Buat'

const TABS = [
  { key: 'dibuat', label: 'Di Buat (Draft)' },
  { key: 'persetujuan', label: 'Persetujuan' },
]

const COLUMNS = [
  { key: 'status', label: 'Status & Approval', className: 'umdl__col-status' },
  { key: 'kodeUmdl', label: 'Kode UMDL & Izin', className: 'umdl__col-kode' },
  { key: 'tglUmdl', label: 'Tanggal & Jarak', className: 'umdl__col-tgl' },
  { key: 'keterangan', label: 'Keterangan Dinas', className: 'umdl__col-ket' },
  { key: 'peserta', label: 'Ketua & Anggota', className: 'umdl__col-peserta' },
]

const FILTER_PLACEHOLDER = 'Cari kode UMDL, izin, keterangan, atau peserta...'

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

  // Modal State
  const [detailModalRow, setDetailModalRow] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRows, setPickerRows] = useState([])
  const [pickerError, setPickerError] = useState('')

  // Rincian (ketua/anggota)
  const [detailFor, setDetailFor] = useState(null)
  const [detailBolehUbah, setDetailBolehUbah] = useState(true)
  const [peserta, setPeserta] = useState([])
  const [pesertaForm, setPesertaForm] = useState(emptyUmdlPeserta)
  const [pesertaError, setPesertaError] = useState('')
  const [editingPeserta, setEditingPeserta] = useState(null)

  const [pesertaPickerOpen, setPesertaPickerOpen] = useState(false)
  const [pesertaPickerQuery, setPesertaPickerQuery] = useState('')
  const [pesertaPickerRows, setPesertaPickerRows] = useState([])

  const [buktiPreview, setBuktiPreview] = useState(null)

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

  // Ringkasan metrik statistik UMDL
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
      if (r.tglUmdl) {
        const d = new Date(r.tglUmdl)
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

  function handlePrint(row) {
    const w = window.open('', '_blank')
    if (!w) return false

    const tglFormatted = formatTanggal(row.tglUmdl)
    const pesertaList = (row.peserta ?? [])
      .map(
        (p, i) =>
          `<tr><td style="text-align:center;width:40px;">${i + 1}</td><td style="font-family:monospace;">${p.nik || '-'}</td><td><b>${p.nama || p.nik || '-'}</b></td><td style="text-align:center;">${p.posisi || 'Anggota'}</td></tr>`
      )
      .join('')

    w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>UMDL_${row.kodeUmdl || 'Dokumen'}</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 20mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1a1f1b; font-size: 10.5pt; line-height: 1.5; }
    .kop { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f261f; padding-bottom: 10px; margin-bottom: 18px; }
    .kop-title { font-size: 14pt; font-weight: 800; color: #0f261f; margin: 0; }
    .kop-sub { font-size: 9pt; color: #556; margin: 2px 0 0; }
    .doc-title { text-align: center; font-size: 13pt; font-weight: 800; text-transform: uppercase; text-decoration: underline; margin: 16px 0 4px; }
    .doc-no { text-align: center; font-size: 10pt; font-weight: 600; color: #445; margin-bottom: 20px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .meta-table td { padding: 5px 8px; vertical-align: top; font-size: 10pt; }
    .meta-table td:first-child { width: 160px; font-weight: 600; color: #334; }
    .peserta-table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; }
    .peserta-table th, .peserta-table td { border: 1px solid #99a; padding: 6px 10px; font-size: 9.5pt; }
    .peserta-table th { background: #f0f4f2; font-weight: 700; text-align: left; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 9pt; font-weight: 700; background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .ttd-wrap { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .ttd-box { text-align: center; width: 200px; font-size: 9.5pt; }
    .ttd-space { height: 60px; }
    .ttd-name { font-weight: 700; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="kop">
    <div>
      <div class="kop-title">PT GERBANG CITRA SUKSES</div>
      <div class="kop-sub">Sistem Manajemen Sumber Daya Manusia (HRIS)</div>
    </div>
    <div style="text-align:right;">
      <span class="badge">${row.statusPersetujuan || row.status || 'Disetujui'}</span>
    </div>
  </div>

  <div class="doc-title">SURAT PERINTAH UANG MUKA DINAS LUAR (UMDL)</div>
  <div class="doc-no">Nomor: ${row.kodeUmdl || '-'}</div>

  <table class="meta-table">
    <tr>
      <td>Tanggal Pelaksanaan</td>
      <td>: ${tglFormatted}</td>
    </tr>
    <tr>
      <td>Rentang Jarak (PP)</td>
      <td>: ${row.rentangKm ? `${row.rentangKm} km (Pulang-Pergi)` : '-'}</td>
    </tr>
    <tr>
      <td>Surat Izin Terkait</td>
      <td>: ${row.kodeIjin || '-'}</td>
    </tr>
    <tr>
      <td>Keperluan / Agenda</td>
      <td>: ${row.keterangan || '-'}</td>
    </tr>
    <tr>
      <td>Status Persetujuan</td>
      <td>: <b>${row.statusPersetujuan || 'Disetujui'}</b></td>
    </tr>
  </table>

  <div style="font-weight:700;font-size:10pt;margin-top:14px;">Daftar Tim Pelaksana (Ketua & Anggota):</div>
  <table class="peserta-table">
    <thead>
      <tr>
        <th style="width:40px;text-align:center;">No</th>
        <th style="width:140px;">NIK</th>
        <th>Nama Pegawai</th>
        <th style="width:100px;text-align:center;">Posisi</th>
      </tr>
    </thead>
    <tbody>
      ${pesertaList || '<tr><td colspan="4" style="text-align:center;font-style:italic;">Belum ada anggota terdaftar</td></tr>'}
    </tbody>
  </table>

  <div class="ttd-wrap">
    <div class="ttd-box">
      <div>Pembuat Pengajuan,</div>
      <div class="ttd-space"></div>
      <div class="ttd-name">${(row.peserta?.find((p) => p.posisi === 'Ketua') || row.peserta?.[0])?.nama || 'Pemohon'}</div>
      <div>Tim Pelaksana</div>
    </div>
    <div class="ttd-box">
      <div>Mengetahui / Menyetujui,</div>
      <div class="ttd-space"></div>
      <div class="ttd-name">Manager Terkait</div>
      <div>Atasan Langsung</div>
    </div>
  </div>
</body>
</html>`)

    w.document.close()
    const cetak = () => {
      w.focus()
      w.print()
    }
    if (w.document.readyState === 'complete') setTimeout(cetak, 200)
    else w.addEventListener('load', () => setTimeout(cetak, 200))
    return true
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
      setFormError('Pilih surat izin dinas terlebih dahulu.')
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
    if (
      !(await dialog.confirm({
        title: 'Hapus UMDL',
        message: `Hapus pengajuan UMDL ${row.kodeUmdl}?`,
        danger: true,
        confirmText: 'Hapus',
      }))
    )
      return
    try {
      await api.deleteUmdl(row.id)
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal menghapus UMDL.')
    }
  }

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
    return (
      <div className="umdl">
        <div className="umdl__card umdl__state-card">
          <AlertCircle size={36} className="umdl__state-icon umdl__state-icon--err" />
          <h4 className="umdl__state-title">Gagal Memuat Data UMDL</h4>
          <p className="umdl__state-desc">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="umdl">
        <div className="umdl__card umdl__state-card">
          <div className="umdl__loading-spinner" />
          <h4 className="umdl__state-title">Memuat Data UMDL</h4>
          <p className="umdl__state-desc">Sedang mengambil riwayat uang muka dinas luar Anda...</p>
        </div>
      </div>
    )
  }

  const isDibuatTab = tab === 'dibuat'

  return (
    <div className="umdl">
      {/* Header Halaman */}
      <div className="umdl__page-header">
        <div className="umdl__page-header-info">
          <div className="umdl__page-header-icon">
            <Wallet size={24} />
          </div>
          <div>
            <h2 className="umdl__page-title">Uang Muka Dinas Luar (UMDL)</h2>
            <p className="umdl__page-subtitle">
              Pengajuan uang makan & akomodasi dinas luar kota jarak dekat (&lt;150 km PP), alokasi tim, dan bukti foto dinas
            </p>
          </div>
        </div>
        <div className="umdl__page-header-actions">
          {isDibuatTab && (
            <button type="button" className="umdl__btn-primary" onClick={openCreate}>
              <Plus size={16} /> <span>Ajukan UMDL Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Metrik Statistik */}
      <div className="umdl__stats-grid">
        <div className="umdl__stat-card">
          <div className="umdl__stat-icon umdl__stat-icon--total">
            <Wallet size={18} />
          </div>
          <div className="umdl__stat-body">
            <span className="umdl__stat-label">Total UMDL</span>
            <span className="umdl__stat-val">{stats.total}</span>
          </div>
        </div>

        <div className="umdl__stat-card">
          <div className="umdl__stat-icon umdl__stat-icon--draft">
            <Clock size={18} />
          </div>
          <div className="umdl__stat-body">
            <span className="umdl__stat-label">Di Buat (Draft)</span>
            <span className="umdl__stat-val umdl__stat-val--draft">{stats.dibuat}</span>
          </div>
        </div>

        <div className="umdl__stat-card">
          <div className="umdl__stat-icon umdl__stat-icon--approved">
            <CheckCircle2 size={18} />
          </div>
          <div className="umdl__stat-body">
            <span className="umdl__stat-label">Disetujui Manager</span>
            <span className="umdl__stat-val umdl__stat-val--approved">{stats.disetujui}</span>
          </div>
        </div>

        <div className="umdl__stat-card">
          <div className="umdl__stat-icon umdl__stat-icon--monthly">
            <Calendar size={18} />
          </div>
          <div className="umdl__stat-body">
            <span className="umdl__stat-label">Bulan Ini</span>
            <span className="umdl__stat-val umdl__stat-val--monthly">{stats.bulanIni}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="umdl__card">
        {/* Tab Selector & Navigation */}
        <div className="umdl__nav-bar">
          <div className="umdl__tabs">
            {TABS.map((t) => {
              const count = t.key === 'dibuat' ? stats.dibuat : stats.total - stats.dibuat
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`umdl__tab${tab === t.key ? ' umdl__tab--active' : ''}`}
                  onClick={() => switchTab(t.key)}
                >
                  <span>{t.label}</span>
                  <span className="umdl__tab-count">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="umdl__nav-actions">
            <button
              type="button"
              className="umdl__icon-btn umdl__icon-btn--refresh"
              onClick={load}
              title="Muat ulang data"
              aria-label="Muat ulang data"
            >
              <RotateCw size={15} />
            </button>
          </div>
        </div>

        {loadError && <div className="umdl__error">{loadError}</div>}

        {/* Toolbar Pencarian & Ukuran Halaman */}
        <div className="umdl__toolbar">
          <div className="umdl__search-box">
            <Search size={15} className="umdl__search-icon" />
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
                className="umdl__search-clear"
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

          <div className="umdl__page-size-wrap">
            <span className="umdl__page-size-label">Tampilkan:</span>
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

        {/* Tabel UMDL (Padat, Pas Layar, Baris Bisa Diklik) */}
        <div className="umdl__table-wrap">
          <table className="umdl__table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const isSorted = sort.key === col.key
                  return (
                    <th
                      key={col.key}
                      className={`${col.className} umdl__th--sortable ${isSorted ? 'umdl__th--active' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <div className="umdl__th-content">
                        <span>{col.label}</span>
                        <span className="umdl__sort-indicator">
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
                <th className="umdl__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="umdl__no-data">
                    <div className="umdl__empty-state">
                      <FileQuestion size={36} className="umdl__empty-icon" />
                      <span className="umdl__empty-title">Tidak ada permohonan UMDL</span>
                      <span className="umdl__empty-sub">
                        {search
                          ? `Tidak ditemukan data UMDL yang sesuai dengan "${search}".`
                          : isDibuatTab
                          ? 'Belum ada draf pengajuan UMDL yang dibuat.'
                          : 'Belum ada pengajuan UMDL yang telah diproses persetujuan.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const bolehUbah = row.peranSaya === 'Pembuat'
                  const isDibuat = row.status === STATUS_DIBUAT

                  return (
                    <tr
                      key={row.id}
                      className="umdl__row umdl__row--clickable"
                      onClick={() => setDetailModalRow(row)}
                      title="Klik untuk melihat detail lengkap UMDL"
                    >
                      {/* Status & Approval */}
                      <td className="umdl__col-status" data-label="Status">
                        <div className="umdl__status-group">
                          <span
                            className={`umdl__badge ${
                              isDibuat ? 'umdl__badge--pending' : 'umdl__badge--success'
                            } umdl__badge--sm`}
                          >
                            {row.status}
                          </span>
                          <StatusPersetujuanBadge status={row.statusPersetujuan} />
                          {!bolehUbah && row.peranSaya && (
                            <span className="umdl__peran-tag">Saya: {row.peranSaya}</span>
                          )}
                        </div>
                      </td>

                      {/* Kode UMDL & Izin */}
                      <td className="umdl__col-kode" data-label="Kode UMDL">
                        <div className="umdl__kode-cell">
                          <span className="umdl__kode-badge">{row.kodeUmdl || '-'}</span>
                          {row.kodeIjin ? (
                            <span className="umdl__source-tag">Izin: {row.kodeIjin}</span>
                          ) : (
                            row.source && <span className="umdl__source-tag">{row.source}</span>
                          )}
                        </div>
                      </td>

                      {/* Tanggal & Jarak */}
                      <td className="umdl__col-tgl" data-label="Tanggal & Jarak">
                        <div className="umdl__date-cell">
                          <div className="umdl__date-row">
                            <Calendar size={11} className="umdl__date-icon" />
                            <span className="umdl__date-text">{formatTanggal(row.tglUmdl)}</span>
                          </div>
                          {row.rentangKm && (
                            <span className="umdl__km-chip">
                              <MapPin size={9} /> {row.rentangKm} km (PP)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Keterangan Dinas */}
                      <td className="umdl__col-ket" data-label="Keterangan">
                        <span className="umdl__ket-text" title={row.keterangan}>
                          {row.keterangan || '-'}
                        </span>
                      </td>

                      {/* Ketua & Anggota */}
                      <td className="umdl__col-peserta" data-label="Ketua & Anggota">
                        <div className="umdl__peserta-cell">
                          {row.peserta?.length ? (
                            <div className="umdl__peserta-list">
                              {row.peserta.map((p) => (
                                <span
                                  key={p.idDet}
                                  className={`umdl__peserta-chip ${
                                    p.posisi === 'Ketua' ? 'umdl__peserta-chip--ketua' : ''
                                  }`}
                                  title={`${p.nama ?? p.nik} (${p.posisi})`}
                                >
                                  <b>{p.posisi === 'Ketua' ? 'K:' : 'A:'}</b> {p.nama ?? p.nik}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="umdl__dash">Belum ada peserta</span>
                          )}
                        </div>
                      </td>

                      {/* Aksi */}
                      <td
                        className="umdl__col-aksi"
                        data-label="Aksi"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="umdl__row-actions">
                          {/* Cetak Dokumen UMDL (muncul jika sudah disetujui atau di tab persetujuan) */}
                          {((row.statusPersetujuan ?? '').toLowerCase().includes('setuju') || !isDibuatTab) && (
                            <button
                              type="button"
                              className="umdl__row-btn umdl__row-btn--print"
                              onClick={() => handlePrint(row)}
                              title="Cetak Dokumen UMDL"
                              aria-label="Cetak Dokumen UMDL"
                            >
                              <Printer size={14} />
                            </button>
                          )}

                          {/* Foto Bukti */}
                          {row.fotoUrl && (
                            <button
                              type="button"
                              className="umdl__row-btn umdl__row-btn--camera"
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
                            className="umdl__row-btn umdl__row-btn--detail"
                            onClick={() => openDetail(row, bolehUbah)}
                            title="Kelola Ketua & Anggota"
                            aria-label="Kelola Ketua & Anggota"
                          >
                            <ListChecks size={14} />
                          </button>

                          {/* Ubah & Hapus (Draft Tab) */}
                          {isDibuatTab && bolehUbah && (
                            <>
                              <button
                                type="button"
                                className="umdl__row-btn umdl__row-btn--edit"
                                onClick={() => openEdit(row)}
                                title="Ubah UMDL"
                                aria-label="Ubah UMDL"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="umdl__row-btn umdl__row-btn--delete"
                                onClick={() => handleDelete(row)}
                                title="Hapus UMDL"
                                aria-label="Hapus UMDL"
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
        <div className="umdl__footer">
          <div className="umdl__footer-info">
            {totalEntries === 0 ? (
              '0 entri UMDL'
            ) : (
              <>
                Menampilkan <strong>{startIdx + 1}</strong>–
                <strong>{Math.min(startIdx + pageSize, totalEntries)}</strong> dari{' '}
                <strong>{totalEntries}</strong> entri
              </>
            )}
          </div>

          <div className="umdl__pagination">
            <button
              type="button"
              className="umdl__page-nav"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={15} />
              <span className="umdl__nav-text">Sebelumnya</span>
            </button>

            <div className="umdl__page-numbers">
              {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="umdl__page-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`umdl__page-num ${currentPage === p ? 'is-active' : ''}`}
                    onClick={() => setPage(Number(p))}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="umdl__page-nav"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Halaman berikutnya"
            >
              <span className="umdl__nav-text">Berikutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Lengkap UMDL (Muncul Saat Baris Diklik) */}
      {detailModalRow && (
        <div className="umdl__modal-backdrop" onClick={() => setDetailModalRow(null)}>
          <div className="umdl__modal umdl__modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <div className="umdl__modal-header-title">
                <Wallet size={18} />
                <h3>Detail Uang Muka Dinas Luar {detailModalRow.kodeUmdl ? `#${detailModalRow.kodeUmdl}` : ''}</h3>
              </div>
              <button
                type="button"
                className="umdl__modal-close"
                onClick={() => setDetailModalRow(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="umdl__detail-body">
              {/* Top Status & Code Banner */}
              <div className="umdl__detail-top">
                <div className="umdl__detail-ident">
                  <span className="umdl__detail-kode">{detailModalRow.kodeUmdl || '-'}</span>
                  {detailModalRow.kodeIjin && (
                    <span className="umdl__chip umdl__chip--izin">Izin: {detailModalRow.kodeIjin}</span>
                  )}
                  <span
                    className={`umdl__badge ${
                      detailModalRow.status === STATUS_DIBUAT ? 'umdl__badge--pending' : 'umdl__badge--success'
                    }`}
                  >
                    {detailModalRow.status}
                  </span>
                </div>
                <StatusPersetujuanBadge status={detailModalRow.statusPersetujuan} />
              </div>

              {/* Detail Items Grid */}
              <div className="umdl__detail-grid">
                <div className="umdl__detail-item">
                  <span className="umdl__detail-label">Tanggal Dinas</span>
                  <div className="umdl__detail-val sppd__detail-val--date">
                    <Calendar size={13} />
                    <span>{formatTanggal(detailModalRow.tglUmdl)}</span>
                  </div>
                </div>

                <div className="umdl__detail-item">
                  <span className="umdl__detail-label">Rentang Jarak (KM)</span>
                  <div className="umdl__detail-val">
                    <MapPin size={13} />
                    <span>{detailModalRow.rentangKm ? `${detailModalRow.rentangKm} km (PP)` : '-'}</span>
                  </div>
                </div>

                <div className="umdl__detail-item umdl__detail-item--full">
                  <span className="umdl__detail-label">Tim Pelaksana (Ketua & Anggota)</span>
                  <div className="umdl__detail-box">
                    {detailModalRow.peserta?.length ? (
                      <ul className="umdl__detail-peserta-list">
                        {detailModalRow.peserta.map((p) => (
                          <li key={p.idDet}>
                            <b>{p.nama ?? p.nik}</b> — <span className="umdl__role-tag">{p.posisi}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="umdl__dash">Belum ada rincian ketua/anggota.</span>
                    )}
                  </div>
                </div>

                <div className="umdl__detail-item umdl__detail-item--full">
                  <span className="umdl__detail-label">Keterangan / Keperluan Dinas</span>
                  <div className="umdl__detail-box">
                    {detailModalRow.keterangan ? (
                      <p className="umdl__detail-desc">{detailModalRow.keterangan}</p>
                    ) : (
                      <span className="umdl__dash">Tidak ada keterangan tambahan.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="umdl__modal-footer umdl__detail-footer">
              <div className="umdl__detail-actions-left">
                {((detailModalRow.statusPersetujuan ?? '').toLowerCase().includes('setuju') || detailModalRow.status !== STATUS_DIBUAT) && (
                  <button
                    type="button"
                    className="umdl__btn-outline umdl__btn-outline--print"
                    onClick={() => handlePrint(detailModalRow)}
                    title="Cetak Dokumen UMDL"
                  >
                    <Printer size={14} /> <span>Cetak Dokumen</span>
                  </button>
                )}
                {detailModalRow.fotoUrl && (
                  <button
                    type="button"
                    className="umdl__btn-outline umdl__btn-outline--photo"
                    onClick={() => viewBukti(detailModalRow)}
                    title="Lihat Foto Bukti"
                  >
                    <Camera size={14} /> <span>Foto Lokasi</span>
                  </button>
                )}
                <button
                  type="button"
                  className="umdl__btn-outline umdl__btn-outline--peserta"
                  onClick={() => {
                    const row = detailModalRow
                    const bolehUbah = row.peranSaya === 'Pembuat'
                    setDetailModalRow(null)
                    openDetail(row, bolehUbah)
                  }}
                  title="Kelola Tim"
                >
                  <ListChecks size={14} /> <span>Kelola Tim</span>
                </button>
              </div>
              <button
                type="button"
                className="umdl__btn-secondary"
                onClick={() => setDetailModalRow(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Pengajuan / Edit UMDL */}
      {modalOpen && (
        <div className="umdl__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="umdl__modal" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <div className="umdl__modal-header-title">
                <Wallet size={18} />
                <h3>{editing ? `Ubah UMDL #${editing.kodeUmdl}` : 'Ajukan UMDL Baru'}</h3>
              </div>
              <button
                type="button"
                className="umdl__modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form className="umdl__modal-body" onSubmit={handleSubmit}>
              <div className="umdl__modal-grid">
                {!editing && (
                  <label className="umdl__field umdl__field--full">
                    <span>Surat Izin Terkait *</span>
                    <div className="umdl__nik-picker">
                      <input
                        type="text"
                        value={form.kodeIjin ? `${form.kodeIjin}${form.tglUmdl ? ` (${formatTanggal(form.tglUmdl)})` : ''}` : ''}
                        placeholder="Klik tombol cari untuk memilih surat izin..."
                        readOnly
                        required
                      />
                      <button
                        type="button"
                        className="umdl__picker-btn"
                        onClick={openPicker}
                        title="Pilih Surat Izin"
                      >
                        <Search size={15} />
                      </button>
                    </div>
                  </label>
                )}

                <label className="umdl__field">
                  <span>Tanggal Dinas *</span>
                  <input
                    type="date"
                    value={form.tglUmdl}
                    onChange={(e) => setForm((p) => ({ ...p, tglUmdl: e.target.value }))}
                    required
                  />
                </label>

                <label className="umdl__field">
                  <span>Rentang Jarak (KM) *</span>
                  <select
                    value={form.rentangKm}
                    onChange={(e) => setForm((p) => ({ ...p, rentangKm: e.target.value }))}
                    required
                  >
                    <option value="">Pilih Rentang Jarak</option>
                    {RENTANG_KM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="umdl__field umdl__field--full">
                  <span>Keterangan Dinas *</span>
                  <textarea
                    rows={3}
                    value={form.keterangan}
                    maxLength={254}
                    placeholder="Tuliskan tujuan dan keperluan dinas luar..."
                    onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="umdl__hint-card">
                <Info size={15} />
                <span>
                  UMDL hanya untuk dinas luar jarak dekat <b>kurang dari 150 km (PP)</b>. Perjalanan dinas di atas 150 km wajib diajukan melalui modul <b>SPPD</b>.
                </span>
              </div>

              {editing && editing.fotoUrl && !form.bukti && (
                <div className="umdl__hint-card umdl__hint-card--info">
                  <Camera size={15} />
                  <span>Foto bukti dinas sebelumnya sudah tersimpan. Ambil foto baru di bawah hanya bila ingin menggantinya.</span>
                </div>
              )}

              <DinasKameraCapture value={form.bukti} onChange={(v) => setForm((p) => ({ ...p, bukti: v }))} />

              {formError && <div className="umdl__error">{formError}</div>}

              <div className="umdl__modal-footer">
                <button
                  type="button"
                  className="umdl__btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className="umdl__submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan & Kelola Tim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Picker Surat Izin */}
      {pickerOpen && (
        <div className="umdl__modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="umdl__modal umdl__modal--picker" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <div className="umdl__modal-header-title">
                <Search size={18} />
                <h3>Pilih Surat Izin Dinas</h3>
              </div>
              <button
                type="button"
                className="umdl__modal-close"
                onClick={() => setPickerOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {pickerError && <div className="umdl__error" style={{ margin: '14px 18px 0' }}>{pickerError}</div>}

            <div className="umdl__picker-table-wrap">
              <table className="umdl__table umdl__table--picker">
                <thead>
                  <tr>
                    <th>Kode Izin</th>
                    <th>Tanggal Izin</th>
                    <th>Jam</th>
                    <th>Keterangan</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Pilih</th>
                  </tr>
                </thead>
                <tbody>
                  {pickerRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="umdl__no-data">
                        Tidak ada data surat izin dinas yang tersedia.
                      </td>
                    </tr>
                  ) : (
                    pickerRows.map((izin) => (
                      <tr key={izin.idIjin} className="umdl__row--picker" onClick={() => pickIjin(izin)}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{izin.kodeIjin}</td>
                        <td>{formatTanggal(izin.tglIjin)}</td>
                        <td>{formatJam(izin.jamMulai)} - {formatJam(izin.jamSelesai)}</td>
                        <td>{izin.keterangan || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="umdl__row-btn umdl__row-btn--pick"
                            onClick={(e) => {
                              e.stopPropagation()
                              pickIjin(izin)
                            }}
                            title="Pilih Izin Ini"
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

      {/* Modal Rincian Ketua / Anggota */}
      {detailFor && (
        <div className="umdl__modal-backdrop" onClick={() => setDetailFor(null)}>
          <div className="umdl__modal umdl__modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <div className="umdl__modal-header-title">
                <Users size={18} />
                <h3>Kelola Tim UMDL #{detailFor.kodeUmdl}</h3>
              </div>
              <button
                type="button"
                className="umdl__modal-close"
                onClick={() => setDetailFor(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {!detailBolehUbah && (
              <div className="umdl__hint-card umdl__hint-card--info" style={{ margin: '14px 18px 0' }}>
                <Info size={15} />
                <span>Anda terdaftar sebagai anggota pada UMDL ini (bukan pembuat) — daftar tim di bawah bersifat hanya-baca (*read-only*).</span>
              </div>
            )}

            {detailBolehUbah && (
              <form className="umdl__modal-body umdl__peserta-form" onSubmit={handleSubmitPeserta}>
                <div className="umdl__modal-grid">
                  <label className="umdl__field">
                    <span>Pilih Pegawai *</span>
                    <div className="umdl__nik-picker">
                      <input
                        type="text"
                        value={pesertaForm.nama ? `${pesertaForm.nik} - ${pesertaForm.nama}` : ''}
                        placeholder="Klik tombol cari untuk memilih pegawai..."
                        readOnly
                      />
                      {!editingPeserta && (
                        <button
                          type="button"
                          className="umdl__picker-btn"
                          onClick={openPesertaPicker}
                          title="Cari Pegawai"
                        >
                          <Search size={15} />
                        </button>
                      )}
                    </div>
                  </label>

                  <label className="umdl__field">
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
                </div>

                {pesertaError && <div className="umdl__error">{pesertaError}</div>}

                <div className="umdl__modal-footer umdl__peserta-form-foot">
                  {editingPeserta && (
                    <button type="button" className="umdl__btn-secondary" onClick={resetPesertaForm}>
                      Batal Ubah
                    </button>
                  )}
                  <button type="submit" className="umdl__submit">
                    {editingPeserta ? (
                      <>
                        <Pencil size={14} /> <span>Simpan Perubahan</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> <span>Tambahkan Anggota</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Tabel Daftar Tim */}
            <div className="umdl__peserta-table-wrap">
              <table className="umdl__table umdl__table--peserta">
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>Posisi</th>
                    <th style={{ width: '25%' }}>NIK</th>
                    <th style={{ width: '40%' }}>Nama</th>
                    {detailBolehUbah && <th style={{ width: '15%', textAlign: 'center' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {peserta.length === 0 ? (
                    <tr>
                      <td colSpan={detailBolehUbah ? 4 : 3} className="umdl__no-data">
                        Belum ada anggota tim terdaftar.
                      </td>
                    </tr>
                  ) : (
                    peserta.map((p) => (
                      <tr key={p.idDet} className={editingPeserta?.idDet === p.idDet ? 'umdl__row--editing' : undefined}>
                        <td>
                          <span
                            className={`umdl__badge ${
                              p.posisi === 'Ketua' ? 'umdl__badge--primary' : 'umdl__badge--neutral'
                            } umdl__badge--sm`}
                          >
                            {p.posisi}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.nik}</td>
                        <td>
                          <b>{p.nama ?? '-'}</b>
                        </td>
                        {detailBolehUbah && (
                          <td style={{ textAlign: 'center' }}>
                            <div className="umdl__row-actions">
                              <button
                                type="button"
                                className="umdl__row-btn umdl__row-btn--edit"
                                onClick={() => openEditPeserta(p)}
                                title="Ubah posisi"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="umdl__row-btn umdl__row-btn--delete"
                                onClick={() => handleDeletePeserta(p.idDet)}
                                title="Hapus anggota"
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

            <div className="umdl__modal-footer">
              <button
                type="button"
                className="umdl__btn-secondary"
                onClick={() => setDetailFor(null)}
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Picker Pegawai UMDL */}
      {pesertaPickerOpen && (
        <div className="umdl__modal-backdrop" onClick={() => setPesertaPickerOpen(false)}>
          <div className="umdl__modal umdl__modal--picker" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <div className="umdl__modal-header-title">
                <Users size={18} />
                <h3>Pilih Pegawai untuk Tim</h3>
              </div>
              <button
                type="button"
                className="umdl__modal-close"
                onClick={() => setPesertaPickerOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="umdl__modal-body" style={{ paddingBottom: '8px' }}>
              <div className="umdl__search-box" style={{ maxWidth: 'none' }}>
                <Search size={15} className="umdl__search-icon" />
                <input
                  type="text"
                  value={pesertaPickerQuery}
                  onChange={(e) => runPesertaPicker(e.target.value)}
                  placeholder="Ketik NIK atau nama pegawai..."
                  autoFocus
                />
              </div>
            </div>

            <div className="umdl__picker-table-wrap">
              <table className="umdl__table umdl__table--picker">
                <thead>
                  <tr>
                    <th>NIK</th>
                    <th>Nama</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Pilih</th>
                  </tr>
                </thead>
                <tbody>
                  {pesertaPickerRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="umdl__no-data">
                        Tidak ada data pegawai yang cocok.
                      </td>
                    </tr>
                  ) : (
                    pesertaPickerRows.map((p) => (
                      <tr key={p.nik} className="umdl__row--picker" onClick={() => pickPesertaPegawai(p)}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.nik}</td>
                        <td>
                          <b>{p.nama}</b>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="umdl__row-btn umdl__row-btn--pick"
                            onClick={(e) => {
                              e.stopPropagation()
                              pickPesertaPegawai(p)
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
        <div className="umdl__modal-backdrop" onClick={closeBuktiPreview}>
          <div className="umdl__modal umdl__modal--photo" onClick={(e) => e.stopPropagation()}>
            <div className="umdl__modal-header">
              <div className="umdl__modal-header-title">
                <Camera size={18} />
                <h3>Foto Bukti Lokasi Dinas</h3>
              </div>
              <button
                type="button"
                className="umdl__modal-close"
                onClick={closeBuktiPreview}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <div className="umdl__modal-body" style={{ textAlign: 'center', padding: '16px' }}>
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
