import { useCallback, useEffect, useState } from 'react'
import {
  Wallet,
  Loader2,
  Info,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Printer,
  Eye,
  EyeOff,
  Award,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './GajiPage.css'

const BULAN = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0)

function formatVal(n, hide) {
  if (hide) return '••••••••'
  return rupiah(n)
}

function kelompokkan(items) {
  const entries = []
  let i = 0
  while (i < items.length) {
    const it = items[i]
    if (it.grupKode) {
      const cluster = [it]
      let j = i + 1
      while (j < items.length && items[j].grupKode === it.grupKode) {
        cluster.push(items[j])
        j++
      }
      entries.push({
        type: 'sub',
        grupKode: it.grupKode,
        grupLabel: it.grupLabel,
        items: cluster,
        subtotal: cluster.reduce((s, x) => s + x.nominal, 0),
      })
      i = j
    } else {
      entries.push({ type: 'row', item: it })
      i++
    }
  }
  return entries
}

function Baris({ it, hidePrivacy }) {
  return (
    <div className={`gaji__row${it.kenaTerlambat ? ' gaji__row--terlambat' : ''}`}>
      <div className="gaji__row-label">
        <span className="gaji__row-nama">{it.nama}</span>
        {it.kenaTerlambat && <span className="gaji__tag gaji__tag--terlambat">dipotong keterlambatan</span>}
        {it.masukTotal === false && <span className="gaji__tag gaji__tag--info">dibayar ke BPJS, tak termasuk Gaji Bersih</span>}
      </div>
      <div className="gaji__row-nominal">{formatVal(it.nominal, hidePrivacy)}</div>
    </div>
  )
}

function SubGrup({ sub, hidePrivacy }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`gaji__subgrup${open ? ' is-open' : ''}`}>
      <button type="button" className="gaji__subgrup-head" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="gaji__subgrup-label">{sub.grupLabel}</span>
        <span className="gaji__subgrup-count">{sub.items.length} item</span>
        <span className="gaji__subgrup-total">{formatVal(sub.subtotal, hidePrivacy)}</span>
      </button>
      {open && (
        <div className="gaji__subgrup-body">
          {sub.items.map((it) => (
            <Baris key={it.kode} it={it} hidePrivacy={hidePrivacy} />
          ))}
        </div>
      )}
    </div>
  )
}

function Grup({ grup, hidePrivacy }) {
  const entries = kelompokkan(grup.items)
  return (
    <div className="gaji__grup">
      <div className="gaji__grup-head">
        <span>{grup.kategori}</span>
        <span>{formatVal(grup.subtotal, hidePrivacy)}</span>
      </div>
      {entries.map((en) =>
        en.type === 'sub' ? (
          <SubGrup key={en.grupKode} sub={en} hidePrivacy={hidePrivacy} />
        ) : (
          <Baris key={en.item.kode} it={en.item} hidePrivacy={hidePrivacy} />
        ),
      )}
    </div>
  )
}

