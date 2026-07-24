import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ClipboardCheck, Eye, RotateCw } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { statusClass } from './statusClass'
import './inovasi.css'

// Daftar penilaian yang ditugaskan ke juri saat ini (stream tempat ia jadi
// Ketua/Anggota/Sekretaris). Ketua & Anggota menilai; Sekretaris hanya melihat.
export default function InovasiPenilaianList() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()

  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    try {
      setRows(await api.listTugasPenilaian())
      setErr('')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Gagal memuat data penilaian.')
    }
  }
  useEffect(() => { load() }, [])

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data penilaian...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Daftar Penilaian</h2>
      <p className="inv__subtitle">Inovasi yang ditugaskan kepada tim penilai Anda. Ketua &amp; Anggota memberi nilai per tahap; Sekretaris memantau hasil.</p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div />
        <button type="button" className="inv__btn inv__btn--ghost" onClick={load} title="Muat ulang"><RotateCw size={15} /></button>
      </div>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th>Status</th><th>No. Registrasi</th><th>Metodologi</th><th>Nama Gugus</th>
              <th>Judul</th><th>Periode</th><th>Peran Saya</th><th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="inv__no-data" colSpan={8}>Belum ada inovasi yang ditugaskan untuk dinilai.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.idPenugasan}>
                <td><span className={`inv__status ${statusClass(r.status === 'Berjalan' ? 'Diajukan' : 'Selesai')}`}>{r.status}</span></td>
                <td>{r.noRegistrasi ?? <span style={{ color: '#9aa79d' }}>-</span>}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.jenis}</td>
                <td>{r.namaGugus ?? '-'}</td>
                <td style={{ maxWidth: 240 }}>{r.judul ?? <span style={{ color: '#9aa79d' }}>(belum ada judul)</span>}</td>
                <td style={{ textAlign: 'center' }}>{r.periode}</td>
                <td>{r.peranSaya}{r.bisaNilai ? '' : ' (lihat saja)'}</td>
                <td>
                  <div className="inv__row-actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="inv__btn inv__btn--primary" onClick={() => navigate(`${base}/penilaian/${r.idPenugasan}`)}>
                      {r.bisaNilai ? <><ClipboardCheck size={15} /> Nilai</> : <><Eye size={15} /> Lihat</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
