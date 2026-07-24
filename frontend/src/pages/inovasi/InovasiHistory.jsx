import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ClipboardList, MessageSquarePlus } from 'lucide-react'
import { api, isEmptyDataError } from '../../lib/api'
import { jenisLabel, statusClass } from './statusClass'
import './inovasi.css'

// History - riwayat gagasan & risalah (status terakhir) yang Anda ikuti,
// diurut dari yang terbaru.
export default function InovasiHistory() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()
  const [gagasan, setGagasan] = useState(null)
  const [risalah, setRisalah] = useState(null)

  useEffect(() => {
    api.listGagasan().then((d) => setGagasan(d.items)).catch((e) => { if (isEmptyDataError(e)) setGagasan([]) })
    api.listInovasi().then((d) => setRisalah(d.items)).catch((e) => { if (isEmptyDataError(e)) setRisalah([]) })
  }, [])

  const items = useMemo(() => {
    const g = (gagasan ?? []).map((x) => ({
      kind: 'Gagasan', id: x.id, judul: x.judul, kode: x.noRegistrasi, status: x.status,
      tgl: x.createdAt, jenis: x.metodologi, to: null,
    }))
    const r = (risalah ?? []).map((x) => ({
      kind: 'Risalah', id: x.id, judul: x.judul ?? x.namaGugus, kode: x.noRegistrasi, status: x.status,
      tgl: x.updatedAt ?? x.createdAt, jenis: x.jenis, to: `${base}/daftar/${x.id}`,
    }))
    return [...g, ...r].sort((a, b) => new Date(b.tgl || 0) - new Date(a.tgl || 0))
  }, [gagasan, risalah, base])

  if (gagasan === null || risalah === null) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">History</h2>
      <p className="inv__subtitle">Riwayat gagasan dan risalah yang Anda ikuti beserta status terakhirnya.</p>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th style={{ width: 130 }}>Jenis</th>
              <th style={{ width: 150 }}>Kode</th>
              <th>Judul</th>
              <th style={{ width: 150, textAlign: 'center' }}>Metodologi</th>
              <th style={{ width: 140, textAlign: 'center' }}>Status</th>
              <th style={{ width: 120, textAlign: 'right' }}>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td className="inv__no-data" colSpan={6}>Belum ada riwayat.</td></tr>}
            {items.map((it) => (
              <tr key={`${it.kind}-${it.id}`} style={it.to ? { cursor: 'pointer' } : undefined} onClick={() => it.to && navigate(it.to)}>
                <td>
                  <span className="inv__typechip" style={{ color: it.kind === 'Gagasan' ? '#a5762f' : '#1f6b39' }}>
                    {it.kind === 'Gagasan' ? <MessageSquarePlus size={14} /> : <ClipboardList size={14} />}
                    {it.kind}
                  </span>
                </td>
                <td>{it.kode ?? '-'}</td>
                <td>{it.judul ?? '-'}</td>
                <td style={{ textAlign: 'center' }}>{it.jenis ? jenisLabel(it.jenis) : '-'}</td>
                <td style={{ textAlign: 'center' }}><span className={`inv__status ${statusClass(it.status)}`}>{it.status}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{it.tgl ? new Date(it.tgl).toLocaleDateString('id-ID') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
