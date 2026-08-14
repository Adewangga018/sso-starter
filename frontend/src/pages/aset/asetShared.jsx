import { useEffect, useState } from 'react'
import { X, Loader2, Search, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'
import AsetPegawaiPicker from './AsetPegawaiPicker'
import './AsetPage.css'

export const rupiah = (n) => (n == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n))
export const tgl = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// GROUP_ASSET (dbo.assets/AssetS_Group) - dipakai lingkup kategori Stock Opname & jenis
// dokumen per kategori. Kode diverifikasi langsung ke SQL (bukan ditebak) - lihat
// backend/Database/aset/09-jenis-aktivitas-ddl.sql.
export const GROUP_ASSET_OPSI = [
  { kode: 'A01', label: 'Tanah' },
  { kode: 'A02', label: 'Bangunan & Instalasi Listrik' },
  { kode: 'A03', label: 'Mesin & Peralatan Pabrik' },
  { kode: 'A04', label: 'Kendaraan & Alat Berat' },
  { kode: 'A05', label: 'Inventaris Kantor' },
  { kode: 'A06', label: 'Aktiva Tak Berwujud' },
]

// "A01,A04" -> "Tanah, Kendaraan & Alat Berat". Kode tak dikenal ditampilkan apa adanya.
export function formatLingkupKategori(lingkupKategori) {
  if (!lingkupKategori) return 'Semua aset'
  return lingkupKategori.split(',').map((kode) => {
    const k = kode.trim()
    return GROUP_ASSET_OPSI.find((g) => g.kode === k)?.label || k
  }).join(', ')
}

