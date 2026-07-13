import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, HelpCircle, Lock, LifeBuoy, LogIn, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import './LoginPage.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <img src="/LOGO MY GCS_1.png" alt="GCS" className="login__logo" />
        <h1 className="login__title">Login</h1>
        <p className="login__subtitle">Access your corporate dashboard</p>

        <form className="login__form" onSubmit={handleSubmit}>
          <label className="login__label" htmlFor="email">
            Username / Email
          </label>
          <div className="login__field">
            <User size={16} className="login__field-icon" />
            <input
              id="email"
              type="text"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <label className="login__label" htmlFor="password">
            Password
          </label>
          <div className="login__field">
            <Lock size={16} className="login__field-icon" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login__field-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <div className="login__error">{error}</div>}

          <button type="submit" className="login__submit" disabled={submitting}>
            {submitting ? 'Memproses...' : 'Masuk'}
            <LogIn size={16} />
          </button>
        </form>

        <div className="login__divider" />

        <div className="login__links">
          <span className="login__link">
            <HelpCircle size={14} /> Forgot Password?
          </span>
          <span className="login__link">
            <LifeBuoy size={14} /> Contact Support
          </span>
        </div>
      </div>
    </div>
  )
}
