import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  Banknote,
  Ticket,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileSignature,
  GraduationCap,
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

const PROFIL_PATH = '/my-personal/profil'

// `locked` items are gated behind the profile being fully filled in (see `profileComplete`
// below) - Profil itself is how that gets completed, so it's always reachable.
function buildSections(profileComplete) {
  return [
    {
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' },
      ],
    },
    {
      label: 'My Personal',
      items: [
        { key: 'profil', label: 'Profil', icon: UserCircle, to: PROFIL_PATH },
        {
          key: 'absensi',
          label: 'Absensi',
          icon: ClipboardList,
          to: '/my-personal/absensi',
          disabled: !profileComplete,
          disabledReason: 'Lengkapi Profil terlebih dahulu',
        },
        {
          key: 'izin',
          label: 'Izin',
          icon: FileSignature,
          to: '/my-personal/izin',
          disabled: !profileComplete,
          disabledReason: 'Lengkapi Profil terlebih dahulu',
        },
        {
          key: 'lembur',
          label: 'Lembur',
          icon: Clock3,
          to: '/my-personal/lembur',
          disabled: !profileComplete,
          disabledReason: 'Lengkapi Profil terlebih dahulu',
        },
        { key: 'cuti', label: 'Cuti', icon: CalendarDays, disabled: true },
        {
          key: 'sppd',
          label: 'SPPD',
          icon: Plane,
          to: '/my-personal/sppd',
          disabled: !profileComplete,
          disabledReason: 'Lengkapi Profil terlebih dahulu',
        },
        {
          key: 'umdl',
          label: 'UMDL',
          icon: Banknote,
          to: '/my-personal/umdl',
          disabled: !profileComplete,
          disabledReason: 'Lengkapi Profil terlebih dahulu',
        },
        {
          key: 'tiket',
          label: 'Pemesanan Tiket',
          icon: Ticket,
          to: '/my-personal/tiket',
          disabled: !profileComplete,
          disabledReason: 'Lengkapi Profil terlebih dahulu',
        },
        { key: 'gaji', label: 'Slip Gaji', icon: Wallet, disabled: true },
        { key: 'asesmen', label: 'Asesmen', icon: ClipboardCheck, disabled: true },
        { key: 'training', label: 'Training', icon: GraduationCap, disabled: true },
      ],
    },
  ]
}

export default function MyPersonalLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()
  const location = useLocation()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Only treat this as a hard lock once we positively know the profile is incomplete - while
  // summary is still loading (or failed to load), default to unlocked so a network hiccup
  // can't strand someone outside their own Profil page.
  const profileComplete = summary ? summary.profileComplete !== false : true

  // logout() clears local tokens + server cookie and redirects to /login itself.
  function handleLogout() {
    logout()
  }

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Personal"
        sections={buildSections(profileComplete)}
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
          {profileComplete || location.pathname === PROFIL_PATH ? <Outlet /> : <Navigate to={PROFIL_PATH} replace />}
        </div>
      </div>
    </div>
  )
}
