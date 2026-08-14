import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, ScanLine, CheckCircle2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { tgl, formatLingkupKategori, encodeAsetId, decodeAsetId, useConfirm } from './asetShared'
import './AsetPage.css'

const KONDISI_OPSI = ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang']
const MAX_FOTO_BYTES = 8 * 1024 * 1024

// Detail 1 sesi opname: form catat scan (manual/paste kode aset - hasil scan QR fisik
// dengan kamera bawaan HP yang membuka halaman Detail Aset, kodenya tinggal disalin ke
// sini, atau langsung lewat tombol "Catat di Opname" di halaman Detail Aset), daftar
// yang sudah discan, dan laporan selisih (tercatat tapi belum ditemukan).
export default function AsetOpnameDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [tab, setTab] = useState('scan')

  const [objectId, setObjectId] = useState(decodeAsetId(params.get('objectId') || ''))
  const [lokasiAktual, setLokasiAktual] = useState('')
  const [kondisiAktual, setKondisiAktual] = useState('')
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState(null)
  const [fotoErr, setFotoErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [lokasiOpsi, setLokasiOpsi] = useState([])
  const { confirm, ConfirmUI } = useConfirm()

  useEffect(() => { api.listLokasiAset().then(setLokasiOpsi).catch(() => setLokasiOpsi([])) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.getAsetOpnameSesiDetail(id)); setError('') }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat sesi opname.') }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  function pilihFoto(e) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_FOTO_BYTES) {
      setFotoErr(`Foto "${f.name}" berukuran ${(f.size / 1024 / 1024).toFixed(1)} MB, melebihi batas 8 MB.`)
      e.target.value = ''
      setFoto(null)
      return
    }
    setFotoErr('')
    setFoto(f)
  }

  async function submitScan(e) {
    e.preventDefault()
    if (!objectId.trim()) { setMsg({ t: 'err', m: 'Kode aset wajib diisi.' }); return }
    if (foto && foto.size > MAX_FOTO_BYTES) { setMsg({ t: 'err', m: 'Foto melebihi batas 8 MB — pilih foto lain atau hapus lampirannya.' }); return }
    setSaving(true)
    const objectIdTercatat = objectId.trim()
    try {
      await api.submitAsetOpnameScan(id, { objectId: objectIdTercatat, lokasiAktual, kondisiAktual, catatan }, foto)
    } catch (err) {
      setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal mencatat scan.' })
      setSaving(false)
      return
    }
    // Scan sudah tersimpan di titik ini - load() menangani gagalnya sendiri (lewat state
    // `error`), jadi tidak akan keliru menimpa pesan sukses ini dengan "gagal mencatat scan".
    setObjectId(''); setLokasiAktual(''); setKondisiAktual(''); setCatatan(''); setFoto(null); setFotoErr('')
    setMsg({ t: 'ok', m: `Aset ${objectIdTercatat} tercatat discan.` })
    await load()
    setSaving(false)
  }

  async function selesaikan() {
    if (!(await confirm('Tandai sesi opname ini selesai? Scan baru tidak bisa ditambahkan lagi setelah ini.', { danger: true }))) return
    try { await api.selesaikanAsetOpnameSesi(id); setMsg({ t: 'ok', m: 'Sesi opname ditandai selesai.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }

  if (loading) return <div className="aset"><div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="aset"><div className="aset__alert">{error}</div></div>
  if (!data) return null

  const { sesi, scan, selisih, lingkupAset } = data
  const berjalan = sesi.status === 'Berjalan'

  return (
    <div className="aset">
      <Link to="/my-asset/opname" className="aset__back"><ArrowLeft size={15} /> Kembali ke Daftar Sesi</Link>

      <div className="aset__head">
        <div>
          <h2 className="aset__title">{sesi.namaSesi}</h2>
          <p className="aset__sub">
            {tgl(sesi.tglMulai)} · {formatLingkupKategori(sesi.lingkupKategori)} · {sesi.jumlahSudahDiscan}/{sesi.jumlahDalamLingkup} tercatat
          </p>
        </div>
        {berjalan && <button type="button" className="aset__btn aset__btn--ghost" onClick={selesaikan}><CheckCircle2 size={15} /> Tandai Selesai</button>}
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      <div className="aset__tools">
        <button type="button" className={`aset__btn ${tab === 'scan' ? '' : 'aset__btn--ghost'}`} onClick={() => setTab('scan')}>Catat Scan ({scan.length})</button>
        <button type="button" className={`aset__btn ${tab === 'selisih' ? '' : 'aset__btn--ghost'}`} onClick={() => setTab('selisih')}>Selisih ({selisih.length})</button>
      </div>

      {tab === 'scan' && (
        <>
          {berjalan && (
            <form className="aset__card" onSubmit={submitScan}>
              <h3 className="aset__card-title">Catat Aset Hasil Scan</h3>
              <p className="aset__muted" style={{ fontSize: '0.8rem', marginBottom: 10 }}>
                Scan label QR aset pakai kamera HP (membuka halaman Detail Aset) — salin kode asetnya ke sini. Pilihan di bawah dibatasi ke aset dalam lingkup sesi ini.
              </p>
              <div className="aset__dgrid" style={{ marginBottom: 10 }}>
                <label className="aset__f">Kode Aset
                  <input value={objectId} onChange={(e) => setObjectId(e.target.value)} placeholder="mis. 000123" list="lingkup-aset-opsi" />
                  <datalist id="lingkup-aset-opsi">
                    {lingkupAset.map((a) => (
                      <option key={a.objectId} value={a.objectId}>{a.nama}{a.sudahDiscan ? ' (sudah discan)' : ''}</option>
                    ))}
                  </datalist>
                </label>
                <label className="aset__f">Kondisi Aktual
                  <select value={kondisiAktual} onChange={(e) => setKondisiAktual(e.target.value)}>
                    <option value="">— tidak dicatat —</option>
                    {KONDISI_OPSI.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </label>
                <label className="aset__f">Lokasi Aktual
                  <select value={lokasiAktual} onChange={(e) => setLokasiAktual(e.target.value)}>
                    <option value="">— tidak dicatat —</option>
                    {lokasiOpsi.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </label>
                <label className="aset__f">Foto (kamera/galeri)<input type="file" accept="image/*" capture="environment" onChange={pilihFoto} /></label>
                <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="opsional" /></label>
              </div>
              {fotoErr && <div className="aset__err" style={{ marginBottom: 10 }}>{fotoErr}</div>}
              <p className="aset__muted" style={{ fontSize: '0.78rem', margin: '0 0 10px' }}>Foto JPG/PNG, maksimal 8 MB.</p>
              <button type="submit" className="aset__btn" disabled={saving}>{saving ? <Loader2 size={15} className="aset__spin" /> : <ScanLine size={15} />} Catat</button>
            </form>
          )}

          {scan.length === 0 ? (
            <div className="aset__empty">Belum ada aset yang discan pada sesi ini.</div>
          ) : (
            <div className="aset__tablewrap">
              <table className="aset__table">
                <thead><tr><th>Kode Aset</th><th>Nama</th><th>Lokasi Aktual</th><th>Kondisi Aktual</th><th>Dicatat Oleh</th><th>Waktu</th></tr></thead>
                <tbody>
                  {scan.map((s) => (
                    <tr key={s.id}>
                      <td className="aset__kode"><Link to={`/my-asset/detail/${encodeAsetId(s.objectId)}`}>{s.objectId}</Link></td>
                      <td>{s.namaAset || '—'}</td>
                      <td className="aset__muted">{s.lokasiAktual || '—'}</td>
                      <td className="aset__muted">{s.kondisiAktual || '—'}</td>
                      <td className="aset__muted">{s.nikPemindai}</td>
                      <td className="aset__muted">{tgl(s.tglScan)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'selisih' && (
        selisih.length === 0 ? (
          <div className="aset__empty">Semua aset dalam lingkup sesi ini sudah discan.</div>
        ) : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr><th>Kode Aset</th><th>Nama</th><th>Kategori</th><th>Lokasi Tercatat</th></tr></thead>
              <tbody>
                {selisih.map((a) => (
                  <tr key={a.objectId}>
                    <td className="aset__kode"><Link to={`/my-asset/detail/${encodeAsetId(a.objectId)}`}>{a.objectId}</Link></td>
                    <td>{a.nama || '—'}</td>
                    <td className="aset__muted">{a.kategori || '—'}</td>
                    <td className="aset__muted">{a.lokasi || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {ConfirmUI}
    </div>
  )
}