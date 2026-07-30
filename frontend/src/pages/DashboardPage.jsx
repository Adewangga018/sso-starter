import { useOutletContext, useNavigate } from 'react-router-dom'
import {
  Activity,
  Archive,
  ArrowRight,
  Bell,
  CalendarCheck2,
  ClipboardCheck,
  Lightbulb,
  Lock,
  Mail,
  TrendingUp,
  Users,
  Users2,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './DashboardPage.css'

const ICONS = {
  users: Users,
  mail: Mail,
  'clipboard-check': ClipboardCheck,
  activity: Activity,
  lightbulb: Lightbulb,
  archive: Archive,
  'trending-up': TrendingUp,
  'users-round': Users2,
  wallet: Wallet,
}

const MODULE_ROUTES = {
  'my-personal': '/my-personal/profil',
  'my-innovation': '/my-innovation',
  'my-team': '/team',
  'my-office': '/my-office',
  'my-prosedur': '/my-prosedur',
  'my-health': '/my-health',
  'my-progress': '/my-progress',
  'my-asset': '/my-asset',
  payroll: '/payroll',
}

// Logo tiap modul (di /public). Bila ada, tampil menggantikan ikon lucide pada tile.
const MODULE_LOGOS = {
  'my-personal': '/personal.png',
  'my-office': '/office.png',
  'my-prosedur': '/prosedur.png',
  'my-health': '/health.png',
  'my-innovation': '/innovation.png',
  'my-asset': '/asset.png',
  'my-progress': '/progress.png',
  'my-team': '/team.png',
}

export default function DashboardPage() {
  const { summary } = useOutletContext()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const modules = summary?.modules ?? []

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h2>Selamat Datang di MyGCS</h2>
        <p>Berikut adalah ringkasan operasional Anda hari ini.</p>
      </div>

      <div className="dashboard__grid">
        <div className="dashboard__profile-card">
          <div className="dashboard__avatar">{summary?.nama?.charAt(0)?.toUpperCase() ?? '?'}</div>
          <div className="dashboard__name">{summary?.nama ?? '-'}</div>
        </div>

        <div className="dashboard__notif-card">
          <div className="dashboard__notif-header">
            <Bell size={16} />
            <span>Notifikasi</span>
          </div>
          <div className="dashboard__notif-item">
            <CalendarCheck2 size={16} className="dashboard__notif-icon" />
            <div>
              <div className="dashboard__notif-title">Selamat datang di MyGCS</div>
              <div className="dashboard__notif-sub">Modul My Personal sudah aktif digunakan.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard__modules-label">Modul</div>
      <div className="dashboard__modules">
        {modules.map((mod) => {
          const Icon = ICONS[mod.icon] ?? Users
          const target = MODULE_ROUTES[mod.key]
          const logo = MODULE_LOGOS[mod.key]

          if (!mod.enabled || !target) {
            return (
              <div className="module-tile module-tile--disabled" key={mod.key} aria-disabled="true">
                {logo ? (
                  <img src={logo} alt={mod.label} className="module-tile__logo" />
                ) : (
                  <div className="module-tile__icon">
                    <Icon size={24} />
                  </div>
                )}
                <div className="module-tile__body">
                  <div className="module-tile__label">
                    {mod.label}
                    {/* Badge hanya untuk Admin IT. Bagi karyawan, modul yang dikunci ke
                        Admin tampil sebagai "Coming Soon" biasa - tidak perlu diberitahu
                        bahwa modulnya ada tapi tidak untuk mereka. */}
                    {isAdmin && mod.access === 'admin' && <span className="module-tile__badge">Khusus Admin</span>}
                  </div>
                  <div className="module-tile__subtitle">{mod.subtitle}</div>
                </div>
                <div className="module-tile__action module-tile__action--locked">
                  <Lock size={12} /> Coming Soon
                </div>
              </div>
            )
          }

          return (
            <button
              type="button"
              className="module-tile module-tile--open"
              key={mod.key}
              onClick={() => navigate(target)}
              aria-label={`Buka modul ${mod.label}`}
            >
              {logo ? (
                <img src={logo} alt={mod.label} className="module-tile__logo" />
              ) : (
                <div className="module-tile__icon module-tile__icon--active">
                  <Icon size={24} />
                </div>
              )}
              <div className="module-tile__body">
                <div className="module-tile__label">
                  {mod.label}
                  {/* Kartu terbuka + badge = modul dengan akses terbatas yang kebetulan boleh
                      dibuka pemirsa ini (Admin IT, atau Admin Modul terkait). Karyawan lain
                      mendapat kartu terkunci "Coming Soon" untuk modul yang sama. */}
                  {mod.access === 'admin' && <span className="module-tile__badge">Khusus Admin</span>}
                  {mod.access === 'admin_modul' && <span className="module-tile__badge">Admin Modul</span>}
                </div>
                <div className="module-tile__subtitle">{mod.subtitle}</div>
              </div>
              <div className="module-tile__action">
                <span>Buka Modul</span>
                <ArrowRight size={14} className="module-tile__arrow" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
