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
const soon = { disabled: true, disabledReason: 'Fitur sedang dikembangkan' }

function angka(val) {
  return typeof val === 'number' && val > 0 ? val : null
}

function buildSections(badge) {
  return [
    {
      label: 'DASHBOARD',
      items: [
        { key: 'beranda', feature: 'my-office:beranda', label: 'Beranda', icon: Table2, to: `${BASE}`, end: true },
      ],
    },
    {
      label: 'INBOX DAN NOTIFIKASI',
      items: [
        {
          key: 'inbox',
          feature: 'my-office:inbox',
          label: 'Inbox',
          icon: Inbox,
          to: `${BASE}/inbox`,
          badge: angka(badge?.inboxBelumDibaca),
        },
        { key: 'inbox-cc', feature: 'my-office:inbox-cc', label: 'Inbox CC Otomatis', icon: MailCheck, to: `${BASE}/inbox-cc` },
        {
          key: 'notifikasi',
          feature: 'my-office:notifikasi',
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
          feature: 'my-office:penciptaan',
          label: 'Penciptaan Surat',
          icon: FileText,
          children: [
            { key: 'buat', feature: 'my-office:buat', label: 'Buat Surat Baru', icon: FilePlus2, to: `${BASE}/buat` },
            { key: 'buat-sp', feature: 'my-office:buat-sp', label: 'Buat Surat SP/ASP', icon: FileSignature, ...soon },
            { key: 'daftar', feature: 'my-office:daftar', label: 'Daftar Surat', icon: Files, to: `${BASE}/daftar` },
            { key: 'review', feature: 'my-office:review', label: 'Menunggu Review', icon: ClipboardCheck, to: `${BASE}/review` },
            { key: 'approval', feature: 'my-office:approval', label: 'Menunggu Approval', icon: CheckSquare, to: `${BASE}/approval` },
          ],
        },
        {
          key: 'master-data',
          feature: 'my-office:master-data',
          label: 'Master Data',
          icon: Database,
          children: [
            { key: 'perusahaan', feature: 'my-office:perusahaan', label: 'List Perusahaan', icon: Building2, ...soon },
            { key: 'group', feature: 'my-office:group', label: 'List Group', icon: UsersRound, ...soon },
          ],
        },
      ],
    },
    {
      label: 'REKAP DAN PENCARIAN',
      items: [
        { key: 'rekap', feature: 'my-office:rekap', label: 'Rekap', icon: ClipboardList, ...soon },
        { key: 'pencarian', feature: 'my-office:pencarian', label: 'Pencarian', icon: Search, ...soon },
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
