import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import {
  Banknote,
  Ticket,
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
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' },
    ],
  },
  {
    label: 'My Personal',
    items: [
      { key: 'profil', label: 'Profil', icon: UserCircle, to: '/my-personal/profil' },
      { key: 'absensi', label: 'Absensi', icon: ClipboardList, to: '/my-personal/absensi' },
      { key: 'izin', label: 'Izin', icon: FileSignature, to: '/my-personal/izin' },
      { key: 'lembur', label: 'Lembur', icon: Clock3, to: '/my-personal/lembur' },
      { key: 'cuti', label: 'Cuti', icon: CalendarDays, disabled: true },
      { key: 'sppd', label: 'SPPD', icon: Plane, to: '/my-personal/sppd' },
      { key: 'umdl', label: 'UMDL', icon: Banknote, to: '/my-personal/umdl' },
      { key: 'tiket', label: 'Pemesanan Tiket', icon: Ticket, to: '/my-personal/tiket' },
      
      { key: 'gaji', label: 'Slip Gaji', icon: Wallet, disabled: true },
    ],
  },
]

export default function MyPersonalLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // logout() clears local tokens + server cookie and redirects to /login itself.
  function handleLogout() {
    logout()
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
        <TopBar
          title="My Personal"
          name={summary?.nama}
          subtitle={summary?.jabatan}
          onMenuClick={openMobile}
          onLogout={handleLogout}
        />
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
