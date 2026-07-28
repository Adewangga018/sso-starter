import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Check, Download, Search } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { statusClass } from './statusClass'
import { METODOLOGI, periodeList, unduhCsv } from './rekapUtils'
import './inovasi.css'

// Roadmap Inovasi - dua sudut pandang atas risalah yang sama:
//  1. Tabel rekap : satu baris per risalah (Ketua, Departemen, gagasan asal,
//     nilai juri & Kategori Penghargaan), bisa disaring dan diunduh.
//  2. Timeline : progres tahapan PDCA tiap risalah, dikelompokkan per periode.
// Keduanya memakai filter yang sama di bagian atas halaman.
const STEPS = ['Draft', 'Verifikasi PLAN', 'Pengerjaan', 'Pengesahan Akhir', 'Selesai']

// Posisi risalah pada Timeline, diturunkan dari status + penanda planDisahkan.
function stepIndex(r) {
  if (r.status === 'Selesai') return 4
  if (r.status === 'Pengesahan Akhir' || r.status === 'Revisi Akhir') return 3
  if (r.planDisahkan) return 2
  if (r.status === 'Draft') return 0
  return 1 // Diajukan / Revisi / menunggu pengesahan PLAN
}

// Warna badge Kategori Penghargaan mengikuti ambang rubrik juri.
function kategoriClass(k) {
  if (!k || k === '-') return ''
  if (k.includes('Platinum')) return 'inv__kat--platinum'
  if (k.includes('Gold')) return 'inv__kat--gold'
  if (k.includes('Silver')) return 'inv__kat--silver'
  if (k.includes('Bronze')) return 'inv__kat--bronze'
  return 'inv__kat--partisipatif'
}

