import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, Paperclip, Send, Trash2, Upload, X } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import './office.css'

function formatSize(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function StatusBadge({ status }) {
  const slug = status.toLowerCase().replace(/\s+/g, '-')
  return <span className={`mo-status mo-status--${slug}`}>{status}</span>
}
function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export default function SuratDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [komentar, setKomentar] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setData(await api.getSuratDetail(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat surat.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function act(fn, okText) {
    setBusy(true); setMsg(null)
    try {
      await fn(id)
      setMsg({ type: 'ok', text: okText })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    } finally {
      setBusy(false)
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg(null)
    try {
      await api.uploadLampiranSurat(id, file)
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengunggah lampiran.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onDeleteLamp(lampId) {
    try {
      await api.hapusLampiranSurat(id, lampId)
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus lampiran.' })
    }
  }

  async function onDownload(l) {
    try {
      await api.unduhLampiranSurat(id, l.id, l.namaFile)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengunduh lampiran.' })
    }
  }

  async function doPengesahan(aksi) {
    setBusy(true); setMsg(null)
    try {
      await api.aksiPengesahanSurat(id, { aksi, komentar: komentar.trim() || null })
      setKomentar('')
      const label = aksi === 'Setujui' ? 'disetujui' : aksi === 'Tolak' ? 'ditolak' : 'diminta revisi'
      setMsg({ type: 'ok', text: `Surat ${label}.` })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="mo"><div className="mo__loading"><Loader2 className="mo__spin" size={20} /> Memuat…</div></div>
  if (error) return <div className="mo"><div className="mo__alert mo__alert--err">{error}</div></div>
  if (!data) return null

  const reviewer = data.penanggungJawab.filter((p) => p.peran === 'Reviewer')
  const approver = data.penanggungJawab.filter((p) => p.peran === 'Approver')
  const tujuan = data.distribusi.filter((d) => d.tipe === 'Tujuan')
  const cc = data.distribusi.filter((d) => d.tipe === 'CC')
  const bisaAksi = data.isPembuat && (data.status === 'Draft' || data.status === 'Revisi')

  return (
    <div className="mo">
      <button type="button" className="mo__back" onClick={() => navigate('/my-office/daftar')}><ArrowLeft size={16} /> Daftar Surat</button>

      <div className="mo__head-row">
        <div>
          <h2 className="mo__intro-title">{data.judul}</h2>
          <p className="mo__intro-sub">{data.jenis}{data.nomor ? ` · ${data.nomor}` : ''} · Dibuat {formatTgl(data.dibuatPada)}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {msg && <div className={`mo__alert mo__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="mo-card">
        <div className="mo-card__head">Informasi Surat</div>
        <div className="mo-detail-grid">
          <div><span>Jenis</span><b>{data.jenis}</b></div>
          <div><span>Sifat</span><b>{data.sifat}</b></div>
          <div><span>Kecepatan</span><b>{data.kecepatan}</b></div>
          <div><span>Klasifikasi</span><b>{data.klasifikasi || '-'}</b></div>
          <div><span>Tanggal Surat</span><b>{formatTgl(data.tanggalSurat)}</b></div>
          <div><span>Pembuat</span><b>{data.pembuatNama || data.pembuatNik}</b></div>
          {data.berlakuMulai && <div><span>Berlaku</span><b>{formatTgl(data.berlakuMulai)} – {formatTgl(data.berlakuSampai)}</b></div>}
          {data.keterangan && <div className="mo-detail--full"><span>Keterangan</span><b>{data.keterangan}</b></div>}
        </div>
      </div>

      <div className="mo-card">
        <div className="mo-card__head">Penanggung Jawab</div>
        <div className="mo-pjcols">
          <div>
            <div className="mo-pjcols__title">Reviewer</div>
            {reviewer.length === 0 ? <div className="mo-empty2">—</div> : reviewer.map((p) => (
              <div className="mo-person2" key={p.id}>
                <div><div className="mo-person2__name">{p.nama || p.nik}</div><div className="mo-person2__meta">{p.jabatan || p.nik}</div></div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
          <div>
            <div className="mo-pjcols__title">Approver</div>
            {approver.length === 0 ? <div className="mo-empty2">—</div> : approver.map((p) => (
              <div className="mo-person2" key={p.id}>
                <div><div className="mo-person2__name">{p.nama || p.nik}</div><div className="mo-person2__meta">{p.jabatan || p.nik}</div></div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {(tujuan.length > 0 || cc.length > 0) && (
        <div className="mo-card">
          <div className="mo-card__head">Distribusi</div>
          <div className="mo-pjcols">
            <div>
              <div className="mo-pjcols__title">Tujuan</div>
              {tujuan.length === 0 ? <div className="mo-empty2">—</div> : tujuan.map((d) => (
                <div className="mo-person2" key={d.id}><div><div className="mo-person2__name">{d.nama || d.nik}</div><div className="mo-person2__meta">{d.jabatan || d.nik}</div></div></div>
              ))}
            </div>
            <div>
              <div className="mo-pjcols__title">Tembusan (CC)</div>
              {cc.length === 0 ? <div className="mo-empty2">—</div> : cc.map((d) => (
                <div className="mo-person2" key={d.id}><div><div className="mo-person2__name">{d.nama || d.nik}</div><div className="mo-person2__meta">{d.jabatan || d.nik}</div></div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mo-card">
        <div className="mo-card__head" style={{ justifyContent: 'space-between' }}>
          <span>Lampiran</span>
          {bisaAksi && (
            <>
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={onUpload}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              />
              <button type="button" className="mo-btn mo-btn--soft" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 size={15} className="mo__spin" /> : <Upload size={15} />} Tambah Lampiran
              </button>
            </>
          )}
        </div>
        {data.lampiran.length === 0 ? (
          <div className="mo-empty2">Belum ada lampiran.</div>
        ) : (
          <div className="mo-lamp-list">
            {data.lampiran.map((l) => (
              <div className="mo-lamp" key={l.id}>
                <Paperclip size={15} />
                <button type="button" className="mo-lamp__name" onClick={() => onDownload(l)} title="Unduh">{l.namaFile}</button>
                {l.ukuran ? <span className="mo-lamp__size">{formatSize(l.ukuran)}</span> : null}
                {bisaAksi && (
                  <button type="button" className="mo-lamp__del" onClick={() => onDeleteLamp(l.id)} title="Hapus"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mo-card">
        <div className="mo-card__head">Riwayat</div>
        <div className="mo-riwayat">
          {data.riwayat.length === 0 ? <div className="mo-empty2">Belum ada riwayat.</div> : data.riwayat.map((r) => (
            <div className="mo-riwayat__item" key={r.id}>
              <div className="mo-riwayat__dot" />
              <div>
                <div className="mo-riwayat__aksi">{r.aksi}{r.olehNama ? ` · ${r.olehNama}` : ''}</div>
                <div className="mo-riwayat__tgl">{formatTgl(r.tgl)}{r.catatan ? ` — ${r.catatan}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.aksiPeran && (
        <div className="mo-card">
          <div className="mo-card__head">Tindakan {data.aksiPeran}</div>
          <textarea
            className="mo-approve__note"
            rows={2}
            placeholder="Komentar (opsional)…"
            value={komentar}
            onChange={(e) => setKomentar(e.target.value)}
          />
          <div className="mo-actions">
            <button type="button" className="mo-btn mo-btn--ghost" onClick={() => doPengesahan('Tolak')} disabled={busy}>Tolak</button>
            <button type="button" className="mo-btn mo-btn--soft" onClick={() => doPengesahan('Revisi')} disabled={busy}>Minta Revisi</button>
            <button type="button" className="mo-btn" onClick={() => doPengesahan('Setujui')} disabled={busy}>
              {busy ? <Loader2 size={16} className="mo__spin" /> : <CheckCircle2 size={16} />} Setujui
            </button>
          </div>
        </div>
      )}

      {bisaAksi && (
        <div className="mo-actions">
          <button type="button" className="mo-btn mo-btn--ghost" onClick={() => act(api.batalSurat, 'Surat dibatalkan.')} disabled={busy}>
            <X size={16} /> Batalkan
          </button>
          <button type="button" className="mo-btn" onClick={() => act(api.kirimSurat, 'Surat dikirim ke reviewer.')} disabled={busy}>
            {busy ? <Loader2 size={16} className="mo__spin" /> : <Send size={16} />} Kirim ke Reviewer
          </button>
        </div>
      )}
    </div>
  )
}
