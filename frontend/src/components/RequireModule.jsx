import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Penjaga rute modul, mengikuti Panel Admin IT > Akses Modul. /dashboard/summary sudah
// memaksa enabled = false untuk modul yang dinonaktifkan MAUPUN yang dikunci ke Admin IT,
// jadi "tidak ada di daftar atau enabled = false" = tidak boleh dibuka.
//
// Ini hanya lapis kenyamanan (mencegah halaman kosong/penuh error saat rute diketik
// manual); penegakan sebenarnya ada di server lewat ModuleGateAttribute.
export default function RequireModule({ moduleKey }) {
  const { summary, isAdmin } = useAuth()

  // Admin IT selalu boleh masuk - termasuk ke modul yang sedang dinonaktifkan, supaya
  // bisa mengujinya sebelum dibuka untuk semua orang.
  if (isAdmin) return <Outlet />

  // Ringkasan gagal dimuat (mis. jaringan): jangan kunci pengguna di sini. Server tetap
  // menolak kalau memang tidak berhak.
  if (!summary?.modules) return <Outlet />

  const mod = summary.modules.find((m) => m.key === moduleKey)
  if (!mod || !mod.enabled) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
