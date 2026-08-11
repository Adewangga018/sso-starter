import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowDown, ArrowRight, Briefcase, Building2, ChevronDown, ChevronRight,
  ChevronUp, Compass, Eye, Layers, LayoutGrid, ListTree, Maximize2, Network,
  Pencil, Plus, RefreshCw, RotateCcw, Search, Sparkles, Trash2, UserCheck, UserPlus, Users, X, ZoomIn, ZoomOut
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useDialog } from '../components/DialogProvider'
import './OrgStruktur.css'

const TIPE_UNIT = ['Direktorat', 'Kompartemen', 'Departemen', 'Region', 'Kelompok']

const TIPE_COLORS = {
  Direktorat: { bg: '#0f261f', text: '#f4ae46', border: '#1f4f2c', badgeBg: 'rgba(244, 174, 70, 0.15)', badgeText: '#f4ae46' },
  Kompartemen: { bg: '#1e293b', text: '#38bdf8', border: '#334155', badgeBg: 'rgba(56, 189, 248, 0.15)', badgeText: '#38bdf8' },
  Departemen: { bg: '#064e3b', text: '#34d399', border: '#065f46', badgeBg: 'rgba(52, 211, 153, 0.15)', badgeText: '#34d399' },
  Region: { bg: '#78350f', text: '#fbbf24', border: '#92400e', badgeBg: 'rgba(251, 191, 36, 0.15)', badgeText: '#fbbf24' },
  Kelompok: { bg: '#4c1d95', text: '#c084fc', border: '#5b21b6', badgeBg: 'rgba(192, 132, 252, 0.15)', badgeText: '#c084fc' },
}

const emptyUnitForm = { nama: '', tipe: 'Departemen', idUnitInduk: '', wilayah: '', keterangan: '' }
const emptyJabatanForm = {
  kode: '', namaJabatan: '', idBand: '', jg: '', idUnit: '', idAtasan: '',
  inti: '', kelompokFungsi: '', jumlahFormasi: '', alasan: '', aktif: true,
}

function buildTree(units) {
  const byInduk = new Map()
  units.forEach((u) => {
    const key = u.idUnitInduk ?? 0
    if (!byInduk.has(key)) byInduk.set(key, [])
    byInduk.get(key).push(u)
  })
  const sortNama = (a, b) => a.nama.localeCompare(b.nama)
  byInduk.forEach((list) => list.sort(sortNama))

  function attach(idUnit) {
    const children = byInduk.get(idUnit) ?? []
    return children.map((u) => ({ ...u, children: attach(u.idUnit) }))
  }
  return attach(0)
}

function buildJabatanTree(jabatanList) {
  const byAtasan = new Map()
  jabatanList.forEach((j) => {
    const key = j.idAtasan ?? 0
    if (!byAtasan.has(key)) byAtasan.set(key, [])
    byAtasan.get(key).push(j)
  })
  const sortNama = (a, b) => a.namaJabatan.localeCompare(b.namaJabatan)
  byAtasan.forEach((list) => list.sort(sortNama))

  function attach(idAtasan) {
    const children = byAtasan.get(idAtasan) ?? []
    return children.map((j) => ({ ...j, children: attach(j.idJabatan) }))
  }
  return attach(0)
}

