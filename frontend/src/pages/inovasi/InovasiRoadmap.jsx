import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Check, Search } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { statusClass } from './statusClass'
import './inovasi.css'

// Roadmap Inovasi - garis waktu (bukan sekadar tabel). Risalah dikelompokkan per
// Periode Inovasi, dan tiap risalah menampilkan progres tahapan PDCA sebagai
// stepper visual: Draft -> Verifikasi PLAN -> Pengerjaan (DO/CHECK/ACTION) ->
// Pengesahan Akhir -> Selesai. Berbeda dari Daftar Inovasi yang berupa tabel.
const STEPS = ['Draft', 'Verifikasi PLAN', 'Pengerjaan', 'Pengesahan Akhir', 'Selesai']

// Posisi risalah pada garis waktu, diturunkan dari status + penanda planDisahkan.
function stepIndex(r) {
  if (r.status === 'Selesai') return 4
  if (r.status === 'Pengesahan Akhir' || r.status === 'Revisi Akhir') return 3
  if (r.planDisahkan) return 2
  if (r.status === 'Draft') return 0
  return 1 // Diajukan / Revisi / menunggu pengesahan PLAN
}

export default function InovasiRoadmap() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.listInovasi()
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = rows ?? []
    if (!term) return list
    return list.filter((r) => [r.noRegistrasi, r.namaGugus, r.judul, r.status, r.namaDepartemen, r.ketuaNama, r.periode]
      .some((v) => (v ?? '').toString().toLowerCase().includes(term)))
  }, [rows, search])

  // Kelompokkan per periode; periode terbaru di atas, dalam grup diurut aktivitas terakhir.
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      const key = r.periode || 'Tanpa Periode'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    const ts = (r) => new Date(r.updatedAt ?? r.createdAt ?? 0).getTime()
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([periode, items]) => [periode, items.sort((a, b) => ts(b) - ts(a))])
  }, [filtered])

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Roadmap Inovasi</h2>
      <p className="inv__subtitle">Garis waktu perjalanan setiap risalah (SS/GIO/5R) mengikuti tahapan PDCA, dikelompokkan per periode inovasi.</p>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__search">
          <span className="inv__search-icon"><Search size={16} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. registrasi, gugus, ketua, periode..." />
        </div>
      </div>

      {groups.length === 0 && <div className="inv__banner inv__banner--info">Belum ada risalah untuk ditampilkan pada roadmap.</div>}

      {groups.map(([periode, items]) => (
        <div key={periode}>
          <div className="inv__road-period">
            <h3>Periode {periode}</h3>
            <span className="inv__road-count">{items.length} risalah</span>
          </div>
          {items.map((r) => (
            <div key={r.id} className="inv__road-card" onClick={() => navigate(`${base}/daftar/${r.id}`)}>
              <div className="inv__road-top">
                <div>
                  <div className="inv__road-title">
                    <span className="inv__road-jenis">{r.jenis}</span>
                    {r.namaGugus ?? r.judul ?? '(tanpa nama gugus)'}
                  </div>
                  <div className="inv__road-sub">
                    <span>No. Reg: {r.noRegistrasi ?? '-'}</span>
                    <span>Ketua: {r.ketuaNama ?? '-'}</span>
                    <span>{r.namaDepartemen ?? r.namaKompartemen ?? '-'}</span>
                  </div>
                </div>
                <span className={`inv__status ${statusClass(r.status)}`}>{r.status}</span>
              </div>
              <Stepper current={stepIndex(r)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Stepper({ current }) {
  const last = STEPS.length - 1
  return (
    <div className="inv__steps-track">
      {STEPS.map((label, i) => {
        // Node terakhir (Selesai) yang sudah tercapai ditandai tuntas, bukan "aktif".
        const state = i < current || (current === last && i === current) ? 'done' : i === current ? 'active' : 'todo'
        return (
          <div key={label} className={`inv__stepnode${state === 'done' ? ' inv__stepnode--done' : state === 'active' ? ' inv__stepnode--active' : ''}`}>
            <span className="inv__stepdot">{state === 'done' && <Check size={13} />}</span>
            <span className="inv__steplabel">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
