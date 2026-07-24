import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, Loader2, UserCheck, Users2, UserX } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './MyTeamPage.css'

export default function RekapTimPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.getRekapTim()
      .then((d) => { if (alive) { setData(d); setLoading(false) } })
      .catch((err) => {
        if (alive) {
          setError(err instanceof ApiError ? err.message : 'Gagal memuat rekap tim.')
          setLoading(false)
        }
      })
    return () => { alive = false }
  }, [])

  if (loading) {
    return <div className="mt"><div className="mt__loading"><Loader2 className="mt__spin" size={22} /> Memuat…</div></div>
  }
  if (error) {
    return <div className="mt"><div className="mt__alert mt__alert--err">{error}</div></div>
  }
  if (!data) return null

  const tiles = [
    { icon: Users2, label: 'Anggota Terisi', value: data.terisi },
    { icon: UserCheck, label: 'Hadir Hari Ini', value: data.hadirHariIni, tone: 'ok' },
    { icon: UserX, label: 'Belum Absen', value: data.belumAbsen, tone: data.belumAbsen ? 'gold' : null },
    { icon: Clock, label: 'Tugas Terlambat', value: data.tugasTerlambat, tone: data.tugasTerlambat ? 'gold' : null },
  ]

  const anggota = data.anggota.filter((a) => a.terisi)

  return (
    <div className="mt">
      <div className="mt__intro">
        <h2 className="mt__intro-title">Rekap Tim</h2>
        <p className="mt__intro-sub">Monitoring kehadiran dan produktivitas tugas seluruh anggota tim.</p>
      </div>

      {data.peringatan?.length > 0 && (
        <div className="mt-rekap__alerts">
          {data.peringatan.map((p, i) => (
            <div className="mt-rekap__alert" key={i}><AlertTriangle size={15} /> {p}</div>
          ))}
        </div>
      )}

      <div className="mt__stats">
        {tiles.map((t) => (
          <div className={`mt-stat${t.tone ? ` mt-stat--${t.tone}` : ''}`} key={t.label}>
            <div className="mt-stat__icon"><t.icon size={20} /></div>
            <div>
              <div className="mt-stat__value">{t.value}</div>
              <div className="mt-stat__label">{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-rekap__card">
        <div className="mt-rekap__head"><Users2 size={15} /> Rincian per Anggota</div>
        <p className="mt-rekap__hint">
          Kehadiran dihitung pada hari kerja (Senin–Jumat). Mingguan = hari kerja berjalan minggu ini
          ({data.hariKerjaMinggu}), Bulanan = bulan berjalan ({data.hariKerjaBulan}).
        </p>
        <div className="mt-rekap__table-wrap">
          <table className="mt-rekap__table">
            <thead>
              <tr>
                <th>Anggota</th>
                <th>Hadir Ini</th>
                <th>Mingguan</th>
                <th>Bulanan</th>
                <th>Tugas Aktif</th>
                <th>Selesai</th>
                <th>Terlambat</th>
              </tr>
            </thead>
            <tbody>
              {anggota.length === 0 && (
                <tr><td colSpan={7} className="mt-rekap__empty">Belum ada anggota terisi.</td></tr>
              )}
              {anggota.map((a) => (
                <tr key={a.idKaryawan}>
                  <td>
                    <div className="mt-rekap__nama">{a.nama}</div>
                    <div className="mt-rekap__jab">{a.jabatan}{a.unit ? ` · ${a.unit}` : ''}</div>
                  </td>
                  <td>{a.hadirHariIni ? <span className="mt-rekap__ok">Hadir</span> : <span className="mt-rekap__no">Belum</span>}</td>
                  <td>{a.hadirMinggu}<span className="mt-rekap__den">/{data.hariKerjaMinggu}</span></td>
                  <td>{a.hadirBulan}<span className="mt-rekap__den">/{data.hariKerjaBulan}</span></td>
                  <td>{a.tugasAktif}</td>
                  <td>{a.tugasSelesai}</td>
                  <td>{a.tugasTerlambat > 0 ? <span className="mt-rekap__late">{a.tugasTerlambat}</span> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
