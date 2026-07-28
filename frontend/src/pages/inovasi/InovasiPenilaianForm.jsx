import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Save } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { jenisLabel } from './statusClass'
import './inovasi.css'

const TAHAP = ['PLAN', 'DO', 'CHECK', 'ACTION', 'MAKALAH', 'PRESENTATION']

function kategori(n) {
  if (n >= 94) return 'Excellent / Platinum'
  if (n >= 87) return 'Very Good / Gold'
  if (n >= 79) return 'Good / Silver'
  if (n >= 61) return 'Fair / Bronze'
  return 'Partisipatif'
}

export default function InovasiPenilaianForm() {
  const { penugasanId } = useParams()
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()

  const [detail, setDetail] = useState(null)
  const [scores, setScores] = useState({})   // idKriteria -> { nilai, catatan }
  const [tahap, setTahap] = useState('PLAN')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const d = await api.getPenilaian(penugasanId)
      setDetail(d)
      const init = {}
      for (const s of d.skorSaya ?? []) init[s.idKriteria] = { nilai: String(s.nilai), catatan: s.catatan ?? '' }
      setScores(init)
      setErr('')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Gagal memuat penilaian.')
    }
  }
  useEffect(() => { load() }, [penugasanId])

  const kriteria = detail?.kriteria ?? []
  const bisaNilai = detail?.bisaNilai === true

  const byTahap = useMemo(() => {
    const m = {}
    for (const k of kriteria) (m[k.tahap] ??= []).push(k)
    return m
  }, [kriteria])

  const tahapAda = TAHAP.filter((t) => (byTahap[t]?.length ?? 0) > 0)

  // Total tertimbang saya (live): SUM(nilai/10 * bobot).
  const totalSaya = useMemo(() => {
    let t = 0
    for (const k of kriteria) {
      const v = Number(scores[k.id]?.nilai)
      if (v >= 1 && v <= 10) t += (v / 10) * Number(k.bobotPersen)
    }
    return Math.round(t * 100) / 100
  }, [kriteria, scores])

  const terisiSaya = kriteria.filter((k) => { const v = Number(scores[k.id]?.nilai); return v >= 1 && v <= 10 }).length

  function setNilai(id, nilai) {
    if (nilai !== '') {
      const n = Number(nilai)
      if (Number.isNaN(n)) return
      if (n < 1) nilai = '1'
      else if (n > 10) nilai = '10'
      else nilai = String(Math.floor(n))
    }
    setScores((s) => ({ ...s, [id]: { ...s[id], nilai } }))
  }
  function setCatatan(id, catatan) {
    setScores((s) => ({ ...s, [id]: { ...s[id], catatan } }))
  }

  async function save() {
    const skor = kriteria
      .map((k) => ({ idKriteria: k.id, nilai: Number(scores[k.id]?.nilai), catatan: scores[k.id]?.catatan || null }))
      .filter((x) => x.nilai >= 1 && x.nilai <= 10)
    setSaving(true)
    setMsg(null)
    try {
      const hasil = await api.savePenilaianSkor(penugasanId, { skor })
      setDetail((d) => ({ ...d, hasil }))
      setMsg({ type: 'ok', text: 'Nilai tersimpan.' })
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof ApiError ? e.message : 'Gagal menyimpan nilai.' })
    } finally {
      setSaving(false)
    }
  }

  if (!detail && !err) return <div className="inv"><p className="inv__subtitle">Memuat penilaian...</p></div>
  if (err) return <div className="inv"><div className="inv__banner inv__banner--err">{err}</div></div>

  const g = detail.gugus
  const rows = byTahap[tahap] ?? []

  return (
    <div className="inv">
      <button type="button" className="inv__btn inv__btn--ghost" style={{ marginBottom: 10 }} onClick={() => navigate(`${base}/penilaian`)}>
        <ArrowLeft size={15} /> Daftar Penilaian
      </button>

      <h2 className="inv__title">Penilaian: {g.namaGugus || g.judul || g.noRegistrasi || `#${g.id}`}</h2>
      <p className="inv__subtitle">
        {jenisLabel(g.jenis)} · Form {detail.jenisForm} · Periode {g.periode} · Peran Anda: <b>{detail.peranSaya}</b>
        {!bisaNilai && ' (hanya melihat)'}
      </p>

      <div className="inv__card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 13 }}>
          <span><b>No. Registrasi:</b> {g.noRegistrasi ?? '-'}</span>
          <span><b>Departemen:</b> {g.namaDepartemen ?? g.namaKompartemen ?? '-'}</span>
          <span><b>Status risalah:</b> {g.status}</span>
        </div>
        {g.judul && <div style={{ marginTop: 8, fontSize: 13 }}><b>Judul:</b> {g.judul}</div>}
        <div style={{ marginTop: 10 }}>
          <button type="button" className="inv__btn inv__btn--soft" onClick={() => navigate(`${base}/daftar/${g.id}`)}>
            <ExternalLink size={14} /> Buka Risalah Lengkap
          </button>
        </div>
      </div>

      <div className="inv__card" style={{ marginBottom: 14, fontSize: 12.5, lineHeight: 1.7 }}>
        <b>Panduan nilai (skala 1-10):</b> 1-4 Kurang · 5-6 Cukup · 7-8 Baik · 9-10 Sangat baik.<br />
        <b>Kategori akhir:</b> ≥94 Excellent/Platinum · ≥87 Very Good/Gold · ≥79 Good/Silver · ≥61 Fair/Bronze · &lt;61 Partisipatif.
      </div>

      {msg && <div className={`inv__banner inv__banner--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* Tabs tahap */}
      <div className="inv__tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {tahapAda.map((t) => {
          const total = byTahap[t].length
          const isi = byTahap[t].filter((k) => { const v = Number(scores[k.id]?.nilai); return v >= 1 && v <= 10 }).length
          return (
            <button key={t} type="button"
              className={`inv__btn ${t === tahap ? 'inv__btn--primary' : 'inv__btn--ghost'}`}
              onClick={() => setTahap(t)}>
              {t} <span style={{ opacity: .7, fontSize: 11 }}>({isi}/{total})</span>
            </button>
          )
        })}
      </div>

      <div className="inv__table-wrap">
        <table className="inv__subtable">
          <thead>
            <tr>
              <th style={{ width: 40 }}>No</th>
              <th>Kriteria ({tahap})</th>
              <th style={{ width: 70, textAlign: 'center' }}>Bobot</th>
              <th style={{ width: 90, textAlign: 'center' }}>Nilai 1-10</th>
              <th style={{ width: 80, textAlign: 'center' }}>Nilai×Bobot</th>
              <th style={{ width: 200 }}>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => {
              const v = Number(scores[k.id]?.nilai)
              const kontrib = v >= 1 && v <= 10 ? Math.round((v / 10) * Number(k.bobotPersen) * 100) / 100 : 0
              return (
                <tr key={k.id}>
                  <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{k.no}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{k.kriteria}</div>
                    {k.keterangan && <div className="inv__hint" style={{ marginTop: 4, fontSize: 12, fontWeight: 400 }}>{k.keterangan}</div>}
                  </td>
                  <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{Number(k.bobotPersen)}%</td>
                  <td style={{ textAlign: 'center' }}>
                    {bisaNilai
                      ? <input type="number" min={1} max={10} value={scores[k.id]?.nilai ?? ''}
                          onChange={(e) => setNilai(k.id, e.target.value)} style={{ width: 64, textAlign: 'center' }} />
                      : (scores[k.id]?.nilai ?? '-')}
                  </td>
                  <td style={{ textAlign: 'center' }}>{kontrib || '-'}</td>
                  <td>
                    {bisaNilai
                      ? <input type="text" value={scores[k.id]?.catatan ?? ''} onChange={(e) => setCatatan(k.id, e.target.value)} placeholder="opsional" style={{ width: '100%' }} />
                      : (scores[k.id]?.catatan || '-')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Ringkasan nilai saya */}
      <div className="inv__card" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'center' }}>
        <span><b>Terisi:</b> {terisiSaya}/{kriteria.length} kriteria</span>
        <span><b>Total nilai Anda:</b> {totalSaya.toFixed(2)} / 100</span>
        <span><b>Kategori:</b> {terisiSaya === kriteria.length ? kategori(totalSaya) : '(belum lengkap)'}</span>
        {bisaNilai && (
          <button type="button" className="inv__btn inv__btn--primary" style={{ marginLeft: 'auto' }} disabled={saving} onClick={save}>
            <Save size={15} /> {saving ? 'Menyimpan...' : 'Simpan Nilai'}
          </button>
        )}
      </div>

      {/* Rekap seluruh penilai (untuk Sekretaris & pemantauan) */}
      {detail.hasil && (
        <div className="inv__card" style={{ marginTop: 14 }}>
          <div className="inv__section-head"><span className="inv__section-tag">Rekap</span><h3>Hasil Penilaian Stream</h3></div>
          <div className="inv__table-wrap">
            <table className="inv__subtable">
              <thead>
                <tr><th>Penilai</th><th>Peran</th><th style={{ textAlign: 'center' }}>Nilai</th><th>Kategori</th><th style={{ textAlign: 'center' }}>Terisi</th></tr>
              </thead>
              <tbody>
                {detail.hasil.penilai.map((p) => (
                  <tr key={p.userId}>
                    <td className="u-nama">{p.nama ?? '-'}</td>
                    <td>{p.peran}</td>
                    <td style={{ textAlign: 'center' }}>{Number(p.nilai).toFixed(2)}</td>
                    <td>{p.kategori}</td>
                    <td style={{ textAlign: 'center' }}>{p.terisi}/{detail.hasil.jumlahKriteria}</td>
                  </tr>
                ))}
                {detail.hasil.penilai.length === 0 && <tr><td colSpan={5} className="inv__no-data">Belum ada penilai.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 14 }}>
            <b>Nilai Akhir (rata-rata penilai lengkap):</b> {Number(detail.hasil.nilaiAkhir).toFixed(2)} / 100 — <b>{detail.hasil.kategori}</b>
          </div>
        </div>
      )}
    </div>
  )
}
