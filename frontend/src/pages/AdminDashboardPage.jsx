import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Boxes, FolderLock, Gavel, KeyRound, MapPin, ShieldAlert, ShieldCheck, Users, UsersRound,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './AdminDashboardPage.css'

const TILES = [
  {
    to: '/admin/users',
    icon: UsersRound,
    title: 'Manajemen Pengguna & Role',
    desc: 'Kelola akun, aktif/nonaktif, buka kunci, dan toggle hak Admin IT.',
  },
  {
    to: '/admin/juri',
    icon: Gavel,
    title: 'Juri & Penilaian Inovasi',
    desc: 'Susun stream juri (Ketua/Anggota/Sekretaris) & tugaskan menilai inovasi.',
  },
  {
    to: '/admin/audit',
    icon: ShieldAlert,
    title: 'Audit Keamanan',
    desc: 'Jejak login, MFA, reset password, dan perubahan hak akses.',
  },
  {
    to: '/admin/documents',
    icon: FolderLock,
    title: 'Dokumen Karyawan',
    desc: 'Telusuri & lihat dokumen (KTP/KK/ijazah) seluruh karyawan.',
  },
  {
    to: '/admin/locations',
    icon: MapPin,
    title: 'Kelola Lokasi Absensi',
    desc: 'Atur titik geofence & radius kantor pusat, region, dan gudang.',
  },
  {
    icon: Boxes,
    title: 'Registrasi Modul',
    desc: 'Daftarkan modul/aplikasi baru ke SSO.',
    soon: 'Segera hadir',
  },
  {
    icon: KeyRound,
    title: 'Kebijakan Keamanan',
    desc: 'Konfigurasi kebijakan password, MFA, dan sesi.',
    soon: 'Segera hadir',
  },
  {
    icon: ShieldCheck,
    title: 'Admin Modul',
    desc: 'Penunjukan admin per modul (SDM, Sekretariat, K3/Klinik).',
    soon: 'Menunggu struktur organisasi',
  },
]

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className={`admin-dash__stat${tone ? ` admin-dash__stat--${tone}` : ''}`}>
      <div className="admin-dash__stat-icon"><Icon size={20} /></div>
      <div>
        <div className="admin-dash__stat-value">{value ?? '—'}</div>
        <div className="admin-dash__stat-label">{label}</div>
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { isAdmin } = useAuth()
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    api
      .getAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Gagal memuat ringkasan.')
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  if (!isAdmin) {
    return <div className="admin-dash"><p className="admin-dash__forbidden">Akses ditolak. Hanya Admin IT.</p></div>
  }

  return (
    <div className="admin-dash">
      <div className="admin-dash__head">
        <Link to="/dashboard" className="admin-dash__back"><ArrowLeft size={16} /> Dashboard</Link>
        <h1><ShieldCheck size={22} /> Panel Admin IT</h1>
        <p className="admin-dash__subtitle">Kontrol akun, hak akses, dan keamanan platform MyGCS.</p>
      </div>

      {error && <div className="admin-dash__error">{error}</div>}

      <div className="admin-dash__stats">
        <StatCard icon={Users} label="Total Pengguna" value={overview?.totalUsers} />
        <StatCard icon={UsersRound} label="Pengguna Aktif" value={overview?.activeUsers} tone="ok" />
        <StatCard icon={ShieldCheck} label="Admin IT" value={overview?.adminCount} tone="admin" />
        <StatCard
          icon={ShieldAlert}
          label="Kejadian Keamanan (7 hari)"
          value={overview?.securityEvents7d}
          tone={overview?.securityEvents7d ? 'warn' : undefined}
        />
      </div>

      <div className="admin-dash__section-title">Kontrol Platform</div>
      <div className="admin-dash__tiles">
        {TILES.map((t) => {
          const Icon = t.icon
          const body = (
            <>
              <div className="admin-dash__tile-icon"><Icon size={22} /></div>
              <div className="admin-dash__tile-text">
                <div className="admin-dash__tile-title">
                  {t.title}
                  {t.soon && <span className="admin-dash__badge">{t.soon}</span>}
                </div>
                <div className="admin-dash__tile-desc">{t.desc}</div>
              </div>
            </>
          )
          return t.to ? (
            <Link key={t.title} to={t.to} className="admin-dash__tile">{body}</Link>
          ) : (
            <div key={t.title} className="admin-dash__tile admin-dash__tile--disabled">{body}</div>
          )
        })}
      </div>
    </div>
  )
}
