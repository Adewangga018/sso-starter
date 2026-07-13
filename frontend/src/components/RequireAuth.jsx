import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAuth() {
  const { isAuthenticated, initializing, login } = useAuth()

  useEffect(() => {
    // Not signed in -> kick off the OIDC redirect to the SSO Hub.
    if (!initializing && !isAuthenticated) {
      login()
    }
  }, [initializing, isAuthenticated, login])

  if (initializing || !isAuthenticated) {
    return <div className="app-loading">Memuat...</div>
  }

  return <Outlet />
}