export default function GajiPage() {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hidePrivacy, setHidePrivacy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.getSlipGaji(tahun, bulan))
    } catch (err) {
      if (isEmptyDataError(err)) setData(null)
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat slip gaji.')
    } finally {
      setLoading(false)
    }
  }, [tahun, bulan])

  useEffect(() => {
    load()
  }, [load])

  const tahunOpsi = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="gaji">
      {/* Header Bar */}
      <div className="gaji__head">
        <div>
          <h2 className="gaji__title">
            <Wallet size={20} /> Slip Gaji
          </h2>
          <p className="gaji__sub">Rincian pendapatan &amp; potongan kepegawaian per periode.</p>
        </div>

        <div className="gaji__head-controls">
          <button
            type="button"
            className={`gaji__btn-privacy${hidePrivacy ? ' is-active' : ''}`}
            onClick={() => setHidePrivacy((v) => !v)}
            title={hidePrivacy ? 'Tampilkan Nominal Gaji' : 'Sembunyikan Nominal Gaji (Mode Privasi)'}
          >
            {hidePrivacy ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{hidePrivacy ? 'Sembunyikan' : 'Mode Privasi'}</span>
          </button>

          {data && (
            <button type="button" className="gaji__btn-print" onClick={() => window.print()} title="Cetak / Unduh PDF Slip Gaji">
              <Printer size={15} />
              <span>Cetak Slip</span>
            </button>
          )}

          <div className="gaji__periode">
            <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} aria-label="Bulan">
              {BULAN.slice(1).map((b, i) => (
                <option key={i + 1} value={i + 1}>
                  {b}
                </option>
              ))}
            </select>
            <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} aria-label="Tahun">
              {tahunOpsi.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="gaji__loading-card">
          <Loader2 className="gaji__spin" size={30} />
          <p>Memuat rincian slip gaji periode {BULAN[bulan]} {tahun}…</p>
        </div>
      ) : error ? (
        <div className="gaji__alert">{error}</div>
      ) : !data ? (
        <div className="gaji__empty-card">
          <Wallet size={36} className="gaji__empty-icon" />
          <h3>Slip Gaji Belum Tersedia</h3>
          <p>Data slip gaji untuk periode {BULAN[bulan]} {tahun} belum diterbitkan.</p>
        </div>
      ) : (
        <div className="gaji__printable-area">
          {/* Identitas Karyawan Card */}
          <div className="gaji__card gaji__ident">
            <div className="gaji__ident-main">
              <div className="gaji__avatar">
                <span>{data.nama?.charAt(0)?.toUpperCase() ?? '?'}</span>
              </div>
              <div className="gaji__ident-details">
                <div className="gaji__ident-nama">{data.nama}</div>
                <div className="gaji__ident-jabatan">
                  {data.jabatan || '—'}
                  {data.tingkatan && <span className="gaji__chip">{data.tingkatan}</span>}
                </div>
              </div>
            </div>

            <div className="gaji__ident-meta">
              <div className="gaji__meta-item">
                <span className="gaji__meta-label">Periode</span>
                <span className="gaji__meta-val">{data.namaBulan} {data.tahun}</span>
              </div>
              {data.band !== null && data.band !== undefined && (
                <div className="gaji__meta-item">
                  <span className="gaji__meta-label">Band</span>
                  <span className="gaji__meta-val">{data.band}</span>
                </div>
              )}
              {data.jg !== null && data.jg !== undefined && (
                <div className="gaji__meta-item">
                  <span className="gaji__meta-label">JG</span>
                  <span className="gaji__meta-val">{data.jg}</span>
                </div>
              )}
              {data.pg !== null && data.pg !== undefined && (
                <div className="gaji__meta-item">
                  <span className="gaji__meta-label">PG</span>
                  <span className="gaji__meta-val">{data.pg}</span>
                </div>
              )}
            </div>
          </div>

          {data.tarifBelumDiisi && (
            <div className="gaji__banner">
              <Info size={16} className="gaji__banner-icon" />
              <span>
                Nominal untuk periode ini belum dikonfigurasi. Struktur slip sudah siap; angka akan tampil setelah tarif (JG × PG) diisi oleh Admin SDM.
              </span>
            </div>
          )}

          {!data.tarifBelumDiisi && !data.final && (
            <div className="gaji__banner">
              <Clock size={16} className="gaji__banner-icon" />
              <span>
                Admin SDM belum menyelesaikan input potongan periode ini (mis. K3PG, Angsuran, RIT). Angka di bawah adalah <strong>estimasi sementara</strong> dan bisa berubah sampai periode ini diposting/diselesaikan.
              </span>
            </div>
          )}

          {/* 2-Column Earnings & Deductions Breakdown */}
          <div className="gaji__cols">
            {/* Column 1: Pendapatan */}
            <section className="gaji__card gaji__col">
              <div className="gaji__col-title gaji__col-title--in">
                <div className="gaji__col-title-left">
                  <TrendingUp size={18} />
                  <span>Pendapatan</span>
                </div>
                <span className="gaji__col-badge gaji__col-badge--in">{formatVal(data.totalPendapatan, hidePrivacy)}</span>
              </div>
              <div className="gaji__col-content">
                {data.pendapatan.map((g) => (
                  <Grup key={g.kategori} grup={g} hidePrivacy={hidePrivacy} />
                ))}
              </div>
              <div className="gaji__col-total gaji__col-total--in">
                <span>Total Pendapatan</span>
                <span>{formatVal(data.totalPendapatan, hidePrivacy)}</span>
              </div>
            </section>

            {/* Column 2: Potongan */}
            <section className="gaji__card gaji__col">
              <div className="gaji__col-title gaji__col-title--out">
                <div className="gaji__col-title-left">
                  <TrendingDown size={18} />
                  <span>Potongan</span>
                </div>
                <span className="gaji__col-badge gaji__col-badge--out">{formatVal(data.totalPotongan, hidePrivacy)}</span>
              </div>
              <div className="gaji__col-content">
                {data.potongan.map((g) => (
                  <Grup key={g.kategori} grup={g} hidePrivacy={hidePrivacy} />
                ))}
              </div>
              <div className="gaji__col-total gaji__col-total--out">
                <span>Total Potongan</span>
                <span>{formatVal(data.totalPotongan, hidePrivacy)}</span>
              </div>
            </section>
          </div>

          {/* Take Home Pay Highlight Card */}
          <div className={`gaji__card gaji__bersih-card${!data.final ? ' gaji__bersih-card--estimasi' : ''}`}>
            <div className="gaji__bersih-main">
              <div className="gaji__bersih-icon-wrap">
                {data.final ? <Award size={24} /> : <Clock size={24} />}
              </div>
              <div className="gaji__bersih-text">
                <div className="gaji__bersih-sub">
                  {data.final ? 'Gaji Bersih (Take Home Pay)' : 'Estimasi Gaji Bersih (Take Home Pay)'}
                </div>
                <div className="gaji__bersih-val">{formatVal(data.gajiBersih, hidePrivacy)}</div>
              </div>
            </div>
            <div className="gaji__bersih-stamp">
              {data.final ? (
                <><CheckCircle2 size={15} /> Verified System</>
              ) : (
                <><Clock size={15} /> Belum Final</>
              )}
            </div>
          </div>

          {data.catatan && (
            <div className="gaji__catatan-card">
              <Info size={15} className="gaji__catatan-icon" />
              <span>{data.catatan}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
