import { Outlet } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import './AppShell.css'

// Dashboard sengaja tanpa sidebar: halaman ini adalah pintu masuk portal, dan satu-satunya
// navigasinya adalah kartu modul di bawah. Sidebar lama hanya berisi "Dashboard" (halaman
// yang sedang dibuka) dan "Pengaturan" yang terkunci - tidak membawa nilai apa pun.
// Bilah atas hijau yang kini memikul identitas: logo + warna korporat.
export default function DashboardLayout() {
  const { summary, logout } = useAuth()

  // logout() clears local tokens + server cookie and redirects to /login itself.
  function handleLogout() {
    logout()
  }

  return (
    <div className="app-shell">
      <div className="app-shell__main">
        <TopBar
          title=""
          name={summary?.nama}
          subtitle={summary?.jabatan}
          logoSrc="/mygcs.png"
          dark
          onLogout={handleLogout}
        />
        <div className="app-shell__content">
          <Outlet context={{ summary }} />
        </div>
      </div>
    </div>
  )
}
