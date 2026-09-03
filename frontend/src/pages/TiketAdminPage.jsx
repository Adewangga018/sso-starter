import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Pencil, RotateCw, ShieldAlert, Ticket, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './PayrollShared.css'

const JENIS_TIKET = ['Bus', 'Hotel', 'Kapal Laut', 'Kereta Api', 'Pesawat']
const STATUS_PROGRES = ['Belum Diproses', 'Sedang Diproses', 'Selesai']

const pad = (n) => String(n).padStart(2, '0')
function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function progresBadgeStyle(status) {
  if (status === 'Selesai') return { background: 'rgba(21,128,61,0.12)', color: '#15803d' }
  if (status === 'Sedang Diproses') return { background: 'rgba(217,119,6,0.12)', color: '#b45309' }
  return { background: 'rgba(107,114,128,0.12)', color: '#4b5563' }
}

function persetujuanBadgeStyle(status) {
  if (status === 'Disetujui') return { background: 'rgba(21,128,61,0.12)', color: '#15803d' }
  if (status === 'Ditolak') return { background: 'rgba(220,38,38,0.12)', color: '#dc2626' }
  return { background: 'rgba(107,114,128,0.12)', color: '#4b5563' }
}

const badgeStyle = { fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, width: 'fit-content' }

function Baris({ row, onBukaProgres }) {
  return (
    <tr>
      <td>
        <div>{row.namaKaryawan ?? '-'}</div>
        <div style={{ fontSize: 12, color: 'var(--gcs-text-muted)' }}>{row.idKaryawan}</div>
      </td>
      <td>{row.kodeTiket ?? '-'}</td>
      <td>{formatTgl(row.tglInput)}</td>
      <td style={{ maxWidth: 220 }}>
        <div style={{ fontSize: 13 }}>{row.keterangan ?? '-'}</div>
        {row.rincian.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {row.rincian.map((r) => (
              <span key={r.idDet} style={{ fontSize: 11.5, color: 'var(--gcs-text-muted)' }}>
                {r.jenisTiket}: {formatTgl(r.tglIn).slice(0, 10)} s/d {formatTgl(r.tglOut).slice(0, 10)}
              </span>
            ))}
          </div>
        )}
      </td>
      <td>
        <span style={{ ...badgeStyle, ...persetujuanBadgeStyle(row.statusPersetujuan) }}>
          {row.statusPersetujuan ?? 'Menunggu'}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...badgeStyle, ...progresBadgeStyle(row.statusProgres) }}>{row.statusProgres}</span>
          <button type="button" className="agt__ibtn" title="Ubah progres" onClick={() => onBukaProgres(row)}>
            <Pencil size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function ProgresModal({ row, onClose, onSimpan, busy }) {
  const [status, setStatus] = useState(row.statusProgres)
  const [catatan, setCatatan] = useState(row.catatanProgres ?? '')

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: 20, width: 380, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{row.namaKaryawan ?? row.idKaryawan}</div>
            <div style={{ fontSize: 12.5, color: 'var(--gcs-text-muted)' }}>{row.kodeTiket ?? '-'} · {row.idKaryawan}</div>
          </div>
          <button type="button" className="agt__ibtn" onClick={onClose} aria-label="Tutup"><X size={16} /></button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
          Progres Sekretariat
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--gcs-border)', borderRadius: 8, fontSize: 13.5 }}
          >
            {STATUS_PROGRES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
          Catatan (opsional)
          <textarea
            rows={3} placeholder="mis. sudah dipesan di [agen], kode booking XXX"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--gcs-border)', borderRadius: 8, fontSize: 13.5, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className="agt__ibtn" onClick={onClose} style={{ padding: '8px 14px' }}>Batal</button>
          <button
            type="button" className="agt__save agt__save--sm" disabled={busy}
            onClick={() => onSimpan(row.id, status, catatan)}
          >
            {busy ? <Loader2 size={14} className="agt__spin" /> : null}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TiketAdminPage() {
  const { isSekretariatTiket, summary } = useAuth()
  const [items, setItems] = useState(null)
  const [ringkasan, setRingkasan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progresRow, setProgresRow] = useState(null)

  const [status, setStatus] = useState('Disetujui')
  const [statusProgres, setStatusProgres] = useState('')
  const [jenis, setJenis] = useState('')
  const [nik, setNik] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await api.getTiketAdmin({ status, statusProgres, jenis, nik: nik.trim() || undefined })
      setItems(data.items)
      setRingkasan(data.ringkasan)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data pemesanan tiket.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [status, statusProgres, jenis, nik])

  useEffect(() => { load() }, [status, statusProgres, jenis]) // eslint-disable-line react-hooks/exhaustive-deps

  async function simpanProgres(id, statusBaru, catatan) {
    setBusy(true); setMsg(null)
    try {
      await api.setTiketProgres(id, { status: statusBaru, catatan: catatan || null })
      setMsg({ type: 'ok', text: 'Progres tersimpan.' })
      setProgresRow(null)
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan progres.' })
    } finally {
      setBusy(false)
    }
  }

  if (!isSekretariatTiket) {
    return (
      <div className="agt">
        <div className="agt__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Monitoring Tiket hanya untuk staf Sekretariat yang ditunjuk (role Sekretariat Tiket) atau Admin IT.</p>
          <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="agt">
      <div className="agt__top">
        <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="agt__role">Sekretariat{summary?.nama ? <> · <span className="u-nama">{summary.nama}</span></> : ''}</span>
      </div>

      <div className="agt__head">
        <h2 className="agt__title"><Ticket size={20} /> Monitoring Tiket</h2>
        <p className="agt__sub">
          Pemesanan tiket karyawan yang sudah disetujui atasan (Kotak Persetujuan) - klik ikon pensil di kolom
          Progres utk menandai tindak lanjutnya (Belum Diproses → Sedang Diproses → Selesai), mis. sambil
          menunggu tiket benar-benar dipesan ke agen/maskapai. Ubah filter status di atas utk melihat
          pengajuan yang masih menunggu persetujuan atasan (gambaran beban kerja yang akan datang).
        </p>
      </div>

      {ringkasan && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          {[
            ['Disetujui (periode ini)', ringkasan.totalDisetujui, '#0f261f'],
            ['Belum Diproses', ringkasan.belumDiproses, '#4b5563'],
            ['Sedang Diproses', ringkasan.sedangDiproses, '#b45309'],
            ['Selesai', ringkasan.selesai, '#15803d'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ flex: '1 1 140px', background: '#fff', border: '1px solid var(--gcs-border)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--gcs-text-muted)', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            </div>
          ))}
          {Object.keys(ringkasan.perJenisTiket ?? {}).length > 0 && (
            <div style={{ flex: '2 1 260px', background: '#fff', border: '1px solid var(--gcs-border)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--gcs-text-muted)', fontWeight: 600, marginBottom: 6 }}>Per Jenis Tiket</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(ringkasan.perJenisTiket).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(15,38,31,0.08)', color: '#0f261f' }}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="agt__sel" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            Status Persetujuan
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--gcs-border)', borderRadius: 8 }}>
              <option value="Disetujui">Disetujui</option>
              <option value="Menunggu">Menunggu</option>
              <option value="Ditolak">Ditolak</option>
              <option value="Batal">Batal</option>
              <option value="Semua">Semua</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            Progres
            <select value={statusProgres} onChange={(e) => setStatusProgres(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--gcs-border)', borderRadius: 8 }}>
              <option value="">Semua</option>
              {STATUS_PROGRES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            Jenis
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--gcs-border)', borderRadius: 8 }}>
              <option value="">Semua</option>
              {JENIS_TIKET.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </label>
          <input
            type="text" placeholder="Filter NIK..." value={nik}
            onChange={(e) => setNik(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ padding: '7px 10px', border: '1px solid var(--gcs-border)', borderRadius: 8, fontSize: 13.5 }}
          />
        </div>
        <button type="button" className="agt__save agt__save--sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <RotateCw size={14} />}
          Muat Ulang
        </button>
      </div>

      {error && <div className="agt__msg agt__msg--err">{error}</div>}
      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {loading && !items ? (
        <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
      ) : !items || items.length === 0 ? (
        <div className="agt__empty">Tidak ada pemesanan tiket yang cocok dengan filter ini.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="agt__presensi-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Kode Tiket</th>
                <th>Tanggal Ajuan</th>
                <th>Keterangan &amp; Rincian</th>
                <th>Persetujuan</th>
                <th>Progres</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <Baris key={row.id} row={row} onBukaProgres={setProgresRow} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {progresRow && (
        <ProgresModal
          row={progresRow}
          onClose={() => setProgresRow(null)}
          onSimpan={simpanProgres}
          busy={busy}
        />
      )}
    </div>
  )
}
