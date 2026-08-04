import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  Building2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Database,
  FilePlus2,
  Files,
  FileSignature,
  FileText,
  Inbox,
  LayoutGrid,
  MailCheck,
  Search,
  Table2,
  UsersRound,
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import { api } from '../lib/api'
import './AppShell.css'

const BASE = '/my-office'

// Struktur menu meniru DOF (Digital Office) — sistem persuratan Petrokimia Gresik —
// disesuaikan ke dalam MyGCS: nama section, urutan item, serta pengelompokan
// "Penciptaan Surat" & "Master Data" sebagai submenu buka-tutup dibuat sama persis
// dengan DOF. Fitur inti dibangun bertahap; menu yang belum siap ditandai
// "Segera hadir" agar peta jalannya jelas.
//
// Label section sengaja ditulis KAPITAL di sini (bukan lewat text-transform di
// Sidebar.css) supaya hanya My Office yang tampil seperti DOF — 9 modul lain tetap
// memakai label Title Case seperti sebelumnya.
// badge = { inboxBelumDibaca, notifikasiBelumDibaca } dari /office/badge; angka 0
// sengaja dilewatkan sebagai undefined supaya lencananya tidak muncul sama sekali.
function buildSections(badge) {
  const soon = { disabled: true, disabledReason: 'Segera hadir' }
  const angka = (n) => (n > 0 ? n : undefined)
  return [
    {
      items: [
        { key: 'dashboard-utama', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' },
      ],
    },
    {
      label: 'DASHBOARD',
      items: [
        { key: 'beranda', label: 'Beranda', icon: Table2, to: `${BASE}`, end: true },
      ],
    },
    {
      label: 'INBOX DAN NOTIFIKASI',
      items: [
        {
          key: 'inbox',
          label: 'Inbox',
          icon: Inbox,
          to: `${BASE}/inbox`,
          badge: angka(badge?.inboxBelumDibaca),
        },
        { key: 'inbox-cc', label: 'Inbox CC Otomatis', icon: MailCheck, to: `${BASE}/inbox-cc` },
        {
          key: 'notifikasi',
          label: 'Notifikasi',
          icon: Bell,
          to: `${BASE}/notifikasi`,
          badge: angka(badge?.notifikasiBelumDibaca),
        },
      ],
    },
    {
      label: 'SURAT DAN DOKUMEN',
      items: [
        {
          key: 'penciptaan',
          label: 'Penciptaan Surat',
          icon: FileText,
          children: [
            { key: 'buat', label: 'Buat Surat Baru', icon: FilePlus2, to: `${BASE}/buat` },
            { key: 'buat-sp', label: 'Buat Surat SP/ASP', icon: FileSignature, ...soon },
            { key: 'daftar', label: 'Daftar Surat', icon: Files, to: `${BASE}/daftar` },
            { key: 'review', label: 'Menunggu Review', icon: ClipboardCheck, to: `${BASE}/review` },
            { key: 'approval', label: 'Menunggu Approval', icon: CheckSquare, to: `${BASE}/approval` },
          ],
        },
        {
          key: 'master-data',
          label: 'Master Data',
          icon: Database,
          children: [
            { key: 'perusahaan', label: 'List Perusahaan', icon: Building2, ...soon },
            { key: 'group', label: 'List Group', icon: UsersRound, ...soon },
          ],
        },
      ],
    },
    {
      label: 'REKAP DAN PENCARIAN',
      items: [
        { key: 'rekap', label: 'Rekap', icon: ClipboardList, ...soon },
        { key: 'pencarian', label: 'Pencarian', icon: Search, ...soon },
      ],
    },
  ]
}

export default function MyOfficeLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()
  const [badge, setBadge] = useState(null)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lencana dihitung ulang tiap pindah halaman di dalam My Office — membuka surat
  // atau notifikasi langsung menurunkan angkanya tanpa perlu muat ulang penuh.
  // Kegagalannya sengaja didiamkan: lencana bukan alasan menggagalkan tata letak.
  useEffect(() => {
    let alive = true
    api.getBadgeOffice()
      .then((d) => { if (alive) setBadge(d) })
      .catch(() => { if (alive) setBadge(null) })
    return () => { alive = false }
  }, [pathname])

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Office"
        sections={buildSections(badge)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={logout}
      />
      <div className="app-shell__main">
        <TopBar
          dark
          title="My Office"
          titleLogo="/office.png"
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
