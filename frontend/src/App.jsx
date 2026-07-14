import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SecurityPage from './pages/SecurityPage'
import AdminAuditPage from './pages/AdminAuditPage'
import DashboardLayout from './layouts/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import MyPersonalLayout from './layouts/MyPersonalLayout'
import ProfilPage from './pages/ProfilPage'
import AbsensiPage from './pages/AbsensiPage'
import SplPage from './pages/SplPage'
import IzinPage from './pages/IzinPage'
import IzinCetakPage from './pages/IzinCetakPage'
import SppdPage from './pages/SppdPage'
import UmdlPage from './pages/UmdlPage'
import TiketPage from './pages/TiketPage'
import TiketCetakPage from './pages/TiketCetakPage'
import SppdCetakPage from './pages/SppdCetakPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
            </Route>

            <Route path="/my-personal" element={<MyPersonalLayout />}>
              <Route index element={<Navigate to="profil" replace />} />
              <Route path="profil" element={<ProfilPage />} />
              <Route path="absensi" element={<AbsensiPage />} />
              <Route path="lembur" element={<SplPage />} />
              <Route path="izin" element={<IzinPage />} />
              <Route path="sppd" element={<SppdPage />} />
              <Route path="umdl" element={<UmdlPage />} />
              <Route path="tiket" element={<TiketPage />} />
            </Route>

            {/* Outside MyPersonalLayout on purpose: the printed letter must be a bare page,
                with no sidebar or header bleeding into the print output. */}
            <Route path="/cetak/izin/:id" element={<IzinCetakPage />} />
            <Route path="/cetak/sppd/:id" element={<SppdCetakPage />} />
            <Route path="/cetak/tiket/:id" element={<TiketCetakPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
