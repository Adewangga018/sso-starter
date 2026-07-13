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
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