// Menyamarkan OBJECTID (kode ERP mentah) di URL - Base64URL, BUKAN enkripsi kriptografis
// (bisa dibalikkan siapa pun yang tahu skemanya). Tujuannya cuma supaya kode ERP tidak
// polos kelihatan di address bar/riwayat browser/tautan yang dibagikan, bukan proteksi data.
// Dipakai konsisten di semua tempat yang membangun URL berisi kode aset (link tabel, QR
// code, query string ?objectId=, dst) - lihat AsetDetail.jsx, Inventaris.jsx, dll.
export function encodeAsetId(objectId) {
  if (!objectId) return objectId
  try {
    return btoa(unescape(encodeURIComponent(objectId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch { return objectId }
}
export function decodeAsetId(encoded) {
  if (!encoded) return encoded
  try {
    let s = encoded.replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    return decodeURIComponent(escape(atob(s)))
  } catch { return encoded }
}

// Pengganti window.confirm() bawaan browser, sesuai gaya visual aplikasi (dan bisa
// menjelaskan akibat aksi, bukan cuma "Yakin?"). Pakai: const { confirm, ConfirmUI } =
// useConfirm(); ... if (!(await confirm('Hapus X? Tidak bisa dibatalkan.', { danger: true }))) return;
// ... lalu render {ConfirmUI} sekali di JSX halaman.
export function useConfirm() {
  const [state, setState] = useState(null) // { message, danger, resolve }

  const confirm = (message, opts = {}) =>
    new Promise((resolve) => setState({ message, danger: opts.danger ?? false, resolve }))

  function selesai(hasil) {
    state?.resolve(hasil)
    setState(null)
  }

  const ConfirmUI = state ? (
    <div className="aset__overlay" onClick={() => selesai(false)}>
      <div className="aset__modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="aset__modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color={state.danger ? '#b03636' : undefined} /> Konfirmasi
          </h3>
          <button type="button" className="aset__x" aria-label="Tutup" onClick={() => selesai(false)}><X size={18} /></button>
        </div>
        <div className="aset__modal-body" style={{ display: 'block' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gcs-ink)' }}>{state.message}</p>
        </div>
        <div className="aset__modal-foot">
          <button type="button" className="aset__btn aset__btn--ghost" onClick={() => selesai(false)}>Batal</button>
          <button type="button" className={`aset__btn ${state.danger ? 'aset__btn--danger' : ''}`} onClick={() => selesai(true)} autoFocus>
            {state.danger ? 'Ya, Hapus' : 'Ya, Lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, ConfirmUI }
}

export function KondisiBadge({ kondisi }) {
  const map = { Baik: 'ok', 'Rusak Ringan': 'warn', 'Rusak Berat': 'bad', Hilang: 'bad' }
  return <span className={`aset__badge aset__badge--${map[kondisi] || 'off'}`}>{kondisi}</span>
}
export function StatusBadge({ status }) {
  const map = { Aktif: 'ok', Dipinjam: 'info', Perbaikan: 'warn', Dihapus: 'off' }
  return <span className={`aset__badge aset__badge--${map[status] || 'off'}`}>{status}</span>
}
export function MaintStatusBadge({ status }) {
  const map = { Terjadwal: 'info', Selesai: 'ok', Batal: 'off' }
  return <span className={`aset__badge aset__badge--${map[status] || 'off'}`}>{status}</span>
}

function Modal({ title, onClose, children, onSubmit, saving, err }) {
  return (
    <div className="aset__overlay" onClick={onClose}>
      <form className="aset__modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <div className="aset__modal-head"><h3>{title}</h3><button type="button" className="aset__x" aria-label="Tutup" onClick={onClose}><X size={18} /></button></div>
        <div className="aset__modal-body">
          {err && <div className="aset__err">{err}</div>}
          {children}
        </div>
        <div className="aset__modal-foot">
          <button type="button" className="aset__btn aset__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="aset__btn" disabled={saving}>{saving ? <Loader2 size={15} className="aset__spin" /> : null} Simpan</button>
        </div>
      </form>
    </div>
  )
}

const EMPTY_ASET = { kode: '', nama: '', kategori: '', merk: '', nomorSeri: '', lokasi: '', idPic: '', namaPic: '', kondisi: 'Baik', status: 'Aktif', nilai: '', tglPerolehan: '', catatan: '' }

export function AsetFormModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_ASET, ...pick(initial, EMPTY_ASET) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.kode.trim() || !form.nama.trim()) { setErr('Kode & nama aset wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        ...form,
        kode: form.kode.trim(), nama: form.nama.trim(),
        kategori: n(form.kategori), merk: n(form.merk), nomorSeri: n(form.nomorSeri),
        lokasi: n(form.lokasi), idPic: n(form.idPic), namaPic: n(form.namaPic), catatan: n(form.catatan),
        nilai: form.nilai === '' ? null : Number(form.nilai),
        tglPerolehan: form.tglPerolehan || null,
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title={initial ? 'Ubah Aset' : 'Tambah Aset'} onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f">Kode<input value={form.kode} onChange={set('kode')} placeholder="AST-001" /></label>
      <label className="aset__f">Kategori<input value={form.kategori} onChange={set('kategori')} placeholder="Elektronik, Kendaraan…" /></label>
      <label className="aset__f aset__f--full">Nama<input value={form.nama} onChange={set('nama')} /></label>
      <label className="aset__f">Merk / Model<input value={form.merk} onChange={set('merk')} /></label>
      <label className="aset__f">Nomor Seri<input value={form.nomorSeri} onChange={set('nomorSeri')} /></label>
      <label className="aset__f">Lokasi<input value={form.lokasi} onChange={set('lokasi')} /></label>
      <label className="aset__f">Penanggung Jawab (nama)<input value={form.namaPic} onChange={set('namaPic')} /></label>
      <label className="aset__f">NIK PIC<input value={form.idPic} onChange={set('idPic')} placeholder="opsional" /></label>
      <label className="aset__f">Kondisi
        <select value={form.kondisi} onChange={set('kondisi')}>{['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Status
        <select value={form.status} onChange={set('status')}>{['Aktif', 'Dipinjam', 'Perbaikan', 'Dihapus'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Nilai (Rp)<input type="number" step="any" value={form.nilai} onChange={set('nilai')} /></label>
      <label className="aset__f">Tgl Perolehan<input type="date" value={form.tglPerolehan} onChange={set('tglPerolehan')} /></label>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} /></label>
    </Modal>
  )
}

const EMPTY_MAINT = { jenis: 'Rutin', tglJadwal: '', tglSelesai: '', status: 'Terjadwal', pelaksana: '', biaya: '', catatan: '' }

export function MaintenanceFormModal({ initial, namaAset, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_MAINT, ...pick(initial, EMPTY_MAINT) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.tglJadwal) { setErr('Tanggal jadwal wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        jenis: form.jenis, tglJadwal: form.tglJadwal, tglSelesai: form.tglSelesai || null,
        status: form.status, pelaksana: n(form.pelaksana), catatan: n(form.catatan),
        biaya: form.biaya === '' ? null : Number(form.biaya),
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title={`${initial ? 'Ubah' : 'Tambah'} Maintenance${namaAset ? ` — ${namaAset}` : ''}`} onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f">Jenis
        <select value={form.jenis} onChange={set('jenis')}>{['Rutin', 'Perbaikan', 'Inspeksi'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Status
        <select value={form.status} onChange={set('status')}>{['Terjadwal', 'Selesai', 'Batal'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Tgl Jadwal<input type="date" value={form.tglJadwal} onChange={set('tglJadwal')} /></label>
      <label className="aset__f">Tgl Selesai<input type="date" value={form.tglSelesai} onChange={set('tglSelesai')} /></label>
      <label className="aset__f">Pelaksana / Vendor<input value={form.pelaksana} onChange={set('pelaksana')} /></label>
      <label className="aset__f">Biaya (Rp)<input type="number" step="any" value={form.biaya} onChange={set('biaya')} /></label>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} /></label>
    </Modal>
  )
}

const EMPTY_TIDAK_PRODUKTIF = {
  jenis: 'Tanah', nama: '', sertifikatHak: '', sertifikatJangkaWaktu: '', sertifikatNo: '', sertifikatTahun: '',
  sertifikatKeterangan: '', lokasi: '', qty: '', satuan: 'M2', statusJaminan: '',
  hargaPasar: '', appraisalHarga: '', appraisalKjpp: '', appraisalTahun: '', appraisalNo: '',
  pbbNop: '', pbbNominal: '', pbbTglPembayaran: '', catatanAkt: '', perijinanPemegangSaham: '',
}

const JENIS_SUGGESTIONS = [
  'Tanah', 'Bangunan', 'Tanah & Bangunan', 'Tanah & Bangunan Pabrik', 'Tanah & Bangunan Filling Station',
  'Tanah (Asset Sitaan)', 'Kendaraan', 'PC', 'Server', 'Perlengkapan Bengkel', 'Lainnya',
]

export function TidakProduktifFormModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_TIDAK_PRODUKTIF, ...pick(initial, EMPTY_TIDAK_PRODUKTIF) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isTanahBangunan = form.jenis.toLowerCase().includes('tanah') || form.jenis.toLowerCase().includes('bangunan')

  async function submit(e) {
    e.preventDefault()
    if (!form.jenis.trim()) { setErr('Jenis aset wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        jenis: form.jenis.trim(),
        nama: n(form.nama),
        sertifikatHak: n(form.sertifikatHak),
        sertifikatJangkaWaktu: form.sertifikatJangkaWaktu || null,
        sertifikatNo: n(form.sertifikatNo),
        sertifikatTahun: form.sertifikatTahun === '' ? null : Number(form.sertifikatTahun),
        sertifikatKeterangan: n(form.sertifikatKeterangan),
        lokasi: n(form.lokasi),
        qty: form.qty === '' ? null : Number(form.qty),
        satuan: form.satuan,
        statusJaminan: n(form.statusJaminan),
        hargaPasar: form.hargaPasar === '' ? null : Number(form.hargaPasar),
        appraisalHarga: form.appraisalHarga === '' ? null : Number(form.appraisalHarga),
        appraisalKjpp: n(form.appraisalKjpp),
        appraisalTahun: form.appraisalTahun === '' ? null : Number(form.appraisalTahun),
        appraisalNo: n(form.appraisalNo),
        pbbNop: n(form.pbbNop),
        pbbNominal: form.pbbNominal === '' ? null : Number(form.pbbNominal),
        pbbTglPembayaran: form.pbbTglPembayaran || null,
        catatanAkt: form.catatanAkt === '' ? null : form.catatanAkt,
        perijinanPemegangSaham: n(form.perijinanPemegangSaham),
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title={initial ? 'Ubah Aset Tidak Produktif' : 'Tambah Aset Tidak Produktif'} onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f">Jenis
        <input list="jenis-suggestions" value={form.jenis} onChange={set('jenis')} placeholder="mis. Tanah & Bangunan Pabrik" />
        <datalist id="jenis-suggestions">{JENIS_SUGGESTIONS.map((k) => <option key={k} value={k} />)}</datalist>
      </label>
      <label className="aset__f">Nama / Deskripsi<input value={form.nama} onChange={set('nama')} placeholder="opsional" /></label>
      <label className="aset__f aset__f--full">Lokasi<input value={form.lokasi} onChange={set('lokasi')} /></label>
      <label className="aset__f">Qty<input type="number" step="any" value={form.qty} onChange={set('qty')} /></label>
      <label className="aset__f">Satuan<input value={form.satuan} onChange={set('satuan')} placeholder="M2" /></label>
      <label className="aset__f">Status Jaminan<input value={form.statusJaminan} onChange={set('statusJaminan')} placeholder="mis. Bank Mandiri / Tidak Dijaminkan" /></label>
      <label className="aset__f">Catatan Akt<select value={form.catatanAkt} onChange={set('catatanAkt')}>
        <option value="">—</option>
        <option value="Y">Y</option>
        <option value="T">T</option>
      </select></label>
      {isTanahBangunan && (
        <>
          <label className="aset__f">Sertifikat - Hak<input value={form.sertifikatHak} onChange={set('sertifikatHak')} placeholder="mis. HGB a.n PT..." /></label>
          <label className="aset__f">Sertifikat - No.<input value={form.sertifikatNo} onChange={set('sertifikatNo')} placeholder="mis. Sertifikat Nomor 1" /></label>
          <label className="aset__f">Sertifikat - Jangka Waktu<input type="date" value={form.sertifikatJangkaWaktu} onChange={set('sertifikatJangkaWaktu')} /></label>
          <label className="aset__f">Sertifikat - Tahun<input type="number" value={form.sertifikatTahun} onChange={set('sertifikatTahun')} /></label>
          <label className="aset__f aset__f--full">Sertifikat - Keterangan<input value={form.sertifikatKeterangan} onChange={set('sertifikatKeterangan')} /></label>
        </>
      )}
      <label className="aset__f">Harga Pasar (Rp)<input type="number" step="any" value={form.hargaPasar} onChange={set('hargaPasar')} /></label>
      <label className="aset__f">Appraisal - Harga (Rp)<input type="number" step="any" value={form.appraisalHarga} onChange={set('appraisalHarga')} /></label>
      <label className="aset__f">Appraisal - KJPP<input value={form.appraisalKjpp} onChange={set('appraisalKjpp')} placeholder="mis. Benedictus Darmapuspita & Rekan" /></label>
      <label className="aset__f">Appraisal - Tahun<input type="number" value={form.appraisalTahun} onChange={set('appraisalTahun')} /></label>
      <label className="aset__f aset__f--full">Appraisal - No.<input value={form.appraisalNo} onChange={set('appraisalNo')} placeholder="mis. 00008/2.0103-01/PI/05/0411/I/II/2025 Tgl.20 Februari 2025" /></label>
      <label className="aset__f">PBB - NOP<input value={form.pbbNop} onChange={set('pbbNop')} /></label>
      <label className="aset__f">PBB - Nominal (Rp)<input type="number" step="any" value={form.pbbNominal} onChange={set('pbbNominal')} /></label>
      <label className="aset__f">PBB - Tgl Pembayaran<input type="date" value={form.pbbTglPembayaran} onChange={set('pbbTglPembayaran')} /></label>
      <label className="aset__f aset__f--full">Perijinan ke Pemegang Saham<textarea rows={2} value={form.perijinanPemegangSaham} onChange={set('perijinanPemegangSaham')} placeholder="mis. Keputusan Pemegang Saham Di Luar RUPS tentang Penghapusbukuan Aset..." /></label>
    </Modal>
  )
}

const EMPTY_AKTIVITAS = { idAset: '', jenis: 'Kunjungan Calon Pembeli', tglAktivitas: '', deskripsi: '', pihakTerkait: '', nilaiNego: '' }

const AKTIVITAS_JENIS_SUGGESTIONS = [
  'Pembersihan Lingkungan', 'Kunjungan Calon Pembeli', 'Negosiasi Harga', 'Negosiasi dengan Customer', 'Perawatan/Keamanan', 'Lainnya',
]

export function AktivitasFormModal({ initial, daftarAset, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_AKTIVITAS, ...pick(initial, EMPTY_AKTIVITAS), idAset: initial?.idAset ?? '' }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isNego = form.jenis.toLowerCase().includes('nego') || form.jenis.toLowerCase().includes('pembeli')

  async function submit(e) {
    e.preventDefault()
    if (!form.idAset) { setErr('Pilih aset terlebih dahulu.'); return }
    if (!form.jenis.trim()) { setErr('Jenis aktivitas wajib diisi.'); return }
    if (!form.tglAktivitas) { setErr('Tanggal aktivitas wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        idAset: Number(form.idAset),
        jenis: form.jenis.trim(),
        tglAktivitas: form.tglAktivitas,
        deskripsi: n(form.deskripsi),
        pihakTerkait: n(form.pihakTerkait),
        nilaiNego: form.nilaiNego === '' ? null : Number(form.nilaiNego),
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title={initial ? 'Ubah Aktivitas' : 'Catat Aktivitas Baru'} onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f aset__f--full">Aset
        <select value={form.idAset} onChange={set('idAset')}>
          <option value="">— pilih aset —</option>
          {daftarAset.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      <label className="aset__f">Jenis Aktivitas
        <input list="aktivitas-jenis-suggestions" value={form.jenis} onChange={set('jenis')} placeholder="mis. Kunjungan Calon Pembeli" />
        <datalist id="aktivitas-jenis-suggestions">{AKTIVITAS_JENIS_SUGGESTIONS.map((k) => <option key={k} value={k} />)}</datalist>
      </label>
      <label className="aset__f">Tanggal<input type="date" value={form.tglAktivitas} onChange={set('tglAktivitas')} /></label>
      {isNego && (
        <>
          <label className="aset__f">Pihak Terkait<input value={form.pihakTerkait} onChange={set('pihakTerkait')} placeholder="mis. nama calon pembeli" /></label>
          <label className="aset__f">Nilai Nego (Rp)<input type="number" step="any" value={form.nilaiNego} onChange={set('nilaiNego')} /></label>
        </>
      )}
      <label className="aset__f aset__f--full">Deskripsi<textarea rows={3} value={form.deskripsi} onChange={set('deskripsi')} placeholder="mis. Calon pembeli melakukan pengecekan lokasi & menawar harga..." /></label>
    </Modal>
  )
}

export function PicBadge({ status }) {
  const map = { Aktif: 'ok', Dikembalikan: 'off', Dipindahkan: 'info' }
  return <span className={`aset__badge aset__badge--${map[status] || 'off'}`}>{status}</span>
}
export function AktivitasStatusBadge({ status }) {
  const map = { Dijadwalkan: 'info', Proses: 'warn', Selesai: 'ok', Batal: 'off' }
  return <span className={`aset__badge aset__badge--${map[status] || 'off'}`}>{status}</span>
}

const EMPTY_KONDISI = { kondisi: 'Baik', catatan: '' }

export function KondisiFormModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_KONDISI, ...pick(initial, EMPTY_KONDISI) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setErr('')
    try { await onSubmit({ kondisi: form.kondisi, catatan: n(form.catatan) }) }
    catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title="Catat Kondisi Aset" onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f">Kondisi
        <select value={form.kondisi} onChange={set('kondisi')}>{['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} placeholder="opsional" /></label>
      <p className="aset__muted" style={{ gridColumn: '1 / -1', fontSize: '0.78rem', margin: 0 }}>
        Ini menambah baris riwayat baru — kondisi sebelumnya tetap tersimpan sebagai histori.
      </p>
    </Modal>
  )
}

const EMPTY_NOMOR = { nomorAset: '', catatan: '' }

export function NomorInternalFormModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_NOMOR, ...pick(initial, EMPTY_NOMOR) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.nomorAset.trim()) { setErr('Nomor aset wajib diisi.'); return }
    setSaving(true); setErr('')
    try { await onSubmit({ nomorAset: form.nomorAset.trim(), catatan: n(form.catatan) }) }
    catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title="Nomor Aset Internal" onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f aset__f--full">Nomor Aset<input value={form.nomorAset} onChange={set('nomorAset')} placeholder="mis. AST-2026-0001" /></label>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} placeholder="opsional" /></label>
    </Modal>
  )
}

const EMPTY_PIC = { jenisPic: 'Orang', nik: '', namaTampil: '', idUnit: '', tglMulai: '', catatan: '' }

export function PicFormModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_PIC)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [bagianList, setBagianList] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (form.jenisPic === 'Bagian' && bagianList.length === 0) {
      api.listBagianAset().then(setBagianList).catch(() => setBagianList([]))
    }
  }, [form.jenisPic, bagianList.length])

  function pilihJenis(jenis) {
    setForm((f) => ({ ...EMPTY_PIC, jenisPic: jenis, tglMulai: f.tglMulai, catatan: f.catatan }))
  }

  async function submit(e) {
    e.preventDefault()
    if (form.jenisPic === 'Orang' && !form.nik.trim()) { setErr('Pilih pegawai terlebih dahulu.'); return }
    if (form.jenisPic === 'Bagian' && !form.idUnit) { setErr('Pilih Bagian terlebih dahulu.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        jenisPic: form.jenisPic,
        nik: form.jenisPic === 'Orang' ? form.nik.trim() : null,
        idUnit: form.jenisPic === 'Bagian' ? Number(form.idUnit) : null,
        tglMulai: form.tglMulai || null,
        catatan: n(form.catatan),
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title="Tetapkan PIC Aset" onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f aset__f--full">Jenis PIC
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" className={`aset__btn ${form.jenisPic === 'Orang' ? '' : 'aset__btn--ghost'}`} onClick={() => pilihJenis('Orang')}>Individu</button>
          <button type="button" className={`aset__btn ${form.jenisPic === 'Bagian' ? '' : 'aset__btn--ghost'}`} onClick={() => pilihJenis('Bagian')}>Bagian</button>
        </div>
      </label>

      {form.jenisPic === 'Orang' ? (
        <label className="aset__f aset__f--full">Pegawai
          <button type="button" className="aset__search" style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => setPickerOpen(true)}>
            <Search size={14} />
            {form.namaTampil ? <span>{form.namaTampil} ({form.nik})</span> : <span className="aset__muted">Klik untuk cari pegawai…</span>}
          </button>
        </label>
      ) : (
        <label className="aset__f aset__f--full">Bagian
          <select value={form.idUnit} onChange={set('idUnit')}>
            <option value="">— pilih Bagian —</option>
            {bagianList.map((b) => <option key={b.id} value={b.id}>{b.nama}{b.namaDepartemen ? ` — ${b.namaDepartemen}` : ''}</option>)}
          </select>
        </label>
      )}

      <label className="aset__f">Tgl Mulai<input type="date" value={form.tglMulai} onChange={set('tglMulai')} /></label>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} placeholder="opsional" /></label>
      <p className="aset__muted" style={{ gridColumn: '1 / -1', fontSize: '0.78rem', margin: 0 }}>
        PIC sebelumnya (kalau ada) otomatis ditutup statusnya jadi "Dipindahkan".
      </p>

      {pickerOpen && (
        <AsetPegawaiPicker
          onClose={() => setPickerOpen(false)}
          onPick={(p) => setForm((f) => ({ ...f, nik: p.nik, namaTampil: p.nama }))}
        />
      )}
    </Modal>
  )
}

const EMPTY_AKTIVITAS_UMUM = { jenis: '', tglAktivitas: '', deskripsi: '', vendorPelaksana: '', biaya: '', status: 'Selesai' }

// groupAssetKode: kode GROUP_ASSET aset yang sedang dibuka (mis. "A04") - dipakai
// menyaring daftar Jenis Aktivitas dari master aset.jenis_aktivitas (via API), supaya
// hanya jenis yang relevan utk kategori aset ini yang tampil (+ jenis "Umum").
export function AktivitasUmumFormModal({ initial, groupAssetKode, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_AKTIVITAS_UMUM, ...pick(initial, EMPTY_AKTIVITAS_UMUM) }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [jenisList, setJenisList] = useState([])
  const [rekananOpsi, setRekananOpsi] = useState([])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    api.listJenisAktivitasAset().then(setJenisList).catch(() => setJenisList([]))
  }, [])

  // Autocomplete Vendor/Pelaksana dari dbo.akun_rekanan (GCS) - datalist, jadi tetap boleh
  // diketik manual kalau vendornya tidak ada di master ERP.
  useEffect(() => {
    const q = form.vendorPelaksana.trim()
    if (q.length < 2) { setRekananOpsi([]); return }
    const t = setTimeout(() => {
      api.cariRekananAset(q).then(setRekananOpsi).catch(() => setRekananOpsi([]))
    }, 300)
    return () => clearTimeout(t)
  }, [form.vendorPelaksana])

  const jenisTerfilter = jenisList.filter((j) => j.groupAsset.length === 0 || j.groupAsset.includes(groupAssetKode))

  async function submit(e) {
    e.preventDefault()
    if (!form.jenis.trim()) { setErr('Jenis aktivitas wajib diisi.'); return }
    if (!form.tglAktivitas) { setErr('Tanggal aktivitas wajib diisi.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        jenis: form.jenis.trim(),
        tglAktivitas: form.tglAktivitas,
        deskripsi: n(form.deskripsi),
        vendorPelaksana: n(form.vendorPelaksana),
        biaya: form.biaya === '' ? null : Number(form.biaya),
        status: form.status,
      })
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title={initial ? 'Ubah Aktivitas' : 'Catat Aktivitas Aset'} onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f aset__f--full">Jenis
        <select value={form.jenis} onChange={set('jenis')}>
          <option value="">— pilih jenis aktivitas —</option>
          {jenisTerfilter.map((j) => <option key={j.id} value={j.nama}>{j.nama}</option>)}
        </select>
      </label>
      <label className="aset__f">Tanggal<input type="date" value={form.tglAktivitas} onChange={set('tglAktivitas')} /></label>
      <label className="aset__f">Status
        <select value={form.status} onChange={set('status')}>{['Dijadwalkan', 'Proses', 'Selesai', 'Batal'].map((k) => <option key={k}>{k}</option>)}</select>
      </label>
      <label className="aset__f">Vendor/Pelaksana
        <input value={form.vendorPelaksana} onChange={set('vendorPelaksana')} list="rekanan-opsi" placeholder="ketik nama vendor…" />
        <datalist id="rekanan-opsi">{rekananOpsi.map((r) => <option key={r.kode} value={r.nama} />)}</datalist>
      </label>
      <label className="aset__f">Biaya (Rp)<input type="number" step="any" value={form.biaya} onChange={set('biaya')} /></label>
      <label className="aset__f aset__f--full">Deskripsi<textarea rows={3} value={form.deskripsi} onChange={set('deskripsi')} /></label>
    </Modal>
  )
}

const EMPTY_DOKUMEN = { jenisDokumen: '', nomorDokumen: '', tglTerbit: '', tglJatuhTempo: '', catatan: '' }
const JENIS_DOKUMEN_UMUM = ['Polis Asuransi', 'Kontrak/PO', 'Lainnya']
// Jenis dokumen relevan per kategori aset (GROUP_ASSET) - supaya mis. Kendaraan tidak
// menawarkan "Sertifikat Tanah"/"IMB/PBG". Kategori tak dikenal/null -> semua jenis tampil.
const JENIS_DOKUMEN_PER_KATEGORI = {
  A01: ['Sertifikat Tanah', ...JENIS_DOKUMEN_UMUM],                    // Tanah
  A02: ['Sertifikat Tanah', 'IMB/PBG', ...JENIS_DOKUMEN_UMUM],         // Bangunan & Instalasi Listrik
  A03: [...JENIS_DOKUMEN_UMUM],                                       // Mesin & Peralatan Pabrik
  A04: ['BPKB', 'STNK', ...JENIS_DOKUMEN_UMUM],                       // Kendaraan & Alat Berat
  A05: [...JENIS_DOKUMEN_UMUM],                                       // Inventaris Kantor
  A06: [...JENIS_DOKUMEN_UMUM],                                       // Aktiva Tak Berwujud
}
const JENIS_DOKUMEN_SEMUA = ['Sertifikat Tanah', 'IMB/PBG', 'BPKB', 'STNK', ...JENIS_DOKUMEN_UMUM]
export const MAX_DOKUMEN_BYTES = 15 * 1024 * 1024

// onSubmit dipanggil dengan (fields, file) - beda dari modal lain (JSON payload saja) karena
// dokumen butuh multipart/form-data. Parent (AsetDetail) yang memanggil api.uploadAsetDokumen.
// groupAssetKode: kode GROUP_ASSET aset yang sedang dibuka - menyaring pilihan Jenis Dokumen
// supaya cuma yang relevan utk kategori aset ini yang tampil.
export function DokumenFormModal({ groupAssetKode, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_DOKUMEN)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const jenisOpsi = JENIS_DOKUMEN_PER_KATEGORI[groupAssetKode] || JENIS_DOKUMEN_SEMUA

  function pilihFile(e) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_DOKUMEN_BYTES) {
      setErr(`Berkas "${f.name}" berukuran ${(f.size / 1024 / 1024).toFixed(1)} MB, melebihi batas 15 MB.`)
      e.target.value = ''
      setFile(null)
      return
    }
    setErr('')
    setFile(f)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.jenisDokumen) { setErr('Jenis dokumen wajib diisi.'); return }
    if (file && file.size > MAX_DOKUMEN_BYTES) { setErr('Berkas melebihi batas 15 MB — pilih berkas lain atau hapus lampirannya.'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        jenisDokumen: form.jenisDokumen,
        nomorDokumen: n(form.nomorDokumen),
        tglTerbit: form.tglTerbit || null,
        tglJatuhTempo: form.tglJatuhTempo || null,
        catatan: n(form.catatan),
      }, file)
    } catch (e2) { setErr(e2?.message || 'Gagal menyimpan.'); setSaving(false) }
  }

  return (
    <Modal title="Tambah Dokumen Aset" onClose={onClose} onSubmit={submit} saving={saving} err={err}>
      <label className="aset__f">Jenis Dokumen
        <select value={form.jenisDokumen} onChange={set('jenisDokumen')}>
          <option value="">— pilih jenis dokumen —</option>
          {jenisOpsi.map((k) => <option key={k}>{k}</option>)}
        </select>
      </label>
      <label className="aset__f">Nomor Dokumen<input value={form.nomorDokumen} onChange={set('nomorDokumen')} placeholder="opsional" /></label>
      <label className="aset__f">Tgl Terbit<input type="date" value={form.tglTerbit} onChange={set('tglTerbit')} /></label>
      <label className="aset__f">Tgl Jatuh Tempo<input type="date" value={form.tglJatuhTempo} onChange={set('tglJatuhTempo')} placeholder="opsional" /></label>
      <label className="aset__f aset__f--full">Berkas
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={pilihFile} />
      </label>
      <p className="aset__muted" style={{ gridColumn: '1 / -1', fontSize: '0.78rem', margin: 0 }}>
        Format PDF, JPG, atau PNG — ukuran berkas maksimal 15 MB.
      </p>
      <label className="aset__f aset__f--full">Catatan<textarea rows={2} value={form.catatan} onChange={set('catatan')} placeholder="opsional" /></label>
    </Modal>
  )
}

export function DokumenStatusBadge({ status }) {
  const map = { Aktif: 'ok', Nonaktif: 'off' }
  return <span className={`aset__badge aset__badge--${map[status] || 'off'}`}>{status}</span>
}

// util: ambil hanya key milik template, ubah null→'' agar cocok untuk input terkontrol
function pick(src, template) {
  if (!src) return {}
  const out = {}
  for (const k of Object.keys(template)) {
    const v = src[k]
    if (v === undefined) continue
    out[k] = v == null ? '' : v
  }
  return out
}
const n = (s) => (typeof s === 'string' && s.trim() === '' ? null : s)
