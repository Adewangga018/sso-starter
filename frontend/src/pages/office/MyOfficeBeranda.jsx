import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileWarning,
  Loader2,
  Megaphone,
  RefreshCw,
  UserCheck,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

// Dashboard My Office, tata letaknya mengikuti dashboard DOF: panel "Statistik Per Tahun"
// (rata-rata lama proses) + kotak peringatan + enam kartu ringkasan.
//
// SEMUA ANGKA BERASAL DARI SERVER (GET /api/office/dashboard) yang menghitungnya dari isi
// office.surat / surat_pj / surat_lampiran / surat_riwayat. Tidak ada satu pun angka yang
// ditulis tetap di berkas ini — kalau semuanya 0, artinya memang belum ada surat.

// Tiga metrik durasi. `sampel` dipakai untuk membedakan "rata-rata 0 menit" dari
// "belum ada surat yang bisa dirata-rata".
const METRIK = [
  { key: 'penyetujuan', nilai: 'menitPenyetujuan', sampel: 'sampelPenyetujuan', label: 'Penyetujuan Surat', icon: UserCheck, tone: 'ungu', hint: 'Dibuat sampai berstatus Disetujui' },
  { key: 'review', nilai: 'menitReview', sampel: 'sampelReview', label: 'Review Surat', icon: CheckCircle2, tone: 'kuning', hint: 'Dikirim ke review sampai reviewer terakhir menindak' },
  { key: 'approve', nilai: 'menitApprove', sampel: 'sampelApprove', label: 'Approve Surat', icon: Clock, tone: 'biru', hint: 'Masuk tahap approval sampai approver terakhir menindak' },
]

// Enam kartu bawah. `to` menautkan ke halaman yang memuat daftar di balik angkanya.
const KARTU = [
  {
    key: 'belum-upload',
    label: 'Belum Upload',
    nilai: 'belumUpload',
    tone: 'biru',
    to: '/my-office/daftar?status=Disetujui',
    sub: [
      { label: '*** Non-SP', nilai: 'belumUploadNonSp', tone: 'gelap' },
      { label: '*** SP', nilai: 'belumUploadSp', tone: 'gelap' },
    ],
  },
  {
    key: 'sp-berakhir',
    label: 'SP akan berakhir dalam 3 bulan *',
    nilai: 'spBerakhir',
    tone: 'merah',
    to: '/my-office/daftar',
    sub: [
      { label: 'Sudah', nilai: 'spBerakhirSudahUpload', tone: 'gelap' },
      { label: 'Belum', nilai: 'spBerakhirBelumUpload', tone: 'gelap' },
    ],
  },
  {
    key: 'total',
    label: 'Total Surat',
    nilai: 'totalSurat',
    tone: 'hijau',
    to: '/my-office/daftar',
    sub: [{ label: 'Subordinat', nilai: 'totalSuratSubordinat', tone: 'gelap' }],
  },
  { key: 'menunggu-approve', label: 'Menunggu Approve', nilai: 'menungguApprove', tone: 'kuning', to: '/my-office/approval' },
  { key: 'sirkuler', label: 'Surat Sirkuler', nilai: 'suratSirkuler', tone: 'abu', to: '/my-office/daftar' },
  { key: 'menunggu-review', label: 'Menunggu Review', nilai: 'menungguReview', tone: 'coklat', to: '/my-office/review' },
]

// 0 menit itu sah (proses < 1 menit), jadi yang membedakan "belum ada data" adalah sampel.
function formatMenit(menit, sampel) {
  if (!sampel) return { angka: '—', satuan: 'belum ada data' }
  return { angka: new Intl.NumberFormat('id-ID').format(menit), satuan: menit === 1 ? 'Menit' : 'Menit' }
}

