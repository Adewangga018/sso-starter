import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { LayoutGrid, MapPinned, SlidersHorizontal, UserCog } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

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
  ]
}

export default function MyPayrollLayout() {
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
        title="Payroll"
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
          title="Payroll"
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
