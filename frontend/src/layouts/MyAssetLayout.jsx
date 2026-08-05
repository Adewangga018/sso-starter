import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { LayoutGrid, Boxes, Wrench } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

function buildSections() {
  return [
    { items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }] },
    {
      label: 'My Asset',
      items: [
        { key: 'inventaris', feature: 'my-asset:inventaris', label: 'Inventaris', icon: Boxes, to: '/my-asset', end: true },
        { key: 'maintenance', feature: 'my-asset:maintenance', label: 'Maintenance', icon: Wrench, to: '/my-asset/maintenance' },
      ],
    },
  ]
}

export default function MyAssetLayout() {
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
        title="My Asset"
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
          title="My Asset"
          titleLogo="/asset.png"
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
