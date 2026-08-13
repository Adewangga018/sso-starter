import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { tgl, GROUP_ASSET_OPSI, formatLingkupKategori } from './asetShared'
import './AsetPage.css'

function BuatSesiModal({ onClose, onSubmit }) {
  const [namaSesi, setNamaSesi] = useState('')
  const [tglMulai, setTglMulai] = useState(() => new Date().toISOString().slice(0, 10))
  const [kategori, setKategori] = useState([])
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function toggleKategori(kode) {
    setKategori((k) => (k.includes(kode) ? k.filter((x) => x !== kode) : [...k, kode]))
  }

  async function submit(e) {
    e.preventDefault()
    if (!namaSesi.trim()) { setErr('Nama sesi wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        namaSesi: namaSesi.trim(),
        tglMulai,
        lingkupKategori: kategori.length > 0 ? kategori.join(',') : null,
        catatan: catatan.trim() || null,
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <div className="aset__overlay" onClick={onClose}>
      <form className="aset__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="aset__modal-head"><h3>Buat Sesi Opname</h3><button type="button" className="aset__x" onClick={onClose}><X size={18} /></button></div>
        <div className="aset__modal-body">
          {err && <div className="aset__err">{err}</div>}
          <label className="aset__f aset__f--full">Nama Sesi<input value={namaSesi} onChange={(e) => setNamaSesi(e.target.value)} placeholder="mis. Opname Q3 2026 - Pabrik Lampung" /></label>
          <label className="aset__f">Tgl Mulai<input type="date" value={tglMulai} onChange={(e) => setTglMulai(e.target.value)} /></label>
          <label className="aset__f aset__f--full">Lingkup Kategori (kosongkan = semua aset)
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {GROUP_ASSET_OPSI.map((g) => (
                <button type="button" key={g.kode} className={`aset__btn ${kategori.includes(g.kode) ? '' : 'aset__btn--ghost'}`} onClick={() => toggleKategori(g.kode)}>
                  {g.label}
                </button>
              ))}
            </div>
          </label>
          <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="opsional" /></label>
        </div>
        <div className="aset__modal-foot">
          <button type="button" className="aset__btn aset__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="aset__btn" disabled={saving}>{saving ? <Loader2 size={15} className="aset__spin" /> : null} Simpan</button>
        </div>
      </form>
    </div>
  )
}

// Daftar sesi Stock Opname + buat sesi baru. Detail scan & laporan selisih ada di
// AsetOpnameDetail.jsx (per sesi).
export default function AsetOpname() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    setLoading(true)
    try { setData(await api.getAsetOpnameSesiList()); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData([])
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat sesi opname.')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function buatSesi(payload) {
    await api.buatAsetOpnameSesi(payload)
    setModal(false); setMsg({ t: 'ok', m: 'Sesi opname dibuat.' }); await load()
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title">Stock Opname</h2>
          <p className="aset__sub">Pencocokan fisik aset berbasis scan QR — bandingkan aset tercatat vs yang benar-benar ditemukan di lapangan.</p>
        </div>
        <button type="button" className="aset__btn" onClick={() => setModal(true)}><Plus size={15} /> Buat Sesi</button>
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : data.length === 0 ? <div className="aset__empty">Belum ada sesi opname. Klik "Buat Sesi" untuk memulai.</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr><th>Nama Sesi</th><th>Tgl Mulai</th><th>Lingkup</th><th>Tercatat</th><th>Sudah Discan</th><th>Selisih</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <td>{s.namaSesi}</td>
                    <td className="aset__muted">{tgl(s.tglMulai)}</td>
                    <td className="aset__muted">{formatLingkupKategori(s.lingkupKategori)}</td>
                    <td className="aset__muted">{s.jumlahDalamLingkup}</td>
                    <td className="aset__muted">{s.jumlahSudahDiscan}</td>
                    <td><span className={`aset__badge aset__badge--${s.jumlahDalamLingkup - s.jumlahSudahDiscan > 0 ? 'warn' : 'ok'}`}>{s.jumlahDalamLingkup - s.jumlahSudahDiscan}</span></td>
                    <td><span className={`aset__badge aset__badge--${s.status === 'Berjalan' ? 'info' : 'off'}`}>{s.status}</span></td>
                    <td><Link className="aset__btn aset__btn--ghost" to={`/my-asset/opname/${s.id}`}>Buka</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal && <BuatSesiModal onClose={() => setModal(false)} onSubmit={buatSesi} />}
    </div>
  )
}