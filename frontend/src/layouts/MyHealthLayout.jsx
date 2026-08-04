import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { LayoutGrid, HeartPulse } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

function buildSections() {
  return [
    { items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }] },
    {
      label: 'My Health',
      items: [
        { key: 'mcu', feature: 'my-health:mcu', label: 'Medical Check-Up', icon: HeartPulse, to: '/my-health', end: true },
      ],
    },
  ]
}

export default function MyHealthLayout() {
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
        title="My Health"
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
          title="My Health"
          titleLogo="/health.png"
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
