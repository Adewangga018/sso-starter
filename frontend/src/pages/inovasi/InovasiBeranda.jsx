import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, CheckSquare, ClipboardCheck, ClipboardList, MessageSquarePlus } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import './inovasi.css'

// Beranda My Innovation. Tampilan menyesuaikan peran:
//  - Karyawan   : ringkasan gagasan & risalah miliknya + aksi Sumbang Gagasan.
//  - Manager/GM : ringkasan persetujuan (gagasan perlu tindakan) & risalah di
//                 lingkup unitnya + aksi Verifikasi/Persetujuan (tanpa menyumbang).
export default function InovasiBeranda() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const peran = ctx.peran ?? 'Karyawan'
  const isApprover = ctx.isApprover === true
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
    const gList = gagasan ?? []
    const byRisalah = (...s) => list.filter((r) => s.includes(r.status)).length
    // Gagasan yang menunggu giliran tindakan approver ini.
    const pending = peran === 'Manager'
      ? gList.filter((g) => g.status === 'Dikirim').length
      : peran === 'GM'
        ? gList.filter((g) => g.status === 'Disetujui Verifikator' || g.status === 'Disetujui GM Kompartemen Asal').length
        : 0
    return {
      totalRisalah: list.length,
      proses: byRisalah('Diajukan', 'Diverifikasi', 'Disetujui Verifikator'),
      disahkan: byRisalah('Divalidasi', 'Selesai'),
      gagasanSaya: gList.length,
      pending,
    }
  }, [rows, gagasan, peran])

  return (
    <div className="inv">
      <h2 className="inv__title">Beranda My Innovation</h2>
      <p className="inv__subtitle">
        {isApprover
          ? `Ringkasan persetujuan gagasan dan pemantauan risalah di ${peran === 'GM' ? 'kompartemen' : 'departemen'} Anda pada periode berjalan.`
          : 'Ringkasan aktivitas inovasi Anda (Sistem Saran, GIO, dan 5R) pada periode berjalan.'}
      </p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      {isApprover ? (
        <>
          <div className="inv__stats">
            <div className="inv__stat"><div className="inv__stat-num">{stats.pending}</div><div className="inv__stat-label">Gagasan Perlu Tindakan</div></div>
            <div className="inv__stat"><div className="inv__stat-num">{stats.gagasanSaya}</div><div className="inv__stat-label">Gagasan di Lingkup Anda</div></div>
            <div className="inv__stat"><div className="inv__stat-num">{stats.totalRisalah}</div><div className="inv__stat-label">Risalah di Lingkup Anda</div></div>
            <div className="inv__stat"><div className="inv__stat-num">{stats.disahkan}</div><div className="inv__stat-label">Risalah Disahkan / Selesai</div></div>
          </div>

          <div className="inv__card">
            <div className="inv__section-head"><span className="inv__section-tag">Aksi Cepat</span></div>
            <div className="inv__actions-bar" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="inv__btn inv__btn--primary" onClick={() => navigate(`${base}/gagasan`)}>
                {peran === 'Manager' ? <ClipboardCheck size={16} /> : <CheckSquare size={16} />}
                {peran === 'Manager' ? ' Verifikasi Gagasan' : ' Persetujuan Gagasan'}
                {stats.pending > 0 && (
                  <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.28)', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{stats.pending}</span>
                )}
              </button>
              <button type="button" className="inv__btn inv__btn--ghost" onClick={() => navigate(`${base}/daftar`)}>
                <ClipboardList size={16} /> Daftar Inovasi <ArrowRight size={14} />
              </button>
            </div>
            <p className="inv__hint" style={{ marginTop: 10, marginBottom: 0 }}>
              {peran === 'Manager'
                ? 'Sebagai Verifikator, Anda menilai gagasan yang diajukan bawahan: setujui untuk meneruskan ke GM Kompartemen, minta revisi, atau tolak. Risalah bawahan dapat Anda pantau di Daftar Inovasi.'
                : 'Sebagai GM Kompartemen, Anda menyetujui gagasan yang telah diverifikasi Manager dan menetapkan metodologinya (SS/GIO/5R). Risalah di kompartemen Anda dapat dipantau di Daftar Inovasi.'}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="inv__stats">
            <div className="inv__stat"><div className="inv__stat-num">{stats.gagasanSaya}</div><div className="inv__stat-label">Sumbang Gagasan Saya</div></div>
            <div className="inv__stat"><div className="inv__stat-num">{stats.totalRisalah}</div><div className="inv__stat-label">Total Risalah Inovasi</div></div>
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
              Alur: kirim Sumbang Gagasan (latar belakang, masalah, solusi) &rarr; diverifikasi Manager &rarr; disetujui GM
              Kompartemen yang menetapkan metodologi (SS/GIO/5R) &rarr; Anda (Ketua) daftarkan menjadi risalah dan isi anggota.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
