import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { LayoutGrid, Boxes, Hash, FileWarning, ScanLine, History, ClipboardCheck, PackagePlus, ShieldCheck } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useSidebarState } from '../hooks/useSidebarState'
import { api } from '../lib/api'
import './AppShell.css'

function angka(val) {
  return typeof val === 'number' && val > 0 ? val : null
}

function buildSections(jumlahJatuhTempo) {
  return [
    { items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/dashboard', variant: 'home' }] },
    {
      label: 'My Asset',
      items: [
        { key: 'inventaris', feature: 'my-asset:inventaris', label: 'Aset', icon: Boxes, to: '/my-asset', end: true },
        { key: 'daftar-baru', feature: 'my-asset:daftar-baru', label: 'Daftar Aset Baru', icon: PackagePlus, to: '/my-asset/daftar' },
        // Dinonaktifkan sementara dari menu (bukan dihapus) - halaman & datanya tetap ada,
        // tetap bisa diakses langsung lewat URL. "Aset Tidak Produktif" nonaktif sejak awal;
        // "Aktivitas Aset" (aktivitas KHUSUS register tidak-produktif) ikut disembunyikan
        // karena parent registernya sudah tidak ada di menu, dan pencatatan aktivitas untuk
        // aset ERP biasa sekarang lewat "Riwayat Aktivitas" di halaman Detail Aset.
        // { key: 'tidak-produktif', feature: 'my-asset:tidak-produktif', label: 'Aset Tidak Produktif', icon: PackageX, to: '/my-asset/tidak-produktif', end: true },
        // { key: 'tidak-produktif-aktivitas', feature: 'my-asset:tidak-produktif-aktivitas', label: 'Aktivitas Aset', icon: Activity, to: '/my-asset/tidak-produktif/aktivitas' },
        { key: 'nomor-internal', feature: 'my-asset:nomor-internal', label: 'No Aset Internal', icon: Hash, to: '/my-asset/nomor-internal' },
        {
          key: 'dokumen-jatuh-tempo',
          feature: 'my-asset:dokumen-jatuh-tempo',
          label: 'Dokumen Jatuh Tempo',
          icon: FileWarning,
          to: '/my-asset/dokumen-jatuh-tempo',
          badge: angka(jumlahJatuhTempo),
        },
        { key: 'opname', feature: 'my-asset:opname', label: 'Stock Opname', icon: ScanLine, to: '/my-asset/opname' },
        { key: 'pic-riwayat', feature: 'my-asset:pic-riwayat', label: 'Riwayat PIC', icon: History, to: '/my-asset/pic/riwayat' },
        { key: 'clearance', feature: 'my-asset:clearance', label: 'Clearance Aset', icon: ClipboardCheck, to: '/my-asset/clearance' },
        { key: 'aktivitas-operator', feature: 'my-asset:aktivitas-operator', label: 'Operator Aktivitas', icon: ShieldCheck, to: '/my-asset/aktivitas-operator' },
      ],
    },
  ]
}

export default function MyAssetLayout() {
  const { summary, logout, refreshSummary } = useAuth()
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState()
  const [jumlahJatuhTempo, setJumlahJatuhTempo] = useState(null)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!summary) refreshSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const muatBadge = useCallback(() => {
    api.getAsetDokumenJatuhTempo(30)
      .then((rows) => setJumlahJatuhTempo(rows.length))
      .catch(() => setJumlahJatuhTempo(null))
  }, [])

  // Lencana "Dokumen Jatuh Tempo" (H-30) - dihitung ulang tiap pindah halaman di My Asset,
  // DAN segera setelah dokumen ditambah/dihapus di halaman yang sama (event 'aset-dokumen-changed'
  // dari AsetDetail.jsx) supaya tidak perlu pindah halaman dulu baru angkanya update.
  useEffect(() => {
    muatBadge()
  }, [pathname, muatBadge])

  useEffect(() => {
    window.addEventListener('aset-dokumen-changed', muatBadge)
    return () => window.removeEventListener('aset-dokumen-changed', muatBadge)
  }, [muatBadge])

  return (
    <div className="app-shell">
      <Sidebar
        logoSrc="/LOGO GCS.png"
        title="My Asset"
        sections={buildSections(jumlahJatuhTempo)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onLogout={logout}
      />
      <div className="app-shell__main">
        <TopBar
          dark
          hideAdminLinks
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