import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DialogProvider } from './components/DialogProvider'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SecurityPage from './pages/SecurityPage'
import AdminAuditPage from './pages/AdminAuditPage'
import AdminDocumentsPage from './pages/AdminDocumentsPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminLocationsPage from './pages/AdminLocationsPage'
import AdminJuriPage from './pages/AdminJuriPage'
import DashboardLayout from './layouts/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import MyTeamPage from './pages/MyTeamPage'
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
import InovasiLayout from './layouts/InovasiLayout'
import InovasiBeranda from './pages/inovasi/InovasiBeranda'
import InovasiPanduan from './pages/inovasi/InovasiPanduan'
import InovasiList from './pages/inovasi/InovasiList'
import InovasiForm from './pages/inovasi/InovasiForm'
import GagasanList from './pages/inovasi/GagasanList'
import InovasiPegawai from './pages/inovasi/InovasiPegawai'
import InovasiRoadmap from './pages/inovasi/InovasiRoadmap'
import InovasiRanking from './pages/inovasi/InovasiRanking'
import InovasiHistory from './pages/inovasi/InovasiHistory'
import InovasiKonvensi from './pages/inovasi/InovasiKonvensi'
import InovasiPenilaianList from './pages/inovasi/InovasiPenilaianList'
import InovasiPenilaianForm from './pages/inovasi/InovasiPenilaianForm'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DialogProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
            <Route path="/admin/documents" element={<AdminDocumentsPage />} />
            <Route path="/admin/locations" element={<AdminLocationsPage />} />
            <Route path="/admin/juri" element={<AdminJuriPage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
            </Route>

            <Route path="/team" element={<MyTeamPage />} />

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

            {/* My Innovation: satu ruang kerja terpadu. Masuk = langsung Sumbang
                Gagasan (metodologi SS/GIO/5R ditentukan GM saat menyetujui). */}
            <Route path="/my-innovation" element={<InovasiLayout />}>
              <Route index element={<Navigate to="gagasan" replace />} />
              <Route path="gagasan" element={<GagasanList />} />
              <Route path="daftar" element={<InovasiList />} />
              <Route path="daftar/:id" element={<InovasiForm />} />
              <Route path="beranda" element={<InovasiBeranda />} />
              <Route path="panduan" element={<InovasiPanduan />} />
              <Route path="pegawai" element={<InovasiPegawai />} />
              <Route path="roadmap" element={<InovasiRoadmap />} />
              <Route path="ranking" element={<InovasiRanking />} />
              <Route path="history" element={<InovasiHistory />} />
              <Route path="konvensi" element={<InovasiKonvensi />} />
              <Route path="penilaian" element={<InovasiPenilaianList />} />
              <Route path="penilaian/:penugasanId" element={<InovasiPenilaianForm />} />
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
        </DialogProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
