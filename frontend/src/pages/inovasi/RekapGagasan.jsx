import { useEffect, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { statusClass } from './statusClass'
import { METODOLOGI, cocokCari, tglId, unduhCsv } from './rekapUtils'
import './inovasi.css'

// Rekap Kegiatan Inovasi > Sumbang Gagasan. Rekapitulasi seluruh usulan dalam
// lingkup yang boleh Anda lihat, dapat disaring per metodologi/status dan
// diunduh sebagai CSV. Berbeda dari menu "Sumbang Gagasan" (administrasi) yang
// dipakai untuk mengirim & memproses usulan.
export default function RekapGagasan() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [metodologi, setMetodologi] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.listGagasan()
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
  }, [])

  const daftarStatus = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.status).filter(Boolean))].sort(),
    [rows])

  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!metodologi || r.metodologi === metodologi) &&
    (!status || r.status === status) &&
    cocokCari(r, ['noRegistrasi', 'judul', 'createdByNama', 'namaDepartemenAsal', 'namaDepartemenTujuan', 'status'], search)
  ), [rows, metodologi, status, search])

  const ringkas = useMemo(() => ({
    total: filtered.length,
    proses: filtered.filter((r) => r.status?.startsWith('Dikirim') || r.status?.startsWith('Disetujui')).length,
    terdaftar: filtered.filter((r) => r.status === 'Terdaftar').length,
    revisi: filtered.filter((r) => r.status?.startsWith('Revisi')).length,
    ditolak: filtered.filter((r) => r.status === 'Ditolak').length,
  }), [filtered])

  function unduh() {
    unduhCsv('rekap-sumbang-gagasan',
      ['No. Registrasi', 'Judul', 'Pengaju', 'Metodologi', 'Departemen Asal', 'Departemen Tujuan', 'Status', 'Tanggal'],
      filtered.map((r) => [r.noRegistrasi, r.judul, r.createdByNama, r.metodologi, r.namaDepartemenAsal, r.namaDepartemenTujuan, r.status, tglId(r.createdAt)]))
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Rekap Sumbang Gagasan</h2>
      <p className="inv__subtitle">Rekapitulasi usulan Sumbang Gagasan beserta metodologi yang ditetapkan GM (SS / GIO / 5R) dan status persetujuannya.</p>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__stats">
        <div className="inv__stat"><div className="inv__stat-num">{ringkas.total}</div><div className="inv__stat-label">Total Gagasan</div></div>
        <div className="inv__stat"><div className="inv__stat-num">{ringkas.proses}</div><div className="inv__stat-label">Dalam Proses</div></div>
        <div className="inv__stat"><div className="inv__stat-num">{ringkas.terdaftar}</div><div className="inv__stat-label">Terdaftar jadi Risalah</div></div>
        <div className="inv__stat"><div className="inv__stat-num">{ringkas.revisi}</div><div className="inv__stat-label">Revisi</div></div>
        <div className="inv__stat"><div className="inv__stat-num">{ringkas.ditolak}</div><div className="inv__stat-label">Ditolak</div></div>
      </div>

      <div className="inv__toolbar">
        <div className="inv__filters">
          <select className="inv__select" value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
            <option value="">Semua Metodologi</option>
            {METODOLOGI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="inv__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {daftarStatus.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="inv__search">
            <span className="inv__search-icon"><Search size={16} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. registrasi, judul, pengaju..." />
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
              <th style={{ width: 150 }}>No. Registrasi</th><th>Judul</th><th style={{ width: 170 }}>Pengaju</th>
              <th style={{ width: 100, textAlign: 'center' }}>Metodologi</th><th style={{ width: 160 }}>Dep. Asal</th>
              <th style={{ width: 160 }}>Dep. Tujuan</th><th style={{ width: 150, textAlign: 'center' }}>Status</th>
              <th style={{ width: 110, textAlign: 'right' }}>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td className="inv__no-data" colSpan={8}>Belum ada gagasan pada filter ini.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.noRegistrasi ?? '-'}</td>
                <td>{r.judul}</td>
                <td>{r.createdByNama ?? '-'}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.metodologi ?? '-'}</td>
                <td>{r.namaDepartemenAsal ?? '-'}</td>
                <td>{r.namaDepartemenTujuan ?? '-'}</td>
                <td style={{ textAlign: 'center' }}><span className={`inv__status ${statusClass(r.status)}`}>{r.status}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{tglId(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
