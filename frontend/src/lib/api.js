import { userManager } from './auth'

// Same-origin in both dev (Vite proxy) and prod (subfolder). Override only if the
// backend is ever hosted on a different host.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// The list endpoints answer 404 when the signed-in account cannot be matched to an
// employee record. The pages treat that as "no rows" and render an empty table rather
// than an error banner. Only 404 is swallowed - a 500 or a network failure still surfaces,
// so a genuinely broken backend never masquerades as an empty list.
export function isEmptyDataError(err) {
  return err instanceof ApiError && err.status === 404
}

async function apiFetch(path, options = {}) {
  const user = await userManager.getUser()
  const headers = { ...(options.headers || {}) }
  // Only JSON bodies get the header. A FormData body must be left alone so the browser can
  // set multipart/form-data with its own boundary - overriding it breaks the upload.
  if (typeof options.body === 'string') headers['Content-Type'] = 'application/json'
  if (user && !user.expired) headers.Authorization = `Bearer ${user.access_token}`

  // credentials:'include' so cookie-based endpoints (login, 2FA step) send/receive
  // the Identity session cookie; same-origin so no CORS concern.
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', ...options, headers })

  if (!res.ok) {
    let message = `Terjadi kesalahan (${res.status}).`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // response has no JSON body, keep default message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return null
  return res.json()
}

const post = (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

// Fetches a binary document (KTP/KK/ijazah, etc.) as a blob and returns an object URL the
// viewer can point an <iframe> at. An <iframe src> can't carry an Authorization header, so we
// fetch with the Bearer token here and hand back a blob: URL instead. The caller MUST call
// URL.revokeObjectURL(url) when done to free the blob. Throws ApiError on failure (e.g. 404
// when the document isn't available), so callers can show a friendly message.
async function apiBlob(path) {
  const user = await userManager.getUser()
  const headers = {}
  if (user && !user.expired) headers.Authorization = `Bearer ${user.access_token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers })
  if (!res.ok) {
    let message = `Terjadi kesalahan (${res.status}).`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // response has no JSON body, keep default message
    }
    throw new ApiError(res.status, message)
  }

  const blob = await res.blob()
  return { url: URL.createObjectURL(blob), contentType: blob.type }
}

// Fetches a file and triggers a browser "Save as" using the server-provided filename
// (from Content-Disposition). Like apiBlob it carries the Bearer token, which a plain
// <a href> download can't. Throws ApiError on failure so callers can show a message.
async function apiDownload(path, fallbackName = 'download') {
  const user = await userManager.getUser()
  const headers = {}
  if (user && !user.expired) headers.Authorization = `Bearer ${user.access_token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers })
  if (!res.ok) {
    let message = `Terjadi kesalahan (${res.status}).`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // no JSON body, keep default message
    }
    throw new ApiError(res.status, message)
  }

  // Parse filename from Content-Disposition (filename*=UTF-8''… or filename="…").
  let name = fallbackName
  const cd = res.headers.get('Content-Disposition') || ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)
  const plain = /filename="?([^";]+)"?/i.exec(cd)
  if (star) name = decodeURIComponent(star[1])
  else if (plain) name = plain[1]

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  // dashboard / personal (Bearer)
  getDashboardSummary: () => apiFetch('/api/dashboard/summary'),
  // My Team (Bearer): struktur tim + kehadiran. semua=true -> seluruh tingkat bawahan.
  getMyTeam: (semua) => apiFetch(`/api/team${semua ? '?semua=true' : ''}`),
  beriTugas: (payload) => apiFetch('/api/team/tugas', { method: 'POST', body: JSON.stringify(payload) }),
  ubahStatusTugas: (id, status) =>
    apiFetch(`/api/team/tugas/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  hapusTugas: (id) => apiFetch(`/api/team/tugas/${id}`, { method: 'DELETE' }),
  // Rekap Tim (monitoring operasional: kehadiran + produktivitas tugas).
  getRekapTim: () => apiFetch('/api/team/rekap'),
  // Unduh laporan tim (CSV) — mencakup seluruh level bawahan. Nama file dari server.
  unduhLaporanTim: () => apiDownload('/api/team/laporan', 'Laporan-Tim.csv'),

  // My Office (persuratan)
  cariPegawaiOffice: (q) => apiFetch(`/api/office/pegawai?q=${encodeURIComponent(q ?? '')}`),
  getDaftarSurat: (status) => apiFetch(`/api/office/surat${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getSuratDetail: (id) => apiFetch(`/api/office/surat/${id}`),
  buatSurat: (payload) => apiFetch('/api/office/surat', { method: 'POST', body: JSON.stringify(payload) }),
  kirimSurat: (id) => apiFetch(`/api/office/surat/${id}/kirim`, { method: 'POST' }),
  batalSurat: (id) => apiFetch(`/api/office/surat/${id}/batal`, { method: 'POST' }),
  getInboxOffice: () => apiFetch('/api/office/inbox'),
  getMenungguReviewOffice: () => apiFetch('/api/office/review'),
  getMenungguApprovalOffice: () => apiFetch('/api/office/approval'),
  aksiPengesahanSurat: (id, payload) =>
    apiFetch(`/api/office/surat/${id}/pengesahan`, { method: 'POST', body: JSON.stringify(payload) }),
  uploadLampiranSurat: (id, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/office/surat/${id}/lampiran`, { method: 'POST', body })
  },
  hapusLampiranSurat: (id, lampId) => apiFetch(`/api/office/surat/${id}/lampiran/${lampId}`, { method: 'DELETE' }),
  unduhLampiranSurat: (id, lampId, nama) => apiDownload(`/api/office/surat/${id}/lampiran/${lampId}`, nama || 'lampiran'),
  getPersonalProfile: () => apiFetch('/api/personal/profile'),
  updateProfile: (payload) => apiFetch('/api/personal/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  uploadDocument: (key, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/personal/documents/${key}`, { method: 'POST', body })
  },
  uploadAktaAnak: (idAnak, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/personal/documents/anak/${idAnak}/akta`, { method: 'POST', body })
  },
  createAnak: (payload) => apiFetch('/api/personal/anak', { method: 'POST', body: JSON.stringify(payload) }),
  updateAnak: (idAnak, payload) =>
    apiFetch(`/api/personal/anak/${idAnak}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAnak: (idAnak) => apiFetch(`/api/personal/anak/${idAnak}`, { method: 'DELETE' }),
  getAbsensi: () => apiFetch('/api/personal/absensi'),
  getLocations: () => apiFetch('/api/personal/locations'),
  submitAbsensi: (payload) =>
    apiFetch('/api/personal/absensi', { method: 'POST', body: JSON.stringify(payload) }),
  getSpl: () => apiFetch('/api/personal/spl'),
  createSpl: (payload) => apiFetch('/api/personal/spl', { method: 'POST', body: JSON.stringify(payload) }),
  updateSpl: (id, payload) =>
    apiFetch(`/api/personal/spl/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSpl: (id) => apiFetch(`/api/personal/spl/${id}`, { method: 'DELETE' }),
  getIzin: () => apiFetch('/api/personal/izin'),
  createIzin: (payload) => apiFetch('/api/personal/izin', { method: 'POST', body: JSON.stringify(payload) }),
  updateIzin: (id, payload) =>
    apiFetch(`/api/personal/izin/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteIzin: (id) => apiFetch(`/api/personal/izin/${id}`, { method: 'DELETE' }),
  // POST, not GET: printing registers the document in the QR-validation registry.
  printIzin: (id) => apiFetch(`/api/personal/izin/${id}/print`, { method: 'POST' }),
  getTiket: () => apiFetch('/api/personal/tiket'),
  createTiket: (payload) => apiFetch('/api/personal/tiket', { method: 'POST', body: JSON.stringify(payload) }),
  updateTiket: (id, payload) =>
    apiFetch(`/api/personal/tiket/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTiket: (id) => apiFetch(`/api/personal/tiket/${id}`, { method: 'DELETE' }),
  getTiketDetail: (id) => apiFetch(`/api/personal/tiket/${id}/detail`),
  addTiketRincian: (id, payload) =>
    apiFetch(`/api/personal/tiket/${id}/detail`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTiketRincian: (id, idDet, payload) =>
    apiFetch(`/api/personal/tiket/${id}/detail/${idDet}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTiketRincian: (id, idDet) =>
    apiFetch(`/api/personal/tiket/${id}/detail/${idDet}`, { method: 'DELETE' }),
  printTiket: (id) => apiFetch(`/api/personal/tiket/${id}/print`, { method: 'POST' }),

  getUmdl: () => apiFetch('/api/personal/umdl'),
  // Hanya izin "Meninggalkan Pekerjaan" + "Dinas" yang belum dipakai UMDL lain.
  cariIjinUmdl: () => apiFetch('/api/personal/umdl/izin'),
  createUmdl: (payload) => apiFetch('/api/personal/umdl', { method: 'POST', body: JSON.stringify(payload) }),
  updateUmdl: (id, payload) =>
    apiFetch(`/api/personal/umdl/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteUmdl: (id) => apiFetch(`/api/personal/umdl/${id}`, { method: 'DELETE' }),

  getSppd: () => apiFetch('/api/personal/sppd'),
  createSppd: (payload) => apiFetch('/api/personal/sppd', { method: 'POST', body: JSON.stringify(payload) }),
  updateSppd: (id, payload) =>
    apiFetch(`/api/personal/sppd/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSppd: (id) => apiFetch(`/api/personal/sppd/${id}`, { method: 'DELETE' }),
  getSppdDetail: (id) => apiFetch(`/api/personal/sppd/${id}/detail`),
  addSppdPeserta: (id, payload) =>
    apiFetch(`/api/personal/sppd/${id}/detail`, { method: 'POST', body: JSON.stringify(payload) }),
  // Hanya posisi & tugas yang bisa diubah; pegawainya tidak.
  updateSppdPeserta: (id, idDet, payload) =>
    apiFetch(`/api/personal/sppd/${id}/detail/${idDet}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSppdPeserta: (id, idDet) =>
    apiFetch(`/api/personal/sppd/${id}/detail/${idDet}`, { method: 'DELETE' }),
  cariPegawai: (q) => apiFetch(`/api/personal/sppd/pegawai?q=${encodeURIComponent(q ?? '')}`),
  // POST, not GET: printing registers the document in the QR-validation registry.
  printSppd: (id) => apiFetch(`/api/personal/sppd/${id}/print`, { method: 'POST' }),
  uploadSuratDokter: (id, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/personal/izin/${id}/surat-dokter`, { method: 'POST', body })
  },
  // Return { url, contentType } - url is a blob: object URL; revoke it when the viewer closes.
  getDocument: (key) => apiBlob(`/api/personal/documents/${key}`),
  getAktaAnak: (idAnak) => apiBlob(`/api/personal/documents/anak/${idAnak}/akta`),

  // My Innovation (SS / GIO / 5R) - Bearer. Tanpa jenis = semua metodologi.
  listInovasi: (jenis) => apiFetch(`/api/inovasi/gugus${jenis ? `?jenis=${encodeURIComponent(jenis)}` : ''}`),
  createInovasi: (payload) => apiFetch('/api/inovasi/gugus', { method: 'POST', body: JSON.stringify(payload) }),
  getInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}`),
  saveInovasiPlan: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/plan`, { method: 'PUT', body: JSON.stringify(payload) }),
  submitInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}/submit`, { method: 'POST' }),
  submitFinalInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}/submit-final`, { method: 'POST' }),
  actPengesahan: (id, pid, payload) => apiFetch(`/api/inovasi/gugus/${id}/pengesahan/${pid}`, { method: 'POST', body: JSON.stringify(payload) }),
  saveInovasiDo: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/do`, { method: 'PUT', body: JSON.stringify(payload) }),
  saveInovasiCheck: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/check`, { method: 'PUT', body: JSON.stringify(payload) }),
  saveInovasiAction: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/action`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}`, { method: 'DELETE' }),
  uploadInovasiFile: (id, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/inovasi/gugus/${id}/upload`, { method: 'POST', body })
  },
  cariPegawaiInovasi: (q, gugusId) => apiFetch(`/api/inovasi/pegawai?q=${encodeURIComponent(q ?? '')}${gugusId ? `&gugusId=${encodeURIComponent(gugusId)}` : ''}`),
  // Direktori pegawai (halaman Daftar Pegawai): seluruh pegawai + filter dep/komp.
  listPegawaiDirektori: ({ q, departemenId, kompartemenId } = {}) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (departemenId) p.set('departemenId', departemenId)
    if (kompartemenId) p.set('kompartemenId', kompartemenId)
    const qs = p.toString()
    return apiFetch(`/api/inovasi/pegawai-direktori${qs ? `?${qs}` : ''}`)
  },
  listKompartemenInovasi: () => apiFetch('/api/inovasi/kompartemen'),
  // Return { url, contentType } - blob object URL; revoke it when done.
  getInovasiFile: (id, path) => apiBlob(`/api/inovasi/gugus/${id}/file?path=${encodeURIComponent(path)}`),

  // Sumbang Gagasan (Bearer)
  listGagasan: () => apiFetch('/api/inovasi/gagasan'),
  createGagasan: (payload) => apiFetch('/api/inovasi/gagasan', { method: 'POST', body: JSON.stringify(payload) }),
  getGagasan: (id) => apiFetch(`/api/inovasi/gagasan/${id}`),
  updateGagasan: (id, payload) => apiFetch(`/api/inovasi/gagasan/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  actGagasanApproval: (id, payload) => apiFetch(`/api/inovasi/gagasan/${id}/approval`, { method: 'POST', body: JSON.stringify(payload) }),
  daftarGagasan: (id, payload) => apiFetch(`/api/inovasi/gagasan/${id}/daftar`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteGagasan: (id) => apiFetch(`/api/inovasi/gagasan/${id}`, { method: 'DELETE' }),
  listDepartemenInovasi: () => apiFetch('/api/inovasi/departemen'),
  getInovasiPeran: () => apiFetch('/api/inovasi/peran'),

  // Penilaian Juri (Bearer). Rubrik + stream (Admin) + penugasan + sisi juri.
  getPenilaianKriteria: (jenisForm) => apiFetch(`/api/inovasi/penilaian/kriteria?jenisForm=${encodeURIComponent(jenisForm ?? '')}`),
  // Admin: seluruh pengguna ber-role Juri (tanpa batas 100)
  listJuriUsers: () => apiFetch('/api/inovasi/penilaian/juri-users'),
  // Admin: kelola stream
  listPenilaianStream: () => apiFetch('/api/inovasi/penilaian/stream'),
  getPenilaianStream: (id) => apiFetch(`/api/inovasi/penilaian/stream/${id}`),
  createPenilaianStream: (payload) => apiFetch('/api/inovasi/penilaian/stream', { method: 'POST', body: JSON.stringify(payload) }),
  updatePenilaianStream: (id, payload) => apiFetch(`/api/inovasi/penilaian/stream/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePenilaianStream: (id) => apiFetch(`/api/inovasi/penilaian/stream/${id}`, { method: 'DELETE' }),
  // Admin: penugasan
  listPenilaianGugusOptions: () => apiFetch('/api/inovasi/penilaian/gugus-options'),
  listPenugasan: () => apiFetch('/api/inovasi/penilaian/penugasan'),
  createPenugasan: (payload) => apiFetch('/api/inovasi/penilaian/penugasan', { method: 'POST', body: JSON.stringify(payload) }),
  tutupPenugasan: (id) => apiFetch(`/api/inovasi/penilaian/penugasan/${id}/tutup`, { method: 'POST' }),
  deletePenugasan: (id) => apiFetch(`/api/inovasi/penilaian/penugasan/${id}`, { method: 'DELETE' }),
  // Juri
  listTugasPenilaian: () => apiFetch('/api/inovasi/penilaian/tugas'),
  getPenilaian: (penugasanId) => apiFetch(`/api/inovasi/penilaian/${penugasanId}`),
  savePenilaianSkor: (penugasanId, payload) => apiFetch(`/api/inovasi/penilaian/${penugasanId}/skor`, { method: 'PUT', body: JSON.stringify(payload) }),
  getPenilaianHasil: (penugasanId) => apiFetch(`/api/inovasi/penilaian/${penugasanId}/hasil`),

  // authentication (cookie flow)
  login: (email, password) => post('/api/account/login', { email, password }),
  loginTwoFactor: (code, rememberMachine) => post('/api/account/login-2fa', { code, rememberMachine }),

  // self-service password
  forgotPassword: (email) => post('/api/account/forgot-password', { email }),
  resetPassword: (email, token, newPassword) => post('/api/account/reset-password', { email, token, newPassword }),
  changePassword: (currentPassword, newPassword) => post('/api/account/change-password', { currentPassword, newPassword }),

  // MFA (authenticator app, Bearer)
  getMe: () => apiFetch('/api/account/me'),
  twoFactorSetup: () => apiFetch('/api/account/2fa/setup'),
  enableTwoFactor: (code) => post('/api/account/2fa/enable', { code }),
  disableTwoFactor: () => post('/api/account/2fa/disable'),

  // admin document browser (Admin, Bearer)
  searchEmployees: (q) => apiFetch(`/api/admin/documents/search?q=${encodeURIComponent(q ?? '')}`),
  getEmployeeDocuments: (idPegawai) => apiFetch(`/api/admin/documents/${idPegawai}`),
  // Return { url, contentType } - blob object URL; revoke it when the viewer closes.
  getEmployeeDocument: (idPegawai, key) => apiBlob(`/api/admin/documents/${idPegawai}/file/${key}`),
  getEmployeeAktaAnak: (idPegawai, idAnak) =>
    apiBlob(`/api/admin/documents/${idPegawai}/anak/${idAnak}/akta`),

  // admin control panel (Admin IT, Bearer)
  getAdminOverview: () => apiFetch('/api/admin/overview'),
  getAdminUsers: (q) => apiFetch(`/api/admin/users?q=${encodeURIComponent(q ?? '')}`),
  setUserAdmin: (id, enabled) =>
    apiFetch(`/api/admin/users/${id}/role/admin`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  setUserJuri: (id, enabled) =>
    apiFetch(`/api/admin/users/${id}/role/juri`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  setUserActive: (id, enabled) =>
    apiFetch(`/api/admin/users/${id}/active`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  unlockUser: (id) => apiFetch(`/api/admin/users/${id}/unlock`, { method: 'POST' }),

  // admin: lokasi geofence absensi (Admin IT, Bearer)
  getAdminLocations: () => apiFetch('/api/admin/locations'),
  createLocation: (payload) => apiFetch('/api/admin/locations', { method: 'POST', body: JSON.stringify(payload) }),
  updateLocation: (id, payload) =>
    apiFetch(`/api/admin/locations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLocation: (id) => apiFetch(`/api/admin/locations/${id}`, { method: 'DELETE' }),

  // audit (Admin, Bearer)
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString()
    return apiFetch('/api/audit' + (q ? `?${q}` : ''))
  },
}
