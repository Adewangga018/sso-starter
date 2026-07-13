import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getStoredToken, setStoredToken } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken())
  const [user, setUser] = useState(null)
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
      if (!token) {
        setInitializing(false)
        return
      }
      const data = await loadSummary()
      if (cancelled) return
      if (!data) {
        // stored token is no longer valid
        setStoredToken(null)
        setToken(null)
      }
      setInitializing(false)
    }
    bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email, password) {
    const data = await api.login(email, password)
    setStoredToken(data.token)
    setToken(data.token)
    setUser(data.user)
    await loadSummary()
    return data
  }

  function logout() {
    setStoredToken(null)
    setToken(null)
    setUser(null)
    setSummary(null)
  }

  const value = {
    token,
    user,
    summary,
    isAuthenticated: Boolean(token),
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
