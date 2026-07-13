import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { userManager } from '../lib/auth'

// OIDC redirect target: exchanges the authorization code for tokens, then
// forwards the user into the app.
export default function CallbackPage() {
  const navigate = useNavigate()
  // React StrictMode runs effects twice in dev; the authorization code is single-use,
  // so guard against a second exchange ("code already redeemed").
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    userManager
      .signinRedirectCallback()
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((err) => {
        console.error('OIDC callback gagal:', err)
        navigate('/login', { replace: true })
      })
  }, [navigate])

  return <div className="app-loading">Menyelesaikan proses login...</div>
}
