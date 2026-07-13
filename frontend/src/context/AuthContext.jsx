import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { userManager } from '../lib/auth'

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
      }
      setInitializing(false)
    }

    bootstrap()

    const handleLoaded = (user) => setOidcUser(user)
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

  // Single logout: clears the Hub session cookie and returns to the app.
  const logout = useCallback(async () => {
    try {
      await userManager.signoutRedirect()
    } catch {
      await userManager.removeUser()
      window.location.href = '/'
    }
  }, [])

  const isAuthenticated = Boolean(oidcUser && !oidcUser.expired)

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
