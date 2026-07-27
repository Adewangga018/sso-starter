import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { KpiCard, KpiFormModal, NilaiModal } from './kpiShared'
import './KpiPage.css'

export default function KpiPerusahaan() {
  const { isAdminModulSdm } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [modal, setModal] = useState(null) // {mode:'buat'|'ubah', kpi?} | {mode:'nilai', kpi}

  const load = useCallback(async () => {
    try { setRows(await api.getKpiPerusahaan()); setLoading(false) }
    catch (err) {
      if (isEmptyDataError(err)) { setRows([]); setLoading(false) }
      else { setError(err instanceof ApiError ? err.message : 'Gagal memuat KPI.'); setLoading(false) }
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (!isAdminModulSdm) {
    return (
      <div className="kpi"><div className="kpi__empty" style={{ padding: 40 }}>
        <ShieldAlert size={26} /><p>Hanya Admin Modul SDM yang dapat mengelola KPI perusahaan.</p>
        <Link to="/my-progress" className="kpi__btn kpi__btn--ghost">Kembali ke KPI Saya</Link>
      </div></div>
    )
  }

  async function buat(payload) { await api.buatKpiPerusahaan(payload); setModal(null); setMsg({ t: 'ok', m: 'KPI perusahaan dibuat.' }); await load() }
  async function ubah(payload) { await api.ubahKpi(modal.kpi.id, payload); setModal(null); setMsg({ t: 'ok', m: 'KPI diperbarui.' }); await load() }
  async function nilai(payload) { await api.nilaiKpi(modal.kpi.id, payload); setModal(null); setMsg({ t: 'ok', m: 'Realisasi tersimpan.' }); await load() }
  async function hapus(k) {
    if (!window.confirm(`Hapus KPI "${k.judul}"?`)) return
    try { await api.hapusKpi(k.id); setMsg({ t: 'ok', m: 'KPI dihapus.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }

  return (
    <div className="kpi">
      <div className="kpi__head">
        <div>
          <h2 className="kpi__title">KPI Perusahaan</h2>
          <p className="kpi__sub">KPI top-level perusahaan. Dijadikan acuan penurunan KPI ke unit & individu.</p>
        </div>
        <button type="button" className="kpi__btn" onClick={() => setModal({ mode: 'buat' })}><Plus size={15} /> Tambah KPI</button>
      </div>

      {msg && <div className={`kpi__msg kpi__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="kpi__loading"><Loader2 className="kpi__spin" size={22} /> Memuat…</div>
        : error ? <div className="kpi__alert">{error}</div>
        : rows.length === 0 ? <div className="kpi__empty">Belum ada KPI perusahaan. Klik “Tambah KPI”.</div>
        : <div className="kpi__grid">{rows.map((k) => (
            <KpiCard key={k.id} kpi={k} actions={{
              onNilai: () => setModal({ mode: 'nilai', kpi: k }),
              onEdit: () => setModal({ mode: 'ubah', kpi: k }),
              onDelete: () => hapus(k),
            }} />
          ))}</div>}

      {modal?.mode === 'buat' && <KpiFormModal title="Tambah KPI Perusahaan" onClose={() => setModal(null)} onSubmit={buat} />}
      {modal?.mode === 'ubah' && <KpiFormModal title="Ubah KPI Perusahaan" initial={modal.kpi} onClose={() => setModal(null)} onSubmit={ubah} />}
      {modal?.mode === 'nilai' && <NilaiModal kpi={modal.kpi} onClose={() => setModal(null)} onSubmit={nilai} />}
    </div>
  )
}
