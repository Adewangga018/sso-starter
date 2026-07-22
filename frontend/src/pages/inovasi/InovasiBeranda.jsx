import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, ClipboardList, MessageSquarePlus } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import './inovasi.css'

// Beranda My Innovation - ringkasan risalah milik pengguna lintas metodologi.
export default function InovasiBeranda() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [gagasan, setGagasan] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    api.listInovasi()
      .then((d) => live && setRows(d.items))
      .catch((e) => { if (live) { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') } })
    api.listGagasan()
      .then((d) => live && setGagasan(d.items))
      .catch((e) => { if (live && isEmptyDataError(e)) setGagasan([]) })
    return () => { live = false }
  }, [])

  const stats = useMemo(() => {
    const list = rows ?? []
    const by = (s) => list.filter((r) => r.status === s).length
    return {
      total: list.length,
      draft: by('Draft') + by('Revisi'),
      proses: by('Diajukan') + by('Diverifikasi'),
      disahkan: by('Divalidasi') + by('Selesai'),
      gagasan: (gagasan ?? []).length,
    }
  }, [rows, gagasan])

  return (
    <div className="inv">
      <h2 className="inv__title">Beranda My Innovation</h2>
      <p className="inv__subtitle">Ringkasan aktivitas inovasi Anda (Sistem Saran, GIO, dan 5R) pada periode berjalan.</p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__stats">
        <div className="inv__stat"><div className="inv__stat-num">{stats.gagasan}</div><div className="inv__stat-label">Sumbang Gagasan Saya</div></div>
        <div className="inv__stat"><div className="inv__stat-num">{stats.total}</div><div className="inv__stat-label">Total Risalah Inovasi</div></div>
        <div className="inv__stat"><div className="inv__stat-num">{stats.proses}</div><div className="inv__stat-label">Proses Pengesahan</div></div>
        <div className="inv__stat"><div className="inv__stat-num">{stats.disahkan}</div><div className="inv__stat-label">Disahkan / Selesai</div></div>
      </div>

      <div className="inv__card">
        <div className="inv__section-head"><span className="inv__section-tag">Aksi Cepat</span></div>
        <div className="inv__actions-bar" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="inv__btn inv__btn--primary" onClick={() => navigate(`${base}/gagasan`)}>
            <MessageSquarePlus size={16} /> Sumbang Gagasan
          </button>
          <button type="button" className="inv__btn inv__btn--ghost" onClick={() => navigate(`${base}/daftar`)}>
            <ClipboardList size={16} /> Daftar Inovasi <ArrowRight size={14} />
          </button>
        </div>
        <p className="inv__hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Alur: kirim Sumbang Gagasan (judul & latar belakang) &rarr; dinilai Reviewer (Manager) &rarr; GM menetapkan
          metodologi (SS/GIO/5R), Fasilitator, dan Pembina (GIO) &rarr; Anda daftarkan menjadi risalah.
        </p>
      </div>
    </div>
  )
}
