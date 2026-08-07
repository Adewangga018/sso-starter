import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { METODOLOGI, unduhCsv } from './rekapUtils'
import { BatangHorizontal, BatangVertikal } from './InvCharts'
import './inovasi.css'

// Rekap Kegiatan Inovasi > Grafik Sumbang Gagasan.
// Menampilkan jumlah inovasi per bulan, sebaran status, sebaran metodologi,
// serta grafik statistik per Kompartemen & Departemen beserta statusnya.
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export default function GrafikGagasan() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [tahun, setTahun] = useState(null)   // null = belum ditentukan, '' = semua tahun
  const [metodologi, setMetodologi] = useState('')
  const [unitTab, setUnitTab] = useState('kompartemen') // 'kompartemen' | 'departemen'

  useEffect(() => {
    api.listGagasan()
      .then((d) => setRows(d.items))
      .catch((e) => { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.') })
  }, [])

  const tahunOpsi = useMemo(
    () => [...new Set((rows ?? []).map((r) => new Date(r.createdAt).getFullYear()))].sort((a, b) => b - a),
    [rows])

  // Tahun default = tahun terbaru yang ada datanya
  useEffect(() => { if (tahun === null && tahunOpsi.length) setTahun(String(tahunOpsi[0])) }, [tahunOpsi, tahun])

  const terpilih = useMemo(() => (rows ?? []).filter((r) =>
    (!tahun || String(new Date(r.createdAt).getFullYear()) === tahun) &&
    (!metodologi || r.metodologi === metodologi)
  ), [rows, tahun, metodologi])

  const perBulan = useMemo(() => {
    const n = Array(12).fill(0)
    terpilih.forEach((r) => { n[new Date(r.createdAt).getMonth()] += 1 })
    return BULAN.map((b, i) => ({ label: b, nilai: n[i] }))
  }, [terpilih])

  const perStatus = useMemo(() => {
    const map = new Map()
    terpilih.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1))
    return [...map.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)
  }, [terpilih])

  const perMetodologi = useMemo(() => {
    const hitung = (m) => terpilih.filter((r) => (m === '-' ? !r.metodologi : r.metodologi === m)).length
    return [...METODOLOGI.map((m) => ({ label: m, nilai: hitung(m) })), { label: 'Belum ditetapkan', nilai: hitung('-') }]
      .filter((x) => x.nilai > 0)
  }, [terpilih])

  // Sebaran Jumlah Inovasi Per Kompartemen
  const perKompartemen = useMemo(() => {
    const map = new Map()
    terpilih.forEach((r) => {
      const komp = r.namaKompartemenAsal || 'Kompartemen Lainnya'
      map.set(komp, (map.get(komp) ?? 0) + 1)
    })
    return [...map.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)
  }, [terpilih])

  // Sebaran Jumlah Inovasi Per Departemen
  const perDepartemen = useMemo(() => {
    const map = new Map()
    terpilih.forEach((r) => {
      const dept = r.namaDepartemenAsal || 'Departemen Lainnya'
      map.set(dept, (map.get(dept) ?? 0) + 1)
    })
    return [...map.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)
  }, [terpilih])

  // Status Inovasi per Kompartemen & Departemen (Matrix Detail)
  const statusPerKompartemen = useMemo(() => {
    const map = new Map()
    terpilih.forEach((r) => {
      const unit = r.namaKompartemenAsal || 'Kompartemen Lainnya'
      if (!map.has(unit)) map.set(unit, { unit, total: 0, dikirim: 0, verifikator: 0, disetujui: 0, revisi: 0, ditolak: 0 })
      const u = map.get(unit)
      u.total += 1
      const st = r.status ?? ''
      if (st === 'Dikirim') u.dikirim += 1
      else if (st === 'Disetujui Verifikator') u.verifikator += 1
      else if (st.includes('Disetujui') || st === 'Siap Risalah') u.disetujui += 1
      else if (st.includes('Revisi')) u.revisi += 1
      else if (st.includes('Ditolak')) u.ditolak += 1
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [terpilih])

  const statusPerDepartemen = useMemo(() => {
    const map = new Map()
    terpilih.forEach((r) => {
      const unit = r.namaDepartemenAsal || 'Departemen Lainnya'
      if (!map.has(unit)) map.set(unit, { unit, total: 0, dikirim: 0, verifikator: 0, disetujui: 0, revisi: 0, ditolak: 0 })
      const u = map.get(unit)
      u.total += 1
      const st = r.status ?? ''
      if (st === 'Dikirim') u.dikirim += 1
      else if (st === 'Disetujui Verifikator') u.verifikator += 1
      else if (st.includes('Disetujui') || st === 'Siap Risalah') u.disetujui += 1
      else if (st.includes('Revisi')) u.revisi += 1
      else if (st.includes('Ditolak')) u.ditolak += 1
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [terpilih])

  function unduh() {
    unduhCsv(`grafik-statistik-inovasi-${tahun || 'semua'}`,
      ['Kelompok', 'Label', 'Jumlah'],
      [
        ...perBulan.map((x) => ['Per Bulan', x.label, x.nilai]),
        ...perStatus.map((x) => ['Per Status', x.label, x.nilai]),
        ...perMetodologi.map((x) => ['Per Metodologi', x.label, x.nilai]),
        ...perKompartemen.map((x) => ['Per Kompartemen', x.label, x.nilai]),
        ...perDepartemen.map((x) => ['Per Departemen', x.label, x.nilai]),
      ])
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Grafik & Statistik Inovasi</h2>
      <p className="inv__subtitle">Sebaran usulan inovasi per bulan, status, metodologi, kompartemen, dan departemen.</p>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__filters">
          <select className="inv__select" value={tahun ?? ''} onChange={(e) => setTahun(e.target.value)}>
            <option value="">Semua Tahun</option>
            {tahunOpsi.map((t) => <option key={t} value={t}>Tahun {t}</option>)}
          </select>
          <select className="inv__select" value={metodologi} onChange={(e) => setMetodologi(e.target.value)}>
            <option value="">Semua Metodologi</option>
            {METODOLOGI.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button type="button" className="inv__btn inv__btn--soft" onClick={unduh} disabled={terpilih.length === 0}>
          <Download size={15} /> Download CSV
        </button>
      </div>

      {terpilih.length === 0
        ? <div className="inv__banner inv__banner--info">Belum ada data inovasi pada filter ini.</div>
        : (
          <>
            {/* Tren Bulanan */}
            <div className="inv__chart-card">
              <h3 className="inv__chart-title">Jumlah Inovasi per Bulan{tahun ? ` - ${tahun}` : ''}</h3>
              <BatangVertikal data={perBulan} />
            </div>

            {/* Status & Metodologi */}
            <div className="inv__chart-row">
              <div className="inv__chart-card">
                <h3 className="inv__chart-title">Sebaran Status Inovasi</h3>
                <BatangHorizontal data={perStatus} />
              </div>
              <div className="inv__chart-card">
                <h3 className="inv__chart-title">Sebaran Metodologi</h3>
                <BatangHorizontal data={perMetodologi} />
              </div>
            </div>

            {/* Inovasi per Kompartemen & Departemen */}
            <div className="inv__chart-row" style={{ marginTop: 20 }}>
              <div className="inv__chart-card">
                <h3 className="inv__chart-title">Jumlah Inovasi per Kompartemen</h3>
                <BatangHorizontal data={perKompartemen} />
              </div>
              <div className="inv__chart-card">
                <h3 className="inv__chart-title">Jumlah Inovasi per Departemen</h3>
                <BatangHorizontal data={perDepartemen} />
              </div>
            </div>

            {/* Rincian Status per Unit (Kompartemen & Departemen) */}
            <div className="inv__card" style={{ marginTop: 24 }}>
              <div className="inv__section-head" style={{ justifyContent: 'space-between' }}>
                <div>
                  <span className="inv__section-tag">Status Inovasi per Unit</span>
                  <h3 style={{ marginTop: 4 }}>Rincian Status Pengajuan di Tiap Unit Kerja</h3>
                </div>
                <div className="inv__steps" style={{ marginBottom: 0 }}>
                  <button type="button" className={`inv__step${unitTab === 'kompartemen' ? ' inv__step--active' : ''}`} onClick={() => setUnitTab('kompartemen')}>
                    Kompartemen
                  </button>
                  <button type="button" className={`inv__step${unitTab === 'departemen' ? ' inv__step--active' : ''}`} onClick={() => setUnitTab('departemen')}>
                    Departemen
                  </button>
                </div>
              </div>

              <div className="inv__table-wrap">
                <table className="inv__table">
                  <thead>
                    <tr>
                      <th>Nama Unit Kerja</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Total</th>
                      <th style={{ width: 110, textAlign: 'center' }}>Dikirim</th>
                      <th style={{ width: 140, textAlign: 'center' }}>Verifikasi Mgr</th>
                      <th style={{ width: 130, textAlign: 'center' }}>Disetujui GM</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Revisi</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Ditolak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(unitTab === 'kompartemen' ? statusPerKompartemen : statusPerDepartemen).map((u) => (
                      <tr key={u.unit}>
                        <td style={{ fontWeight: 600 }}>{u.unit}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{u.total}</td>
                        <td style={{ textAlign: 'center', color: '#1f4f2c', fontWeight: 700 }}>{u.dikirim}</td>
                        <td style={{ textAlign: 'center', color: '#2563eb', fontWeight: 700 }}>{u.verifikator}</td>
                        <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{u.disetujui}</td>
                        <td style={{ textAlign: 'center', color: '#d97706', fontWeight: 700 }}>{u.revisi}</td>
                        <td style={{ textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>{u.ditolak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </div>
  )
}

