import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Lock } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './LoginPage.css'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const invalidLink = !email || !token

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }
    setSubmitting(true)
    try {
      await api.resetPassword(email, token, password)
      setDone(true)
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
        <h1 className="login__title">Reset Kata Sandi</h1>

        {invalidLink ? (
          <>
            <p className="login__subtitle">Tautan reset tidak valid. Silakan minta ulang.</p>
            <div className="login__divider" />
            <div className="login__links">
              <Link to="/forgot-password" className="login__link"><ArrowLeft size={14} /> Minta tautan baru</Link>
            </div>
          </>
        ) : done ? (
          <>
            <p className="login__subtitle">Kata sandi berhasil diganti. Silakan login dengan kata sandi baru.</p>
            <div className="login__divider" />
            <div className="login__links">
              <Link to="/login" className="login__link"><ArrowLeft size={14} /> Ke halaman login</Link>
            </div>
          </>
        ) : (
          <>
            <p className="login__subtitle">Membuat kata sandi baru untuk <b>{email}</b></p>
            <form className="login__form" onSubmit={handleSubmit}>
              <label className="login__label" htmlFor="password">Kata Sandi Baru</label>
              <div className="login__field">
                <Lock size={16} className="login__field-icon" />
                <input
                  id="password"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>

              <label className="login__label" htmlFor="confirm">Ulangi Kata Sandi</label>
              <div className="login__field">
                <Lock size={16} className="login__field-icon" />
                <input
                  id="confirm"
                  type="password"
                  placeholder="Ulangi kata sandi baru"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && <div className="login__error">{error}</div>}

              <button type="submit" className="login__submit" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Kata Sandi'}
                <Check size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
