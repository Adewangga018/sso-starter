import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { jenisLabel, statusClass } from './statusClass'
import { METODOLOGI, cocokCari } from './rekapUtils'
import { BatangHorizontal } from './InvCharts'
import './inovasi.css'

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

function matchPeriode(createdAt, targetTahun, targetBulan) {
  if (!targetTahun && !targetBulan) return true
  if (!createdAt) return false
  const d = new Date(createdAt)
  if (isNaN(d.getTime())) return false

  if (targetTahun && String(d.getFullYear()) !== String(targetTahun)) {
    return false
  }
  if (targetBulan && String(d.getMonth() + 1) !== String(targetBulan)) {
    return false
  }
  return true
}

// Ringkasan Seluruh Perusahaan - menu tambahan khusus Kepala Bagian
// Sekretariat/Umum & Kepala Bagian Administrasi/Pengembangan SDM dan Inovasi
// (id_jabatan 38/39, lihat OrgResolver.IsGlobalInovasiViewerAsync). Berbeda
// dari peran GM/Manager yang cakupannya terbatas kompartemen/departemen
// sendiri, halaman ini lintas SELURUH kompartemen & departemen dan bersifat
// read-only (tanpa aksi buat/hapus/approve).
export default function InovasiGlobalOverview() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()

  const [gagasan, setGagasan] = useState(null)
  const [inovasi, setInovasi] = useState(null)
  const [err, setErr] = useState('')

  // Filter Bulan, Tahun, Departemen & Kompartemen berlaku global (statistik, grafik, dan
  // kedua tabel di bawah mengikutinya), di luar filter status/metodologi/pencarian
  // yang sudah ada per tabel.
  const [filterBulan, setFilterBulan] = useState('')
  const [filterTahun, setFilterTahun] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterKomp, setFilterKomp] = useState('')
  const [searchGagasan, setSearchGagasan] = useState('')
  const [statusGagasan, setStatusGagasan] = useState('')
  const [metodologi, setMetodologi] = useState('')
  const [searchInovasi, setSearchInovasi] = useState('')
  const [statusInovasi, setStatusInovasi] = useState('')

  useEffect(() => {
    Promise.all([api.listGagasanGlobal(), api.listInovasiGlobal()])
      .then(([g, i]) => { setGagasan(g.items); setInovasi(i.items) })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) {
          setErr('Menu ini khusus Kepala Bagian Sekretariat/Umum & Kepala Bagian Administrasi/Pengembangan SDM dan Inovasi.')
        } else {
          setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.')
        }
        setGagasan([]); setInovasi([])
      })
  }, [])

  const tahunOpsi = useMemo(() => {
    const years = new Set()
    const currentYear = new Date().getFullYear()
    years.add(currentYear)

    const parseYear = (createdAt) => {
      if (!createdAt) return
      const d = new Date(createdAt)
      if (!isNaN(d.getTime())) years.add(d.getFullYear())
    }

    ;(gagasan ?? []).forEach((r) => parseYear(r.createdAt))
    ;(inovasi ?? []).forEach((r) => parseYear(r.createdAt))

    return [...years].sort((a, b) => b - a)
  }, [gagasan, inovasi])

  const departemenSet = useMemo(() => {
    const s = new Set()
    ;(gagasan ?? []).forEach((r) => { if (r.namaDepartemenAsal) s.add(r.namaDepartemenAsal) })
    ;(inovasi ?? []).forEach((r) => { if (r.namaDepartemen) s.add(r.namaDepartemen) })
    return s
  }, [gagasan, inovasi])

  const kompartemenSet = useMemo(() => {
    const s = new Set()
    ;(gagasan ?? []).forEach((r) => { if (r.namaKompartemenAsal) s.add(r.namaKompartemenAsal) })
    ;(inovasi ?? []).forEach((r) => { if (r.namaKompartemen) s.add(r.namaKompartemen) })
    return s
  }, [gagasan, inovasi])

  const departemenOpsi = useMemo(() => [...departemenSet].sort((a, b) => a.localeCompare(b)), [departemenSet])
  const kompartemenOpsi = useMemo(() => [...kompartemenSet].sort((a, b) => a.localeCompare(b)), [kompartemenSet])

  const statusGagasanOpsi = useMemo(() => [...new Set((gagasan ?? []).map((r) => r.status).filter(Boolean))].sort(), [gagasan])
  const statusInovasiOpsi = useMemo(() => [...new Set((inovasi ?? []).map((r) => r.status).filter(Boolean))].sort(), [inovasi])

  // Filter Bulan/Tahun/Departemen/Kompartemen diterapkan lebih dulu - statistik, grafik,
  // dan kedua tabel di bawah semuanya menurunkan dari sini.
  const gagasanCakupan = useMemo(() => (gagasan ?? []).filter((r) =>
    (!filterDept || r.namaDepartemenAsal === filterDept) &&
    (!filterKomp || r.namaKompartemenAsal === filterKomp) &&
    matchPeriode(r.createdAt, filterTahun, filterBulan)
  ), [gagasan, filterDept, filterKomp, filterTahun, filterBulan])

  const inovasiCakupan = useMemo(() => (inovasi ?? []).filter((r) =>
    (!filterDept || r.namaDepartemen === filterDept) &&
    (!filterKomp || r.namaKompartemen === filterKomp) &&
    matchPeriode(r.createdAt, filterTahun, filterBulan)
  ), [inovasi, filterDept, filterKomp, filterTahun, filterBulan])

  const perMetodologi = useMemo(() => {
    const dasar = inovasiCakupan.filter((r) => (!statusInovasi || r.status === statusInovasi) && cocokCari(r, ['noRegistrasi', 'namaGugus', 'judul', 'ketuaNama', 'namaDepartemen', 'namaKompartemen'], searchInovasi))
    return METODOLOGI.map((m) => ({ m, n: dasar.filter((r) => r.jenis === m).length }))
  }, [inovasiCakupan, statusInovasi, searchInovasi])

  const filteredGagasan = useMemo(() => gagasanCakupan.filter((r) =>
    (!statusGagasan || r.status === statusGagasan) &&
    cocokCari(r, ['noRegistrasi', 'judul', 'status', 'namaDepartemenAsal', 'namaDepartemenTujuan', 'namaKompartemenAsal', 'namaKompartemenTujuan', 'metodologi', 'createdByNama', 'createdByNik'], searchGagasan)
  ), [gagasanCakupan, statusGagasan, searchGagasan])

  const filteredInovasi = useMemo(() => inovasiCakupan.filter((r) =>
    (!statusInovasi || r.status === statusInovasi) &&
    (!metodologi || r.jenis === metodologi) &&
    cocokCari(r, ['noRegistrasi', 'namaGugus', 'judul', 'ketuaNama', 'namaDepartemen', 'namaKompartemen'], searchInovasi)
  ), [inovasiCakupan, statusInovasi, metodologi, searchInovasi])

  // Grafik statistik: sebaran gagasan & inovasi (pada cakupan filter aktif) per
  // Departemen & Kompartemen.
  function sebaranPer(rows, kolom) {
    const map = new Map()
    rows.forEach((r) => {
      const v = r[kolom] || 'Lainnya'
      map.set(v, (map.get(v) ?? 0) + 1)
    })
    return [...map.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)
  }
  const gagasanPerDept = useMemo(() => sebaranPer(filteredGagasan, 'namaDepartemenAsal'), [filteredGagasan])
  const gagasanPerKomp = useMemo(() => sebaranPer(filteredGagasan, 'namaKompartemenAsal'), [filteredGagasan])
  const inovasiPerDept = useMemo(() => sebaranPer(filteredInovasi, 'namaDepartemen'), [filteredInovasi])
  const inovasiPerKomp = useMemo(() => sebaranPer(filteredInovasi, 'namaKompartemen'), [filteredInovasi])

  // Cakupan terlibat mengikuti filter Departemen/Kompartemen aktif (bukan total
  // keseluruhan) supaya stat tile konsisten dengan grafik & tabel di bawahnya.
  const deptTerlibat = useMemo(() => {
    const s = new Set()
    gagasanCakupan.forEach((r) => { if (r.namaDepartemenAsal) s.add(r.namaDepartemenAsal) })
    inovasiCakupan.forEach((r) => { if (r.namaDepartemen) s.add(r.namaDepartemen) })
    return s.size
  }, [gagasanCakupan, inovasiCakupan])
  const kompTerlibat = useMemo(() => {
    const s = new Set()
    gagasanCakupan.forEach((r) => { if (r.namaKompartemenAsal) s.add(r.namaKompartemenAsal) })
    inovasiCakupan.forEach((r) => { if (r.namaKompartemen) s.add(r.namaKompartemen) })
    return s.size
  }, [gagasanCakupan, inovasiCakupan])

  const memuat = gagasan === null || inovasi === null

  return (
    <div className="inv">
      <h2 className="inv__title">Ringkasan Seluruh Perusahaan</h2>
      <p className="inv__subtitle">
        Seluruh Sumbang Gagasan &amp; Inovasi lintas kompartemen dan departemen - bukan hanya cakupan departemen/kompartemen Anda sendiri. Tampilan ini read-only.
      </p>
      {err && <div className="inv__banner inv__banner--err">{err}</div>}
      {memuat && !err && <p className="inv__subtitle">Memuat data...</p>}

      {!memuat && (
        <>
          <div className="inv__toolbar">
            <div className="inv__filters">
              <select className="inv__select" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
                <option value="">Semua Bulan</option>
                {NAMA_BULAN.map((b, i) => <option key={b} value={String(i + 1)}>{b}</option>)}
              </select>
              <select className="inv__select" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}>
                <option value="">Semua Tahun</option>
                {tahunOpsi.map((t) => <option key={t} value={String(t)}>Tahun {t}</option>)}
              </select>
              <select className="inv__select" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="">Semua Departemen</option>
                {departemenOpsi.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="inv__select" value={filterKomp} onChange={(e) => setFilterKomp(e.target.value)}>
                <option value="">Semua Kompartemen</option>
                {kompartemenOpsi.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div className="inv__stats">
            <div className="inv__stat">
              <div className="inv__stat-num">{gagasanCakupan.length}</div>
              <div className="inv__stat-label">Total Sumbang Gagasan</div>
            </div>
            <div className="inv__stat">
              <div className="inv__stat-num">{inovasiCakupan.length}</div>
              <div className="inv__stat-label">Total Inovasi Terdaftar</div>
            </div>
            <div className="inv__stat">
              <div className="inv__stat-num">{deptTerlibat}</div>
              <div className="inv__stat-label">Departemen Terlibat</div>
            </div>
            <div className="inv__stat">
              <div className="inv__stat-num">{kompTerlibat}</div>
              <div className="inv__stat-label">Kompartemen Terlibat</div>
            </div>
          </div>

          <div className="inv__stats">
            <button type="button" className={`inv__stat inv__stat--btn${metodologi === '' ? ' inv__stat--on' : ''}`} onClick={() => setMetodologi('')}>
              <div className="inv__stat-num">{perMetodologi.reduce((a, x) => a + x.n, 0)}</div>
              <div className="inv__stat-label">Semua Metodologi</div>
            </button>
            {perMetodologi.map(({ m, n }) => (
              <button key={m} type="button" className={`inv__stat inv__stat--btn${metodologi === m ? ' inv__stat--on' : ''}`} onClick={() => setMetodologi(m)}>
                <div className="inv__stat-num">{n}</div>
                <div className="inv__stat-label">{m} - {jenisLabel(m)}</div>
              </button>
            ))}
          </div>

          <h3 className="inv__title" style={{ fontSize: '1.05rem', marginTop: 24 }}>Grafik Statistik</h3>
          <div className="inv__chart-row">
            <div className="inv__chart-card">
              <h3 className="inv__chart-title">Sumbang Gagasan per Departemen</h3>
              {gagasanPerDept.length === 0
                ? <p className="inv__subtitle">Belum ada data pada filter ini.</p>
                : <BatangHorizontal data={gagasanPerDept} />}
            </div>
            <div className="inv__chart-card">
              <h3 className="inv__chart-title">Sumbang Gagasan per Kompartemen</h3>
              {gagasanPerKomp.length === 0
                ? <p className="inv__subtitle">Belum ada data pada filter ini.</p>
                : <BatangHorizontal data={gagasanPerKomp} />}
            </div>
          </div>
          <div className="inv__chart-row" style={{ marginTop: 20 }}>
            <div className="inv__chart-card">
              <h3 className="inv__chart-title">Inovasi per Departemen</h3>
              {inovasiPerDept.length === 0
                ? <p className="inv__subtitle">Belum ada data pada filter ini.</p>
                : <BatangHorizontal data={inovasiPerDept} />}
            </div>
            <div className="inv__chart-card">
              <h3 className="inv__chart-title">Inovasi per Kompartemen</h3>
              {inovasiPerKomp.length === 0
                ? <p className="inv__subtitle">Belum ada data pada filter ini.</p>
                : <BatangHorizontal data={inovasiPerKomp} />}
            </div>
          </div>

          <h3 className="inv__title" style={{ fontSize: '1.05rem', marginTop: 24 }}>Sumbang Gagasan</h3>
          <div className="inv__toolbar">
            <div className="inv__filters">
              <div className="inv__search">
                <span className="inv__search-icon"><Search size={16} /></span>
                <input value={searchGagasan} onChange={(e) => setSearchGagasan(e.target.value)} placeholder="Cari no. registrasi, judul, departemen, pengaju..." />
              </div>
              <select className="inv__select" value={statusGagasan} onChange={(e) => setStatusGagasan(e.target.value)}>
                <option value="">Semua Status</option>
                {statusGagasanOpsi.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="inv__table-wrap inv__table-wrap--cards">
            <table className="inv__table">
              <thead>
                <tr>
                  <th>Status</th><th>No. Registrasi</th><th>Judul</th><th>Departemen Asal</th>
                  <th>Kompartemen Asal</th><th>Pengaju</th>
                </tr>
              </thead>
              <tbody>
                {filteredGagasan.length === 0 && (
                  <tr><td className="inv__no-data" colSpan={6}>Belum ada gagasan pada filter ini.</td></tr>
                )}
                {filteredGagasan.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Status"><span className={`inv__status ${statusClass(r.status)}`}>{r.status}</span></td>
                    <td data-label="No. Registrasi">{r.noRegistrasi ?? '-'}</td>
                    <td data-label="Judul" className="inv__cell--wide">{r.judul}</td>
                    <td data-label="Departemen Asal">{r.namaDepartemenAsal ?? '-'}</td>
                    <td data-label="Kompartemen Asal">{r.namaKompartemenAsal ?? '-'}</td>
                    <td data-label="Pengaju" className="u-nama">{r.createdByNama ?? r.createdByNik ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="inv__title" style={{ fontSize: '1.05rem', marginTop: 24 }}>Daftar Inovasi</h3>
          <div className="inv__toolbar">
            <div className="inv__filters">
              <div className="inv__search">
                <span className="inv__search-icon"><Search size={16} /></span>
                <input value={searchInovasi} onChange={(e) => setSearchInovasi(e.target.value)} placeholder="Cari no. registrasi, nama gugus, judul, ketua..." />
              </div>
              <select className="inv__select" value={statusInovasi} onChange={(e) => setStatusInovasi(e.target.value)}>
                <option value="">Semua Status</option>
                {statusInovasiOpsi.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="inv__table-wrap inv__table-wrap--cards">
            <table className="inv__table">
              <thead>
                <tr>
                  <th>Status</th><th>No. Registrasi</th><th>Metodologi</th><th>Nama Gugus</th>
                  <th>Judul</th><th>Departemen</th><th>Ketua</th>
                </tr>
              </thead>
              <tbody>
                {filteredInovasi.length === 0 && (
                  <tr><td className="inv__no-data" colSpan={7}>Belum ada inovasi pada filter ini.</td></tr>
                )}
                {filteredInovasi.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/daftar/${r.id}`)}>
                    <td data-label="Status"><span className={`inv__status ${statusClass(r.status)}`}>{r.status}</span></td>
                    <td data-label="No. Registrasi">{r.noRegistrasi ?? '-'}</td>
                    <td data-label="Metodologi" style={{ textAlign: 'center', fontWeight: 700 }}>{r.jenis}</td>
                    <td data-label="Nama Gugus">{r.namaGugus ?? '-'}</td>
                    <td data-label="Judul" className="inv__cell--wide">{r.judul ?? '-'}</td>
                    <td data-label="Departemen">{r.namaDepartemen ?? r.namaKompartemen ?? '-'}</td>
                    <td data-label="Ketua" className="u-nama">{r.ketuaNama ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