export default function InovasiRoadmap() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [nilai, setNilai] = useState({})   // { [idGugus]: RekapNilaiDto }
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [periode, setPeriode] = useState('')
  const [metodologi, setMetodologi] = useState('')
  const [kompartemen, setKompartemen] = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.listInovasi()
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
    // Nilai juri bersifat pelengkap: bila gagal/belum ada, tabel tetap tampil.
    api.getRekapNilai()
      .then((d) => setNilai(Object.fromEntries((d ?? []).map((x) => [x.idGugus, x]))))
      .catch(() => setNilai({}))
  }, [])

  const periodeOpsi = useMemo(() => periodeList(rows), [rows])
  const kompartemenOpsi = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.namaKompartemen).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rows ?? []).filter((r) => {
      if (periode && r.periode !== periode) return false
      if (metodologi && r.jenis !== metodologi) return false
      if (kompartemen && r.namaKompartemen !== kompartemen) return false
      if (!term) return true
      return [r.noRegistrasi, r.namaGugus, r.judul, r.status, r.namaDepartemen, r.ketuaNama, r.periode, r.gagasanJudul]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))
    })
  }, [rows, search, periode, metodologi, kompartemen])

  // Reset ke halaman 1 setiap kali filter berubah agar tidak tersangkut di halaman kosong.
  useEffect(() => { setPage(1) }, [search, periode, metodologi, kompartemen, perPage])

  const totalHal = Math.max(1, Math.ceil(filtered.length / perPage))
  const halaman = Math.min(page, totalHal)
  const tampil = filtered.slice((halaman - 1) * perPage, halaman * perPage)

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
      .map(([p, items]) => [p, items.sort((a, b) => ts(b) - ts(a))])
  }, [filtered])

  const namaRisalah = (r) => [r.namaGugus, r.jenis].filter(Boolean).join(' - ') + (r.judul ? ` - ${r.judul}` : '')

  function unduh() {
    unduhCsv('roadmap-inovasi',
      ['No', 'Ketua', 'Departemen', 'Kompartemen', 'Periode', 'Sumbang Gagasan', 'Risalah Inovasi', 'Status', 'Nilai Juri', 'Kategori Penghargaan'],
      filtered.map((r, i) => {
        const n = nilai[r.id]
        return [i + 1, r.ketuaNama ?? '-', r.namaDepartemen ?? '-', r.namaKompartemen ?? '-', r.periode ?? '-',
          r.gagasanJudul ?? '-', namaRisalah(r), r.status,
          n?.penilaiLengkap ? n.nilaiAkhir : '-', n?.kategori ?? '-']
      }))
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <div className="inv__road-head">
        <div>
          <h2 className="inv__title">Roadmap Inovasi</h2>
          <p className="inv__subtitle">Rekap perjalanan setiap risalah (SS/GIO/5R) beserta Kategori Penghargaan hasil penilaian juri.</p>
        </div>
        <button type="button" className="inv__btn inv__btn--soft" onClick={unduh} disabled={filtered.length === 0}>
          <Download size={15} /> Download
        </button>
      </div>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__road-filters">
        <select className="inv__select" value={periode} onChange={(e) => setPeriode(e.target.value)}>
          <option value="">Semua Periode</option>
          {periodeOpsi.map((p) => <option key={p} value={p}>Periode {p}</option>)}
        </select>
        <select className="inv__select" value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
          <option value="">Pilih Metodologi</option>
          {METODOLOGI.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="inv__select" value={kompartemen} onChange={(e) => setKompartemen(e.target.value)}>
          <option value="">Pilih Kompartemen</option>
          {kompartemenOpsi.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div className="inv__toolbar">
        <label className="inv__hint" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Tampilkan
          <select className="inv__select" style={{ width: 72 }} value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          baris
        </label>
        <div className="inv__search">
          <span className="inv__search-icon"><Search size={16} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari ketua, gugus, gagasan, no. registrasi..." />
        </div>
      </div>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th style={{ width: 50, textAlign: 'center' }}>No</th>
              <th style={{ width: 160 }}>Ketua</th>
              <th style={{ width: 180 }}>Departemen</th>
              <th>Sumbang Gagasan</th>
              <th>Risalah Inovasi</th>
              <th style={{ width: 80, textAlign: 'center' }}>Nilai</th>
              <th style={{ width: 150, textAlign: 'center' }}>Kategori Penghargaan</th>
            </tr>
          </thead>
          <tbody>
            {tampil.length === 0 && <tr><td className="inv__no-data" colSpan={7}>Belum ada risalah untuk ditampilkan.</td></tr>}
            {tampil.map((r, i) => {
              const n = nilai[r.id]
              const dinilai = Boolean(n?.penilaiLengkap)
              return (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/daftar/${r.id}`)}>
                  <td style={{ textAlign: 'center' }}>{(halaman - 1) * perPage + i + 1}</td>
                  <td className="u-nama" style={{ fontWeight: 600 }}>{r.ketuaNama ?? '-'}</td>
                  <td>{r.namaDepartemen ?? r.namaKompartemen ?? '-'}</td>
                  <td>{r.gagasanJudul ?? '-'}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{r.namaGugus ?? '(tanpa nama gugus)'}</span>
                    <span className="inv__road-jenis" style={{ marginLeft: 6 }}>{r.jenis}</span>
                    {r.judul && <div className="inv__hint" style={{ margin: 0 }}>{r.judul}</div>}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{dinilai ? n.nilaiAkhir : '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {dinilai
                      ? <span className={`inv__kat ${kategoriClass(n.kategori)}`}>{n.kategori}</span>
                      : <span style={{ color: '#9aa79d' }}>-</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > perPage && (
        <div className="inv__pager">
          <span className="inv__hint" style={{ margin: 0 }}>
            {(halaman - 1) * perPage + 1}-{Math.min(halaman * perPage, filtered.length)} dari {filtered.length} risalah
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="inv__btn inv__btn--soft" disabled={halaman <= 1} onClick={() => setPage(halaman - 1)}>Sebelumnya</button>
            <button type="button" className="inv__btn inv__btn--soft" disabled={halaman >= totalHal} onClick={() => setPage(halaman + 1)}>Berikutnya</button>
          </div>
        </div>
      )}

      <h3 className="inv__road-section">Timeline Tahapan</h3>
      {groups.length === 0 && <div className="inv__banner inv__banner--info">Belum ada risalah untuk ditampilkan pada Timeline.</div>}

      {groups.map(([p, items]) => (
        <div key={p}>
          <div className="inv__road-period">
            <h3>Periode {p}</h3>
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
                    <span>Ketua: <span className="u-nama">{r.ketuaNama ?? '-'}</span></span>
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
