import { useCallback, useEffect, useState } from 'react'
import { Wallet, Loader2, Info, TrendingUp, TrendingDown } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './GajiPage.css'

const BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember']

const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0)

function Grup({ grup }) {
  return (
    <div className="gaji__grup">
      <div className="gaji__grup-head">
        <span>{grup.kategori}</span>
        <span>{rupiah(grup.subtotal)}</span>
      </div>
      {grup.items.map((it) => (
        <div className="gaji__row" key={it.kode}>
          <div className="gaji__row-label">
            <span className="gaji__row-nama">{it.nama}</span>
            {it.opsional && <span className="gaji__tag gaji__tag--opsional">opsional</span>}
            {it.kenaTerlambat && <span className="gaji__tag gaji__tag--terlambat">dipotong keterlambatan</span>}
          </div>
          <div className="gaji__row-nominal">{rupiah(it.nominal)}</div>
        </div>
      ))}
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

  useEffect(() => { load() }, [load])

  const tahunOpsi = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="gaji">
      <div className="gaji__head">
        <div>
          <h2 className="gaji__title"><Wallet size={20} /> Slip Gaji</h2>
          <p className="gaji__sub">Rincian komponen gaji berdasarkan Job Grade (JG) & Person Grade (PG).</p>
        </div>
        <div className="gaji__periode">
          <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} aria-label="Bulan">
            {BULAN.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
          </select>
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} aria-label="Tahun">
            {tahunOpsi.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="gaji__loading"><Loader2 className="gaji__spin" size={22} /> Memuat…</div>
      ) : error ? (
        <div className="gaji__alert">{error}</div>
      ) : !data ? (
        <div className="gaji__empty">Slip untuk periode ini belum tersedia.</div>
      ) : (
        <>
          {/* Identitas pegawai + grade */}
          <div className="gaji__card gaji__ident">
            <div className="gaji__ident-main">
              <div className="gaji__ident-nama">{data.nama}</div>
              <div className="gaji__ident-jabatan">
                {data.jabatan || '—'}
                {data.tingkatan && <span className="gaji__chip">{data.tingkatan}</span>}
              </div>
            </div>
            <div className="gaji__ident-grade">
              <div><span>Periode</span><b>{data.namaBulan} {data.tahun}</b></div>
              <div><span>Band</span><b>{data.band ?? '—'}</b></div>
              <div><span>JG</span><b>{data.jg ?? '—'}</b></div>
              <div><span>PG</span><b>{data.pg ?? '—'}</b></div>
            </div>
          </div>

          {data.tarifBelumDiisi && (
            <div className="gaji__banner">
              <Info size={16} />
              <span>Nominal untuk periode ini belum dikonfigurasi. Struktur slip sudah siap; angka akan tampil setelah tarif (JG × PG) diisi oleh admin SDM.</span>
            </div>
          )}

          <div className="gaji__cols">
            <section className="gaji__card gaji__col">
              <h3 className="gaji__col-title gaji__col-title--in"><TrendingUp size={16} /> Pendapatan</h3>
              {data.pendapatan.map((g) => <Grup key={g.kategori} grup={g} />)}
              <div className="gaji__col-total">
                <span>Total Pendapatan</span><span>{rupiah(data.totalPendapatan)}</span>
              </div>
            </section>

            <section className="gaji__card gaji__col">
              <h3 className="gaji__col-title gaji__col-title--out"><TrendingDown size={16} /> Potongan</h3>
              {data.potongan.map((g) => <Grup key={g.kategori} grup={g} />)}
              <div className="gaji__col-total">
                <span>Total Potongan</span><span>{rupiah(data.totalPotongan)}</span>
              </div>
            </section>
          </div>

          <div className="gaji__card gaji__bersih">
            <span>Gaji Bersih (Take Home Pay)</span>
            <b>{rupiah(data.gajiBersih)}</b>
          </div>

          {data.catatan && (
            <p className="gaji__catatan"><Info size={13} /> {data.catatan}</p>
          )}
        </>
      )}
    </div>
  )
}
