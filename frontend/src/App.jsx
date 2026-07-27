import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DialogProvider } from './components/DialogProvider'
import RequireAuth from './components/RequireAuth'
import RequireModule from './components/RequireModule'
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
import AdminModulesPage from './pages/AdminModulesPage'
import AdminJuriPage from './pages/AdminJuriPage'
import DashboardLayout from './layouts/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import MyTeamPage from './pages/MyTeamPage'
import RekapTimPage from './pages/RekapTimPage'
import MyTeamLayout from './layouts/MyTeamLayout'
import MyOfficeLayout from './layouts/MyOfficeLayout'
import MyOfficeBeranda from './pages/office/MyOfficeBeranda'
import BuatSurat from './pages/office/BuatSurat'
import DaftarSurat from './pages/office/DaftarSurat'
import SuratDetail from './pages/office/SuratDetail'
import MenungguSurat from './pages/office/MenungguSurat'
import OfficeInbox from './pages/office/Inbox'
import MyPersonalLayout from './layouts/MyPersonalLayout'
import ProfilPage from './pages/ProfilPage'
import CutiPage from './pages/CutiPage'
import PersetujuanPage from './pages/PersetujuanPage'
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
import RankingPage from './pages/inovasi/RankingPage'
import RekapGagasan from './pages/inovasi/RekapGagasan'
import RekapMetodologi from './pages/inovasi/RekapMetodologi'
import GrafikGagasan from './pages/inovasi/GrafikGagasan'
import HistoryApproval from './pages/inovasi/HistoryApproval'
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
            <Route path="/admin/modules" element={<AdminModulesPage />} />
            {/* Panel Juri berdiri sendiri (di luar /admin): pengelola stream juri
                belum tentu Admin IT. Rute lama /admin/juri diarahkan ke sini. */}
            <Route path="/juri" element={<AdminJuriPage />} />
            <Route path="/admin/juri" element={<Navigate to="/juri" replace />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
            </Route>

            {/* Tiap modul dijaga RequireModule: kalau Admin IT menonaktifkannya atau
                menguncinya ke Admin saja (Panel Admin > Akses Modul), rutenya dilempar
                balik ke dashboard. Penegakan sebenarnya ada di server (ModuleGate). */}
            <Route element={<RequireModule moduleKey="my-team" />}>
              <Route path="/team" element={<MyTeamLayout />}>
                <Route index element={<MyTeamPage />} />
                <Route path="rekap" element={<RekapTimPage />} />
              </Route>
            </Route>

            <Route element={<RequireModule moduleKey="my-office" />}>
              <Route path="/my-office" element={<MyOfficeLayout />}>
                <Route index element={<MyOfficeBeranda />} />
                <Route path="inbox" element={<OfficeInbox />} />
                <Route path="buat" element={<BuatSurat />} />
                <Route path="daftar" element={<DaftarSurat />} />
                <Route path="review" element={<MenungguSurat mode="review" />} />
                <Route path="approval" element={<MenungguSurat mode="approval" />} />
                <Route path="surat/:id" element={<SuratDetail />} />
              </Route>
            </Route>

            <Route element={<RequireModule moduleKey="my-personal" />}>
              <Route path="/my-personal" element={<MyPersonalLayout />}>
                <Route index element={<Navigate to="profil" replace />} />
                <Route path="profil" element={<ProfilPage />} />
                <Route path="cuti" element={<CutiPage />} />
                <Route path="persetujuan" element={<PersetujuanPage />} />
                <Route path="absensi" element={<AbsensiPage />} />
                <Route path="lembur" element={<SplPage />} />
                <Route path="izin" element={<IzinPage />} />
                <Route path="sppd" element={<SppdPage />} />
                <Route path="umdl" element={<UmdlPage />} />
                <Route path="tiket" element={<TiketPage />} />
              </Route>
            </Route>

            {/* My Innovation: satu ruang kerja terpadu. Masuk = langsung Sumbang
                Gagasan (metodologi SS/GIO/5R ditentukan GM saat menyetujui). */}
            <Route element={<RequireModule moduleKey="my-innovation" />}>
              <Route path="/my-innovation" element={<InovasiLayout />}>
                <Route index element={<Navigate to="gagasan" replace />} />
                <Route path="gagasan" element={<GagasanList />} />
                <Route path="daftar" element={<InovasiList />} />
                <Route path="daftar/:id" element={<InovasiForm />} />
                <Route path="beranda" element={<InovasiBeranda />} />
                <Route path="panduan" element={<InovasiPanduan />} />
                <Route path="pegawai" element={<InovasiPegawai />} />
                <Route path="roadmap" element={<InovasiRoadmap />} />
                <Route path="rekap/gagasan" element={<RekapGagasan />} />
                <Route path="rekap/metodologi" element={<RekapMetodologi />} />
                {/* Ranking Sumbang Gagasan & Ranking Inovasi kini satu menu bertab;
                    dua rute lama diarahkan ke sana agar tautan lama tetap hidup. */}
                <Route path="rekap/ranking" element={<RankingPage />} />
                <Route path="rekap/ranking-gagasan" element={<Navigate to="../rekap/ranking" replace />} />
                <Route path="rekap/grafik-gagasan" element={<GrafikGagasan />} />
                <Route path="ranking" element={<Navigate to="../rekap/ranking" replace />} />
                {/* History dipecah mengikuti objek yang disetujui: gagasan & risalah. */}
                <Route path="history" element={<Navigate to="gagasan" replace />} />
                <Route path="history/gagasan" element={<HistoryApproval kind="gagasan" />} />
                <Route path="history/inovasi" element={<HistoryApproval kind="inovasi" />} />
                <Route path="konvensi" element={<InovasiKonvensi />} />
                <Route path="penilaian" element={<InovasiPenilaianList />} />
                <Route path="penilaian/:penugasanId" element={<InovasiPenilaianForm />} />
              </Route>
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
