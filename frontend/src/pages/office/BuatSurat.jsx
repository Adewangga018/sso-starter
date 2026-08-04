import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Search, Send, Save, X } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

const SIFAT = ['Biasa', 'Terbatas', 'Rahasia']
const KECEPATAN = ['Biasa', 'Segera', 'Sangat Segera']

// Pemilih klasifikasi masalah: daftarnya 171 kode, jadi dropdown biasa tidak
// terpakai — dicari dengan mengetik kode atau kata pada uraian masalahnya.
function KlasifikasiPicker({ daftar, nilai, onChange }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const terpilih = daftar.find((k) => k.kode === nilai) || null
  const hasil = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return daftar.slice(0, 30)
    return daftar
      .filter((k) => k.kode.toLowerCase().includes(s) || k.masalah.toLowerCase().includes(s))
      .slice(0, 30)
  }, [daftar, q])

  if (terpilih) {
    return (
      <div className="mo-picker">
        <label className="mo-field__label">Klasifikasi Masalah</label>
        <div className="mo-klas">
          <div className="mo-klas__body">
            <div className="mo-klas__kode">{terpilih.kode}</div>
            <div className="mo-klas__masalah">{terpilih.masalah}</div>
          </div>
          <button type="button" onClick={() => { onChange(''); setQ('') }} aria-label="Ganti klasifikasi">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mo-picker">
      <label className="mo-field__label">Klasifikasi Masalah</label>
      <div className="mo-picker__input">
        <Search size={15} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Cari kode atau masalah…"
        />
      </div>
      {open && hasil.length > 0 && (
        <div className="mo-picker__results">
          {hasil.map((k) => (
            <button
              type="button"
              key={k.kode}
              className="mo-picker__result"
              onClick={() => { onChange(k.kode); setOpen(false) }}
            >
              <span className="mo-picker__name">{k.kode}</span>
              <span className="mo-picker__meta">{k.masalah}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Pemilih pegawai: cari (debounce), pilih dari hasil, tampil sebagai chip yang bisa dihapus.
function PegawaiPicker({ label, hint, selected, onChange }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const rows = await api.cariPegawaiOffice(q.trim())
        setResults(rows); setOpen(true)
      } catch { /* abaikan */ } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [q])

  function add(p) {
    if (!selected.some((s) => s.nik === p.nik)) onChange([...selected, p])
    setQ(''); setResults([]); setOpen(false)
  }
  function remove(nik) { onChange(selected.filter((s) => s.nik !== nik)) }

  return (
    <div className="mo-picker">
      <label className="mo-field__label">{label}{hint && <span className="mo-field__hint"> {hint}</span>}</label>
      <div className="mo-picker__input">
        <Search size={15} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Cari nama atau NIK…"
        />
        {loading && <Loader2 size={15} className="mo__spin" />}
      </div>
      {open && results.length > 0 && (
        <div className="mo-picker__results">
          {results.map((p) => (
            <button type="button" key={p.nik} className="mo-picker__result" onClick={() => add(p)}>
              <span className="mo-picker__name">{p.nama}</span>
              <span className="mo-picker__meta">{p.nik}{p.jabatan ? ` · ${p.jabatan}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mo-chips">
          {selected.map((p) => (
            <span className="mo-chip2" key={p.nik}>
              <span className="u-nama">{p.nama}</span>
              <button type="button" onClick={() => remove(p.nik)} aria-label="Hapus"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BuatSurat() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    jenis: '', kodeBagian: '', kodeKlasifikasi: '', sifat: 'Biasa', kecepatan: 'Biasa',
    judul: '', keterangan: '', tanggalSurat: '', berlakuMulai: '', berlakuSampai: '',
  })
  const [ref, setRef] = useState({ jenis: [], bagian: [], klasifikasi: [], bagianSaya: null })
  const [loadingRef, setLoadingRef] = useState(true)
  const [reviewer, setReviewer] = useState([])
  const [approver, setApprover] = useState([])
  const [tujuan, setTujuan] = useState([])
  const [cc, setCc] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Master kode surat menentukan isi tiga dropdown sekaligus nilai awal jenis &
  // bagian, jadi form baru bisa diisi setelah panggilan ini selesai.
  useEffect(() => {
    let alive = true
    api.getReferensiOffice()
      .then((d) => {
        if (!alive) return
        setRef(d)
        setForm((f) => ({
          ...f,
          jenis: f.jenis || d.jenis?.[0]?.kode || '',
          kodeBagian: f.kodeBagian || d.bagianSaya || '',
        }))
        setLoadingRef(false)
      })
      .catch((err) => {
        if (!alive) return
        setMsg({
          type: 'err',
          text: err instanceof ApiError ? err.message : 'Gagal memuat master kode surat.',
        })
        setLoadingRef(false)
      })
    return () => { alive = false }
  }, [])

  async function submit(kirim) {
    if (!form.judul.trim()) { setMsg({ type: 'err', text: 'Judul surat wajib diisi.' }); return }
    if (!form.kodeBagian) { setMsg({ type: 'err', text: 'Bagian penerbit wajib dipilih.' }); return }
    if (!form.kodeKlasifikasi) { setMsg({ type: 'err', text: 'Klasifikasi masalah wajib dipilih.' }); return }
    if (kirim && (reviewer.length === 0 || approver.length === 0)) {
      setMsg({ type: 'err', text: 'Reviewer dan Approver wajib dipilih sebelum dikirim.' }); return
    }
    setSaving(true); setMsg(null)
    const payload = {
      jenis: form.jenis,
      kodeBagian: form.kodeBagian,
      kodeKlasifikasi: form.kodeKlasifikasi,
      sifat: form.sifat,
      kecepatan: form.kecepatan,
      judul: form.judul.trim(),
      keterangan: form.keterangan.trim() || null,
      isi: null,
      tanggalSurat: form.tanggalSurat || null,
      berlakuMulai: form.berlakuMulai || null,
      berlakuSampai: form.berlakuSampai || null,
      penanggungJawab: [
        ...reviewer.map((p, i) => ({ peran: 'Reviewer', nik: p.nik, nama: p.nama, jabatan: p.jabatan, urutan: i + 1 })),
        ...approver.map((p, i) => ({ peran: 'Approver', nik: p.nik, nama: p.nama, jabatan: p.jabatan, urutan: i + 1 })),
      ],
      distribusi: [
        ...tujuan.map((p) => ({ tipe: 'Tujuan', nik: p.nik, nama: p.nama, jabatan: p.jabatan })),
        ...cc.map((p) => ({ tipe: 'CC', nik: p.nik, nama: p.nama, jabatan: p.jabatan })),
      ],
      kirimKeReviewer: kirim,
    }
    try {
      const res = await api.buatSurat(payload)
      // Draft -> buka detail agar bisa menambah lampiran lalu kirim; Kirim -> ke daftar.
      navigate(kirim ? '/my-office/daftar' : `/my-office/surat/${res.id}`)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan surat.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mo">
      <div className="mo__intro">
        <h2 className="mo__intro-title">Buat Surat</h2>
        <p className="mo__intro-sub">Lengkapi informasi surat, penanggung jawab, dan distribusi.</p>
      </div>

      {msg && <div className={`mo__alert mo__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* Nomor surat baru terbit saat surat disetujui — pratinjaunya membantu
          pembuat memastikan kode yang dipilih sudah benar sejak awal. */}
      {form.kodeBagian && form.kodeKlasifikasi && form.jenis && (
        <div className="mo-nomor-preview">
          <span>Nomor surat nanti</span>
          <b>{`#####/${form.kodeBagian}/${form.kodeKlasifikasi}/${form.jenis}/${new Date().getFullYear()}`}</b>
        </div>
      )}

      {/* Informasi Surat */}
      <div className="mo-card">
        <div className="mo-card__head">01 · Informasi Surat</div>
        <div className="mo-form-grid">
          <div className="mo-field">
            <label className="mo-field__label">Jenis Surat</label>
            <select value={form.jenis} onChange={(e) => set('jenis', e.target.value)} disabled={loadingRef}>
              {ref.jenis.map((j) => <option key={j.kode} value={j.kode}>{j.kode} · {j.nama}</option>)}
            </select>
          </div>
          <div className="mo-field">
            <label className="mo-field__label">
              Bagian Penerbit
              {ref.bagianSaya && form.kodeBagian === ref.bagianSaya && (
                <span className="mo-field__hint"> (dari unit kerja Anda)</span>
              )}
            </label>
            <select value={form.kodeBagian} onChange={(e) => set('kodeBagian', e.target.value)} disabled={loadingRef}>
              <option value="">— pilih bagian —</option>
              {ref.bagian.map((b) => <option key={b.kode} value={b.kode}>{b.kode} · {b.nama}</option>)}
            </select>
          </div>
          <div className="mo-field mo-field--full">
            <KlasifikasiPicker
              daftar={ref.klasifikasi}
              nilai={form.kodeKlasifikasi}
              onChange={(v) => set('kodeKlasifikasi', v)}
            />
          </div>
          <div className="mo-field">
            <label className="mo-field__label">Sifat</label>
            <select value={form.sifat} onChange={(e) => set('sifat', e.target.value)}>
              {SIFAT.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="mo-field">
            <label className="mo-field__label">Kecepatan Tanggapan</label>
            <select value={form.kecepatan} onChange={(e) => set('kecepatan', e.target.value)}>
              {KECEPATAN.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="mo-field mo-field--full">
            <label className="mo-field__label">Judul / Perihal</label>
            <input value={form.judul} onChange={(e) => set('judul', e.target.value)} placeholder="Judul atau perihal surat" required />
          </div>
          <div className="mo-field">
            <label className="mo-field__label">Tanggal Surat <span className="mo-field__hint">(opsional)</span></label>
            <input type="date" value={form.tanggalSurat} onChange={(e) => set('tanggalSurat', e.target.value)} />
          </div>
          <div className="mo-field">
            <label className="mo-field__label">Berlaku Mulai <span className="mo-field__hint">(opsional)</span></label>
            <input type="date" value={form.berlakuMulai} onChange={(e) => set('berlakuMulai', e.target.value)} />
          </div>
          <div className="mo-field">
            <label className="mo-field__label">Berlaku Sampai <span className="mo-field__hint">(opsional)</span></label>
            <input type="date" value={form.berlakuSampai} onChange={(e) => set('berlakuSampai', e.target.value)} />
          </div>
          <div className="mo-field mo-field--full">
            <label className="mo-field__label">Keterangan <span className="mo-field__hint">(opsional)</span></label>
            <textarea rows={3} value={form.keterangan} onChange={(e) => set('keterangan', e.target.value)} placeholder="Keterangan tambahan…" />
          </div>
        </div>
      </div>

      {/* Penanggung Jawab */}
      <div className="mo-card">
        <div className="mo-card__head">02 · Penanggung Jawab</div>
        <div className="mo-form-grid">
          <PegawaiPicker label="Reviewer" hint="(wajib untuk dikirim)" selected={reviewer} onChange={setReviewer} />
          <PegawaiPicker label="Approver" hint="(wajib untuk dikirim)" selected={approver} onChange={setApprover} />
        </div>
      </div>

      {/* Distribusi */}
      <div className="mo-card">
        <div className="mo-card__head">03 · Distribusi Surat</div>
        <div className="mo-form-grid">
          <PegawaiPicker label="Tujuan" selected={tujuan} onChange={setTujuan} />
          <PegawaiPicker label="Tembusan (CC)" selected={cc} onChange={setCc} />
        </div>
      </div>

      <div className="mo-actions">
        <button type="button" className="mo-btn mo-btn--ghost" onClick={() => navigate('/my-office/daftar')} disabled={saving}>Batal</button>
        <button type="button" className="mo-btn mo-btn--soft" onClick={() => submit(false)} disabled={saving}>
          <Save size={16} /> Simpan Draft
        </button>
        <button type="button" className="mo-btn" onClick={() => submit(true)} disabled={saving}>
          {saving ? <Loader2 size={16} className="mo__spin" /> : <Send size={16} />} Kirim ke Reviewer
        </button>
      </div>
    </div>
  )
}
