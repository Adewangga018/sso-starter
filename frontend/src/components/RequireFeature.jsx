import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Penjaga rute per FITUR (item menu), mengikuti Akses Modul > fitur. Bila fitur dikunci
// Admin IT, non-Admin dialihkan ke dashboard (menu-nya juga sudah disembunyikan).
// Lapis kenyamanan; penegakan sebenarnya ada di server (FeatureGateAttribute) untuk fitur
// yang punya controller tersendiri.
export default function RequireFeature({ featureKey }) {
  const { summary, isAdmin, isFeatureLocked } = useAuth()
  if (isAdmin) return <Outlet />
  if (!summary) return <Outlet />           // ringkasan belum termuat: jangan kunci di sini
  if (isFeatureLocked(featureKey)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
