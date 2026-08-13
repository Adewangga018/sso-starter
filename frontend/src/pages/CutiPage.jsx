import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CalendarRange, CheckCircle2, Flag, Info, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './CutiPage.css'

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// Jumlah hari kerja (Sen–Jum) inklusif — untuk pratinjau di form.
function hariKerja(mulai, selesai) {
  if (!mulai || !selesai) return 0
  const a = new Date(mulai), b = new Date(selesai)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  let n = 0
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const w = d.getDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

function StatusBadge({ status }) {
  const map = { Menunggu: 'wait', Disetujui: 'ok', Ditolak: 'no', Batal: 'off' }
  return <span className={`cuti__st cuti__st--${map[status] || 'off'}`}>{status}</span>
}

const EMPTY_CB = { tglMulai: '', tglSelesai: '', keterangan: '', mengurangiHak: true }
const EMPTY_NAS = { tglMulai: '', tglSelesai: '', keterangan: '' }

export default function CutiPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ tglMulai: '', tglSelesai: '', keterangan: '' })
  const [busy, setBusy] = useState(false)
  const [cbModal, setCbModal] = useState(null)   // {mode, entry}
  const [nasModal, setNasModal] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await api.getCuti()
      setData(d); setLoading(false)
    } catch (err) {
      if (isEmptyDataError(err)) { setData({ sisa: 0, adaData: false, pengajuan: [], persetujuan: [], riwayat: [], cutiBersamaList: [], cutiNasionalList: [] }) }
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat data cuti.')
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (type, text) => { setMsg({ type, text }); if (type === 'ok') setTimeout(() => setMsg(null), 4000) }

  async function ajukan(e) {
    e.preventDefault()
    if (!form.tglMulai || !form.tglSelesai) { flash('err', 'Tanggal mulai dan selesai wajib diisi.'); return }
    setBusy(true); setMsg(null)
    try {
      await api.ajukanCuti({ tglMulai: form.tglMulai, tglSelesai: form.tglSelesai, keterangan: form.keterangan.trim() || null })
      setForm({ tglMulai: '', tglSelesai: '', keterangan: '' }); setFormOpen(false)
      flash('ok', 'Pengajuan cuti terkirim, menunggu persetujuan atasan.'); await load()
    } catch (err) { flash('err', err instanceof ApiError ? err.message : 'Gagal mengajukan cuti.') }
    finally { setBusy(false) }
  }

  async function act(fn, okText) {
    setMsg(null)
    try { await fn(); flash('ok', okText); await load() }
    catch (err) { flash('err', err instanceof ApiError ? err.message : 'Aksi gagal.') }
  }

  if (loading) return <div className="cuti"><div className="cuti__loading"><Loader2 className="cuti__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="cuti"><div className="cuti__alert">{error}</div></div>
  if (!data) return null

  const previewHari = hariKerja(form.tglMulai, form.tglSelesai)
  const isAdmin = data.isAdminSdm

  return (
    <div className="cuti">
      <div className="cuti__intro">
        <h2 className="cuti__title">Cuti Tahunan</h2>
        <p className="cuti__sub">
          Akrual {data.hakPerTahun ?? 24} hari tiap 2 tahun sekali, di ulang tahun kerja (TMT) Anda — maksimal menumpuk {data.batasAkumulasi ?? 24} hari.
        </p>
      </div>

      {msg && <div className={`cuti__msg cuti__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="cuti__saldo">
        <div className="cuti__saldo-icon"><CalendarDays size={26} /></div>
        <div className="cuti__saldo-main">
          <div className="cuti__saldo-value">{data.sisa} <span>hari</span></div>
          <div className="cuti__saldo-label">Sisa Cuti Tahunan{data.periode ? ` · periode ${data.periode}` : ''}</div>
          {data.adaData && (
            <div className="cuti__saldo-break">
              Akrual {data.akrual}{data.cutiBersama > 0 ? ` − cuti bersama ${data.cutiBersama}` : ''} = <b>hak {data.hak} hari</b> · terpakai {data.diambil}
            </div>
          )}
          {data.tmt && (
            <div className="cuti__saldo-break">
              TMT {formatTgl(data.tmt)}
              {data.akrualBerikutnya ? ` · akrual berikutnya ${formatTgl(data.akrualBerikutnya)}` : ''}
            </div>
          )}
        </div>
        {data.adaData && (
          <button type="button" className="cuti__btn" onClick={() => setFormOpen((v) => !v)}>
            <Plus size={16} /> Ajukan Cuti
          </button>
        )}
      </div>

      {!data.adaData && (
        <div className="cuti__nodata">
          <Info size={15} />
          <span>Belum ada data saldo cuti untuk NIK Anda. Hubungi SDM bila seharusnya ada.</span>
        </div>
      )}

      {/* Form ajukan */}
      {formOpen && (
        <form className="cuti__card" onSubmit={ajukan}>
          <div className="cuti__card-head">Ajukan Cuti Tahunan</div>
          <div className="cuti__form">
            <label>Tanggal Mulai
              <input type="date" value={form.tglMulai} onChange={(e) => setForm((f) => ({ ...f, tglMulai: e.target.value }))} required />
            </label>
            <label>Tanggal Selesai
              <input type="date" value={form.tglSelesai} min={form.tglMulai || undefined} onChange={(e) => setForm((f) => ({ ...f, tglSelesai: e.target.value }))} required />
            </label>
            <label className="cuti__form-full">Keterangan <span>(opsional)</span>
              <input value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} placeholder="Alasan / catatan cuti" />
            </label>
          </div>
          <div className="cuti__form-foot">
            <span className="cuti__preview">{previewHari > 0 ? `${previewHari} hari kerja` : 'Pilih rentang tanggal'}</span>
            <div className="cuti__form-actions">
              <button type="button" className="cuti__btn cuti__btn--ghost" onClick={() => setFormOpen(false)}>Batal</button>
              <button type="submit" className="cuti__btn" disabled={busy}>{busy ? <Loader2 size={16} className="cuti__spin" /> : <CheckCircle2 size={16} />} Kirim Pengajuan</button>
            </div>
          </div>
        </form>
      )}

      {/* Persetujuan (atasan) */}
      {data.persetujuan?.length > 0 && (
        <div className="cuti__card">
          <div className="cuti__card-head">Menunggu Persetujuan Anda</div>
          <div className="cuti__list">
            {data.persetujuan.map((p) => (
              <div className="cuti__item" key={p.id}>
                <div className="cuti__item-main">
                  <div className="cuti__item-title">{p.nama || p.idKaryawan} · <b>{p.jumlahHari} hari</b></div>
                  <div className="cuti__item-sub">{formatTgl(p.tglMulai)} – {formatTgl(p.tglSelesai)}{p.keterangan ? ` · ${p.keterangan}` : ''}</div>
                </div>
                <div className="cuti__item-actions">
                  <button type="button" className="cuti__btn cuti__btn--ghost" onClick={() => act(() => api.putusanCuti(p.id, { setuju: false }), 'Pengajuan ditolak.')}>Tolak</button>
                  <button type="button" className="cuti__btn" onClick={() => act(() => api.putusanCuti(p.id, { setuju: true }), 'Pengajuan disetujui, saldo pemohon berkurang.')}>Setujui</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pengajuan saya */}
      <div className="cuti__card">
        <div className="cuti__card-head">Pengajuan Saya</div>
        <div className="cuti__table-wrap">
          <table className="cuti__table">
            <thead><tr><th>Tanggal</th><th>Hari</th><th>Keterangan</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data.pengajuan?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="cuti__empty">Belum ada pengajuan cuti.</td></tr>
              )}
              {(data.pengajuan ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{formatTgl(p.tglMulai)} – {formatTgl(p.tglSelesai)}</td>
                  <td>{p.jumlahHari}</td>
                  <td className="cuti__ket">{p.keterangan || '-'}{p.komentar ? ` (atasan: ${p.komentar})` : ''}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.status === 'Menunggu' && (
                    <button type="button" className="cuti__link-del" onClick={() => act(() => api.batalCuti(p.id), 'Pengajuan dibatalkan.')} title="Batalkan"><X size={14} /></button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cuti Bersama (info untuk semua; CRUD utk Admin SDM) */}
      <div className="cuti__card">
        <div className="cuti__card-head">
          <span><CalendarRange size={16} /> Cuti Bersama</span>
          {isAdmin && <button type="button" className="cuti__btn cuti__btn--sm" onClick={() => setCbModal({ mode: 'buat', entry: { ...EMPTY_CB } })}><Plus size={14} /> Tambah</button>}
        </div>
        <KalenderList
          items={data.cutiBersamaList}
          isAdmin={isAdmin}
          kind="cb"
          onEdit={(x) => setCbModal({ mode: 'ubah', entry: { id: x.id, tglMulai: x.tglMulai, tglSelesai: x.tglSelesai, keterangan: x.keterangan, mengurangiHak: x.mengurangiHak } })}
          onDelete={(x) => window.confirm(`Hapus cuti bersama "${x.keterangan}"?`) && act(() => api.hapusCutiBersama(x.id), 'Cuti bersama dihapus, saldo dihitung ulang.')}
        />
      </div>

      {/* Cuti Nasional */}
      <div className="cuti__card">
        <div className="cuti__card-head">
          <span><Flag size={16} /> Cuti Nasional / Hari Libur</span>
          {isAdmin && <button type="button" className="cuti__btn cuti__btn--sm" onClick={() => setNasModal({ mode: 'buat', entry: { ...EMPTY_NAS } })}><Plus size={14} /> Tambah</button>}
        </div>
        <KalenderList
          items={data.cutiNasionalList}
          isAdmin={isAdmin}
          kind="nas"
          onEdit={(x) => setNasModal({ mode: 'ubah', entry: { id: x.id, tglMulai: x.tglMulai, tglSelesai: x.tglSelesai, keterangan: x.keterangan } })}
          onDelete={(x) => window.confirm(`Hapus cuti nasional "${x.keterangan}"?`) && act(() => api.hapusCutiNasional(x.id), 'Cuti nasional dihapus.')}
        />
      </div>

      {(data.riwayat?.length ?? 0) > 0 && (
        <div className="cuti__card">
          <div className="cuti__card-head">Riwayat Cuti (data lama SDM)</div>
          <div className="cuti__table-wrap">
            <table className="cuti__table">
              <thead><tr><th>Kode</th><th>Tanggal Ajuan</th><th>Keterangan</th><th>Status</th></tr></thead>
              <tbody>
                {data.riwayat.map((r, i) => (
                  <tr key={i}>
                    <td>{r.kode || '-'}</td>
                    <td>{formatTgl(r.tanggal)}</td>
                    <td className="cuti__ket">{r.keterangan || '-'}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Cuti Bersama */}
      {cbModal && (
        <KalenderForm
          title={cbModal.mode === 'buat' ? 'Tambah Cuti Bersama' : 'Ubah Cuti Bersama'}
          entry={cbModal.entry}
          withFlag
          onClose={() => setCbModal(null)}
          onSubmit={async (payload) => {
            try {
              if (cbModal.mode === 'buat') await api.buatCutiBersama(payload)
              else await api.ubahCutiBersama(cbModal.entry.id, payload)
              setCbModal(null); flash('ok', 'Cuti bersama disimpan, saldo semua karyawan dihitung ulang.'); await load()
            } catch (err) { flash('err', err instanceof ApiError ? err.message : 'Gagal menyimpan.') }
          }}
        />
      )}

      {/* Modal Cuti Nasional */}
      {nasModal && (
        <KalenderForm
          title={nasModal.mode === 'buat' ? 'Tambah Cuti Nasional' : 'Ubah Cuti Nasional'}
          entry={nasModal.entry}
          onClose={() => setNasModal(null)}
          onSubmit={async (payload) => {
            try {
              if (nasModal.mode === 'buat') await api.buatCutiNasional(payload)
              else await api.ubahCutiNasional(nasModal.entry.id, payload)
              setNasModal(null); flash('ok', 'Cuti nasional disimpan.'); await load()
            } catch (err) { flash('err', err instanceof ApiError ? err.message : 'Gagal menyimpan.') }
          }}
        />
      )}
    </div>
  )
}

function KalenderList({ items, isAdmin, kind, onEdit, onDelete }) {
  const list = items || []
  if (list.length === 0) return <div className="cuti__empty cuti__empty--pad">Belum ada data.</div>
  return (
    <div className="cuti__kal">
      {list.map((x) => (
        <div className="cuti__kal-row" key={x.id}>
          <div className="cuti__kal-date">{formatTgl(x.tglMulai)}{x.tglSelesai !== x.tglMulai ? ` – ${formatTgl(x.tglSelesai)}` : ''}</div>
          <div className="cuti__kal-main">
            <span className="cuti__kal-ket">{x.keterangan}</span>
            <span className="cuti__kal-days">{x.jumlahHari} hari</span>
            {kind === 'cb' && (
              x.mengurangiHak
                ? <span className="cuti__tag cuti__tag--red">mengurangi hak</span>
                : <span className="cuti__tag cuti__tag--grey">tidak mengurangi</span>
            )}
          </div>
          {isAdmin && (
            <div className="cuti__kal-act">
              <button type="button" className="cuti__ibtn" title="Ubah" onClick={() => onEdit(x)}><Pencil size={14} /></button>
              <button type="button" className="cuti__ibtn cuti__ibtn--danger" title="Hapus" onClick={() => onDelete(x)}><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function KalenderForm({ title, entry, withFlag, onClose, onSubmit }) {
  const [f, setF] = useState({
    tglMulai: entry.tglMulai || '', tglSelesai: entry.tglSelesai || '',
    keterangan: entry.keterangan || '', mengurangiHak: entry.mengurangiHak ?? true,
  })
  const [busy, setBusy] = useState(false)
  const hari = hariKerja(f.tglMulai, f.tglSelesai)

  const submit = async (e) => {
    e.preventDefault()
    if (!f.tglMulai || !f.tglSelesai) return
    if (!f.keterangan.trim()) return
    setBusy(true)
    const payload = { tglMulai: f.tglMulai, tglSelesai: f.tglSelesai, keterangan: f.keterangan.trim() }
    if (withFlag) payload.mengurangiHak = f.mengurangiHak
    await onSubmit(payload)
    setBusy(false)
  }

  return (
    <div className="cuti__overlay" onClick={onClose}>
      <form className="cuti__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="cuti__modal-head"><h3>{title}</h3><button type="button" className="cuti__x" onClick={onClose}><X size={18} /></button></div>
        <div className="cuti__modal-body">
          <div className="cuti__form">
            <label>Tanggal Mulai<input type="date" value={f.tglMulai} onChange={(e) => setF({ ...f, tglMulai: e.target.value })} required /></label>
            <label>Tanggal Selesai<input type="date" value={f.tglSelesai} min={f.tglMulai || undefined} onChange={(e) => setF({ ...f, tglSelesai: e.target.value })} required /></label>
            <label className="cuti__form-full">Keterangan<input value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} placeholder="mis. Cuti Bersama Idul Fitri" required /></label>
          </div>
          {withFlag && (
            <label className="cuti__check">
              <input type="checkbox" checked={f.mengurangiHak} onChange={(e) => setF({ ...f, mengurangiHak: e.target.checked })} />
              Mengurangi hak cuti semua karyawan ({hari > 0 ? `−${hari} hari` : 'sesuai jumlah hari'})
            </label>
          )}
          <div className="cuti__preview cuti__preview--pad">{hari > 0 ? `${hari} hari kerja` : 'Pilih rentang tanggal'}</div>
        </div>
        <div className="cuti__modal-foot">
          <button type="button" className="cuti__btn cuti__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="cuti__btn" disabled={busy}>{busy ? <Loader2 size={16} className="cuti__spin" /> : <CheckCircle2 size={16} />} Simpan</button>
        </div>
      </form>
    </div>
  )
}
