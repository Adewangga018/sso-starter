import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  Gavel,
  Layers,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  Map,
  Medal,
  MessageSquarePlus,
  Trophy,
  UserCheck,
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

  // Seksi Juri. Pengelolaan Stream & Penugasan kini diakses lewat tombol "Panel
  // Juri" di topbar (bukan sidebar), karena pengelola belum tentu Admin IT.
  // Sidebar hanya menyisakan daftar tugas menilai untuk anggota ber-role Juri.
  const juriItems = []
  if (isJuri) juriItems.push({ key: 'penilaian', label: 'Daftar Penilaian', icon: Gavel, to: `${BASE}/penilaian` })
  const juriSection = { label: 'Menu Juri', items: juriItems }
  const withJuri = (sections) => (juriItems.length ? [...sections, juriSection] : sections)

  // History = jejak approval. Dipakai semua peran: approver menelusuri apa yang
  // pernah ia verifikasi/setujui, pengaju menelusuri perjalanan usulannya.
  const historySection = {
    label: 'History',
    items: [
      { key: 'hist-gagasan', label: 'History Approval Gagasan', icon: FileCheck2, to: `${BASE}/history/gagasan` },
      { key: 'hist-inovasi', label: 'History Approval Inovasi', icon: UserCheck, to: `${BASE}/history/inovasi` },
    ],
  }

  // Manager & GM hanya melakukan persetujuan (tidak menyumbang gagasan). Sidebar
  // mereka ramping: menu persetujuan + pemantauan risalah + jejak approval sendiri.
  if (peran === 'Manager' || peran === 'GM') {
    const gagasanItem = peran === 'Manager'
      ? { key: 'gagasan', label: 'Verifikasi Gagasan', icon: ClipboardCheck, to: `${BASE}/gagasan` }
      : { key: 'gagasan', label: 'Persetujuan Gagasan', icon: CheckSquare, to: `${BASE}/gagasan` }
    return withJuri([
      { items: [dashboard] },
      { label: 'Menu Utama', items: [beranda, panduan] },
      { label: peran === 'Manager' ? 'Menu Verifikasi' : 'Menu Persetujuan', items: [gagasanItem, daftar] },
      historySection,
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
        { key: 'rekap-gagasan', label: 'Sumbang Gagasan', icon: MessageSquarePlus, to: `${BASE}/rekap/gagasan` },
        { key: 'rekap-metodologi', label: 'Inovasi Per Metodologi', icon: Layers, to: `${BASE}/rekap/metodologi` },
        { key: 'ranking', label: 'Ranking', icon: Medal, to: `${BASE}/rekap/ranking` },
        { key: 'grafik-gagasan', label: 'Grafik Sumbang Gagasan', icon: BarChart3, to: `${BASE}/rekap/grafik-gagasan` },
      ],
    },
    historySection,
    {
      items: [
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
          dark
          title="My Innovation"
          titleLogo="/innovation.png"
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
