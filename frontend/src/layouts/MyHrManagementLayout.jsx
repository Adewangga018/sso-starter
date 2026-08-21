import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { LayoutGrid, MapPinned, Network, SlidersHorizontal, UserCog, UserCog2, UserSquare2, UsersRound } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

// Modul gabungan "HR Management" (2026-08-20) - sebelumnya Payroll dan Struktur
// Organisasi tampil sbg 2 kartu/modul terpisah di dashboard meski keduanya sama-sama
// khusus Admin Modul SDM (lihat DashboardController). Digabung jadi satu modul supaya
// admin SDM cukup masuk satu pintu untuk kedua area ini - rute (/payroll/*, /org/*)
// dan kode halaman di baliknya TIDAK berubah, cuma shell/sidebar-nya disatukan.
function buildSections() {
  return [
    { items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }] },
    {
      label: 'Payroll',
      items: [
        { key: 'formula', feature: 'payroll:formula', label: 'Formula & Generalisasi', icon: SlidersHorizontal, to: '/payroll', end: true },
        { key: 'manual', feature: 'payroll:manual', label: 'Manual per Karyawan', icon: UserCog, to: '/payroll/manual' },
        { key: 'dinas', feature: 'payroll:dinas', label: 'Verifikasi Dinas', icon: MapPinned, to: '/payroll/dinas' },
      ],
    },
    {
      label: 'Struktur Organisasi',
      items: [
        { key: 'struktur', feature: 'org:struktur', label: 'Unit & Jabatan', icon: Network, to: '/org', end: true },
        { key: 'penempatan', feature: 'org:penempatan', label: 'Penempatan Karyawan', icon: UsersRound, to: '/org/penempatan' },
      ],
    },
    {
      label: 'Data Karyawan',
      items: [
        { key: 'pegawai', feature: 'org:pegawai', label: 'Direktori Karyawan', icon: UserSquare2, to: '/org/pegawai' },
        { key: 'person-grade', feature: 'org:person-grade', label: 'Person Grade (PG)', icon: UserCog2, to: '/org/person-grade' },
      ],
    },
  ]
}

export default function MyHrManagementLayout() {
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
        title="HR Management"
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
          title="HR Management"
          name={summary?.nama}
          subtitle={summary?.jabatan}
          onMenuClick={openMobile}
          onLogout={logout}
        />
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
