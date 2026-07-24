import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ChevronDown, ChevronRight, Download, ExternalLink, Search } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { statusClass } from './statusClass'
import { METODOLOGI, cocokCari, unduhCsv, waktuId } from './rekapUtils'
import './inovasi.css'

// History Approval - jejak langkah persetujuan. Satu baris = satu langkah pada
// rantai approval (Verifikator/GM untuk gagasan; Fasilitator/Pembina untuk
// risalah). Approver (Manager/GM) memakainya sebagai log pribadi: apa yang ia
// verifikasi dan kapan; pengaju memakainya untuk menelusuri perjalanan usulannya.
// Baris dapat dibuka untuk melihat seluruh rantai "Riwayat Approval".
export default function HistoryApproval({ kind = 'gagasan' }) {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()
  const isInovasi = kind === 'inovasi'

  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  // Approver membuka menu ini untuk log dirinya sendiri; pengaju ingin melihat
  // seluruh rantai. Nilai awal mengikuti peran, tetap bisa diubah.
  const [lingkup, setLingkup] = useState(ctx.isApprover ? 'saya' : 'semua')
  const [status, setStatus] = useState('')
  const [metodologi, setMetodologi] = useState('')
  const [search, setSearch] = useState('')
  const [buka, setBuka] = useState(null)

  useEffect(() => {
    setRows(null); setErr(''); setBuka(null)
    const ambil = isInovasi ? api.historyApprovalInovasi() : api.historyApprovalGagasan()
    ambil
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
  }, [isInovasi])

  useEffect(() => { setLingkup(ctx.isApprover ? 'saya' : 'semua') }, [ctx.isApprover])

  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (lingkup !== 'saya' || r.saya) &&
    (!status || r.statusLangkah === status) &&
    (!metodologi || r.metodologi === metodologi) &&
    cocokCari(r, ['noRegistrasi', 'judul', 'peran', 'nama', 'unit', 'statusLangkah'], search)
  ), [rows, lingkup, status, metodologi, search])

  const daftarStatus = useMemo(() => [...new Set((rows ?? []).map((r) => r.statusLangkah))].sort(), [rows])

  // Seluruh langkah satu gagasan/risalah, untuk panel "Riwayat Approval".
  const rantai = useMemo(() => {
    if (buka === null) return []
    return (rows ?? []).filter((r) => r.idTarget === buka)
      .slice()
      .sort((a, b) => new Date(a.tgl ?? 0) - new Date(b.tgl ?? 0))
  }, [rows, buka])

  function unduh() {
    unduhCsv(`history-approval-${isInovasi ? 'inovasi' : 'gagasan'}`,
      ['Waktu', 'No. Registrasi', 'Judul', 'Metodologi', ...(isInovasi ? ['Tahap'] : []), 'Peran', 'Approver', 'Status Langkah', 'Komentar', 'Status Akhir'],
      filtered.map((r) => [waktuId(r.tgl), r.noRegistrasi, r.judul, r.metodologi, ...(isInovasi ? [r.tahap] : []),
        r.peran, r.nama, r.statusLangkah, r.komentar, r.statusTarget]))
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  const judul = isInovasi ? 'History Approval Inovasi' : 'History Approval Gagasan'
  const kolomTotal = isInovasi ? 10 : 9

  return (
    <div className="inv">
      <h2 className="inv__title">{judul}</h2>
      <p className="inv__subtitle">
        {isInovasi
          ? 'Jejak Lembar Pengesahan risalah (SS / GIO / 5R): tahap PLAN dan pengesahan akhir, lengkap dengan waktu dan catatan.'
          : 'Jejak persetujuan Sumbang Gagasan: Verifikator (Manager) dan GM Kompartemen, lengkap dengan waktu dan catatan.'}
        {' '}Klik satu baris untuk melihat seluruh riwayat approval-nya.
      </p>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__filters">
          <select className="inv__select" value={lingkup} onChange={(e) => setLingkup(e.target.value)}>
            <option value="saya">Tindakan saya</option>
            <option value="semua">Semua langkah</option>
          </select>
          <select className="inv__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {daftarStatus.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="inv__select" value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
            <option value="">Semua Metodologi</option>
            {METODOLOGI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="inv__search">
            <span className="inv__search-icon"><Search size={16} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. registrasi, judul, approver..." />
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
              <th style={{ width: 28 }} aria-label="Buka riwayat" />
              <th style={{ width: 130 }}>Waktu</th>
              <th style={{ width: 140 }}>No. Registrasi</th>
              <th>Judul</th>
              <th style={{ width: 90, textAlign: 'center' }}>Metodologi</th>
              {isInovasi && <th style={{ width: 80, textAlign: 'center' }}>Tahap</th>}
              <th style={{ width: 160 }}>Peran</th>
              <th style={{ width: 160 }}>Approver</th>
              <th style={{ width: 110, textAlign: 'center' }}>Langkah</th>
              <th style={{ width: 50 }} aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td className="inv__no-data" colSpan={kolomTotal}>
                {lingkup === 'saya' ? 'Belum ada tindakan persetujuan yang Anda lakukan.' : 'Belum ada riwayat approval.'}
              </td></tr>
            )}
            {filtered.map((r, i) => {
              const terbuka = buka === r.idTarget
              return [
                <tr key={`r-${r.idTarget}-${i}`} className={r.saya ? 'inv__row--mine' : undefined}
                  style={{ cursor: 'pointer' }} onClick={() => setBuka(terbuka ? null : r.idTarget)}>
                  <td>{terbuka ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{waktuId(r.tgl)}</td>
                  <td>{r.noRegistrasi ?? '-'}</td>
                  <td>{r.judul ?? '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.metodologi ?? '-'}</td>
                  {isInovasi && <td style={{ textAlign: 'center' }}>{r.tahap ?? '-'}</td>}
                  <td>{r.peran}</td>
                  <td>{r.nama ?? '-'}{r.saya && <span className="inv__chip-saya">saya</span>}</td>
                  <td style={{ textAlign: 'center' }}><span className={`inv__status ${statusClass(r.statusLangkah)}`}>{r.statusLangkah}</span></td>
                  <td>
                    {isInovasi && (
                      <button type="button" className="inv__icon-btn" title="Buka risalah"
                        onClick={(e) => { e.stopPropagation(); navigate(`${base}/daftar/${r.idTarget}`) }}>
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </td>
                </tr>,
                terbuka && (
                  <tr key={`d-${r.idTarget}-${i}`}>
                    <td colSpan={kolomTotal} style={{ background: '#f7faf7' }}>
                      <div className="inv__timeline">
                        <div className="inv__timeline-head">Riwayat Approval - {r.noRegistrasi ?? r.judul}</div>
                        {rantai.map((s, si) => (
                          <div key={si} className="inv__timeline-row">
                            <div>
                              <div className="inv__timeline-what">
                                {s.statusLangkah === 'Menunggu' ? 'Menunggu' : s.statusLangkah}
                                {isInovasi && s.tahap ? <> pada tahap <b>{s.tahap}</b></> : null} oleh <b>{s.peran}</b>
                              </div>
                              <div className="inv__timeline-who">{s.nik ? `${s.nik} - ` : ''}{s.nama ?? '(belum ditetapkan)'}{s.komentar ? ` - "${s.komentar}"` : ''}</div>
                            </div>
                            <div className="inv__timeline-when">{s.tgl ? waktuId(s.tgl) : 'belum diproses'}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
