import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { KpiCard, KpiFormModal, NilaiModal } from './kpiShared'
import './KpiPage.css'

export default function KpiTim() {
  const [anggota, setAnggota] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sel, setSel] = useState(null) // {nik, nama}
  const [kpis, setKpis] = useState([])
  const [kpiLoading, setKpiLoading] = useState(false)
  const [parentOpts, setParentOpts] = useState([])
  const [msg, setMsg] = useState(null)
  const [modal, setModal] = useState(null)

  const loadTim = useCallback(async () => {
    try { setAnggota(await api.getKpiTim()); setLoading(false) }
    catch (err) {
      if (isEmptyDataError(err)) { setAnggota([]); setLoading(false) }
      else { setError(err instanceof ApiError ? err.message : 'Gagal memuat tim.'); setLoading(false) }
    }
  }, [])
  useEffect(() => { loadTim() }, [loadTim])

  // KPI perusahaan untuk pilihan kaitan induk (opsional).
  useEffect(() => { api.getKpiPerusahaan().then((r) => setParentOpts(r.map((k) => ({ id: k.id, judul: k.judul })))).catch(() => {}) }, [])

  const loadKpi = useCallback(async (nik) => {
    setKpiLoading(true)
    try { setKpis(await api.getKpiKaryawan(nik)) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal memuat KPI.' }); setKpis([]) }
    finally { setKpiLoading(false) }
  }, [])

  function pilih(a) { setSel(a); setMsg(null); loadKpi(a.nik) }

  async function turunkan(payload) { await api.turunkanKpi(sel.nik, payload); setModal(null); setMsg({ t: 'ok', m: 'KPI diturunkan.' }); await loadKpi(sel.nik); await loadTim() }
  async function ubah(payload) { await api.ubahKpi(modal.kpi.id, payload); setModal(null); setMsg({ t: 'ok', m: 'KPI diperbarui.' }); await loadKpi(sel.nik) }
  async function nilai(payload) { await api.nilaiKpi(modal.kpi.id, payload); setModal(null); setMsg({ t: 'ok', m: 'Realisasi tersimpan.' }); await loadKpi(sel.nik) }
  async function hapus(k) {
    if (!window.confirm(`Hapus KPI "${k.judul}"?`)) return
    try { await api.hapusKpi(k.id); setMsg({ t: 'ok', m: 'KPI dihapus.' }); await loadKpi(sel.nik); await loadTim() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }

  if (loading) return <div className="kpi"><div className="kpi__loading"><Loader2 className="kpi__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="kpi"><div className="kpi__alert">{error}</div></div>

  return (
    <div className="kpi">
      <div className="kpi__head">
        <div>
          <h2 className="kpi__title">KPI Tim</h2>
          <p className="kpi__sub">Turunkan KPI ke bawahan (seluruh jenjang) dan nilai realisasinya.</p>
        </div>
      </div>

      {msg && <div className={`kpi__msg kpi__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {anggota.length === 0 ? (
        <div className="kpi__empty">Anda belum memiliki bawahan pada struktur organisasi.</div>
      ) : (
        <div className="kpi__tim">
          <div className="kpi__people">
            {anggota.map((a) => (
              <button type="button" key={a.nik} onClick={() => pilih(a)} className={`kpi__person${sel?.nik === a.nik ? ' kpi__person--active' : ''}`}>
                <span>
                  <span className="kpi__person-nama">{a.nama}</span>
                  <span className="kpi__person-jab">{a.jabatan || a.nik}</span>
                </span>
                <span className="kpi__count">{a.jumlahKpi}</span>
              </button>
            ))}
          </div>

          <div className="kpi__panel">
            {!sel ? (
              <div className="kpi__empty">Pilih anggota tim untuk melihat & mengatur KPI-nya.</div>
            ) : (
              <>
                <div className="kpi__panel-head">
                  <h3 className="kpi__section-title">{sel.nama}</h3>
                  <button type="button" className="kpi__btn" onClick={() => setModal({ mode: 'buat' })}><Plus size={15} /> Turunkan KPI</button>
                </div>
                {kpiLoading ? <div className="kpi__loading"><Loader2 className="kpi__spin" size={18} /> Memuat…</div>
                  : kpis.length === 0 ? <div className="kpi__empty">Belum ada KPI untuk {sel.nama}.</div>
                  : <div className="kpi__grid">{kpis.map((k) => (
                      <KpiCard key={k.id} kpi={k} actions={{
                        onNilai: () => setModal({ mode: 'nilai', kpi: k }),
                        onEdit: () => setModal({ mode: 'ubah', kpi: k }),
                        onDelete: () => hapus(k),
                      }} />
                    ))}</div>}
              </>
            )}
          </div>
        </div>
      )}

      {modal?.mode === 'buat' && <KpiFormModal title={`Turunkan KPI ke ${sel?.nama}`} parentOptions={parentOpts} onClose={() => setModal(null)} onSubmit={turunkan} />}
      {modal?.mode === 'ubah' && <KpiFormModal title="Ubah KPI" initial={modal.kpi} parentOptions={parentOpts} onClose={() => setModal(null)} onSubmit={ubah} />}
      {modal?.mode === 'nilai' && <NilaiModal kpi={modal.kpi} onClose={() => setModal(null)} onSubmit={nilai} />}
    </div>
  )
}
