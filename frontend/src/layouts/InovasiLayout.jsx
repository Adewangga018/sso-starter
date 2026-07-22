import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import {
  Award,
  BookOpen,
  ClipboardList,
  History,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  Map,
  MessageSquarePlus,
  Trophy,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import './AppShell.css'

// Ruang kerja My Innovation TERPADU (satu sidebar, bukan dipisah per metodologi).
// Metodologi (SS/GIO/5R) ditentukan GM saat menyetujui gagasan - jadi pengguna
// tidak memilih metodologi di depan; ia langsung menyumbang gagasan. Sidebar
// mengacu gaya SERGIO (User Guide Karyawan & Akun Approval).
const BASE = '/my-innovation'

const SECTIONS = [
  { items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }] },
  {
    label: 'Menu Utama',
    items: [
      { key: 'beranda', label: 'Beranda', icon: Lightbulb, to: `${BASE}/beranda` },
      { key: 'panduan', label: 'Panduan Inovasi', icon: BookOpen, to: `${BASE}/panduan` },
    ],
  },
  {
    label: 'Menu Administrasi',
    items: [
      { key: 'gagasan', label: 'Sumbang Gagasan', icon: MessageSquarePlus, to: `${BASE}/gagasan` },
      { key: 'daftar', label: 'Daftar Inovasi', icon: ClipboardList, to: `${BASE}/daftar` },
      { key: 'pegawai', label: 'Daftar Pegawai', icon: ListChecks, disabled: true, disabledReason: 'Segera hadir' },
    ],
  },
  {
    label: 'Rekap Kegiatan Inovasi',
    items: [
      { key: 'roadmap', label: 'Roadmap Inovasi', icon: Map, disabled: true, disabledReason: 'Segera hadir' },
      { key: 'ranking', label: 'Ranking Inovasi', icon: Award, disabled: true, disabledReason: 'Segera hadir' },
    ],
  },
  {
    items: [
      { key: 'history', label: 'History', icon: History, disabled: true, disabledReason: 'Segera hadir' },
      { key: 'konvensi', label: 'Menu Konvensi', icon: Trophy, disabled: true, disabledReason: 'Segera hadir' },
    ],
  },
]

export default function InovasiLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guard: modul terkunci sampai Profil lengkap, konsisten dengan My Personal.
  const profileComplete = summary ? summary.profileComplete !== false : true
  if (!profileComplete) return <Navigate to="/my-personal/profil" replace />

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Innovation"
        subtitle="SS / GIO / 5R"
        sections={SECTIONS}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={logout}
      />
      <div className="app-shell__main">
        <TopBar
          title="My Innovation"
          name={summary?.nama}
          subtitle={summary?.jabatan}
          onMenuClick={openMobile}
          onLogout={logout}
        />
        <div className="app-shell__content">
          <Outlet context={{ base: BASE, summary }} />
        </div>
      </div>
    </div>
  )
}
