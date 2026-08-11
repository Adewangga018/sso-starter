import { useState, useMemo } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import {
  Activity,
  Archive,
  ArrowRight,
  Bell,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Gavel,
  HeartPulse,
  Lightbulb,
  Lock,
  Mail,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Users2,
  Wallet,
  X,
  Zap,
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
  network: Network,
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
  org: '/org',
}

const MODULE_LOGOS = {
  'my-personal': '/personal.png',
  'my-office': '/office.png',
  'my-prosedur': '/prosedur.png',
  'my-health': '/health.png',
  'my-innovation': '/innovation.png',
  'my-asset': '/asset.png',
  'my-progress': '/progress.png',
  'my-team': '/team.png',
  payroll: '/payroll.png',
  'my-payroll': '/payroll.png',
}

const CATEGORIES = [
  { id: 'all', label: 'Semua Modul' },
  { id: 'fav', label: '⭐ Favorit' },
  { id: 'sdm', label: 'SDM & Personal' },
  { id: 'operasional', label: 'Operasional' },
  { id: 'kinerja', label: 'Kinerja & Inovasi' },
]

const MODULE_CATEGORY_MAP = {
  'my-personal': 'sdm',
  'my-team': 'sdm',
  payroll: 'sdm',
  'my-payroll': 'sdm',
  'my-office': 'operasional',
  'my-prosedur': 'operasional',
  'my-asset': 'operasional',
  'my-innovation': 'kinerja',
  'my-health': 'kinerja',
  'my-progress': 'kinerja',
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 4 && hour < 11) return 'Selamat Pagi'
  if (hour >= 11 && hour < 15) return 'Selamat Siang'
  if (hour >= 15 && hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

function getFormattedDate() {
  const now = new Date()
  return now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const { summary } = useOutletContext()
  const { isAdmin, isPengelolaJuri } = useAuth()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('gcs_favorite_modules')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const modules = summary?.modules ?? []

  const toggleFavorite = (e, modKey) => {
    e.stopPropagation()
    setFavorites((prev) => {
      const next = prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
      try {
        localStorage.setItem('gcs_favorite_modules', JSON.stringify(next))
      } catch (err) {
        console.error('Failed to save favorites', err)
      }
      return next
    })
  }

  const activeModulesCount = useMemo(() => {
    return modules.filter((m) => m.enabled && MODULE_ROUTES[m.key]).length
  }, [modules])

  const filteredModules = useMemo(() => {
    return modules.filter((mod) => {
      // Filter tab
      if (activeCategory === 'fav') {
        if (!favorites.includes(mod.key)) return false
      } else if (activeCategory !== 'all') {
        const cat = MODULE_CATEGORY_MAP[mod.key]
        if (cat !== activeCategory) return false
      }

      // Filter query pencarian
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const matchLabel = mod.label?.toLowerCase().includes(q)
      const matchSub = mod.subtitle?.toLowerCase().includes(q)
      return matchLabel || matchSub
    })
  }, [modules, activeCategory, favorites, searchQuery])

  const userInitial = summary?.nama?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="dashboard">
      {/* Dynamic Welcome Hero Section */}
      <div className="dashboard__hero">
        <div className="dashboard__hero-content">
          <div className="dashboard__hero-badge">
            <Sparkles size={14} className="dashboard__hero-badge-icon" />
            <span>Single Sign-On Portal MyGCS</span>
          </div>

          <h1 className="dashboard__hero-greeting">
            {getGreeting()}, <span className="dashboard__name">{summary?.nama ?? 'Rekan GCS'}</span>!
          </h1>
          <p className="dashboard__hero-sub">
            {getFormattedDate()} • Selamat datang di pusat layanan terpadu operasional dan kepegawaian Anda.
          </p>

          <div className="dashboard__hero-actions-row">
            <div className="dashboard__hero-stats">
              <div className="hero-stat">
                <div className="hero-stat__value">{activeModulesCount}</div>
                <div className="hero-stat__label">Modul Aktif</div>
              </div>
              <div className="hero-stat__divider" />
              <div className="hero-stat">
                <div className="hero-stat__value">{summary?.profileComplete ? '100%' : '85%'}</div>
                <div className="hero-stat__label">Kelengkapan Profil</div>
              </div>
              <div className="hero-stat__divider" />
              <div className="hero-stat">
                <div className="hero-stat__value">SSO</div>
                <div className="hero-stat__label">Sesi Terproteksi</div>
              </div>
            </div>

            {(isAdmin || isPengelolaJuri) && (
              <div className="dashboard__hero-admin-actions">
                {isAdmin && (
                  <button
                    type="button"
                    className="hero-admin-btn hero-admin-btn--admin"
                    onClick={() => navigate('/admin')}
                    title="Buka Panel Admin IT"
                  >
                    <ShieldCheck size={16} />
                    <span>Panel Admin</span>
                  </button>
                )}
                {isPengelolaJuri && (
                  <button
                    type="button"
                    className="hero-admin-btn hero-admin-btn--juri"
                    onClick={() => navigate('/juri')}
                    title="Buka Panel Penilaian Juri"
                  >
                    <Gavel size={16} />
                    <span>Panel Juri</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Card inside Hero */}
        <div className="dashboard__hero-user">
          <div className="dashboard__user-avatar-wrap">
            <div className="dashboard__avatar">{userInitial}</div>
            <span className="dashboard__user-online" title="SSO Active" />
          </div>
          <div className="dashboard__user-info">
            <div className="dashboard__name dashboard__user-name">{summary?.nama ?? '-'}</div>
            <div className="dashboard__user-title">{summary?.jabatan || 'Pegawai Organik'}</div>
            <div className="dashboard__user-meta">
              {summary?.band && <span className="user-meta-tag user-meta-tag--gold">BAND {summary.band}</span>}
              {summary?.tingkatan && <span className="user-meta-tag">{summary.tingkatan}</span>}
              <span className="user-meta-tag user-meta-tag--green">
                <ShieldCheck size={11} /> Verified SSO
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pintasan Akses Cepat */}
      <div className="dashboard__quick-bar">
        <div className="dashboard__quick-title">
          <Zap size={15} className="dashboard__quick-icon" />
          <span>Akses Cepat</span>
        </div>
        <div className="dashboard__quick-actions">
          <button
            type="button"
            className="quick-btn"
            onClick={() => navigate('/my-personal/absensi')}
            title="Buka Halaman Presensi"
          >
            <CalendarCheck2 size={16} />
            <span>Presensi Harian</span>
          </button>
          <button
            type="button"
            className="quick-btn"
            onClick={() => navigate('/my-personal/cuti')}
            title="Ajukan Izin atau Cuti"
          >
            <FileText size={16} />
            <span>Pengajuan Cuti</span>
          </button>
          <button
            type="button"
            className="quick-btn"
            onClick={() => navigate('/my-office')}
            title="Surat & Naskah Dinas"
          >
            <Mail size={16} />
            <span>Persuratan Office</span>
          </button>
          <button
            type="button"
            className="quick-btn"
            onClick={() => navigate('/my-innovation')}
            title="Submit Ide Inovasi"
          >
            <Lightbulb size={16} />
            <span>Ide Inovasi</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Modules & Side Widgets */}
      <div className="dashboard__layout-grid">
        {/* Module Section */}
        <div className="dashboard__modules-section">
          {/* Toolbar: Tabs & Search */}
          <div className="dashboard__toolbar">
            <div className="dashboard__tabs" role="tablist">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id
                const count =
                  cat.id === 'fav'
                    ? favorites.length
                    : cat.id === 'all'
                    ? modules.length
                    : modules.filter((m) => MODULE_CATEGORY_MAP[m.key] === cat.id).length

                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`dashboard__tab ${isActive ? 'dashboard__tab--active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span>{cat.label}</span>
                    <span className="dashboard__tab-count">{count}</span>
                  </button>
                )
              })}
            </div>

            <div className="dashboard__search-box">
              <Search size={16} className="dashboard__search-icon" />
              <input
                type="text"
                className="dashboard__search-input"
                placeholder="Cari modul portal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="dashboard__search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Bersihkan pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Module Grid */}
          {filteredModules.length === 0 ? (
            <div className="dashboard__empty">
              <Search size={32} className="dashboard__empty-icon" />
              <h3>Modul tidak ditemukan</h3>
              <p>Tidak ada modul yang cocok dengan kata kunci atau filter kategori ini.</p>
              {searchQuery && (
                <button
                  type="button"
                  className="dashboard__empty-reset"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveCategory('all')
                  }}
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="dashboard__modules">
              {filteredModules.map((mod) => {
                const Icon = ICONS[mod.icon] ?? Users
                const target = MODULE_ROUTES[mod.key]
                const logo = mod.logoUrl ?? MODULE_LOGOS[mod.key]
                const isFav = favorites.includes(mod.key)

                if (!mod.enabled || !target) {
                  return (
                    <div className="module-tile module-tile--disabled" key={mod.key} aria-disabled="true">
                      <div className="module-tile__top-bar">
                        <button
                          type="button"
                          className={`module-tile__fav-btn ${isFav ? 'is-fav' : ''}`}
                          onClick={(e) => toggleFavorite(e, mod.key)}
                          title={isFav ? 'Hapus dari favorit' : 'Tandai sebagai favorit'}
                        >
                          <Star size={15} fill={isFav ? '#f4ae46' : 'none'} />
                        </button>
                      </div>

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
                          {isAdmin && mod.access === 'admin' && (
                            <span className="module-tile__badge">Khusus Admin</span>
                          )}
                        </div>
                        <div className="module-tile__subtitle">{mod.subtitle}</div>
                      </div>

                      <div className="module-tile__action module-tile__action--locked">
                        <Lock size={13} /> <span>Coming Soon</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <button
                    type="button"
                    className={`module-tile module-tile--open ${isFav ? 'module-tile--fav' : ''}`}
                    key={mod.key}
                    onClick={() => navigate(target)}
                    aria-label={`Buka modul ${mod.label}`}
                  >
                    <div className="module-tile__top-bar">
                      <button
                        type="button"
                        className={`module-tile__fav-btn ${isFav ? 'is-fav' : ''}`}
                        onClick={(e) => toggleFavorite(e, mod.key)}
                        title={isFav ? 'Hapus dari favorit' : 'Tandai sebagai favorit'}
                      >
                        <Star size={15} fill={isFav ? '#f4ae46' : 'none'} />
                      </button>
                    </div>

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
          )}
        </div>

        {/* Sidebar Widgets Column */}
        <aside className="dashboard__sidebar-widgets">
          {/* Notifications Card */}
          <div className="dashboard__widget">
            <div className="dashboard__widget-header">
              <div className="dashboard__widget-title">
                <Bell size={16} className="widget-title-icon" />
                <span>Informasi & Pengumuman</span>
              </div>
              <span className="widget-header-badge">Terbaru</span>
            </div>

            <div className="dashboard__notif-list">
              <div className="notif-card-item">
                <div className="notif-card-item__icon notif-card-item__icon--green">
                  <CheckCircle2 size={16} />
                </div>
                <div className="notif-card-item__content">
                  <div className="notif-card-item__title">Portal MyGCS Aktif</div>
                  <div className="notif-card-item__desc">
                    Semua sistem Single Sign-On (SSO) berjalan optimal untuk akun Anda.
                  </div>
                  <div className="notif-card-item__time">Hari ini</div>
                </div>
              </div>

              <div className="notif-card-item">
                <div className="notif-card-item__icon notif-card-item__icon--gold">
                  <UserCheck size={16} />
                </div>
                <div className="notif-card-item__content">
                  <div className="notif-card-item__title">Modul My Personal & SDM</div>
                  <div className="notif-card-item__desc">
                    Lengkapi berkas identitas dan presensi harian secara berkala.
                  </div>
                  <div className="notif-card-item__time">Pemberitahuan</div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Status Card */}
          <div className="dashboard__widget dashboard__widget--security">
            <div className="dashboard__widget-header">
              <div className="dashboard__widget-title">
                <ShieldCheck size={16} className="widget-title-icon" />
                <span>Keamanan Sesi SSO</span>
              </div>
            </div>

            <div className="security-status-box">
              <div className="security-status-row">
                <span className="sec-label">Protokol Autentikasi:</span>
                <span className="sec-val">OAuth2 / OIDC PKCE</span>
              </div>
              <div className="security-status-row">
                <span className="sec-label">Status Enkripsi:</span>
                <span className="sec-val sec-val--active">Terenkripsi Aktif</span>
              </div>
              <div className="security-status-row">
                <span className="sec-label">Perlindungan Idle:</span>
                <span className="sec-val">Otomatis Aktif</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
