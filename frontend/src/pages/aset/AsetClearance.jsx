import { useState } from 'react'
import { Search, Loader2, UserMinus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../lib/api'
import { tgl, encodeAsetId } from './asetShared'
import AsetPegawaiPicker from './AsetPegawaiPicker'
import './AsetPage.css'

// Clearance Aset (SDM): cari NIK karyawan (mis. yang resign/pensiun), tampilkan
// daftar aset yang masih jadi tanggungannya (PIC aktif), tandai sudah dikembalikan.
export default function AsetClearance() {
  const [nik, setNik] = useState('')
  const [namaTampil, setNamaTampil] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)

  async function cariNik(targetNik) {
    if (!targetNik.trim()) return
    setLoading(true); setError(''); setMsg(null)
    try { setData(await api.getAsetClearance(targetNik.trim())) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'); setData(null) }
    finally { setLoading(false) }
  }

  function pilihPegawai(p) {
    setNik(p.nik); setNamaTampil(p.nama); setPickerOpen(false)
    cariNik(p.nik)
  }

  async function kembalikan(item) {
    if (!window.confirm(`Tandai aset "${item.namaAset || item.objectId}" sudah dikembalikan?`)) return
    try {
      await api.kembalikanAsetPic(item.idAssignment)
      setMsg({ t: 'ok', m: 'Aset ditandai sudah dikembalikan.' })
      setData(await api.getAsetClearance(nik.trim()))
    } catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title">Clearance Aset</h2>
          <p className="aset__sub">Cek daftar aset yang masih jadi tanggungan seorang karyawan — dipakai SDM saat proses clearance sheet (resign/pensiun).</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); cariNik(nik) }} style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="aset__search" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 280, cursor: 'pointer', textAlign: 'left' }} onClick={() => setPickerOpen(true)}>
          <Search size={14} />
          {namaTampil ? <span>{namaTampil} ({nik})</span> : <span className="aset__muted">Cari pegawai (NIK atau nama)…</span>}
        </button>
        <button type="submit" className="aset__btn"><Search size={15} /> Cari</button>
      </form>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading && <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>}
      {!loading && error && <div className="aset__alert">{error}</div>}

      {!loading && data && (
        <>
          <div className="aset__card">
            <div><span className="aset__muted" style={{ fontSize: '0.78rem' }}>NIK</span><div><b>{data.nik}</b></div></div>
            <div style={{ marginTop: 8 }}><span className="aset__muted" style={{ fontSize: '0.78rem' }}>Nama</span><div><b>{data.namaKaryawan || '—'}</b></div></div>
          </div>

          {data.aset.length === 0 ? (
            <div className="aset__empty">Tidak ada aset yang masih jadi tanggungan karyawan ini.</div>
          ) : (
            <div className="aset__tablewrap">
              <table className="aset__table">
                <thead><tr><th>Kode</th><th>Nama Aset</th><th>Lokasi</th><th>Sejak</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.aset.map((item) => (
                    <tr key={item.idAssignment}>
                      <td className="aset__kode"><Link to={`/my-asset/detail/${encodeAsetId(item.objectId)}`}>{item.objectId}</Link></td>
                      <td>{item.namaAset || '—'}</td>
                      <td className="aset__muted">{item.lokasi || '—'}</td>
                      <td className="aset__muted">{tgl(item.tglMulai)}</td>
                      <td className="aset__muted">{item.status}</td>
                      <td>
                        <button type="button" className="aset__ibtn" title="Tandai dikembalikan" onClick={() => kembalikan(item)}><UserMinus size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {pickerOpen && <AsetPegawaiPicker onClose={() => setPickerOpen(false)} onPick={pilihPegawai} />}
    </div>
  )
}