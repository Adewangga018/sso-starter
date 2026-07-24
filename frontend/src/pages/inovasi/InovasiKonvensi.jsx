import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { api, isEmptyDataError } from '../../lib/api'
import { jenisLabel, statusClass } from './statusClass'
import './inovasi.css'

// Menu Konvensi - risalah yang sudah Selesai (disahkan akhir) dan layak diusulkan
// ke Konvensi Inovasi (tingkat kompartemen / perusahaan / nasional).
export default function InovasiKonvensi() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    api.listInovasi().then((d) => setRows(d.items)).catch((e) => { if (isEmptyDataError(e)) setRows([]) })
  }, [])

  const eligible = useMemo(() => (rows ?? []).filter((r) => r.status === 'Selesai'), [rows])

  if (rows === null) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Menu Konvensi</h2>
      <p className="inv__subtitle">Risalah yang telah <b>Selesai</b> (disahkan akhir) dan layak diusulkan mengikuti Konvensi Inovasi.</p>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>No. Registrasi</th>
              <th style={{ width: 140, textAlign: 'center' }}>Metodologi</th>
              <th style={{ width: '26%' }}>Nama Gugus</th>
              <th>Judul</th>
              <th style={{ width: 180 }}>Ketua</th>
              <th style={{ width: 150, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {eligible.length === 0 && <tr><td className="inv__no-data" colSpan={6}>Belum ada risalah yang Selesai untuk konvensi.</td></tr>}
            {eligible.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/daftar/${r.id}`)}>
                <td>{r.noRegistrasi ?? '-'}</td>
                <td style={{ textAlign: 'center' }}>{jenisLabel(r.jenis)}</td>
                <td>{r.namaGugus ?? '-'}</td>
                <td>{r.judul ?? '-'}</td>
                <td>{r.ketuaNama ?? '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`inv__status ${statusClass(r.status)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trophy size={12} /> {r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
