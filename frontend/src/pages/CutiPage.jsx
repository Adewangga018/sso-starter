import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Info, Loader2, Plus, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './CutiPage.css'

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// Jumlah hari kerja (Sen–Jum) inklusif — untuk pratinjau di form.
function hariKerja(mulai, selesai) {
  if (!mulai || !selesai) return 0
  const a = new Date(mulai), b = new Date(selesai)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  let n = 0
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const w = d.getDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

function StatusBadge({ status }) {
  const map = { Menunggu: 'wait', Disetujui: 'ok', Ditolak: 'no', Batal: 'off' }
  return <span className={`cuti__st cuti__st--${map[status] || 'off'}`}>{status}</span>
}

export default function CutiPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ tglMulai: '', tglSelesai: '', keterangan: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api.getCuti()
      setData(d); setLoading(false)
    } catch (err) {
      if (isEmptyDataError(err)) { setData({ sisa: 0, adaData: false, pengajuan: [], persetujuan: [], riwayat: [] }) }
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat data cuti.')
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function ajukan(e) {
    e.preventDefault()
    if (!form.tglMulai || !form.tglSelesai) { setMsg({ type: 'err', text: 'Tanggal mulai dan selesai wajib diisi.' }); return }
    setBusy(true); setMsg(null)
    try {
      await api.ajukanCuti({ tglMulai: form.tglMulai, tglSelesai: form.tglSelesai, keterangan: form.keterangan.trim() || null })
      setForm({ tglMulai: '', tglSelesai: '', keterangan: '' })
      setFormOpen(false)
      setMsg({ type: 'ok', text: 'Pengajuan cuti terkirim, menunggu persetujuan atasan.' })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengajukan cuti.' })
    } finally { setBusy(false) }
  }

  async function act(fn, okText) {
    setMsg(null)
    try { await fn(); setMsg({ type: 'ok', text: okText }); await load() }
    catch (err) { setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' }) }
  }

  if (loading) return <div className="cuti"><div className="cuti__loading"><Loader2 className="cuti__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="cuti"><div className="cuti__alert">{error}</div></div>
  if (!data) return null

  const previewHari = hariKerja(form.tglMulai, form.tglSelesai)

  return (
    <div className="cuti">
      <div className="cuti__intro">
        <h2 className="cuti__title">Cuti Tahunan</h2>
        <p className="cuti__sub">Saldo cuti tahunan Anda. Ajukan cuti, disetujui atasan, saldo otomatis berkurang.</p>
      </div>

      {msg && <div className={`cuti__msg cuti__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="cuti__saldo">
        <div className="cuti__saldo-icon"><CalendarDays size={26} /></div>
        <div className="cuti__saldo-main">
          <div className="cuti__saldo-value">{data.sisa} <span>hari</span></div>
          <div className="cuti__saldo-label">Sisa Cuti Tahunan{data.periode ? ` · periode ${data.periode}` : ''}</div>
        </div>
        {data.adaData && (
          <button type="button" className="cuti__btn" onClick={() => setFormOpen((v) => !v)}>
            <Plus size={16} /> Ajukan Cuti
          </button>
        )}
      </div>

      {!data.adaData && (
        <div className="cuti__nodata">
          <Info size={15} />
          <span>Belum ada data saldo cuti untuk NIK Anda. Hubungi SDM bila seharusnya ada.</span>
        </div>
      )}

      {/* Form ajukan */}
      {formOpen && (
        <form className="cuti__card" onSubmit={ajukan}>
          <div className="cuti__card-head">Ajukan Cuti Tahunan</div>
          <div className="cuti__form">
            <label>Tanggal Mulai
              <input type="date" value={form.tglMulai} onChange={(e) => setForm((f) => ({ ...f, tglMulai: e.target.value }))} required />
            </label>
            <label>Tanggal Selesai
              <input type="date" value={form.tglSelesai} min={form.tglMulai || undefined} onChange={(e) => setForm((f) => ({ ...f, tglSelesai: e.target.value }))} required />
            </label>
            <label className="cuti__form-full">Keterangan <span>(opsional)</span>
              <input value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} placeholder="Alasan / catatan cuti" />
            </label>
          </div>
          <div className="cuti__form-foot">
            <span className="cuti__preview">{previewHari > 0 ? `${previewHari} hari kerja` : 'Pilih rentang tanggal'}</span>
            <div className="cuti__form-actions">
              <button type="button" className="cuti__btn cuti__btn--ghost" onClick={() => setFormOpen(false)}>Batal</button>
              <button type="submit" className="cuti__btn" disabled={busy}>{busy ? <Loader2 size={16} className="cuti__spin" /> : <CheckCircle2 size={16} />} Kirim Pengajuan</button>
            </div>
          </div>
        </form>
      )}

      {/* Persetujuan (atasan) */}
      {data.persetujuan?.length > 0 && (
        <div className="cuti__card">
          <div className="cuti__card-head">Menunggu Persetujuan Anda</div>
          <div className="cuti__list">
            {data.persetujuan.map((p) => (
              <div className="cuti__item" key={p.id}>
                <div className="cuti__item-main">
                  <div className="cuti__item-title">{p.nama || p.idKaryawan} · <b>{p.jumlahHari} hari</b></div>
                  <div className="cuti__item-sub">{formatTgl(p.tglMulai)} – {formatTgl(p.tglSelesai)}{p.keterangan ? ` · ${p.keterangan}` : ''}</div>
                </div>
                <div className="cuti__item-actions">
                  <button type="button" className="cuti__btn cuti__btn--ghost" onClick={() => act(() => api.putusanCuti(p.id, { setuju: false }), 'Pengajuan ditolak.')}>Tolak</button>
                  <button type="button" className="cuti__btn" onClick={() => act(() => api.putusanCuti(p.id, { setuju: true }), 'Pengajuan disetujui, saldo pemohon berkurang.')}>Setujui</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pengajuan saya */}
      <div className="cuti__card">
        <div className="cuti__card-head">Pengajuan Saya</div>
        <div className="cuti__table-wrap">
          <table className="cuti__table">
            <thead>
              <tr><th>Tanggal</th><th>Hari</th><th>Keterangan</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {(data.pengajuan?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="cuti__empty">Belum ada pengajuan cuti.</td></tr>
              )}
              {(data.pengajuan ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{formatTgl(p.tglMulai)} – {formatTgl(p.tglSelesai)}</td>
                  <td>{p.jumlahHari}</td>
                  <td className="cuti__ket">{p.keterangan || '-'}{p.komentar ? ` (atasan: ${p.komentar})` : ''}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.status === 'Menunggu' && (
                    <button type="button" className="cuti__link-del" onClick={() => act(() => api.batalCuti(p.id), 'Pengajuan dibatalkan.')} title="Batalkan"><X size={14} /></button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(data.riwayat?.length ?? 0) > 0 && (
        <div className="cuti__card">
          <div className="cuti__card-head">Riwayat Cuti (data lama SDM)</div>
          <div className="cuti__table-wrap">
            <table className="cuti__table">
              <thead><tr><th>Kode</th><th>Tanggal Ajuan</th><th>Keterangan</th><th>Status</th></tr></thead>
              <tbody>
                {data.riwayat.map((r, i) => (
                  <tr key={i}>
                    <td>{r.kode || '-'}</td>
                    <td>{formatTgl(r.tanggal)}</td>
                    <td className="cuti__ket">{r.keterangan || '-'}</td>
                    <td>{r.status}</td>
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
