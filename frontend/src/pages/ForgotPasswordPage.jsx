import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './LoginPage.css'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.forgotPassword(email)
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
        <h1 className="login__title">Lupa Kata Sandi</h1>

        {done ? (
          <>
            <p className="login__subtitle">
              Jika email terdaftar, tautan reset kata sandi telah dikirim. Silakan cek kotak masuk Anda.
            </p>
            <div className="login__divider" />
            <div className="login__links">
              <Link to="/login" className="login__link"><ArrowLeft size={14} /> Kembali ke login</Link>
            </div>
          </>
        ) : (
          <>
            <p className="login__subtitle">Masukkan email Anda untuk menerima tautan reset kata sandi</p>
            <form className="login__form" onSubmit={handleSubmit}>
              <label className="login__label" htmlFor="email">Email</label>
              <div className="login__field">
                <Mail size={16} className="login__field-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="nama@gcs-gresik.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              {error && <div className="login__error">{error}</div>}

              <button type="submit" className="login__submit" disabled={submitting}>
                {submitting ? 'Mengirim...' : 'Kirim Tautan Reset'}
                <Send size={16} />
              </button>
            </form>
            <div className="login__divider" />
            <div className="login__links">
              <Link to="/login" className="login__link"><ArrowLeft size={14} /> Kembali ke login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
