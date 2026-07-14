import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { userManager } from '../lib/auth'
import { useIdleLogout } from '../hooks/useIdleLogout'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [oidcUser, setOidcUser] = useState(null)
  const [summary, setSummary] = useState(null)
  const [initializing, setInitializing] = useState(true)

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.getDashboardSummary()
      setSummary(data)
      return data
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const user = await userManager.getUser()
      if (cancelled) return

      if (user && !user.expired) {
        setOidcUser(user)
        await loadSummary()
      } else if (user) {
        // Token sudah kedaluwarsa saat halaman dibuka. Perpanjang sekarang juga daripada
        // menunggu automaticSilentRenew - kalau tidak, halaman tampil kosong sampai
        // pengguna menekan refresh sendiri. Keberhasilannya memicu handleLoaded di bawah,
        // yang memuat ringkasannya.
        try {
          await userManager.signinSilent()
        } catch {
          // Refresh token ikut mati - biarkan RequireAuth mengarahkan ke halaman login.
        }
      }

      if (!cancelled) setInitializing(false)
    }

    bootstrap()

    // Fires on login and on every silent token renew. The summary must be reloaded here, not
    // only in bootstrap(): if the stored token was already expired at page load, the first
    // fetch failed and summary stayed null - leaving the dashboard blank ("?" avatar, no
    // modules) until the user hit refresh by hand.
    const handleLoaded = (user) => {
      setOidcUser(user)
      loadSummary()
    }

    const handleUnloaded = () => {
      setOidcUser(null)
      setSummary(null)
    }
    userManager.events.addUserLoaded(handleLoaded)
    userManager.events.addUserUnloaded(handleUnloaded)

    return () => {
      cancelled = true
      userManager.events.removeUserLoaded(handleLoaded)
      userManager.events.removeUserUnloaded(handleUnloaded)
    }
  }, [loadSummary])

  // Starts the OIDC login flow (redirect to the SSO Hub authorize endpoint).
  const login = useCallback(() => userManager.signinRedirect(), [])

  // Logout in two parts so the app is *actually* signed out:
  //  1) remove the tokens from the SPA's storage (otherwise the still-valid JWT keeps the
  //     UI "logged in" even after the server cookie is gone);
  //  2) clear the SSO Hub session cookie so the next login must re-enter the password.
  const logout = useCallback(async () => {
    await userManager.removeUser()
    try {
      await fetch('/api/account/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // network hiccup — local logout already happened, continue anyway
    }
    window.location.replace('/login')
  }, [])

  const isAuthenticated = Boolean(oidcUser && !oidcUser.expired)

  // Sesi berakhir kalau aplikasi ditinggal diam terlalu lama. Tanpa ini, refresh token
  // (offline_access) akan terus memperpanjang akses tanpa batas selama tab dibiarkan
  // terbuka - berbahaya di komputer bersama.
  useIdleLogout(isAuthenticated, useCallback(() => logout(), [logout]))

  const roles = oidcUser?.profile?.role
  const isAdmin = isAuthenticated &&
    (Array.isArray(roles) ? roles.includes('Admin') : roles === 'Admin')

  const value = {
    user: isAuthenticated
      ? { name: oidcUser.profile?.name ?? '', email: oidcUser.profile?.email ?? '' }
      : null,
    summary,
    isAuthenticated,
    isAdmin,
    initializing,
    login,
    logout,
    refreshSummary: loadSummary,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
