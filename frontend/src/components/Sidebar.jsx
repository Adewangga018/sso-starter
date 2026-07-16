import { NavLink } from 'react-router-dom'
import { Lock, LogOut, Menu } from 'lucide-react'
import './Sidebar.css'

export default function Sidebar({
  logoSrc,
  title,
  subtitle,
  sections,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onLogout,
}) {
  // On mobile the drawer is always shown at full width with labels, regardless
  // of the persisted desktop "collapsed" (icon-rail) preference.
  const showLabels = !collapsed || mobileOpen

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${mobileOpen ? ' sidebar--mobile-open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__brand-identity">
            <img src={logoSrc} alt="GCS" className="sidebar__logo" />
            {showLabels && (
              <div className="sidebar__brand-text">
                <div className="sidebar__title">{title}</div>
                {subtitle && <div className="sidebar__subtitle">{subtitle}</div>}
              </div>
            )}
          </div>
          <button
            type="button"
            className="sidebar__hamburger"
            onClick={mobileOpen ? onCloseMobile : onToggleCollapse}
            aria-label={collapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
            title={collapsed ? 'Perluas' : 'Perkecil'}
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {sections.map((section, idx) => (
            <div className="sidebar__section" key={section.label ?? idx}>
              {section.label && showLabels && <div className="sidebar__section-label">{section.label}</div>}
              {section.items.map((item) => (
                <SidebarItem key={item.key} item={item} showLabels={showLabels} onNavigate={onCloseMobile} />
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button type="button" className="sidebar__logout-btn" onClick={onLogout} title="Keluar">
            <LogOut size={16} />
            {showLabels && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

function SidebarItem({ item, showLabels, onNavigate }) {
  const Icon = item.icon

  if (item.disabled) {
    const title = item.disabledReason ?? (showLabels ? undefined : item.label)
    return (
      <div className="sidebar__item sidebar__item--disabled" title={title}>
        <span className="sidebar__item-content">
          {Icon && <Icon size={18} />}
          {showLabels && <span>{item.label}</span>}
        </span>
        {showLabels && <Lock size={12} className="sidebar__lock" />}
      </div>
    )
  }

  const variantClass = item.variant ? ` sidebar__item--${item.variant}` : ''

  return (
    <NavLink
      to={item.to}
      title={showLabels ? undefined : item.label}
      onClick={onNavigate}
      className={({ isActive }) => `sidebar__item${variantClass}${isActive ? ' sidebar__item--active' : ''}`}
    >
      <span className="sidebar__item-content">
        {Icon && <Icon size={18} />}
        {showLabels && <span>{item.label}</span>}
      </span>
    </NavLink>
  )
}
