import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Search, User, Building2 } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { tgl, PicBadge, encodeAsetId } from './asetShared'
import AsetPegawaiPicker from './AsetPegawaiPicker'
import './AsetPage.css'

// Riwayat PIC lintas-aset (read-only) - dibaca langsung dari aset.pic_assignment yang
// sudah ada, tanpa tabel/kolom baru. Filter: pegawai, Bagian, atau rentang tgl mulai.
export default function AsetPicRiwayat() {
  const [nik, setNik] = useState('')
  const [namaTampil, setNamaTampil] = useState('')
  const [idUnit, setIdUnit] = useState('')
  const [bagianList, setBagianList] = useState([])
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { api.listBagianAset().then(setBagianList).catch(() => setBagianList([])) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.getAsetRiwayatPic({ nik: nik || undefined, idUnit: idUnit || undefined, dari: dari || undefined, sampai: sampai || undefined }))
      setError('')
    } catch (err) {
      if (isEmptyDataError(err)) setData([])
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat PIC.')
    } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nik, idUnit, dari, sampai])
  useEffect(() => { load() }, [load])

  function resetFilter() {
    setNik(''); setNamaTampil(''); setIdUnit(''); setDari(''); setSampai('')
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title">Riwayat PIC</h2>
          <p className="aset__sub">Seluruh histori penetapan PIC (orang & bagian) lintas aset — 500 baris terbaru.</p>
        </div>
      </div>

      <div className="aset__tools">
        <button type="button" className="aset__search" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setPickerOpen(true)}>
          <Search size={14} />
          {namaTampil ? <span>{namaTampil} ({nik})</span> : <span className="aset__muted">Filter per pegawai…</span>}
        </button>
        <select className="aset__search" value={idUnit} onChange={(e) => setIdUnit(e.target.value)}>
          <option value="">Filter per Bagian…</option>
          {bagianList.map((b) => <option key={b.id} value={b.id}>{b.nama}{b.namaDepartemen ? ` — ${b.namaDepartemen}` : ''}</option>)}
        </select>
        <input className="aset__search" type="date" value={dari} onChange={(e) => setDari(e.target.value)} title="Tgl mulai dari" />
        <input className="aset__search" type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} title="Tgl mulai sampai" />
        {(nik || idUnit || dari || sampai) && (
          <button type="button" className="aset__btn aset__btn--ghost" onClick={resetFilter}>Reset Filter</button>
        )}
      </div>

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : data.length === 0 ? <div className="aset__empty">Tidak ada riwayat PIC untuk filter ini.</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr><th>Kode Aset</th><th>Nama Aset</th><th>PIC</th><th>Mulai</th><th>Selesai</th><th>Status</th></tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td className="aset__kode"><Link to={`/my-asset/detail/${encodeAsetId(p.objectId)}`}>{p.objectId}</Link></td>
                    <td>{p.namaAset || '—'}</td>
                    <td>
                      {p.jenisPic === 'Bagian' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={13} /> {p.namaUnit}</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={13} /> {p.namaPic} <small className="aset__muted">({p.nik})</small></span>
                      )}
                    </td>
                    <td className="aset__muted">{tgl(p.tglMulai)}</td>
                    <td className="aset__muted">{p.tglSelesai ? tgl(p.tglSelesai) : '—'}</td>
                    <td><PicBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {pickerOpen && (
        <AsetPegawaiPicker
          onClose={() => setPickerOpen(false)}
          onPick={(p) => { setNik(p.nik); setNamaTampil(p.nama); setIdUnit(''); setPickerOpen(false) }}
        />
      )}
    </div>
  )
}