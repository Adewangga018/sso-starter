import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './SecurityPage.css'

export default function SecurityPage() {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // 2FA setup
  const [setup, setSetup] = useState(null) // { sharedKey, authenticatorUri }
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState(null)

  // change password
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')

  async function loadMe() {
    try {
      setMe(await api.getMe())
    } catch {
      setErr('Gagal memuat status akun.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMe() }, [])

  function resetBanners() { setMsg(''); setErr('') }

  async function startSetup() {
    resetBanners()
    try {
      setSetup(await api.twoFactorSetup())
      setRecoveryCodes(null)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Gagal memulai setup.')
    }
  }

  async function enable(e) {
    e.preventDefault()
    resetBanners()
    try {
      const res = await api.enableTwoFactor(code)
      setRecoveryCodes(res.recoveryCodes)
      setSetup(null)
      setCode('')
      setMsg('Verifikasi dua langkah berhasil diaktifkan.')
      await loadMe()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Gagal mengaktifkan.')
    }
  }

  async function disable() {
    resetBanners()
    try {
      await api.disableTwoFactor()
      setMsg('Verifikasi dua langkah dinonaktifkan.')
      await loadMe()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Gagal menonaktifkan.')
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    resetBanners()
    try {
      await api.changePassword(current, next)
      setCurrent(''); setNext('')
      setMsg('Kata sandi berhasil diganti.')
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Gagal ganti kata sandi.')
    }
  }

  if (loading) return <div className="app-loading">Memuat...</div>

  return (
    <div className="security">
      <div className="security__head">
        <Link to="/dashboard" className="security__back"><ArrowLeft size={16} /> Dashboard</Link>
        <h1>Keamanan Akun</h1>
      </div>

      {msg && <div className="security__banner security__banner--ok">{msg}</div>}
      {err && <div className="security__banner security__banner--err">{err}</div>}

      {/* MFA */}
      <section className="security__card">
        <h2><ShieldCheck size={18} /> Verifikasi Dua Langkah (MFA)</h2>
        <p className="security__status">
          Status: <b>{me?.twoFactorEnabled ? 'Aktif' : 'Nonaktif'}</b>
        </p>

        {me?.twoFactorEnabled ? (
          <button className="security__btn security__btn--danger" onClick={disable}>
            <ShieldOff size={16} /> Nonaktifkan MFA
          </button>
        ) : recoveryCodes ? (
          <div className="security__recovery">
            <p><b>Simpan kode pemulihan ini</b> di tempat aman. Tiap kode hanya bisa dipakai sekali bila Anda kehilangan akses ke authenticator:</p>
            <ul className="security__codes">
              {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        ) : setup ? (
          <div className="security__setup">
            <p>1. Buka aplikasi authenticator (Google/Microsoft Authenticator), tambahkan akun secara manual dengan kunci berikut:</p>
            <div className="security__key">{setup.sharedKey}</div>
            <p className="security__hint">
              atau gunakan URI: <code>{setup.authenticatorUri}</code>
            </p>
            <form onSubmit={enable} className="security__inline">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Kode 6 digit"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <button className="security__btn" type="submit">Aktifkan</button>
            </form>
          </div>
        ) : (
          <button className="security__btn" onClick={startSetup}>
            <ShieldCheck size={16} /> Aktifkan MFA
          </button>
        )}
      </section>

      {/* Change password */}
      <section className="security__card">
        <h2><KeyRound size={18} /> Ganti Kata Sandi</h2>
        <form onSubmit={changePassword} className="security__form">
          <input
            type="password"
            placeholder="Kata sandi saat ini"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
          <input
            type="password"
            placeholder="Kata sandi baru (min. 8 karakter)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button className="security__btn" type="submit">Simpan</button>
        </form>
      </section>
    </div>
  )
}
