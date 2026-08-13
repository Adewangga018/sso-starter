import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { tgl, encodeAsetId } from './asetShared'
import './AsetPage.css'

// Dashboard "Dokumen Jatuh Tempo": dokumen aset (sertifikat/BPKB/STNK/IMB/polis) dengan
// tgl_jatuh_tempo dalam N hari ke depan. Query langsung (bukan tabel notifikasi terpisah) -
// lihat catatan di AsetDokumenService.JatuhTempoAsync.
export default function AsetDokumenJatuhTempo() {
  const [hari, setHari] = useState(30)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (h) => {
    setLoading(true)
    try { setData(await api.getAsetDokumenJatuhTempo(h)); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData([])
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat dokumen.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(hari) }, [load, hari])

  function urgensi(sisaHari) {
    if (sisaHari < 0) return 'bad'
    if (sisaHari <= 7) return 'bad'
    if (sisaHari <= 30) return 'warn'
    return 'ok'
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title">Dokumen Jatuh Tempo</h2>
          <p className="aset__sub">Sertifikat, BPKB, STNK, IMB, polis asuransi, dll yang mendekati atau sudah lewat tanggal jatuh tempo.</p>
        </div>
      </div>

      <div className="aset__tools">
        <select className="aset__search" value={hari} onChange={(e) => setHari(Number(e.target.value))}>
          <option value={7}>H-7</option>
          <option value={30}>H-30</option>
          <option value={90}>H-90</option>
        </select>
      </div>

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : data.length === 0 ? <div className="aset__empty">Tidak ada dokumen jatuh tempo dalam rentang ini.</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr><th>Kode Aset</th><th>Nama Aset</th><th>Jenis Dokumen</th><th>Nomor</th><th>Jatuh Tempo</th><th>Sisa Hari</th></tr></thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id}>
                    <td className="aset__kode"><Link to={`/my-asset/detail/${encodeAsetId(d.objectId)}`}>{d.objectId}</Link></td>
                    <td>{d.namaAset || '—'}</td>
                    <td className="aset__muted">{d.jenisDokumen}</td>
                    <td className="aset__muted">{d.nomorDokumen || '—'}</td>
                    <td className="aset__muted">{tgl(d.tglJatuhTempo)}</td>
                    <td><span className={`aset__badge aset__badge--${urgensi(d.sisaHari)}`}>{d.sisaHari < 0 ? `Lewat ${-d.sisaHari} hari` : `${d.sisaHari} hari lagi`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}