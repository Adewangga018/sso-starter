import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, HelpCircle, Lock, LifeBuoy, LogIn, ShieldCheck, User } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { userManager } from '../lib/auth'
import './LoginPage.css'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Two-factor step
  const [twoFactor, setTwoFactor] = useState(false)
  const [code, setCode] = useState('')
  const [rememberMachine, setRememberMachine] = useState(false)

  // Continue the OIDC authorize flow once the Hub session cookie is established.
  function continueOidc() {
    const returnUrl = searchParams.get('ReturnUrl')
    if (returnUrl && returnUrl.startsWith('/')) {
      window.location.href = returnUrl
    } else {
      userManager.signinRedirect()
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api.login(email, password)
      if (data?.requiresTwoFactor) {
        setTwoFactor(true)
        setSubmitting(false)
        return
      }
      continueOidc()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server.')
      setSubmitting(false)
    }
  }

  async function handleTwoFactorSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.loginTwoFactor(code, rememberMachine)
      continueOidc()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server.')
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <img src="/LOGO MY GCS_1.png" alt="GCS" className="login__logo" />

        {!twoFactor ? (
          <>
            <h1 className="login__title">Login</h1>
            <p className="login__subtitle">Access your corporate dashboard</p>

            <form className="login__form" onSubmit={handleSubmit}>
              <label className="login__label" htmlFor="email">Username / Email</label>
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

              <label className="login__label" htmlFor="password">Password</label>
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
              <Link to="/forgot-password" className="login__link">
                <HelpCircle size={14} /> Forgot Password?
              </Link>
              <span className="login__link">
                <LifeBuoy size={14} /> Contact Support
              </span>
            </div>
          </>
        ) : (
          <>
            <h1 className="login__title">Verifikasi Dua Langkah</h1>
            <p className="login__subtitle">Masukkan kode 6 digit dari aplikasi authenticator Anda</p>

            <form className="login__form" onSubmit={handleTwoFactorSubmit}>
              <label className="login__label" htmlFor="code">Kode Autentikator</label>
              <div className="login__field">
                <ShieldCheck size={16} className="login__field-icon" />
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </div>

              <label className="login__remember">
                <input
                  type="checkbox"
                  checked={rememberMachine}
                  onChange={(e) => setRememberMachine(e.target.checked)}
                />
                Ingat perangkat ini
              </label>

              {error && <div className="login__error">{error}</div>}

              <button type="submit" className="login__submit" disabled={submitting}>
                {submitting ? 'Memverifikasi...' : 'Verifikasi'}
                <ShieldCheck size={16} />
              </button>
            </form>

            <div className="login__divider" />
            <div className="login__links">
              <button
                type="button"
                className="login__link"
                onClick={() => { setTwoFactor(false); setCode(''); setError('') }}
              >
                Kembali ke login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
