import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronDown, Gavel, LogOut, Menu, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './TopBar.css'

/**
 * Bilah atas aplikasi.
 *
 * @param {string} title        - judul halaman.
 * @param {string} name         - nama pengguna.
 * @param {string} subtitle     - baris kecil di bawah nama (jabatan).
 * @param {string} logoSrc      - kalau diisi, logo tampil di kiri menggantikan tombol menu.
 *                                Dipakai Dashboard, yang memang tidak punya sidebar.
 * @param {boolean} dark        - varian hijau tua (Dashboard); selain itu putih.
 * @param {function} onMenuClick - membuka sidebar di layar kecil.
 * @param {function} onLogout   - dipanggil dari menu profil.
 */
export default function TopBar({ title, titleLogo, name, subtitle, logoSrc, dark = false, onMenuClick, onLogout }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?'
  const { isAdmin, isPengelolaJuri } = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const actionsRef = useRef(null)

  // Klik di luar atau tombol Esc menutup kedua popup - kalau tidak, popup menggantung
  // terbuka saat pengguna berpindah ke bagian lain halaman.
  useEffect(() => {
    if (!menuOpen && !notifOpen) return

    function onPointerDown(e) {
      if (!actionsRef.current?.contains(e.target)) {
        setMenuOpen(false)
        setNotifOpen(false)
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setNotifOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, notifOpen])

  return (
    <header className={`topbar${dark ? ' topbar--dark' : ''}`}>
      <div className="topbar__left">
        {logoSrc ? (
          <Link to="/dashboard" className="topbar__brand">
            <img src={logoSrc} alt="MyGCS" className="topbar__logo" />
          </Link>
        ) : (
          <button type="button" className="topbar__menu-btn" onClick={onMenuClick} aria-label="Buka menu">
            <Menu size={20} />
          </button>
        )}
        {titleLogo
          ? <img src={titleLogo} alt={title} className="topbar__title-logo" />
          : title && <h1 className="topbar__title">{title}</h1>}
      </div>

      <div className="topbar__actions" ref={actionsRef}>
        {/* Panel Juri berdiri sendiri (bukan sub-menu Admin): pengelola stream
            juri belum tentu Admin IT. Untuk Admin yang juga pengelola, tampil
            berdampingan dengan Panel Admin. */}
        {isPengelolaJuri && (
          <Link to="/juri" className="topbar__admin-link topbar__admin-link--juri" title="Panel Juri & Penilaian Inovasi">
            <Gavel size={16} /> Panel Juri
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin" className="topbar__admin-link" title="Panel Admin IT">
            <ShieldCheck size={16} /> Panel Admin
          </Link>
        )}

        <div className="topbar__popup-anchor">
          <button
            type="button"
            className="topbar__bell"
            aria-label="Notifikasi"
            aria-expanded={notifOpen}
            onClick={() => {
              setNotifOpen((v) => !v)
              setMenuOpen(false)
            }}
          >
            <Bell size={18} />
          </button>

          {notifOpen && (
            <div className="topbar__popup" role="dialog" aria-label="Notifikasi">
              <div className="topbar__popup-title">Notifikasi</div>
              <div className="topbar__popup-empty">Belum ada notifikasi.</div>
            </div>
          )}
        </div>

        <div className="topbar__popup-anchor">
          <button
            type="button"
            className="topbar__user"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((v) => !v)
              setNotifOpen(false)
            }}
          >
            <div className="topbar__avatar">{initial}</div>
            {name && (
              <div className="topbar__user-text">
                <div className="topbar__user-name">{name}</div>
                {subtitle && <div className="topbar__user-role">{subtitle}</div>}
              </div>
            )}
            <ChevronDown size={16} className={`topbar__chevron${menuOpen ? ' topbar__chevron--open' : ''}`} />
          </button>

          {menuOpen && (
            <div className="topbar__popup topbar__popup--menu" role="menu">
              <div className="topbar__popup-user">
                <div className="topbar__popup-name">{name}</div>
                {subtitle && <div className="topbar__popup-role">{subtitle}</div>}
              </div>
              <button type="button" className="topbar__popup-item" role="menuitem" onClick={onLogout}>
                <LogOut size={15} /> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
