import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileSignature,
  LayoutGrid,
  Plane,
  UserCircle,
  Wallet,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import '../layouts/AppShell.css'

const SECTIONS = [
  {
    label: 'My Personal',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard' },
      { key: 'profil', label: 'Profil', icon: UserCircle, to: '/my-personal/profil' },
      { key: 'absensi', label: 'Absensi', icon: ClipboardList, disabled: true },
      { key: 'gaji', label: 'Gaji', icon: Wallet, disabled: true },
      { key: 'lembur', label: 'Lembur', icon: Clock3, disabled: true },
      { key: 'cuti', label: 'Cuti', icon: CalendarDays, disabled: true },
      { key: 'izin', label: 'Izin', icon: FileSignature, disabled: true },
      { key: 'sppd', label: 'SPPD', icon: Plane, disabled: true },
      { key: 'umdm', label: 'UMDM', icon: Banknote, disabled: true },
    ],
  },
]

export default function MyPersonalLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const navigate = useNavigate()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Personal"
        sections={SECTIONS}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={handleLogout}
      />
      <div className="app-shell__main">
        <TopBar title="My Personal" name={summary?.nama} jabatan={summary?.jabatan} onMenuClick={openMobile} />
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