export default function MyOfficeBeranda() {
  const [tahun, setTahun] = useState(null)      // null = biarkan server memilih tahun terbaru
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [muatUlang, setMuatUlang] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api.getOfficeDashboard(tahun)
      .then((d) => {
        if (!alive) return
        setData(d)
        // Selaraskan pilihan tahun dengan yang benar-benar dipakai server.
        if (tahun === null && typeof d?.tahun === 'number') setTahun(d.tahun)
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof ApiError ? e.message : 'Gagal memuat statistik.')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tahun, muatUlang])

  const nilai = (k) => data?.[k] ?? 0
  const tahunOpsi = data?.tahunTersedia ?? []

  return (
    <div className="mo">
      <div className="mo__intro">
        <h2 className="mo__intro-title">Dashboard My Office</h2>
        <p className="mo__intro-sub">
          Persuratan digital PT Gresik Cipta Sejahtera — penciptaan, distribusi, dan pengarsipan naskah dinas.
        </p>
      </div>

      {error && (
        <div className="mo__alert mo__alert--err mo__alert--row">
          <span>{error}</span>
          <button type="button" className="mo-btn mo-btn--ghost" onClick={() => setMuatUlang((v) => v + 1)}>
            Coba lagi
          </button>
        </div>
      )}

      {/* --- Statistik Per Tahun --- */}
      <div className="mo-card">
        <div className="mo-card__head mo-card__head--split">
          <span>Statistik Per Tahun</span>
          <div className="mo-card__tools">
            <button
              type="button"
              className="mo-icon-btn"
              onClick={() => setMuatUlang((v) => v + 1)}
              disabled={loading}
              title="Muat ulang"
            >
              <RefreshCw size={14} className={loading ? 'mo__spin' : undefined} />
            </button>
            <select
              className="mo-select"
              value={tahun ?? ''}
              onChange={(e) => setTahun(Number(e.target.value))}
              disabled={loading || tahunOpsi.length === 0}
            >
              {tahunOpsi.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="mo-metrics">
          {METRIK.map((m) => {
            const { angka, satuan } = formatMenit(nilai(m.nilai), nilai(m.sampel))
            return (
              <div className="mo-metric" key={m.key}>
                <div className={`mo-metric__icon mo-metric__icon--${m.tone}`}><m.icon size={18} /></div>
                <div className="mo-metric__body">
                  <div className="mo-metric__value">
                    {loading ? <Loader2 size={18} className="mo__spin" /> : <>{angka} <span className="mo-metric__unit">{satuan}</span></>}
                  </div>
                  <div className="mo-metric__label">{m.label}</div>
                  <div className="mo-metric__hint">{m.hint}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Kotak peringatan hanya muncul kalau memang ada surat yang lampirannya belum diunggah. */}
      {!loading && nilai('belumUpload') > 0 && (
        <div className="mo-warn">
          <AlertTriangle size={16} />
          <div>
            <strong>PERHATIAN !</strong>
            <ul className="mo-warn__list">
              <li>
                Anda punya <strong>{nilai('belumUpload')}</strong> surat sudah disetujui yang berkas
                tanda tangannya belum diunggah ({nilai('belumUploadNonSp')} Non-SP, {nilai('belumUploadSp')} SP/ASP).
                Unggah lampiran lewat halaman detail surat.
              </li>
              {nilai('spBerakhirBelumUpload') > 0 && (
                <li>
                  <strong>{nilai('spBerakhirBelumUpload')}</strong> SP/ASP akan berakhir dalam 3 bulan dan
                  belum ada lampirannya.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* --- Enam kartu ringkasan --- */}
      <div className="mo-cards">
        {KARTU.map((k) => (
          <Link className={`mo-tile mo-tile--${k.tone}`} to={k.to} key={k.key}>
            <div className="mo-tile__head">
              <span className="mo-tile__label">{k.label}</span>
              <span className="mo-tile__go"><ExternalLink size={14} /></span>
            </div>
            <div className="mo-tile__value">
              {loading ? <Loader2 size={22} className="mo__spin" /> : new Intl.NumberFormat('id-ID').format(nilai(k.nilai))}
            </div>
            {k.sub && (
              <div className="mo-tile__subs">
                {k.sub.map((s) => (
                  <span className="mo-tile__sub" key={s.label}>
                    <span className={`mo-tile__sub-label mo-tile__sub-label--${s.tone}`}>{s.label}</span>
                    <span className="mo-tile__sub-value">{loading ? '…' : nilai(s.nilai)}</span>
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="mo-keterangan">
        <div className="mo-keterangan__title">Keterangan :</div>
        <div>* Untuk Seluruh Tahun (tidak mengikuti pilihan tahun di atas)</div>
        <div>** Non-SP : jenis Surat, Memo, dan Sirkuler</div>
        <div>*** Belum Upload : surat sudah Disetujui tetapi belum ada lampirannya</div>
      </div>

      <div className="mo-legend">
        <span className="mo-legend__item"><ClipboardCheck size={13} /> Menunggu Review &amp; Approve dihitung dari antrean tindakan Anda saat ini (lintas tahun).</span>
        <span className="mo-legend__item"><FileWarning size={13} /> Subordinat dihitung dari bawahan langsung pada data SDM.</span>
        <span className="mo-legend__item"><Megaphone size={13} /> Surat Sirkuler dihitung dari surat berjenis “Sirkuler”.</span>
      </div>
    </div>
  )
}
