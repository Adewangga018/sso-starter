import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, Lock, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
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

  // Fitur (item menu) yang dikunci Admin IT disembunyikan bagi non-Admin IT.
  const { isFeatureLocked } = useAuth()

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
          {sections.map((section, idx) => {
            const items = (section.items ?? []).filter((item) => !isFeatureLocked(item.feature))
            if (items.length === 0) return null
            return (
              <div className="sidebar__section" key={section.label ?? idx}>
                {section.label && showLabels && <div className="sidebar__section-label">{section.label}</div>}
                {items.map((item) =>
                  item.children ? (
                    <SidebarGroup key={item.key} item={item} showLabels={showLabels} onNavigate={onCloseMobile} />
                  ) : (
                    <SidebarItem key={item.key} item={item} showLabels={showLabels} onNavigate={onCloseMobile} />
                  ),
                )}
              </div>
            )
          })}
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

function SidebarItem({ item, showLabels, onNavigate, sub = false }) {
  const Icon = item.icon
  // Sub-items are marked with a bullet dot instead of an icon (the parent already
  // carries the icon), matching the nested menu style of the DOF reference.
  const marker = sub ? <span className="sidebar__dot" /> : Icon ? <Icon size={18} /> : null
  const subClass = sub ? ' sidebar__item--sub' : ''

  if (item.disabled) {
    const title = item.disabledReason ?? (showLabels ? undefined : item.label)
    return (
      <div className={`sidebar__item sidebar__item--disabled${subClass}`} title={title}>
        <span className="sidebar__item-content">
          {marker}
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
      end={item.end}
      title={showLabels ? undefined : item.label}
      onClick={onNavigate}
      className={({ isActive }) =>
        `sidebar__item${variantClass}${subClass}${isActive ? ' sidebar__item--active' : ''}`
      }
    >
      <span className="sidebar__item-content">
        {marker}
        {showLabels && <span>{item.label}</span>}
      </span>
      {showLabels && <Badge value={item.badge} />}
    </NavLink>
  )
}

// Rendered only when the caller supplies a real count, so no placeholder numbers
// appear while a module still lacks an unread-count source.
function Badge({ value }) {
  if (value === null || value === undefined || value === 0 || value === '') return null
  const text = typeof value === 'number' && value > 99 ? '99+' : String(value)
  return <span className="sidebar__badge">{text}</span>
}

function isChildActive(child, pathname) {
  if (!child.to) return false
  if (child.end) return pathname === child.to
  return pathname === child.to || pathname.startsWith(`${child.to}/`)
}

function SidebarGroup({ item, showLabels, onNavigate }) {
  const { pathname } = useLocation()
  const Icon = item.icon
  const children = item.children ?? []
  const hasActiveChild = children.some((c) => isChildActive(c, pathname))
  const [open, setOpen] = useState(hasActiveChild)

  // Navigating into one of the children (e.g. from a link elsewhere in the app)
  // opens the group so the current page is always visible in the menu.
  useEffect(() => {
    if (hasActiveChild) setOpen(true)
  }, [hasActiveChild])

  // In the collapsed icon rail there is no room for the expand affordance or the
  // child labels, so the children are rendered flat as icon-only entries instead -
  // every destination stays reachable, each with its label as a tooltip.
  if (!showLabels) {
    return (
      <>
        {children.map((child) => (
          <SidebarItem key={child.key} item={child} showLabels={false} onNavigate={onNavigate} />
        ))}
      </>
    )
  }

  return (
    <div className={`sidebar__group${open ? ' sidebar__group--open' : ''}`}>
      <button
        type="button"
        className={`sidebar__item sidebar__item--parent${hasActiveChild ? ' sidebar__item--parent-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="sidebar__item-content">
          {Icon && <Icon size={18} />}
          <span>{item.label}</span>
        </span>
        <ChevronRight size={14} className="sidebar__chevron" />
      </button>
      {open && (
        <div className="sidebar__submenu">
          {children.map((child) => (
            <SidebarItem key={child.key} item={child} showLabels sub onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}
