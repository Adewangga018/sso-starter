import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './PersetujuanPage.css'

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

function StatusBadge({ status }) {
  const map = { Menunggu: 'wait', Disetujui: 'ok', Ditolak: 'no', Batal: 'off' }
  return <span className={`apr__st apr__st--${map[status] || 'off'}`}>{status}</span>
}

export default function PersetujuanPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    try { setData(await api.getPersetujuan()); setLoading(false) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat persetujuan.'); setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function putusan(id, setuju) {
    setMsg(null)
    try {
      await api.putusanPersetujuan(id, { setuju })
      setMsg({ type: 'ok', text: setuju ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.' })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    }
  }

  if (loading) return <div className="apr"><div className="apr__loading"><Loader2 className="apr__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="apr"><div className="apr__alert">{error}</div></div>
  if (!data) return null

  const menunggu = data.menunggu ?? []
  const riwayat = data.riwayat ?? []

  return (
    <div className="apr">
      <div className="apr__intro">
        <h2 className="apr__title">Kotak Persetujuan</h2>
        <p className="apr__sub">Pengajuan tim (Izin, Lembur, SPPD, UMDL, Tiket) yang menunggu persetujuan Anda sebagai manager.</p>
      </div>

      {msg && <div className={`apr__msg apr__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="apr__card">
        <div className="apr__card-head"><ClipboardCheck size={16} /> Menunggu Persetujuan <span className="apr__count">{menunggu.length}</span></div>
        {menunggu.length === 0 ? (
          <div className="apr__empty">Tidak ada pengajuan yang menunggu persetujuan Anda.</div>
        ) : (
          <div className="apr__list">
            {menunggu.map((p) => (
              <div className="apr__item" key={p.id}>
                <div className="apr__item-main">
                  <div className="apr__item-top">
                    <span className="apr__jenis">{p.jenis}</span>
                    <span className="apr__pemohon">{p.nama || p.idKaryawan}</span>
                  </div>
                  <div className="apr__ringkasan">{p.ringkasan || '-'}</div>
                  <div className="apr__tgl">Diajukan {formatTgl(p.tglPengajuan)}</div>
                </div>
                <div className="apr__actions">
                  <button type="button" className="apr__btn apr__btn--ghost" onClick={() => putusan(p.id, false)}>Tolak</button>
                  <button type="button" className="apr__btn" onClick={() => putusan(p.id, true)}><CheckCircle2 size={15} /> Setujui</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {riwayat.length > 0 && (
        <div className="apr__card">
          <div className="apr__card-head">Riwayat Keputusan</div>
          <div className="apr__table-wrap">
            <table className="apr__table">
              <thead><tr><th>Jenis</th><th>Pemohon</th><th>Ringkasan</th><th>Status</th><th>Tanggal</th></tr></thead>
              <tbody>
                {riwayat.map((p) => (
                  <tr key={p.id}>
                    <td>{p.jenis}</td>
                    <td>{p.nama || p.idKaryawan}</td>
                    <td className="apr__ket">{p.ringkasan || '-'}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{formatTgl(p.tglKeputusan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
