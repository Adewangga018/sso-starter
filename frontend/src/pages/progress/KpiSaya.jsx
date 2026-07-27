import { useCallback, useEffect, useState } from 'react'
import { Loader2, Target, Building2 } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { KpiCard } from './kpiShared'
import './KpiPage.css'

export default function KpiSaya() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setData(await api.getKpiSaya()); setLoading(false) }
    catch (err) {
      if (isEmptyDataError(err)) { setData({ perusahaan: [], saya: [] }); setLoading(false) }
      else { setError(err instanceof ApiError ? err.message : 'Gagal memuat KPI.'); setLoading(false) }
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="kpi"><div className="kpi__loading"><Loader2 className="kpi__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="kpi"><div className="kpi__alert">{error}</div></div>

  const perusahaan = data?.perusahaan ?? []
  const saya = data?.saya ?? []

  return (
    <div className="kpi">
      <div className="kpi__head">
        <div>
          <h2 className="kpi__title">KPI Saya</h2>
          <p className="kpi__sub">Capaian target Anda pada periode berjalan. Realisasi dinilai oleh atasan.</p>
        </div>
      </div>

      <h3 className="kpi__section-title"><Target size={16} /> KPI Individu</h3>
      {saya.length === 0
        ? <div className="kpi__empty">Belum ada KPI yang diberikan untuk Anda.</div>
        : <div className="kpi__grid">{saya.map((k) => <KpiCard key={k.id} kpi={k} />)}</div>}

      {perusahaan.length > 0 && (
        <>
          <h3 className="kpi__section-title"><Building2 size={16} /> KPI Perusahaan</h3>
          <div className="kpi__grid">{perusahaan.map((k) => <KpiCard key={k.id} kpi={k} />)}</div>
        </>
      )}
    </div>
  )
}
