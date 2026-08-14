import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Save, CheckCircle2, Printer, Plus } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { encodeAsetId } from './asetShared'
import './AsetPage.css'

const SATUAN_SARAN = ['Unit', 'Set', 'Buah', 'Botol', 'M2', 'Meja', 'Kursi', 'PCS', 'Lemari']

const EMPTY_FORM = {
  nama: '', lokasi: '', groupAsset: '', kelompok: '', tanggal: new Date().toISOString().slice(0, 10),
  kodeCc: '', satuan: 'Unit', nomorInternal: '',
}

// Pendaftaran aset baru: MENULIS ke GCS.dbo.assets (ERP), bukan tabel My Asset sendiri -
// dbo.assets tetap SSOT. Hanya identitas dasar yang diisi di sini; nilai perolehan, nilai
// buku, masa manfaat, dan field akuntansi lain SENGAJA dikosongkan, dilengkapi akunting
// langsung di ERP. Lihat catatan arsitektur lengkap di backend AsetService.DaftarAsetBaruAsync.
export default function AsetDaftarBaru() {
  const [isAdmin, setIsAdmin] = useState(null) // null = belum dicek
  const [groupList, setGroupList] = useState([])
  const [kelompokList, setKelompokList] = useState([])
  const [kodeCcList, setKodeCcList] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [hasil, setHasil] = useState(null) // { objectId } setelah sukses
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    api.getAsetAdminStatus().then((r) => setIsAdmin(r.isAdminAset)).catch(() => setIsAdmin(false))
    api.listGroupAssetErp().then(setGroupList).catch(() => setGroupList([]))
    api.listKodeCcErp().then(setKodeCcList).catch(() => setKodeCcList([]))
  }, [])

  // Kelompok mengikuti Group Asset yang dipilih (cascading) - reset pilihan kelompok
  // tiap kali kategori berubah supaya tidak nyangkut kelompok kategori lain.
  useEffect(() => {
    if (!form.groupAsset) { setKelompokList([]); return }
    api.listKelompokErp(form.groupAsset).then(setKelompokList).catch(() => setKelompokList([]))
    setForm((f) => ({ ...f, kelompok: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.groupAsset])

  async function submit(e) {
    e.preventDefault()
    if (!form.nama.trim()) { setErr('Nama aset wajib diisi.'); return }
    if (!form.lokasi.trim()) { setErr('Lokasi wajib diisi.'); return }
    if (!form.groupAsset) { setErr('Kategori (Group Asset) wajib dipilih.'); return }
    if (!form.kelompok) { setErr('Kelompok wajib dipilih.'); return }
    if (!form.kodeCc) { setErr('Kode CC / Wilayah wajib dipilih.'); return }
    if (!form.satuan.trim()) { setErr('Satuan wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      const res = await api.daftarAsetBaru({
        nama: form.nama.trim(),
        lokasi: form.lokasi.trim(),
        groupAsset: form.groupAsset,
        kelompok: form.kelompok,
        tanggal: form.tanggal,
        kodeCc: form.kodeCc,
        satuan: form.satuan.trim(),
        nomorInternal: form.nomorInternal.trim() || null,
      })
      setHasil(res)
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Gagal mendaftarkan aset.')
    } finally { setSaving(false) }
  }

  function daftarLagi() {
    setHasil(null)
    setForm(EMPTY_FORM)
  }

  if (isAdmin === false) {
    return (
      <div className="aset">
        <div className="aset__head"><h2 className="aset__title">Daftar Aset Baru</h2></div>
        <div className="aset__msg aset__msg--err">Hanya Admin Aset (Departemen Kepatuhan) yang dapat mendaftarkan aset baru.</div>
      </div>
    )
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title">Daftar Aset Baru</h2>
          <p className="aset__sub">
            Mendaftarkan aset baru langsung ke sistem ERP (dbo.assets) — tetap satu sumber data (SSOT), bukan duplikat di MyGCS.
            Nilai perolehan, nilai buku, dan masa manfaat <b>tidak diisi di sini</b> — dilengkapi tim akuntansi langsung di ERP.
          </p>
        </div>
      </div>

      {isAdmin === null ? (
        <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
      ) : hasil ? (
        <div className="aset__card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <CheckCircle2 size={40} color="#1f7a3a" style={{ marginBottom: 10 }} />
          <h3 className="aset__card-title" style={{ fontSize: '1.05rem' }}>Aset berhasil didaftarkan</h3>
          <p className="aset__muted" style={{ margin: '4px 0 20px' }}>Kode aset (OBJECTID): <b style={{ color: 'var(--gcs-green-900)' }}>{hasil.objectId}</b></p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="aset__btn" to={`/my-asset/detail/${encodeAsetId(hasil.objectId)}`}>Buka Detail Aset</Link>
            <button type="button" className="aset__btn aset__btn--ghost" onClick={() => window.open(`/cetak/aset-qr?ids=${encodeURIComponent(encodeAsetId(hasil.objectId))}`, '_blank')}>
              <Printer size={14} /> Cetak Label QR
            </button>
            <button type="button" className="aset__btn aset__btn--ghost" onClick={daftarLagi}><Plus size={14} /> Daftarkan Aset Lain</button>
          </div>
        </div>
      ) : (
        <form className="aset__card" onSubmit={submit}>
          {err && <div className="aset__err" style={{ marginBottom: 12 }}>{err}</div>}
          <div className="aset__dgrid">
            <label className="aset__f aset__f--full">Nama Aset<input value={form.nama} onChange={set('nama')} placeholder="mis. Laptop Lenovo ThinkPad" /></label>
            <label className="aset__f">Kategori (Group Asset)
              <select value={form.groupAsset} onChange={set('groupAsset')}>
                <option value="">— pilih kategori —</option>
                {groupList.map((g) => <option key={g.kode} value={g.kode}>{g.nama}</option>)}
              </select>
            </label>
            <label className="aset__f">Kelompok
              <select value={form.kelompok} onChange={set('kelompok')} disabled={!form.groupAsset}>
                <option value="">{form.groupAsset ? '— pilih kelompok —' : 'pilih kategori dulu'}</option>
                {kelompokList.map((k) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
              </select>
            </label>
            <label className="aset__f aset__f--full">Lokasi<input value={form.lokasi} onChange={set('lokasi')} placeholder="mis. Kantor Pusat Gresik Lt.3" /></label>
            <label className="aset__f">Kode CC / Wilayah
              <select value={form.kodeCc} onChange={set('kodeCc')}>
                <option value="">— pilih wilayah —</option>
                {kodeCcList.map((c) => <option key={c.kodeCc} value={c.kodeCc}>{c.wilayah}</option>)}
              </select>
            </label>
            <label className="aset__f">Tanggal Perolehan<input type="date" value={form.tanggal} onChange={set('tanggal')} /></label>
            <label className="aset__f">Satuan
              <input value={form.satuan} onChange={set('satuan')} list="satuan-saran" placeholder="mis. Unit" />
              <datalist id="satuan-saran">{SATUAN_SARAN.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="aset__f">Nomor Aset Internal<input value={form.nomorInternal} onChange={set('nomorInternal')} placeholder="opsional, mis. AST-2026-0001" /></label>
          </div>
          <p className="aset__muted" style={{ fontSize: '0.78rem', margin: '14px 0 0' }}>
            Kode aset (OBJECTID) dibuat otomatis oleh sistem setelah disimpan.
          </p>
          <button type="submit" className="aset__btn" style={{ marginTop: 14 }} disabled={saving}>
            {saving ? <Loader2 size={15} className="aset__spin" /> : <Save size={15} />} Daftarkan Aset
          </button>
        </form>
      )}
    </div>
  )
}