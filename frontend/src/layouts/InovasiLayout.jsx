import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Gavel,
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

function buildSections(peran, isJuri) {
  const dashboard = { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }
  const beranda = { key: 'beranda', label: 'Beranda', icon: Lightbulb, to: `${BASE}/beranda` }
  const panduan = { key: 'panduan', label: 'Panduan Inovasi', icon: BookOpen, to: `${BASE}/panduan` }
  const daftar = { key: 'daftar', label: 'Daftar Inovasi', icon: ClipboardList, to: `${BASE}/daftar` }

  // Seksi Juri: muncul untuk siapa pun ber-role Juri (lepas dari band/jabatan).
  const juriSection = {
    label: 'Menu Juri',
    items: [{ key: 'penilaian', label: 'Daftar Penilaian', icon: Gavel, to: `${BASE}/penilaian` }],
  }
  const withJuri = (sections) => (isJuri ? [...sections, juriSection] : sections)

  // Manager & GM hanya melakukan persetujuan (tidak menyumbang gagasan). Sidebar
  // mereka ramping: menu persetujuan + pemantauan risalah + panduan verifikasi.
  if (peran === 'Manager' || peran === 'GM') {
    const gagasanItem = peran === 'Manager'
      ? { key: 'gagasan', label: 'Verifikasi Gagasan', icon: ClipboardCheck, to: `${BASE}/gagasan` }
      : { key: 'gagasan', label: 'Persetujuan Gagasan', icon: CheckSquare, to: `${BASE}/gagasan` }
    return withJuri([
      { items: [dashboard] },
      { label: 'Menu Utama', items: [beranda, panduan] },
      { label: peran === 'Manager' ? 'Menu Verifikasi' : 'Menu Persetujuan', items: [gagasanItem, daftar] },
    ])
  }

  // Karyawan: ruang kerja penuh.
  return withJuri([
    { items: [dashboard] },
    { label: 'Menu Utama', items: [beranda, panduan] },
    {
      label: 'Menu Administrasi',
      items: [
        { key: 'gagasan', label: 'Sumbang Gagasan', icon: MessageSquarePlus, to: `${BASE}/gagasan` },
        daftar,
        { key: 'pegawai', label: 'Daftar Pegawai', icon: ListChecks, to: `${BASE}/pegawai` },
      ],
    },
    {
      label: 'Rekap Kegiatan Inovasi',
      items: [
        { key: 'roadmap', label: 'Roadmap Inovasi', icon: Map, to: `${BASE}/roadmap` },
        { key: 'ranking', label: 'Ranking Inovasi', icon: Award, to: `${BASE}/ranking` },
      ],
    },
    {
      items: [
        { key: 'history', label: 'History', icon: History, to: `${BASE}/history` },
        { key: 'konvensi', label: 'Menu Konvensi', icon: Trophy, to: `${BASE}/konvensi` },
      ],
    },
  ])
}

export default function InovasiLayout() {
  const { summary, logout, refreshSummary, isJuri } = useAuth()
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
        sections={buildSections(peran?.peran ?? 'Karyawan', isJuri)}
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
