import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './inovasi.css'

// Daftar Pegawai - direktori seluruh pegawai aktif. Dapat disaring per Kompartemen
// / Departemen (data org) dan dicari via nama atau NIK. Kolom departemen &
// kompartemen terisi untuk pegawai yang datanya ada di org (grading).
export default function InovasiPegawai() {
  const [q, setQ] = useState('')
  const [departemenId, setDepartemenId] = useState('')
  const [kompartemenId, setKompartemenId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [depts, setDepts] = useState([])
  const [komps, setKomps] = useState([])

  useEffect(() => {
    api.listDepartemenInovasi().then(setDepts).catch(() => setDepts([]))
    api.listKompartemenInovasi().then(setKomps).catch(() => setKomps([]))
  }, [])

  useEffect(() => {
    const term = q.trim()
    let live = true
    setLoading(true)
    setErr('')
    const t = setTimeout(() => {
      api.listPegawaiDirektori({
        q: term.length >= 2 ? term : '',
        departemenId: departemenId || undefined,
        kompartemenId: kompartemenId || undefined,
      })
        .then((d) => { if (live) setRows(d) })
        .catch((e) => { if (live) { setRows([]); setErr(e instanceof ApiError ? e.message : 'Gagal memuat data pegawai.') } })
        .finally(() => { if (live) setLoading(false) })
    }, term.length >= 2 ? 300 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [q, departemenId, kompartemenId])

  return (
    <div className="inv">
      <h2 className="inv__title">Daftar Pegawai</h2>
      <p className="inv__subtitle">Seluruh pegawai aktif. Saring per kompartemen/departemen atau cari nama/NIK.</p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__search">
          <span className="inv__search-icon"><Search size={16} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NIK..." />
        </div>
        <select className="inv__select" value={kompartemenId} onChange={(e) => setKompartemenId(e.target.value)}>
          <option value="">Semua Kompartemen</option>
          {komps.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>
        <select className="inv__select" value={departemenId} onChange={(e) => setDepartemenId(e.target.value)}>
          <option value="">Semua Departemen</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
        </select>
      </div>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead><tr><th style={{ width: 120 }}>NIK</th><th style={{ width: '24%' }}>Nama</th><th>Jabatan</th><th>Departemen</th><th>Kompartemen</th></tr></thead>
          <tbody>
            {loading && <tr><td className="inv__no-data" colSpan={5}>Memuat...</td></tr>}
            {!loading && rows.length === 0 && <tr><td className="inv__no-data" colSpan={5}>Tidak ada pegawai.</td></tr>}
            {!loading && rows.map((p) => (
              <tr key={p.nik}>
                <td>{p.nik}</td>
                <td style={{ fontWeight: 600 }}>{p.nama}</td>
                <td>{p.jabatan ?? '-'}</td>
                <td>{p.departemen ?? <span style={{ color: '#9aa79d' }}>-</span>}</td>
                <td>{p.kompartemen ?? <span style={{ color: '#9aa79d' }}>-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
