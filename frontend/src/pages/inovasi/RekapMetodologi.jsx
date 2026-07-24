import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Check, Download, Minus, Search } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { jenisLabel, statusClass } from './statusClass'
import { METODOLOGI, cocokCari, periodeList, tglId, unduhCsv } from './rekapUtils'
import './inovasi.css'

// Rekap Kegiatan Inovasi > Inovasi Per Metodologi. Risalah dikelompokkan menurut
// metodologi (SS / GIO / 5R) dengan penanda pengesahan PLAN & pengesahan AKHIR -
// dua titik yang benar-benar tercatat pada Lembar Pengesahan.
export default function RekapMetodologi() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()

  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [metodologi, setMetodologi] = useState('')
  const [periode, setPeriode] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.listInovasi()
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
  }, [])

  const periodeOpsi = useMemo(() => periodeList(rows), [rows])
  const daftarStatus = useMemo(() => [...new Set((rows ?? []).map((r) => r.status).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!metodologi || r.jenis === metodologi) &&
    (!periode || r.periode === periode) &&
    (!status || r.status === status) &&
    cocokCari(r, ['noRegistrasi', 'namaGugus', 'judul', 'ketuaNama', 'namaDepartemen', 'status'], search)
  ), [rows, metodologi, periode, status, search])

  // Jumlah per metodologi mengikuti filter selain metodologi itu sendiri.
  const perMetodologi = useMemo(() => {
    const dasar = (rows ?? []).filter((r) =>
      (!periode || r.periode === periode) &&
      (!status || r.status === status) &&
      cocokCari(r, ['noRegistrasi', 'namaGugus', 'judul', 'ketuaNama', 'namaDepartemen', 'status'], search))
    return METODOLOGI.map((m) => ({ m, n: dasar.filter((r) => r.jenis === m).length }))
  }, [rows, periode, status, search])

  function unduh() {
    unduhCsv(`inovasi-per-metodologi${metodologi ? `-${metodologi}` : ''}`,
      ['No. Registrasi', 'Metodologi', 'Nama Gugus', 'Judul', 'Ketua', 'Departemen', 'Periode', 'Status', 'PLAN Disahkan', 'Pengesahan Akhir', 'Terakhir Diubah'],
      filtered.map((r) => [r.noRegistrasi, r.jenis, r.namaGugus, r.judul, r.ketuaNama, r.namaDepartemen ?? r.namaKompartemen,
        r.periode, r.status, r.planDisahkan ? 'Ya' : 'Belum', r.status === 'Selesai' ? 'Ya' : 'Belum', tglId(r.updatedAt ?? r.createdAt)]))
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Inovasi Per Metodologi</h2>
      <p className="inv__subtitle">Risalah inovasi menurut metodologi. Pilih metodologi untuk melihat daftarnya, lalu unduh bila perlu.</p>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__stats">
        <button type="button" className={`inv__stat inv__stat--btn${metodologi === '' ? ' inv__stat--on' : ''}`} onClick={() => setMetodologi('')}>
          <div className="inv__stat-num">{perMetodologi.reduce((a, x) => a + x.n, 0)}</div>
          <div className="inv__stat-label">Semua Metodologi</div>
        </button>
        {perMetodologi.map(({ m, n }) => (
          <button key={m} type="button" className={`inv__stat inv__stat--btn${metodologi === m ? ' inv__stat--on' : ''}`} onClick={() => setMetodologi(m)}>
            <div className="inv__stat-num">{n}</div>
            <div className="inv__stat-label">{m} - {jenisLabel(m)}</div>
          </button>
        ))}
      </div>

      <div className="inv__toolbar">
        <div className="inv__filters">
          <select className="inv__select" value={periode} onChange={(e) => setPeriode(e.target.value)}>
            <option value="">Semua Periode</option>
            {periodeOpsi.map((p) => <option key={p} value={p}>Periode {p}</option>)}
          </select>
          <select className="inv__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {daftarStatus.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="inv__search">
            <span className="inv__search-icon"><Search size={16} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. registrasi, gugus, judul, ketua..." />
          </div>
        </div>
        <button type="button" className="inv__btn inv__btn--soft" onClick={unduh} disabled={filtered.length === 0}>
          <Download size={15} /> Download
        </button>
      </div>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>No. Registrasi</th><th style={{ width: 90, textAlign: 'center' }}>Metodologi</th>
              <th>Nama Gugus</th><th>Judul</th><th style={{ width: 150 }}>Ketua</th>
              <th style={{ width: 110, textAlign: 'center' }}>Periode</th><th style={{ width: 150, textAlign: 'center' }}>Status</th>
              <th style={{ width: 70, textAlign: 'center' }}>PLAN</th><th style={{ width: 80, textAlign: 'center' }}>Akhir</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td className="inv__no-data" colSpan={9}>Belum ada risalah pada filter ini.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/daftar/${r.id}`)}>
                <td>{r.noRegistrasi ?? '-'}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.jenis}</td>
                <td>{r.namaGugus ?? '-'}</td>
                <td>{r.judul ?? '-'}</td>
                <td>{r.ketuaNama ?? '-'}</td>
                <td style={{ textAlign: 'center' }}>{r.periode}</td>
                <td style={{ textAlign: 'center' }}><span className={`inv__status ${statusClass(r.status)}`}>{r.status}</span></td>
                <td style={{ textAlign: 'center' }}><Tanda ya={r.planDisahkan} judul="Pengesahan PLAN" /></td>
                <td style={{ textAlign: 'center' }}><Tanda ya={r.status === 'Selesai'} judul="Pengesahan Akhir" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Tanda({ ya, judul }) {
  return ya
    ? <span className="inv__tick inv__tick--on" title={`${judul}: selesai`}><Check size={14} /></span>
    : <span className="inv__tick" title={`${judul}: belum`}><Minus size={14} /></span>
}
