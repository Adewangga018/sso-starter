import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Layers,
  Map,
  Medal,
  MessageSquarePlus,
  PieChart,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import './inovasi.css'

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HIJAU = '#1f6b39'

// Beranda My Innovation. Tampilan menyesuaikan peran:
//  - Karyawan   : ringkasan gagasan & risalah miliknya + aksi Sumbang Gagasan.
//  - Manager/GM : grafik statistik lengkap jumlah inovasi di tiap Kompartemen & Departemen,
//                 sebaran status inovasi per unit, metodologi, dan tren bulanan.
export default function InovasiBeranda() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const peran = ctx.peran ?? 'Karyawan'
  const isApprover = ctx.isApprover === true
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [gagasan, setGagasan] = useState(null)
  const [err, setErr] = useState('')
  const [unitTab, setUnitTab] = useState('kompartemen') // 'kompartemen' | 'departemen'

  useEffect(() => {
    let live = true
    api.listInovasi()
      .then((d) => live && setRows(d.items))
      .catch((e) => { if (live) { if (isEmptyDataError(e)) setRows([]); else setErr(e instanceof ApiError ? e.message : 'Gagal memuat data risalah.') } })
    api.listGagasan()
      .then((d) => live && setGagasan(d.items))
      .catch((e) => { if (live && isEmptyDataError(e)) setGagasan([]) })
    return () => { live = false }
  }, [])

  const stats = useMemo(() => {
    const list = rows ?? []
    const gList = gagasan ?? []
    const byRisalah = (...s) => list.filter((r) => s.includes(r.status)).length

    // Gagasan yang menunggu giliran tindakan approver ini.
    const pending = peran === 'Manager'
      ? gList.filter((g) => g.status === 'Dikirim').length
      : peran === 'GM'
        ? gList.filter((g) => g.status === 'Disetujui Verifikator' || g.status === 'Disetujui GM Kompartemen Asal').length
        : 0

    // Hitung Sebaran Metodologi
    const countGio = list.filter((r) => r.jenis === 'GIO').length + gList.filter((g) => g.metodologi === 'GIO' && !list.some((r) => r.idGagasan === g.id)).length
    const countSs = list.filter((r) => r.jenis === 'SS').length + gList.filter((g) => g.metodologi === 'SS' && !list.some((r) => r.idGagasan === g.id)).length
    const count5r = list.filter((r) => r.jenis === '5R').length + gList.filter((g) => g.metodologi === '5R' && !list.some((r) => r.idGagasan === g.id)).length
    const countBelum = gList.filter((g) => !g.metodologi && g.status !== 'Ditolak').length

    const totalMetodologi = Math.max(1, countGio + countSs + count5r + countBelum)

    // Hitung Sebaran Status Gagasan
    const statusGagasan = {
      dikirim: gList.filter((g) => g.status === 'Dikirim').length,
      verifikator: gList.filter((g) => g.status === 'Disetujui Verifikator').length,
      disetujui: gList.filter((g) => g.status === 'Disetujui' || g.status === 'Disetujui GM Kompartemen Asal' || g.status === 'Disetujui GM Kompartemen Tujuan').length,
      revisi: gList.filter((g) => (g.status ?? '').includes('Revisi')).length,
      ditolak: gList.filter((g) => (g.status ?? '').includes('Ditolak')).length,
    }

    // Tren Gagasan per Bulan (Tahun Berjalan)
    const currentYear = new Date().getFullYear()
    const nBulan = Array(12).fill(0)
    gList.forEach((g) => {
      const dt = new Date(g.createdAt)
      if (dt.getFullYear() === currentYear) {
        nBulan[dt.getMonth()] += 1
      }
    })
    const perBulan = BULAN.map((b, i) => ({ label: b, nilai: nBulan[i] }))

    // Jumlah Inovasi per Kompartemen
    const kompMap = new Map()
    gList.forEach((g) => {
      const k = g.namaKompartemenAsal || 'Kompartemen Lainnya'
      kompMap.set(k, (kompMap.get(k) ?? 0) + 1)
    })
    const perKompartemen = [...kompMap.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)
    const maksKomp = Math.max(1, ...perKompartemen.map((x) => x.nilai))

    // Jumlah Inovasi per Departemen
    const deptMap = new Map()
    gList.forEach((g) => {
      const d = g.namaDepartemenAsal || 'Departemen Lainnya'
      deptMap.set(d, (deptMap.get(d) ?? 0) + 1)
    })
    const perDepartemen = [...deptMap.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)
    const maksDept = Math.max(1, ...perDepartemen.map((x) => x.nilai))

    // Rincian Status per Kompartemen
    const statusKompMap = new Map()
    gList.forEach((g) => {
      const unit = g.namaKompartemenAsal || 'Kompartemen Lainnya'
      if (!statusKompMap.has(unit)) statusKompMap.set(unit, { unit, total: 0, dikirim: 0, verifikator: 0, disetujui: 0, revisi: 0, ditolak: 0 })
      const u = statusKompMap.get(unit)
      u.total += 1
      const st = g.status ?? ''
      if (st === 'Dikirim') u.dikirim += 1
      else if (st === 'Disetujui Verifikator') u.verifikator += 1
      else if (st.includes('Disetujui') || st === 'Siap Risalah') u.disetujui += 1
      else if (st.includes('Revisi')) u.revisi += 1
      else if (st.includes('Ditolak')) u.ditolak += 1
    })
    const statusPerKompartemen = [...statusKompMap.values()].sort((a, b) => b.total - a.total)

    // Rincian Status per Departemen
    const statusDeptMap = new Map()
    gList.forEach((g) => {
      const unit = g.namaDepartemenAsal || 'Departemen Lainnya'
      if (!statusDeptMap.has(unit)) statusDeptMap.set(unit, { unit, total: 0, dikirim: 0, verifikator: 0, disetujui: 0, revisi: 0, ditolak: 0 })
      const u = statusDeptMap.get(unit)
      u.total += 1
      const st = g.status ?? ''
      if (st === 'Dikirim') u.dikirim += 1
      else if (st === 'Disetujui Verifikator') u.verifikator += 1
      else if (st.includes('Disetujui') || st === 'Siap Risalah') u.disetujui += 1
      else if (st.includes('Revisi')) u.revisi += 1
      else if (st.includes('Ditolak')) u.ditolak += 1
    })
    const statusPerDepartemen = [...statusDeptMap.values()].sort((a, b) => b.total - a.total)

    return {
      totalRisalah: list.length,
      proses: byRisalah('Diajukan', 'Diverifikasi', 'Disetujui Verifikator'),
      disahkan: byRisalah('Divalidasi', 'Selesai'),
      gagasanSaya: gList.length,
      pending,
      metodologi: {
        gio: countGio,
        ss: countSs,
        r5: count5r,
        belum: countBelum,
        gioPct: Math.round((countGio / totalMetodologi) * 100),
        ssPct: Math.round((countSs / totalMetodologi) * 100),
        r5Pct: Math.round((count5r / totalMetodologi) * 100),
        belumPct: Math.round((countBelum / totalMetodologi) * 100),
      },
      statusGagasan,
      perBulan,
      perKompartemen,
      perDepartemen,
      maksKomp,
      maksDept,
      statusPerKompartemen,
      statusPerDepartemen,
    }
  }, [rows, gagasan, peran])

  return (
    <div className="inv">
      <h2 className="inv__title">Beranda My Innovation</h2>
      <p className="inv__subtitle">
        {isApprover
          ? `Ringkasan statistik data, persetujuan gagasan, dan pemantauan risalah di ${peran === 'GM' ? 'kompartemen' : 'departemen'} Anda.`
          : 'Ringkasan aktivitas inovasi Anda (Sistem Saran, GIO, dan 5R) pada periode berjalan.'}
      </p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      {isApprover ? (
        <>
          {/* Ringkasan Indikator Utama */}
          <div className="inv__stats">
            <div className="inv__stat">
              <div className="inv__stat-num" style={{ color: stats.pending > 0 ? '#b91c1c' : '#1f4f2c' }}>{stats.pending}</div>
              <div className="inv__stat-label">Gagasan Perlu Tindakan</div>
            </div>
            <div className="inv__stat">
              <div className="inv__stat-num">{stats.gagasanSaya}</div>
              <div className="inv__stat-label">Gagasan di Lingkup Anda</div>
            </div>
            <div className="inv__stat">
              <div className="inv__stat-num">{stats.totalRisalah}</div>
              <div className="inv__stat-label">Risalah di Lingkup Anda</div>
            </div>
            <div className="inv__stat">
              <div className="inv__stat-num">{stats.disahkan}</div>
              <div className="inv__stat-label">Risalah Disahkan / Selesai</div>
            </div>
          </div>

          {/* Aksi Cepat */}
          <div className="inv__card">
            <div className="inv__section-head"><span className="inv__section-tag">Aksi Cepat</span></div>
            <div className="inv__actions-bar" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="inv__btn inv__btn--primary" onClick={() => navigate(`${base}/gagasan`)}>
                {peran === 'Manager' ? <ClipboardCheck size={16} /> : <CheckSquare size={16} />}
                {peran === 'Manager' ? ' Verifikasi Gagasan' : ' Persetujuan Gagasan'}
                {stats.pending > 0 && (
                  <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.28)', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{stats.pending}</span>
                )}
              </button>
              <button type="button" className="inv__btn inv__btn--ghost" onClick={() => navigate(`${base}/daftar`)}>
                <ClipboardList size={16} /> Daftar Inovasi <ArrowRight size={14} />
              </button>
            </div>
            <p className="inv__hint" style={{ marginTop: 10, marginBottom: 0 }}>
              {peran === 'Manager'
                ? 'Sebagai Verifikator, Anda menilai gagasan yang diajukan bawahan: setujui untuk meneruskan ke GM Kompartemen, minta revisi, atau tolak. Risalah bawahan dapat Anda pantau di Daftar Inovasi.'
                : 'Sebagai GM Kompartemen, Anda menyetujui gagasan yang telah diverifikasi Manager dan menetapkan metodologinya (SS/GIO/5R). Risalah di kompartemen Anda dapat dipantau di Daftar Inovasi.'}
            </p>
          </div>

          {/* Stat Visual Section: Metodologi & Status */}
          <div className="inv__section-head" style={{ marginTop: 24, marginBottom: 12 }}>
            <span className="inv__section-tag">Statistik Data Inovasi</span>
            <h3>Ringkasan Metodologi & Status Pengajuan</h3>
          </div>

          <div className="inv__stat-grid">
            {/* Sebaran Metodologi */}
            <div className="inv__stat-card">
              <div className="inv__stat-card-title">
                <span>Sebaran Metodologi</span>
                <PieChart size={18} color="var(--inv-green)" />
              </div>
              <div className="inv__progress-group">
                <div className="inv__progress-item">
                  <div className="inv__progress-header">
                    <span>GIO (Gugus Inovasi Operasi)</span>
                    <span>{stats.metodologi.gio} ({stats.metodologi.gioPct}%)</span>
                  </div>
                  <div className="inv__progress-bar">
                    <div className="inv__progress-fill inv__progress-fill--gio" style={{ width: `${stats.metodologi.gioPct}%` }} />
                  </div>
                </div>
                <div className="inv__progress-item">
                  <div className="inv__progress-header">
                    <span>SS (Sistem Saran)</span>
                    <span>{stats.metodologi.ss} ({stats.metodologi.ssPct}%)</span>
                  </div>
                  <div className="inv__progress-bar">
                    <div className="inv__progress-fill inv__progress-fill--ss" style={{ width: `${stats.metodologi.ssPct}%` }} />
                  </div>
                </div>
                <div className="inv__progress-item">
                  <div className="inv__progress-header">
                    <span>5R (Ringkas, Rapi, Resik, Rawat, Rajin)</span>
                    <span>{stats.metodologi.r5} ({stats.metodologi.r5Pct}%)</span>
                  </div>
                  <div className="inv__progress-bar">
                    <div className="inv__progress-fill inv__progress-fill--5r" style={{ width: `${stats.metodologi.r5Pct}%` }} />
                  </div>
                </div>
                {stats.metodologi.belum > 0 && (
                  <div className="inv__progress-item">
                    <div className="inv__progress-header">
                      <span>Belum Ditetapkan GM</span>
                      <span>{stats.metodologi.belum} ({stats.metodologi.belumPct}%)</span>
                    </div>
                    <div className="inv__progress-bar">
                      <div className="inv__progress-fill inv__progress-fill--pending" style={{ width: `${stats.metodologi.belumPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sebaran Status Gagasan */}
            <div className="inv__stat-card">
              <div className="inv__stat-card-title">
                <span>Status Sumbang Gagasan</span>
                <Clock size={18} color="var(--inv-green)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '10px 12px', background: '#f8faf8', borderRadius: 8, border: '1px solid #eef2ef' }}>
                  <div style={{ fontSize: 11, color: '#6b7a6f', textTransform: 'uppercase', fontWeight: 700 }}>Menunggu Verifikasi</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1f4f2c', marginTop: 2 }}>{stats.statusGagasan.dikirim}</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#f8faf8', borderRadius: 8, border: '1px solid #eef2ef' }}>
                  <div style={{ fontSize: 11, color: '#6b7a6f', textTransform: 'uppercase', fontWeight: 700 }}>Diverifikasi Manager</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>{stats.statusGagasan.verifikator}</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#f8faf8', borderRadius: 8, border: '1px solid #eef2ef' }}>
                  <div style={{ fontSize: 11, color: '#6b7a6f', textTransform: 'uppercase', fontWeight: 700 }}>Disetujui GM</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>{stats.statusGagasan.disetujui}</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#f8faf8', borderRadius: 8, border: '1px solid #eef2ef' }}>
                  <div style={{ fontSize: 11, color: '#6b7a6f', textTransform: 'uppercase', fontWeight: 700 }}>Revisi / Ditolak</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706', marginTop: 2 }}>{stats.statusGagasan.revisi + stats.statusGagasan.ditolak}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grafik Jumlah Inovasi per Kompartemen & Departemen */}
          <div className="inv__section-head" style={{ marginTop: 24, marginBottom: 12 }}>
            <span className="inv__section-tag">Statistik Unit Kerja</span>
            <h3>Grafik Jumlah Inovasi per Kompartemen & Departemen</h3>
          </div>

          <div className="inv__stat-grid">
            {/* Diagram Jumlah Inovasi per Kompartemen */}
            <div className="inv__stat-card">
              <div className="inv__stat-card-title">
                <span>Jumlah Inovasi per Kompartemen</span>
                <Building2 size={18} color="var(--inv-green)" />
              </div>
              <div className="inv__progress-group">
                {stats.perKompartemen.length === 0 ? (
                  <p className="inv__hint" style={{ margin: 0 }}>Belum ada data kompartemen.</p>
                ) : (
                  stats.perKompartemen.map((k) => {
                    const pct = Math.round((k.nilai / stats.maksKomp) * 100)
                    return (
                      <div key={k.label} className="inv__progress-item">
                        <div className="inv__progress-header">
                          <span>{k.label}</span>
                          <span>{k.nilai} Inovasi</span>
                        </div>
                        <div className="inv__progress-bar">
                          <div className="inv__progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Diagram Jumlah Inovasi per Departemen */}
            <div className="inv__stat-card">
              <div className="inv__stat-card-title">
                <span>Jumlah Inovasi per Departemen</span>
                <Building2 size={18} color="var(--inv-green)" />
              </div>
              <div className="inv__progress-group">
                {stats.perDepartemen.length === 0 ? (
                  <p className="inv__hint" style={{ margin: 0 }}>Belum ada data departemen.</p>
                ) : (
                  stats.perDepartemen.map((d) => {
                    const pct = Math.round((d.nilai / stats.maksDept) * 100)
                    return (
                      <div key={d.label} className="inv__progress-item">
                        <div className="inv__progress-header">
                          <span>{d.label}</span>
                          <span>{d.nilai} Inovasi</span>
                        </div>
                        <div className="inv__progress-bar">
                          <div className="inv__progress-fill inv__progress-fill--ss" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Tabel Rincian Status Inovasi per Unit Kerja */}
          <div className="inv__card" style={{ marginTop: 24 }}>
            <div className="inv__section-head" style={{ justifyContent: 'space-between' }}>
              <div>
                <span className="inv__section-tag">Matriks Status Inovasi</span>
                <h3 style={{ marginTop: 4 }}>Status Inovasi di Tiap Kompartemen & Departemen</h3>
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
                  {(unitTab === 'kompartemen' ? stats.statusPerKompartemen : stats.statusPerDepartemen).length === 0 ? (
                    <tr><td colSpan={7} className="inv__no-data">Belum ada data unit kerja.</td></tr>
                  ) : (
                    (unitTab === 'kompartemen' ? stats.statusPerKompartemen : stats.statusPerDepartemen).map((u) => (
                      <tr key={u.unit}>
                        <td style={{ fontWeight: 600 }}>{u.unit}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{u.total}</td>
                        <td style={{ textAlign: 'center', color: '#1f4f2c', fontWeight: 700 }}>{u.dikirim}</td>
                        <td style={{ textAlign: 'center', color: '#2563eb', fontWeight: 700 }}>{u.verifikator}</td>
                        <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{u.disetujui}</td>
                        <td style={{ textAlign: 'center', color: '#d97706', fontWeight: 700 }}>{u.revisi}</td>
                        <td style={{ textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>{u.ditolak}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart Tren Pengajuan per Bulan */}
          <div className="inv__card" style={{ marginTop: 24 }}>
            <div className="inv__section-head">
              <span className="inv__section-tag">Grafik Activity</span>
              <h3>Tren Pengajuan Inovasi Bulan Per Bulan ({new Date().getFullYear()})</h3>
            </div>
            <BatangVertikalMini data={stats.perBulan} />
          </div>

          {/* Pintasan Rekap & Laporan */}
          <div className="inv__section-head" style={{ marginTop: 24, marginBottom: 12 }}>
            <span className="inv__section-tag">Menu Rekap Data</span>
            <h3>Laporan & Grafik Detail Inovasi</h3>
          </div>

          <div className="inv__stat-shortcuts">
            <div className="inv__shortcut-card" onClick={() => navigate(`${base}/rekap/grafik-gagasan`)}>
              <div className="inv__shortcut-icon"><BarChart3 size={20} /></div>
              <div className="inv__shortcut-info">
                <h4>Grafik & Statistik Inovasi</h4>
                <p>Visualisasi sebaran Kompartemen, Departemen & status</p>
              </div>
            </div>
            <div className="inv__shortcut-card" onClick={() => navigate(`${base}/rekap/metodologi`)}>
              <div className="inv__shortcut-icon"><Layers size={20} /></div>
              <div className="inv__shortcut-info">
                <h4>Inovasi Per Metodologi</h4>
                <p>Rekap pengesahan PLAN & Akhir SS/GIO/5R</p>
              </div>
            </div>
            <div className="inv__shortcut-card" onClick={() => navigate(`${base}/rekap/ranking`)}>
              <div className="inv__shortcut-icon"><Medal size={20} /></div>
              <div className="inv__shortcut-info">
                <h4>Ranking Inovasi</h4>
                <p>Peringkat partisipasi pegawai & Ketua gugus</p>
              </div>
            </div>
            <div className="inv__shortcut-card" onClick={() => navigate(`${base}/roadmap`)}>
              <div className="inv__shortcut-icon"><Map size={20} /></div>
              <div className="inv__shortcut-info">
                <h4>Roadmap Inovasi</h4>
                <p>Peta jalan risalah, nilai akhir & penghargaan</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="inv__stats">
            <div className="inv__stat"><div className="inv__stat-num">{stats.gagasanSaya}</div><div className="inv__stat-label">Sumbang Gagasan Saya</div></div>
            <div className="inv__stat"><div className="inv__stat-num">{stats.totalRisalah}</div><div className="inv__stat-label">Total Risalah Inovasi</div></div>
            <div className="inv__stat"><div className="inv__stat-num">{stats.proses}</div><div className="inv__stat-label">Proses Pengesahan</div></div>
            <div className="inv__stat"><div className="inv__stat-num">{stats.disahkan}</div><div className="inv__stat-label">Disahkan / Selesai</div></div>
          </div>

          <div className="inv__card">
            <div className="inv__section-head"><span className="inv__section-tag">Aksi Cepat</span></div>
            <div className="inv__actions-bar" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="inv__btn inv__btn--primary" onClick={() => navigate(`${base}/gagasan`)}>
                <MessageSquarePlus size={16} /> Sumbang Gagasan
              </button>
              <button type="button" className="inv__btn inv__btn--ghost" onClick={() => navigate(`${base}/daftar`)}>
                <ClipboardList size={16} /> Daftar Inovasi <ArrowRight size={14} />
              </button>
            </div>
            <p className="inv__hint" style={{ marginTop: 10, marginBottom: 0 }}>
              Alur: kirim Sumbang Gagasan (latar belakang, masalah, solusi) &rarr; diverifikasi Manager &rarr; disetujui GM
              Kompartemen yang menetapkan metodologi (SS/GIO/5R) &rarr; Anda (Ketua) daftarkan menjadi risalah dan isi anggota.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function batangTegak(x, y, w, h, r = 4) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} a${rr},${rr} 0 0 1 ${rr},-${rr} h${w - rr * 2} a${rr},${rr} 0 0 1 ${rr},${rr} V${y + h} Z`
}

function BatangVertikalMini({ data }) {
  const W = 760, H = 200, L = 34, R = 10, T = 22, B = 30
  const plotW = W - L - R, plotH = H - T - B
  const maks = Math.max(1, ...data.map((d) => d.nilai))
  const step = plotW / data.length
  const bw = Math.max(10, step - 14)
  const garis = [0, 0.5, 1].map((f) => Math.round(maks * f))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagram batang tren bulanan inovasi" style={{ display: 'block' }}>
      {[...new Set(garis)].map((v) => {
        const y = T + plotH - (v / maks) * plotH
        return (
          <g key={v}>
            <line x1={L} y1={y} x2={W - R} y2={y} stroke="#e6ece7" strokeWidth={1} />
            <text x={L - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="#8a978c">{v}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const h = (d.nilai / maks) * plotH
        const x = L + step * i + (step - bw) / 2
        const y = T + plotH - h
        return (
          <g key={d.label}>
            {d.nilai > 0 && (
              <>
                <path d={batangTegak(x, y, bw, h)} fill={HIJAU} />
                <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#2c3a30">{d.nilai}</text>
              </>
            )}
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize={10.5} fill="#5c6b60">{d.label}</text>
            <title>{`${d.label}: ${d.nilai} inovasi`}</title>
          </g>
        )
      })}
      <line x1={L} y1={T + plotH} x2={W - R} y2={T + plotH} stroke="#c8d3ca" strokeWidth={1} />
    </svg>
  )
}
