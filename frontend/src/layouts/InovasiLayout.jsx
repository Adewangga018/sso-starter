import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
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
import { api } from '../lib/api'
import './AppShell.css'

// Ruang kerja My Innovation TERPADU (satu sidebar, bukan dipisah per metodologi).
// Metodologi (SS/GIO/5R) ditentukan GM saat menyetujui gagasan - jadi pengguna
// tidak memilih metodologi di depan; ia langsung menyumbang gagasan. Menu
// approver (Manager/GM) berbeda: hanya melihat & memproses persetujuan.
const BASE = '/my-innovation'

function buildSections(peran) {
  const dashboard = { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }
  const beranda = { key: 'beranda', label: 'Beranda', icon: Lightbulb, to: `${BASE}/beranda` }
  const panduan = { key: 'panduan', label: 'Panduan Inovasi', icon: BookOpen, to: `${BASE}/panduan` }
  const daftar = { key: 'daftar', label: 'Daftar Inovasi', icon: ClipboardList, to: `${BASE}/daftar` }

  // Manager & GM hanya melakukan persetujuan (tidak menyumbang gagasan). Sidebar
  // mereka ramping: hanya menu persetujuan + pemantauan risalah, tanpa menu
  // yang masih terkunci ("Segera hadir") maupun "Sumbang Gagasan".
  if (peran === 'Manager' || peran === 'GM') {
    const gagasanItem = peran === 'Manager'
      ? { key: 'gagasan', label: 'Verifikasi Gagasan', icon: ClipboardCheck, to: `${BASE}/gagasan` }
      : { key: 'gagasan', label: 'Persetujuan Gagasan', icon: CheckSquare, to: `${BASE}/gagasan` }
    // Tanpa "Panduan Inovasi": panduan ditujukan untuk penyusun gagasan/risalah,
    // sedangkan Manager & GM hanya menyetujui.
    return [
      { items: [dashboard] },
      { label: 'Menu Utama', items: [beranda] },
      { label: peran === 'Manager' ? 'Menu Verifikasi' : 'Menu Persetujuan', items: [gagasanItem, daftar] },
    ]
  }

  // Karyawan: ruang kerja penuh (Sumbang Gagasan + menu lain yang menyusul).
  return [
    { items: [dashboard] },
    { label: 'Menu Utama', items: [beranda, panduan] },
    {
      label: 'Menu Administrasi',
      items: [
        { key: 'gagasan', label: 'Sumbang Gagasan', icon: MessageSquarePlus, to: `${BASE}/gagasan` },
        daftar,
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
}

export default function InovasiLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()

  const [peran, setPeran] = useState(null) // { peran: 'GM'|'Manager'|'Karyawan', bolehApprove }

  useEffect(() => {
    if (!summary) refreshSummary()
    api.getInovasiPeran().then(setPeran).catch(() => setPeran({ peran: 'Karyawan', bolehApprove: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tidak ada gate profil di sini: My Innovation dipakai lintas peran (termasuk
  // approver/GM yang mungkin tidak punya baris MST_PEGAWAI lengkap) dan bekerja
  // cukup dari klaim NIK - berbeda dengan My Personal yang butuh profil lengkap.
  const isApprover = peran?.bolehApprove === true

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Innovation"
        subtitle={isApprover ? `${peran.peran} - ${peran.peran === 'Manager' ? 'Verifikasi' : 'Persetujuan'}` : 'SS / GIO / 5R'}
        sections={buildSections(peran?.peran ?? 'Karyawan')}
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
          <Outlet context={{ base: BASE, summary, peran: peran?.peran ?? 'Karyawan', isApprover }} />
        </div>
      </div>
    </div>
  )
}
