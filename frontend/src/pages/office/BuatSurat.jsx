import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Search, Send, Save, X } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

const JENIS = ['Surat', 'SP', 'ASP', 'Memo']
const SIFAT = ['Biasa', 'Terbatas', 'Rahasia']
const KECEPATAN = ['Biasa', 'Segera', 'Sangat Segera']

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
              {p.nama}
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
    jenis: 'Surat', klasifikasi: '', sifat: 'Biasa', kecepatan: 'Biasa',
    judul: '', keterangan: '', tanggalSurat: '', berlakuMulai: '', berlakuSampai: '',
  })
  const [reviewer, setReviewer] = useState([])
  const [approver, setApprover] = useState([])
  const [tujuan, setTujuan] = useState([])
  const [cc, setCc] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isSP = form.jenis === 'SP' || form.jenis === 'ASP'

  async function submit(kirim) {
    if (!form.judul.trim()) { setMsg({ type: 'err', text: 'Judul surat wajib diisi.' }); return }
    if (kirim && (reviewer.length === 0 || approver.length === 0)) {
      setMsg({ type: 'err', text: 'Reviewer dan Approver wajib dipilih sebelum dikirim.' }); return
    }
    setSaving(true); setMsg(null)
    const payload = {
      jenis: form.jenis,
      klasifikasi: form.klasifikasi.trim() || null,
      sifat: form.sifat,
      kecepatan: form.kecepatan,
      judul: form.judul.trim(),
      keterangan: form.keterangan.trim() || null,
      isi: null,
      tanggalSurat: form.tanggalSurat || null,
      berlakuMulai: isSP ? (form.berlakuMulai || null) : null,
      berlakuSampai: isSP ? (form.berlakuSampai || null) : null,
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

      {/* Informasi Surat */}
      <div className="mo-card">
        <div className="mo-card__head">01 · Informasi Surat</div>
        <div className="mo-form-grid">
          <div className="mo-field">
            <label className="mo-field__label">Jenis Surat</label>
            <select value={form.jenis} onChange={(e) => set('jenis', e.target.value)}>
              {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="mo-field">
            <label className="mo-field__label">Klasifikasi <span className="mo-field__hint">(opsional)</span></label>
            <input value={form.klasifikasi} onChange={(e) => set('klasifikasi', e.target.value)} placeholder="mis. 01.01/BA" />
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
          {isSP && (
            <>
              <div className="mo-field">
                <label className="mo-field__label">Berlaku Mulai</label>
                <input type="date" value={form.berlakuMulai} onChange={(e) => set('berlakuMulai', e.target.value)} />
              </div>
              <div className="mo-field">
                <label className="mo-field__label">Berlaku Sampai</label>
                <input type="date" value={form.berlakuSampai} onChange={(e) => set('berlakuSampai', e.target.value)} />
              </div>
            </>
          )}
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
