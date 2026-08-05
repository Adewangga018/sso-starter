import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { LayoutGrid, Target, Users2, Building2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

function buildSections(isAdminModulSdm) {
  const items = [
    { key: 'saya', feature: 'my-progress:saya', label: 'KPI Saya', icon: Target, to: '/my-progress', end: true },
    { key: 'tim', feature: 'my-progress:tim', label: 'KPI Tim', icon: Users2, to: '/my-progress/tim' },
  ]
  if (isAdminModulSdm) {
    items.push({ key: 'perusahaan', feature: 'my-progress:perusahaan', label: 'KPI Perusahaan', icon: Building2, to: '/my-progress/perusahaan' })
  }
  return [
    { items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }] },
    { label: 'My Progress', items },
  ]
}

export default function MyProgressLayout() {
  const { summary, logout, refreshSummary, isAdminModulSdm } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Progress"
        sections={buildSections(isAdminModulSdm)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={logout}
      />
      <div className="app-shell__main">
        <TopBar
          dark
          title="My Progress"
          titleLogo="/progress.png"
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
