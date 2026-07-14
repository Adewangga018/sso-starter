import { Outlet } from 'react-router-dom'
import { LayoutGrid, Settings } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

const SECTIONS = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard' },
      { key: 'pengaturan', label: 'Pengaturan', icon: Settings, disabled: true },
    ],
  },
]

export default function DashboardLayout() {
  const { summary, logout } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()

  // logout() clears local tokens + server cookie and redirects to /login itself.
  function handleLogout() {
    logout()
  }

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="MyGCS"
        // subtitle="PORTAL KORPORAT"
        sections={SECTIONS}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={handleLogout}
      />
      <div className="app-shell__main">
        <TopBar title="Dashboard" name={summary?.nama} onMenuClick={openMobile} />
        <div className="app-shell__content">
          <Outlet context={{ summary }} />
        </div>
      </div>
    </div>
  )
}
