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
  if (options.body) headers['Content-Type'] = 'application/json'
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

export const api = {
  // dashboard / personal (Bearer)
  getDashboardSummary: () => apiFetch('/api/dashboard/summary'),
  getPersonalProfile: () => apiFetch('/api/personal/profile'),
  getAbsensi: () => apiFetch('/api/personal/absensi'),
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
  getDocument: (key) => apiFetch(`/api/personal/documents/${key}`),
  getAktaAnak: (idAnak) => apiFetch(`/api/personal/documents/anak/${idAnak}/akta`),

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

  // audit (Admin, Bearer)
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString()
    return apiFetch('/api/audit' + (q ? `?${q}` : ''))
  },
}
