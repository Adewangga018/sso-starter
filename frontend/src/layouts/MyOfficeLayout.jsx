import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import {
  Building2,
  CheckSquare,
  ClipboardCheck,
  FilePlus2,
  Files,
  Inbox,
  LayoutGrid,
  Search,
  Table2,
  UsersRound,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

const BASE = '/my-office'

// Struktur menu meniru DOF (Digital Office) — sistem persuratan Petrokimia Gresik —
// disesuaikan ke dalam MyGCS. Fitur inti dibangun bertahap; menu yang belum siap
// ditandai "Segera hadir" agar peta jalannya jelas.
function buildSections() {
  const soon = { disabled: true, disabledReason: 'Segera hadir' }
  return [
    {
      items: [
        { key: 'dashboard-utama', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' },
      ],
    },
    {
      label: 'My Office',
      items: [
        { key: 'beranda', label: 'Beranda', icon: Table2, to: `${BASE}`, end: true },
        { key: 'inbox', label: 'Kotak Masuk', icon: Inbox, to: `${BASE}/inbox` },
      ],
    },
    {
      label: 'Penciptaan Surat',
      items: [
        { key: 'buat', label: 'Buat Surat', icon: FilePlus2, to: `${BASE}/buat` },
        { key: 'daftar', label: 'Daftar Surat', icon: Files, to: `${BASE}/daftar` },
      ],
    },
    {
      label: 'Persetujuan',
      items: [
        { key: 'review', label: 'Menunggu Review', icon: ClipboardCheck, to: `${BASE}/review` },
        { key: 'approval', label: 'Menunggu Approval', icon: CheckSquare, to: `${BASE}/approval` },
      ],
    },
    {
      label: 'Master Data',
      items: [
        { key: 'perusahaan', label: 'List Perusahaan', icon: Building2, ...soon },
        { key: 'group', label: 'List Group', icon: UsersRound, ...soon },
      ],
    },
    {
      label: 'Rekap & Pencarian',
      items: [
        { key: 'pencarian', label: 'Pencarian', icon: Search, ...soon },
      ],
    },
  ]
}

export default function MyOfficeLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Office"
        sections={buildSections()}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={logout}
      />
      <div className="app-shell__main">
        <TopBar
          dark
          title="My Office"
          titleLogo="/office.png"
          name={summary?.nama}
          subtitle={summary?.jabatan}
          onMenuClick={openMobile}
          onLogout={logout}
        />
        <div className="app-shell__content">
          <Outlet context={{ base: BASE, summary }} />
        </div>
      </div>
    </div>
  )
}
