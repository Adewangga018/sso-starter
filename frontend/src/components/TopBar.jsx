import { Bell, ChevronDown, Menu } from 'lucide-react'
import './TopBar.css'

export default function TopBar({ title, name, jabatan, onMenuClick }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button type="button" className="topbar__menu-btn" onClick={onMenuClick} aria-label="Buka menu">
          <Menu size={20} />
        </button>
        <h1 className="topbar__title">{title}</h1>
      </div>
      <div className="topbar__actions">
        <button type="button" className="topbar__bell" aria-label="Notifikasi">
          <Bell size={18} />
        </button>
        <div className="topbar__user">
          <div className="topbar__avatar">{initial}</div>
          {name && (
            <div className="topbar__user-text">
              <div className="topbar__user-name">{name}</div>
              {jabatan && <div className="topbar__user-role">{jabatan}</div>}
            </div>
          )}
          <ChevronDown size={16} className="topbar__chevron" />
        </div>
      </div>
    </header>
  )
}