function initialAvatar(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/* --- Component: Node Unit untuk Sidebar Tree --- */
function UnitTreeNode({ node, depth, selectedId, expanded, search, onToggle, onSelect, onEdit, onDelete, onCreateSub }) {
  const isExpanded = expanded.has(node.idUnit)
  const hasChildren = node.children && node.children.length > 0
  const matchesSearch = !search || node.nama.toLowerCase().includes(search.toLowerCase()) || node.tipe.toLowerCase().includes(search.toLowerCase())
  const colors = TIPE_COLORS[node.tipe] || TIPE_COLORS.Departemen

  if (!matchesSearch && search && !node.children.some(c => c.nama.toLowerCase().includes(search.toLowerCase()))) {
    return null
  }

  return (
    <div className="org-tree__unit-node">
      <div
        className={`org-tree__unit-row ${selectedId === node.idUnit ? 'is-selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 18 }}
      >
        <button
          type="button"
          className="org-tree__unit-caret"
          onClick={() => hasChildren && onToggle(node.idUnit)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="org-tree__caret-spacer" />
          )}
        </button>
        <button type="button" className="org-tree__unit-label" onClick={() => onSelect(node.idUnit)}>
          <span className="org-tree__unit-tipe" style={{ color: colors.badgeText, backgroundColor: colors.badgeBg }}>
            {node.tipe}
          </span>
          <span className="org-tree__unit-nama">{node.nama}</span>
          <span className="org-tree__unit-count" title={`${node.jumlahJabatan} jabatan`}>
            {node.jumlahJabatan} <Briefcase size={11} />
          </span>
        </button>
        <div className="org-tree__unit-actions">
          <button type="button" className="org-iconbtn" title="Tambah Sub-unit" onClick={() => onCreateSub(node.idUnit)}>
            <Plus size={13} />
          </button>
          <button type="button" className="org-iconbtn" title="Ubah Unit" onClick={() => onEdit(node)}>
            <Pencil size={13} />
          </button>
          <button type="button" className="org-iconbtn org-iconbtn--danger" title="Hapus Unit" onClick={() => onDelete(node)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {hasChildren && isExpanded && node.children.map((c) => (
        <UnitTreeNode
          key={c.idUnit} node={c} depth={depth + 1} selectedId={selectedId} expanded={expanded}
          search={search} onToggle={onToggle} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete}
          onCreateSub={onCreateSub}
        />
      ))}
    </div>
  )
}

/* --- Component: Card Visual Org Chart (Vertical / Horizontal) --- */
function OrgChartNode({
  node, jabatanList, search, orientation = 'vertical',
  onSelectUnit, onEditUnit, onDeleteUnit, onCreateSubUnit, onCreateJabatan, onViewJabatanDetail
}) {
  const [collapsed, setCollapsed] = useState(false)
  const colors = TIPE_COLORS[node.tipe] || TIPE_COLORS.Departemen
  const unitJabatan = useMemo(() => jabatanList.filter(j => j.idUnit === node.idUnit), [jabatanList, node.idUnit])

  const filledPositions = unitJabatan.reduce((acc, j) => acc + (j.incumbent?.length || 0), 0)
  const totalFormasi = unitJabatan.reduce((acc, j) => acc + (j.jumlahFormasi || 1), 0)

  const isMatched = search && (
    node.nama.toLowerCase().includes(search.toLowerCase()) ||
    node.tipe.toLowerCase().includes(search.toLowerCase()) ||
    unitJabatan.some(j => j.namaJabatan.toLowerCase().includes(search.toLowerCase()))
  )

  const hasChildren = node.children && node.children.length > 0

  return (
    <div className={`org-chart__branch org-chart__branch--${orientation} ${isMatched ? 'is-highlighted' : ''}`}>
      <div className="org-chart__card">
        <div className="org-chart__card-header" style={{ background: colors.bg, borderColor: colors.border }}>
          <div className="org-chart__card-type" style={{ color: colors.text }}>
            <Building2 size={12} />
            <span>{node.tipe}</span>
          </div>
          <h4 className="org-chart__card-title" onClick={() => onSelectUnit(node.idUnit)} title="Lihat detail unit">
            {node.nama}
          </h4>
          {node.wilayah && <span className="org-chart__card-loc">📍 {node.wilayah}</span>}
          <div className="org-chart__card-actions">
            <button type="button" className="org-chart__action-btn" title="Tambah Sub-unit" onClick={() => onCreateSubUnit(node.idUnit)}>
              <Plus size={12} /> Sub
            </button>
            <button type="button" className="org-chart__action-btn" title="Tambah Jabatan di Unit ini" onClick={() => onCreateJabatan(node.idUnit)}>
              <Plus size={12} /> Jabatan
            </button>
            <button type="button" className="org-chart__action-btn" title="Edit Unit" onClick={() => onEditUnit(node)}>
              <Pencil size={12} />
            </button>
            <button type="button" className="org-chart__action-btn org-chart__action-btn--danger" title="Hapus Unit" onClick={() => onDeleteUnit(node)}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div className="org-chart__card-body">
          <div className="org-chart__stats-row">
            <span className="org-chart__chip"><Briefcase size={11} /> {unitJabatan.length} Jabatan</span>
            <span className="org-chart__chip"><Users size={11} /> {filledPositions}/{totalFormasi} Formasi</span>
          </div>

          {unitJabatan.length > 0 ? (
            <div className="org-chart__jabatan-list">
              {unitJabatan.slice(0, 4).map((j) => (
                <div key={j.idJabatan} className="org-chart__jabatan-item" onClick={() => onViewJabatanDetail(j)}>
                  <div className="org-chart__jabatan-info">
                    <span className="org-chart__jabatan-name">{j.namaJabatan}</span>
                    <span className="org-chart__jabatan-band">{j.namaBand || `Band ${j.idBand}`}</span>
                  </div>
                  <div className="org-chart__incumbents">
                    {j.incumbent && j.incumbent.length > 0 ? (
                      j.incumbent.map((inc) => (
                        <span key={inc.id} className="org-chart__avatar" title={`${inc.nama} (${inc.idKaryawan})`}>
                          {initialAvatar(inc.nama)}
                        </span>
                      ))
                    ) : (
                      <span className="org-chart__empty-formasi" title="Formasi Kosong">Kosong</span>
                    )}
                  </div>
                </div>
              ))}
              {unitJabatan.length > 4 && (
                <button type="button" className="org-chart__more-btn" onClick={() => onSelectUnit(node.idUnit)}>
                  +{unitJabatan.length - 4} jabatan lainnya...
                </button>
              )}
            </div>
          ) : (
            <div className="org-chart__no-jabatan">Belum ada jabatan</div>
          )}
        </div>

        {hasChildren && (
          <button
            type="button"
            className="org-chart__toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Tampilkan sub-unit' : 'Sembunyikan sub-unit'}
          >
            {collapsed ? (orientation === 'horizontal' ? <ChevronRight size={14} /> : <ChevronDown size={14} />) : (orientation === 'horizontal' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
            <span>{node.children.length} Sub-unit</span>
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className={`org-chart__children org-chart__children--${orientation}`}>
          {node.children.map((child) => (
            <OrgChartNode
              key={child.idUnit} node={child} jabatanList={jabatanList} search={search}
              orientation={orientation}
              onSelectUnit={onSelectUnit} onEditUnit={onEditUnit} onDeleteUnit={onDeleteUnit}
              onCreateSubUnit={onCreateSubUnit} onCreateJabatan={onCreateJabatan}
              onViewJabatanDetail={onViewJabatanDetail}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* --- Component: Item Tree Hirarki Reporting Jabatan --- */
function ReportingJabatanNode({ node, depth, search, onViewDetail, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const filledCount = node.incumbent?.length || 0
  const targetFormasi = node.jumlahFormasi || 1
  const isVacant = filledCount === 0

  const matchesSearch = !search || node.namaJabatan.toLowerCase().includes(search.toLowerCase()) || (node.namaUnit && node.namaUnit.toLowerCase().includes(search.toLowerCase()))

  if (!matchesSearch && search && !node.children.some(c => c.namaJabatan.toLowerCase().includes(search.toLowerCase()))) {
    return null
  }

  return (
    <div className="org-report__node">
      <div className="org-report__card" style={{ marginLeft: depth * 24 }}>
        <button
          type="button"
          className="org-report__toggle"
          onClick={() => hasChildren && setExpanded(!expanded)}
          disabled={!hasChildren}
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="org-report__spacer" />}
        </button>

        <div className="org-report__content" onClick={() => onViewDetail(node)}>
          <div className="org-report__main">
            <span className="org-report__title">{node.namaJabatan}</span>
            <span className="org-report__unit">{node.namaUnit ? `🏢 ${node.namaUnit}` : 'Direksi / Tanpa Unit'}</span>
          </div>
          <div className="org-report__meta">
            <span className="org-report__badge">{node.namaBand || `Band ${node.idBand}`}</span>
            {node.jg && <span className="org-report__badge org-report__badge--jg">JG {node.jg}</span>}
            <span className={`org-report__formasi ${isVacant ? 'is-vacant' : 'is-filled'}`}>
              <Users size={12} /> {filledCount}/{targetFormasi} Terisi
            </span>
          </div>
        </div>

        <div className="org-report__actions">
          <button type="button" className="org-iconbtn" title="Ubah Jabatan" onClick={() => onEdit(node)}>
            <Pencil size={13} />
          </button>
          <button type="button" className="org-iconbtn org-iconbtn--danger" title="Hapus Jabatan" onClick={() => onDelete(node)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="org-report__children">
          {node.children.map((c) => (
            <ReportingJabatanNode
              key={c.idJabatan} node={c} depth={depth + 1} search={search}
              onViewDetail={onViewDetail} onEdit={onEdit} onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgStrukturPage() {
  const dialog = useDialog()
  const [units, setUnits] = useState([])
  const [jabatan, setJabatan] = useState([])
  const [band, setBand] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [viewMode, setViewMode] = useState('chart') // 'chart' | 'manage' | 'reporting'
  const [search, setSearch] = useState('')

  /* Canvas Controls State (Zoom & Pan) */
  const viewportRef = useRef(null)
  const canvasRef = useRef(null)
  const [zoomLevel, setZoomLevel] = useState(0.95)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [chartOrientation, setChartOrientation] = useState('vertical') // 'vertical' | 'horizontal'

  /* Drawer detail jabatan & incumbent */
  const [detailJabatan, setDetailJabatan] = useState(null)

  /* Modals */
  const [unitModal, setUnitModal] = useState(false)
  const [unitEditing, setUnitEditing] = useState(null)
  const [unitForm, setUnitForm] = useState(emptyUnitForm)
  const [unitError, setUnitError] = useState('')
  const [unitSaving, setUnitSaving] = useState(false)

  const [jabatanModal, setJabatanModal] = useState(false)
  const [jabatanEditing, setJabatanEditing] = useState(null)
  const [jabatanForm, setJabatanForm] = useState(emptyJabatanForm)
  const [jabatanError, setJabatanError] = useState('')
  const [jabatanSaving, setJabatanSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [u, j, b] = await Promise.all([api.getOrgUnit(), api.getOrgJabatan(), api.getOrgBand()])
      setUnits(u); setJabatan(j); setBand(b)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat struktur organisasi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tree = useMemo(() => buildTree(units), [units])
  const jabatanTree = useMemo(() => buildJabatanTree(jabatan), [jabatan])
  const unitById = useMemo(() => new Map(units.map((u) => [u.idUnit, u])), [units])

  /* Auto expand first level units on initial load */
  useEffect(() => {
    if (units.length > 0 && expanded.size === 0) {
      const rootIds = units.filter(u => u.idUnitInduk === null || u.idUnitInduk === 0).map(u => u.idUnit)
      setExpanded(new Set(rootIds))
    }
  }, [units, expanded.size])

  /* Wheel Zoom handling on canvas viewport */
  useEffect(() => {
    const el = viewportRef.current
    if (!el || viewMode !== 'chart') return

    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      setZoomLevel((prev) => {
        const next = Math.min(Math.max(0.3, prev + delta), 2.2)
        return Number(next.toFixed(2))
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [viewMode])

  /* Auto fit view calculation */
  const fitView = useCallback(() => {
    if (!viewportRef.current || !canvasRef.current) {
      setZoomLevel(0.9)
      setPanX(0)
      setPanY(0)
      return
    }
    const vpW = viewportRef.current.clientWidth || 900
    const vpH = viewportRef.current.clientHeight || 500
    const cvW = canvasRef.current.scrollWidth || 1200
    const cvH = canvasRef.current.scrollHeight || 700

    const scaleX = (vpW - 60) / cvW
    const scaleY = (vpH - 60) / cvH
    const bestScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.1)

    setZoomLevel(Number(bestScale.toFixed(2)))
    setPanX(0)
    setPanY(0)
  }, [])

  /* Pan Drag Handlers */
  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    if (e.target.closest('button, input, a, select')) return
    setIsDragging(true)
    setStartPan({ x: e.clientX - panX, y: e.clientY - panY })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPanX(e.clientX - startPan.x)
    setPanY(e.clientY - startPan.y)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setIsDragging(true)
      setStartPan({ x: touch.clientX - panX, y: touch.clientY - panY })
    }
  }

  const handleTouchMove = (e) => {
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0]
      setPanX(touch.clientX - startPan.x)
      setPanY(touch.clientY - startPan.y)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  /* Calculated KPI Stats */
  const stats = useMemo(() => {
    const totalUnits = units.length
    const totalJabatan = jabatan.length
    const totalFormasiSlots = jabatan.reduce((acc, j) => acc + (j.jumlahFormasi || 1), 0)
    const filledFormasiSlots = jabatan.reduce((acc, j) => acc + (j.incumbent?.length || 0), 0)
    const vacantJabatan = jabatan.filter(j => (!j.incumbent || j.incumbent.length === 0)).length
    const filledPercent = totalFormasiSlots > 0 ? Math.round((filledFormasiSlots / totalFormasiSlots) * 100) : 0

    return { totalUnits, totalJabatan, totalFormasiSlots, filledFormasiSlots, vacantJabatan, filledPercent }
  }, [units, jabatan])

  const jabatanTampil = useMemo(() => {
    let list = jabatan
    if (selectedUnit === null) {
      list = jabatan.filter((j) => j.idUnit === null)
    } else if (selectedUnit !== 'ALL') {
      list = jabatan.filter((j) => j.idUnit === selectedUnit)
    }
    if (search.trim()) {
      const term = search.toLowerCase()
      list = list.filter((j) =>
        j.namaJabatan.toLowerCase().includes(term) ||
        (j.namaBand && j.namaBand.toLowerCase().includes(term)) ||
        (j.namaAtasan && j.namaAtasan.toLowerCase().includes(term)) ||
        j.incumbent?.some(i => i.nama.toLowerCase().includes(term) || i.idKaryawan.toLowerCase().includes(term))
      )
    }
    return list
  }, [jabatan, selectedUnit, search])

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpanded(new Set(units.map(u => u.idUnit)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  /* --- Unit CRUD --- */

  function openCreateUnit(parentId = null) {
    setUnitEditing(null)
    setUnitForm({ ...emptyUnitForm, idUnitInduk: parentId ?? (selectedUnit && selectedUnit !== 'ALL' ? selectedUnit : '') })
    setUnitError('')
    setUnitModal(true)
  }

  function openEditUnit(u) {
    setUnitEditing(u)
    setUnitForm({
      nama: u.nama, tipe: u.tipe, idUnitInduk: u.idUnitInduk ?? '',
      wilayah: u.wilayah ?? '', keterangan: u.keterangan ?? '',
    })
    setUnitError('')
    setUnitModal(true)
  }

  async function submitUnit(e) {
    e.preventDefault()
    setUnitError('')
    if (!unitForm.nama.trim()) { setUnitError('Nama unit wajib diisi.'); return }
    setUnitSaving(true)
    try {
      const payload = {
        nama: unitForm.nama.trim(),
        tipe: unitForm.tipe,
        idUnitInduk: unitForm.idUnitInduk === '' ? null : Number(unitForm.idUnitInduk),
        wilayah: unitForm.wilayah.trim() || null,
        keterangan: unitForm.keterangan.trim() || null,
      }
      if (unitEditing) await api.ubahOrgUnit(unitEditing.idUnit, payload)
      else await api.buatOrgUnit(payload)
      setUnitModal(false)
      await load()
    } catch (err) {
      setUnitError(err instanceof ApiError ? err.message : 'Gagal menyimpan unit.')
    } finally {
      setUnitSaving(false)
    }
  }

  async function deleteUnit(u) {
    if (!(await dialog.confirm({ title: 'Hapus Unit', message: `Hapus unit "${u.nama}"? Semua jabatan di dalamnya akan terpengaruh.`, danger: true, confirmText: 'Hapus' }))) return
    try {
      await api.hapusOrgUnit(u.idUnit)
      if (selectedUnit === u.idUnit) setSelectedUnit(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus unit.')
    }
  }

  /* --- Jabatan CRUD --- */

  function openCreateJabatan(presetUnitId = null) {
    setJabatanEditing(null)
    const targetUnit = presetUnitId ?? (selectedUnit && selectedUnit !== 'ALL' ? selectedUnit : '')
    setJabatanForm({ ...emptyJabatanForm, idUnit: targetUnit })
    setJabatanError('')
    setJabatanModal(true)
  }

  function openEditJabatan(j) {
    setJabatanEditing(j)
    setJabatanForm({
      kode: j.kode ?? '', namaJabatan: j.namaJabatan, idBand: j.idBand,
      jg: j.jg ?? '', idUnit: j.idUnit ?? '', idAtasan: j.idAtasan ?? '',
      inti: j.inti === null || j.inti === undefined ? '' : String(j.inti),
      kelompokFungsi: j.kelompokFungsi ?? '', jumlahFormasi: j.jumlahFormasi ?? '',
      alasan: '', aktif: j.aktif,
    })
    setJabatanError('')
    setJabatanModal(true)
  }

  async function submitJabatan(e) {
    e.preventDefault()
    setJabatanError('')
    if (!jabatanForm.namaJabatan.trim()) { setJabatanError('Nama jabatan wajib diisi.'); return }
    if (jabatanForm.idBand === '') { setJabatanError('Band wajib dipilih.'); return }
    setJabatanSaving(true)
    try {
      const payload = {
        kode: jabatanForm.kode === '' ? null : Number(jabatanForm.kode),
        namaJabatan: jabatanForm.namaJabatan.trim(),
        idBand: Number(jabatanForm.idBand),
        jg: jabatanForm.jg === '' ? null : Number(jabatanForm.jg),
        idUnit: jabatanForm.idUnit === '' ? null : Number(jabatanForm.idUnit),
        idAtasan: jabatanForm.idAtasan === '' ? null : Number(jabatanForm.idAtasan),
        inti: jabatanForm.inti === '' ? null : jabatanForm.inti === 'true',
        kelompokFungsi: jabatanForm.kelompokFungsi.trim() || null,
        jumlahFormasi: jabatanForm.jumlahFormasi === '' ? null : Number(jabatanForm.jumlahFormasi),
        alasan: jabatanForm.alasan.trim() || null,
        aktif: jabatanForm.aktif,
      }
      if (jabatanEditing) await api.ubahOrgJabatan(jabatanEditing.idJabatan, payload)
      else await api.buatOrgJabatan(payload)
      setJabatanModal(false)
      await load()
    } catch (err) {
      setJabatanError(err instanceof ApiError ? err.message : 'Gagal menyimpan jabatan.')
    } finally {
      setJabatanSaving(false)
    }
  }

  async function deleteJabatan(j) {
    if (!(await dialog.confirm({ title: 'Hapus Jabatan', message: `Hapus jabatan "${j.namaJabatan}"?`, danger: true, confirmText: 'Hapus' }))) return
    try {
      await api.hapusOrgJabatan(j.idJabatan)
      if (detailJabatan?.idJabatan === j.idJabatan) setDetailJabatan(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus jabatan.')
    }
  }

  const selectedUnitObj = selectedUnit === null ? null : (selectedUnit === 'ALL' ? { nama: 'Semua Unit Organisasi', tipe: 'GLOBAL' } : unitById.get(selectedUnit))

  return (
    <div className="org-page">
      {/* Header Banner */}
      <header className="org-header">
        <div className="org-header__content">
          <div className="org-header__title-group">
            <span className="org-header__icon"><Network size={24} /></span>
            <div>
              <h1>Struktur Organisasi &amp; Jabatan</h1>
              <p>Visualisasi interaktif hirarki unit kerja, formasi jabatan, dan skema atasan-bawahan PT GCS.</p>
            </div>
          </div>
          <div className="org-header__actions">
            <button type="button" className="org-btn org-btn--sec" onClick={() => openCreateUnit()}>
              <Plus size={16} /> Unit Baru
            </button>
            <button type="button" className="org-btn org-btn--pri" onClick={() => openCreateJabatan()}>
              <Plus size={16} /> Jabatan Baru
            </button>
            <button type="button" className="org-iconbtn org-iconbtn--lg" title="Refresh Data" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'org-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Stats Highlight Cards */}
        <div className="org-stats">
          <div className="org-stat-card">
            <div className="org-stat-card__icon org-stat-card__icon--emerald"><Building2 size={20} /></div>
            <div className="org-stat-card__data">
              <span className="org-stat-card__value">{stats.totalUnits}</span>
              <span className="org-stat-card__label">Unit Organisasi</span>
            </div>
          </div>

          <div className="org-stat-card">
            <div className="org-stat-card__icon org-stat-card__icon--blue"><Briefcase size={20} /></div>
            <div className="org-stat-card__data">
              <span className="org-stat-card__value">{stats.totalJabatan}</span>
              <span className="org-stat-card__label">Jabatan Terdaftar</span>
            </div>
          </div>

          <div className="org-stat-card">
            <div className="org-stat-card__icon org-stat-card__icon--gold"><UserCheck size={20} /></div>
            <div className="org-stat-card__data">
              <div className="org-stat-card__row">
                <span className="org-stat-card__value">{stats.filledFormasiSlots}</span>
                <span className="org-stat-card__sub">/ {stats.totalFormasiSlots} Slot</span>
              </div>
              <div className="org-stat-card__bar">
                <div className="org-stat-card__progress" style={{ width: `${stats.filledPercent}%` }} />
              </div>
              <span className="org-stat-card__label">{stats.filledPercent}% Formasi Terisi</span>
            </div>
          </div>

          <div className={`org-stat-card ${stats.vacantJabatan > 0 ? 'org-stat-card--warn' : ''}`}>
            <div className="org-stat-card__icon org-stat-card__icon--rose"><AlertCircle size={20} /></div>
            <div className="org-stat-card__data">
              <span className="org-stat-card__value">{stats.vacantJabatan}</span>
              <span className="org-stat-card__label">Jabatan Kosong</span>
            </div>
          </div>
        </div>

        {/* Toolbar & View Switcher */}
        <div className="org-toolbar">
          <div className="org-toolbar__tabs">
            <button
              type="button"
              className={`org-tab ${viewMode === 'chart' ? 'is-active' : ''}`}
              onClick={() => setViewMode('chart')}
            >
              <LayoutGrid size={16} /> Diagram Chart Visual
            </button>
            <button
              type="button"
              className={`org-tab ${viewMode === 'manage' ? 'is-active' : ''}`}
              onClick={() => setViewMode('manage')}
            >
              <ListTree size={16} /> Kelola Unit &amp; Jabatan
            </button>
            <button
              type="button"
              className={`org-tab ${viewMode === 'reporting' ? 'is-active' : ''}`}
              onClick={() => setViewMode('reporting')}
            >
              <Layers size={16} /> Hirarki Reporting (Atasan)
            </button>
          </div>

          <div className="org-toolbar__search">
            <Search size={16} className="org-toolbar__search-icon" />
            <input
              type="text"
              placeholder="Cari nama unit, jabatan, atau karyawan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="org-toolbar__clear" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {error && <div className="org-alert org-alert--err">{error}</div>}

      {/* --- MODE 1: VISUAL DIAGRAM CHART CANVAS --- */}
      {viewMode === 'chart' && (
        <div className="org-chart-wrapper">
          <div className="org-chart-controls">
            <div className="org-chart-controls__orient">
              <span className="org-chart-controls__label"><Sparkles size={14} /> Tata Letak:</span>
              <button
                type="button"
                className={`org-chart-btn ${chartOrientation === 'vertical' ? 'is-active' : ''}`}
                onClick={() => setChartOrientation('vertical')}
              >
                <ArrowDown size={13} /> Pohon Ke Bawah
              </button>
              <button
                type="button"
                className={`org-chart-btn ${chartOrientation === 'horizontal' ? 'is-active' : ''}`}
                onClick={() => setChartOrientation('horizontal')}
              >
                <ArrowRight size={13} /> Pohon Ke Samping
              </button>
            </div>

            <div className="org-chart-controls__group">
              <button type="button" className="org-iconbtn" title="Zoom Out (Scroll mouse ke bawah)" onClick={() => setZoomLevel(z => Math.max(0.3, Number((z - 0.1).toFixed(2))))}>
                <ZoomOut size={15} />
              </button>
              <span className="org-chart-zoom-val">{Math.round(zoomLevel * 100)}%</span>
              <button type="button" className="org-iconbtn" title="Zoom In (Scroll mouse ke atas)" onClick={() => setZoomLevel(z => Math.min(2.2, Number((z + 0.1).toFixed(2))))}>
                <ZoomIn size={15} />
              </button>
              <button type="button" className="org-iconbtn" title="Fit Layout / Pas Layar" onClick={fitView}>
                <Maximize2 size={15} />
              </button>
              <button type="button" className="org-iconbtn" title="Reset Zoom & Pan" onClick={() => { setZoomLevel(1); setPanX(0); setPanY(0) }}>
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          <div
            ref={viewportRef}
            className={`org-chart-viewport ${isDragging ? 'is-dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              ref={canvasRef}
              className="org-chart-canvas"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
                transformOrigin: '50% 0%',
              }}
            >
              {tree.length > 0 ? (
                <div className={`org-chart__tree-root org-chart__tree-root--${chartOrientation}`}>
                  {tree.map((node) => (
                    <OrgChartNode
                      key={node.idUnit} node={node} jabatanList={jabatan} search={search}
                      orientation={chartOrientation}
                      onSelectUnit={(id) => { setSelectedUnit(id); setViewMode('manage') }}
                      onEditUnit={openEditUnit} onDeleteUnit={deleteUnit}
                      onCreateSubUnit={openCreateUnit} onCreateJabatan={openCreateJabatan}
                      onViewJabatanDetail={setDetailJabatan}
                    />
                  ))}
                </div>
              ) : (
                <div className="org-empty-state">
                  <Building2 size={36} />
                  <h3>Belum ada unit organisasi</h3>
                  <p>Mulai membuat struktur dengan menambahkan unit pertama.</p>
                  <button type="button" className="org-btn org-btn--pri" onClick={() => openCreateUnit()}>
                    <Plus size={16} /> Buat Unit Pertama
                  </button>
                </div>
              )}
            </div>

            <div className="org-chart-hint">
              <Compass size={13} /> Scroll mouse untuk Zoom In/Out • Drag/Geser latar untuk Pan Kanvas
            </div>
          </div>
        </div>
      )}

      {/* --- MODE 2: KELOLA UNIT & JABATAN (SPLIT TREE & TABLE) --- */}
      {viewMode === 'manage' && (
        <div className="org-manage-layout">
          {/* Panel Kiri: Tree Sidebar */}
          <aside className="org-manage-panel org-manage-panel--sidebar">
            <div className="org-manage-panel__head">
              <h3><Building2 size={16} /> Unit Kerja</h3>
              <div className="org-manage-panel__actions">
                <button type="button" className="org-iconbtn" title="Kembangkan Semua" onClick={expandAll}>
                  <ChevronDown size={14} />
                </button>
                <button type="button" className="org-iconbtn" title="Ciutkan Semua" onClick={collapseAll}>
                  <ChevronUp size={14} />
                </button>
                <button type="button" className="org-btn-mini" onClick={() => openCreateUnit()}>
                  <Plus size={13} /> Unit
                </button>
              </div>
            </div>

            <div className="org-tree-container">
              <button
                type="button"
                className={`org-tree__unit-root ${selectedUnit === 'ALL' ? 'is-selected' : ''}`}
                onClick={() => setSelectedUnit('ALL')}
              >
                <Building2 size={14} /> Semua Unit ({units.length})
              </button>

              <button
                type="button"
                className={`org-tree__unit-root ${selectedUnit === null ? 'is-selected' : ''}`}
                onClick={() => setSelectedUnit(null)}
              >
                <Briefcase size={14} /> Tanpa Unit / Direksi ({jabatan.filter(j => !j.idUnit).length})
              </button>

              {tree.map((node) => (
                <UnitTreeNode
                  key={node.idUnit} node={node} depth={0} selectedId={selectedUnit} expanded={expanded}
                  search={search} onToggle={toggleExpand} onSelect={setSelectedUnit} onEdit={openEditUnit}
                  onDelete={deleteUnit} onCreateSub={openCreateUnit}
                />
              ))}
            </div>
          </aside>

          {/* Panel Kanan: Tabel Jabatan */}
          <main className="org-manage-panel org-manage-panel--main">
            <div className="org-manage-panel__head">
              <div>
                <h2>
                  {selectedUnitObj ? selectedUnitObj.nama : 'Jabatan Tanpa Unit'}
                  {selectedUnitObj?.tipe && selectedUnitObj.tipe !== 'GLOBAL' && (
                    <span className="org-unit-badge">{selectedUnitObj.tipe}</span>
                  )}
                </h2>
                {selectedUnitObj?.wilayah && (
                  <span className="org-unit-subtext">📍 Wilayah: {selectedUnitObj.wilayah}</span>
                )}
              </div>
              <button type="button" className="org-btn org-btn--pri" onClick={() => openCreateJabatan()}>
                <Plus size={16} /> Tambah Jabatan
              </button>
            </div>

            <div className="org-table-wrap">
              <table className="org-table">
                <thead>
                  <tr>
                    <th>Jabatan &amp; Code</th>
                    <th>Band / Grade</th>
                    <th>Reporting (Atasan)</th>
                    <th>Formasi</th>
                    <th>Pemegang Jabatan (Incumbent)</th>
                    <th className="org-col-center">Status</th>
                    <th className="org-col-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {jabatanTampil.map((j) => {
                    const filled = j.incumbent?.length || 0
                    const capacity = j.jumlahFormasi || 1
                    const isFull = filled >= capacity
                    const isEmpty = filled === 0

                    return (
                      <tr key={j.idJabatan} className={!j.aktif ? 'is-nonaktif' : ''}>
                        <td>
                          <div className="org-table__jabatan-cell">
                            <span className="org-table__jabatan-title" onClick={() => setDetailJabatan(j)}>
                              {j.namaJabatan}
                            </span>
                            {j.kode && <span className="org-table__jabatan-code">Kode: {j.kode}</span>}
                            {j.namaUnit && selectedUnit === 'ALL' && (
                              <span className="org-table__jabatan-unit">🏢 {j.namaUnit}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="org-table__band-cell">
                            <span className="org-badge">{j.namaBand || `Band ${j.idBand}`}</span>
                            {j.jg && <span className="org-badge org-badge--jg">JG {j.jg}</span>}
                          </div>
                        </td>
                        <td>
                          <span className="org-table__atasan">
                            {j.namaAtasan ? j.namaAtasan : <span className="org-text-muted">— (Puncak / Direksi)</span>}
                          </span>
                        </td>
                        <td>
                          <div className="org-table__formasi-cell">
                            <span className={`org-formasi-pill ${isEmpty ? 'is-empty' : (isFull ? 'is-full' : 'is-partial')}`}>
                              {filled}/{capacity} Slot
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="org-table__incumbents" onClick={() => setDetailJabatan(j)}>
                            {j.incumbent && j.incumbent.length > 0 ? (
                              j.incumbent.map((inc) => (
                                <span key={inc.id} className="org-incumbent-chip" title={`NIK: ${inc.idKaryawan}`}>
                                  <span className="org-incumbent-avatar">{initialAvatar(inc.nama)}</span>
                                  <span className="org-incumbent-name">{inc.nama}</span>
                                </span>
                              ))
                            ) : (
                              <span className="org-incumbent-empty">Belum ada karyawan</span>
                            )}
                          </div>
                        </td>
                        <td className="org-col-center">
                          <span className={`org-status-dot ${j.aktif ? 'is-active' : 'is-inactive'}`}>
                            {j.aktif ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        </td>
                        <td className="org-col-right">
                          <div className="org-row-actions">
                            <button type="button" className="org-iconbtn" title="Detail & Incumbent" onClick={() => setDetailJabatan(j)}>
                              <Eye size={14} />
                            </button>
                            <button type="button" className="org-iconbtn" title="Ubah Jabatan" onClick={() => openEditJabatan(j)}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="org-iconbtn org-iconbtn--danger" title="Hapus" onClick={() => deleteJabatan(j)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!jabatanTampil.length && !loading && (
                    <tr>
                      <td colSpan={7} className="org-empty-row">
                        Tidak ada jabatan ditemukan untuk unit ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      )}

      {/* --- MODE 3: HIRARKI REPORTING (ATASAN-BAWAHAN) --- */}
      {viewMode === 'reporting' && (
        <div className="org-reporting-wrapper">
          <div className="org-reporting-info">
            <Layers size={18} />
            <p>
              Menampilkan struktur komando berdasarkan <b>Atasan Directly Reporting</b>.
              Garis ini menentukan delegasi tugas, penilaian KPI, dan alur persetujuan.
            </p>
          </div>

          <div className="org-reporting-tree">
            {jabatanTree.length > 0 ? (
              jabatanTree.map((node) => (
                <ReportingJabatanNode
                  key={node.idJabatan} node={node} depth={0} search={search}
                  onViewDetail={setDetailJabatan} onEdit={openEditJabatan} onDelete={deleteJabatan}
                />
              ))
            ) : (
              <div className="org-empty-state">
                <Briefcase size={36} />
                <h3>Belum ada data hirarki jabatan</h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL DRAWER DETAIL JABATAN & INCUMBENT --- */}
      {detailJabatan && (
        <div className="org-modal-backdrop" onClick={() => setDetailJabatan(null)}>
          <div className="org-modal org-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <div>
                <span className="org-modal-subtitle">Detail Jabatan &amp; Pemegang Position</span>
                <h3>{detailJabatan.namaJabatan}</h3>
              </div>
              <button type="button" className="org-modal-close" onClick={() => setDetailJabatan(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="org-modal-body">
              <div className="org-detail-grid">
                <div className="org-detail-card">
                  <span className="org-detail-label">Unit Kerja</span>
                  <span className="org-detail-value">{detailJabatan.namaUnit || 'Direksi / Tanpa Unit'}</span>
                </div>
                <div className="org-detail-card">
                  <span className="org-detail-label">Band &amp; Job Grade</span>
                  <span className="org-detail-value">{detailJabatan.namaBand || `Band ${detailJabatan.idBand}`} (JG {detailJabatan.jg || '-'})</span>
                </div>
                <div className="org-detail-card">
                  <span className="org-detail-label">Atasan Directly</span>
                  <span className="org-detail-value">{detailJabatan.namaAtasan || 'Puncak Hirarki'}</span>
                </div>
                <div className="org-detail-card">
                  <span className="org-detail-label">Kapasitas Formasi</span>
                  <span className="org-detail-value">{detailJabatan.incumbent?.length || 0} / {detailJabatan.jumlahFormasi || 1} Slot Terisi</span>
                </div>
              </div>

              <div className="org-detail-section">
                <div className="org-detail-section__head">
                  <h4><Users size={16} /> Karyawan Terdaftar (Incumbent)</h4>
                  <Link to="/org/penempatan" className="org-btn-mini">
                    <UserPlus size={13} /> Kelola Penempatan
                  </Link>
                </div>

                {detailJabatan.incumbent && detailJabatan.incumbent.length > 0 ? (
                  <div className="org-incumbent-list">
                    {detailJabatan.incumbent.map((inc) => (
                      <div key={inc.id} className="org-incumbent-card">
                        <div className="org-incumbent-avatar org-incumbent-avatar--lg">
                          {initialAvatar(inc.nama)}
                        </div>
                        <div className="org-incumbent-meta">
                          <span className="org-incumbent-card-name">{inc.nama}</span>
                          <span className="org-incumbent-card-nik">NIK: {inc.idKaryawan}</span>
                          {inc.tmt && <span className="org-incumbent-card-tmt">TMT: {new Date(inc.tmt).toLocaleDateString('id-ID')}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="org-incumbent-empty-box">
                    <AlertCircle size={24} />
                    <p>Jabatan ini belum terisi oleh karyawan aktif.</p>
                    <Link to="/org/penempatan" className="org-btn org-btn--pri">
                      Tempatkan Karyawan Ke Jabatan Ini
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL TAMBAH / UBAH UNIT --- */}
      {unitModal && (
        <div className="org-modal-backdrop" onClick={() => setUnitModal(false)}>
          <div className="org-modal" onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <h3>{unitEditing ? `Ubah Unit ${unitEditing.nama}` : 'Tambah Unit Organisasi'}</h3>
              <button type="button" className="org-modal-close" onClick={() => setUnitModal(false)}><X size={20} /></button>
            </div>
            <form className="org-modal-body" onSubmit={submitUnit}>
              <label className="org-form-group">
                <span>Nama Unit Organisasi *</span>
                <input
                  type="text"
                  value={unitForm.nama}
                  onChange={(e) => setUnitForm((f) => ({ ...f, nama: e.target.value }))}
                  placeholder="Mis. Departemen TI & Sistem Informasi"
                  required
                />
              </label>

              <label className="org-form-group">
                <span>Tipe Unit</span>
                <select value={unitForm.tipe} onChange={(e) => setUnitForm((f) => ({ ...f, tipe: e.target.value }))}>
                  {TIPE_UNIT.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label className="org-form-group">
                <span>Unit Induk (Parent Unit)</span>
                <select value={unitForm.idUnitInduk} onChange={(e) => setUnitForm((f) => ({ ...f, idUnitInduk: e.target.value }))}>
                  <option value="">(Tidak ada - Level Atas)</option>
                  {units.filter((u) => u.idUnit !== unitEditing?.idUnit).map((u) => (
                    <option key={u.idUnit} value={u.idUnit}>{u.tipe} — {u.nama}</option>
                  ))}
                </select>
              </label>

              <label className="org-form-group">
                <span>Wilayah Kerja</span>
                <input
                  type="text"
                  value={unitForm.wilayah}
                  onChange={(e) => setUnitForm((f) => ({ ...f, wilayah: e.target.value }))}
                  placeholder="Opsional, mis. Lampung / Pusat"
                />
              </label>

              <label className="org-form-group">
                <span>Keterangan</span>
                <input
                  type="text"
                  value={unitForm.keterangan}
                  onChange={(e) => setUnitForm((f) => ({ ...f, keterangan: e.target.value }))}
                  placeholder="Opsional"
                />
              </label>

              {unitError && <div className="org-alert org-alert--err">{unitError}</div>}

              <div className="org-modal-footer">
                <button type="button" className="org-btn org-btn--sec" onClick={() => setUnitModal(false)}>Batal</button>
                <button type="submit" className="org-btn org-btn--pri" disabled={unitSaving}>
                  {unitSaving ? 'Menyimpan...' : 'Simpan Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL TAMBAH / UBAH JABATAN --- */}
      {jabatanModal && (
        <div className="org-modal-backdrop" onClick={() => setJabatanModal(false)}>
          <div className="org-modal org-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <h3>{jabatanEditing ? `Ubah Jabatan: ${jabatanEditing.namaJabatan}` : 'Tambah Jabatan Baru'}</h3>
              <button type="button" className="org-modal-close" onClick={() => setJabatanModal(false)}><X size={20} /></button>
            </div>
            <form className="org-modal-body" onSubmit={submitJabatan}>
              <div className="org-form-grid">
                <label className="org-form-group org-col-span-2">
                  <span>Nama Jabatan *</span>
                  <input
                    type="text"
                    value={jabatanForm.namaJabatan}
                    onChange={(e) => setJabatanForm((f) => ({ ...f, namaJabatan: e.target.value }))}
                    placeholder="Mis. Senior Software Engineer"
                    required
                  />
                </label>

                <label className="org-form-group">
                  <span>Band *</span>
                  <select value={jabatanForm.idBand} onChange={(e) => setJabatanForm((f) => ({ ...f, idBand: e.target.value }))} required>
                    <option value="">(Pilih Band)</option>
                    {band.map((b) => <option key={b.idBand} value={b.idBand}>{b.nama}</option>)}
                  </select>
                </label>

                <label className="org-form-group">
                  <span>Job Grade (JG)</span>
                  <input
                    type="number"
                    min="7"
                    max="21"
                    value={jabatanForm.jg}
                    onChange={(e) => setJabatanForm((f) => ({ ...f, jg: e.target.value }))}
                    placeholder="Kosong = Direksi"
                  />
                </label>

                <label className="org-form-group">
                  <span>Unit Kerja</span>
                  <select value={jabatanForm.idUnit} onChange={(e) => setJabatanForm((f) => ({ ...f, idUnit: e.target.value }))}>
                    <option value="">(Tanpa Unit / Direksi)</option>
                    {units.map((u) => <option key={u.idUnit} value={u.idUnit}>{u.tipe} — {u.nama}</option>)}
                  </select>
                </label>

                <label className="org-form-group">
                  <span>Atasan Directly</span>
                  <select value={jabatanForm.idAtasan} onChange={(e) => setJabatanForm((f) => ({ ...f, idAtasan: e.target.value }))}>
                    <option value="">(Tidak Ada / Puncak)</option>
                    {jabatan.filter((j) => j.idJabatan !== jabatanEditing?.idJabatan).map((j) => (
                      <option key={j.idJabatan} value={j.idJabatan}>{j.namaJabatan}</option>
                    ))}
                  </select>
                </label>

                <label className="org-form-group">
                  <span>Jumlah Formasi Slot</span>
                  <input
                    type="number"
                    min="1"
                    value={jabatanForm.jumlahFormasi}
                    onChange={(e) => setJabatanForm((f) => ({ ...f, jumlahFormasi: e.target.value }))}
                    placeholder="Default 1"
                  />
                </label>

                <label className="org-form-group">
                  <span>Kelompok Fungsi</span>
                  <input
                    type="text"
                    value={jabatanForm.kelompokFungsi}
                    onChange={(e) => setJabatanForm((f) => ({ ...f, kelompokFungsi: e.target.value }))}
                    placeholder="Opsional, mis. IT Development"
                  />
                </label>

                <label className="org-form-group org-form-group--checkbox org-col-span-2">
                  <input
                    type="checkbox"
                    checked={jabatanForm.aktif}
                    onChange={(e) => setJabatanForm((f) => ({ ...f, aktif: e.target.checked }))}
                  />
                  <span>Jabatan Aktif dalam Struktur Organisasi</span>
                </label>
              </div>

              {jabatanError && <div className="org-alert org-alert--err">{jabatanError}</div>}

              <div className="org-modal-footer">
                <button type="button" className="org-btn org-btn--sec" onClick={() => setUnitModal(false)}>Batal</button>
                <button type="submit" className="org-btn org-btn--pri" disabled={jabatanSaving}>
                  {jabatanSaving ? 'Menyimpan...' : 'Simpan Jabatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
