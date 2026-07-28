import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { BarChart3, LayoutGrid, Users2, MessagesSquare } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

function buildSections() {
  return [
    {
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' },
      ],
    },
    {
      label: 'My Team',
      items: [
        { key: 'tim', label: 'Tim & Tugas', icon: Users2, to: '/team', end: true },
        { key: 'coaching', label: 'Coaching', icon: MessagesSquare, to: '/team/coaching' },
        { key: 'rekap', label: 'Rekap Tim', icon: BarChart3, to: '/team/rekap' },
      ],
    },
  ]
}

export default function MyTeamLayout() {
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
        title="My Team"
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
          title="My Team"
          titleLogo="/team.png"
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
