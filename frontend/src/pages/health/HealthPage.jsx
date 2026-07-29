import { useEffect, useState, useCallback } from 'react'
import {
  HeartPulse, Loader2, Plus, X, Pencil, Trash2, FileText, Users, CalendarDays, ClipboardList,
} from 'lucide-react'
import { api } from '../../lib/api'
import './HealthPage.css'

const STATUS_UMUM = ['Sehat', 'Perlu Perhatian', 'Tindak Lanjut']
const STATUS_TL = ['Tidak Perlu', 'Belum', 'Dijadwalkan', 'Selesai']
const STATUS_PERIODE = ['Direncanakan', 'Berlangsung', 'Selesai']

const clsUmum = (s) => s === 'Sehat' ? 'green' : s === 'Perlu Perhatian' ? 'gold' : 'red'
const clsTl = (s) => s === 'Selesai' ? 'green' : s === 'Dijadwalkan' ? 'gold' : s === 'Belum' ? 'red' : 'grey'
const clsPer = (s) => s === 'Berlangsung' ? 'gold' : s === 'Selesai' ? 'grey' : 'navy'
const fmtTgl = (s) => s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function HealthPage() {
  const [tab, setTab] = useState('riwayat')
  const [riwayat, setRiwayat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState(null)

  // admin state
  const [periodeList, setPeriodeList] = useState(null)
  const [detail, setDetail] = useState(null)          // periode detail (admin)
  const [periodeForm, setPeriodeForm] = useState(null) // {mode, data}
  const [hasilForm, setHasilForm] = useState(null)     // {mode, data, idPeriode}
  const [lihatHasil, setLihatHasil] = useState(null)   // employee result detail

  const isAdmin = riwayat?.isAdmin

  const loadRiwayat = useCallback(async () => {
    setLoading(true); setErr('')
    try { setRiwayat(await api.getHealthRiwayat()) }
    catch (e) { setErr(e.message || 'Gagal memuat data.') }
    finally { setLoading(false) }
  }, [])

  const loadPeriode = useCallback(async () => {
    try { setPeriodeList(await api.getHealthPeriodeList()) }
    catch (e) { setErr(e.message || 'Gagal memuat periode.') }
  }, [])

  useEffect(() => { loadRiwayat() }, [loadRiwayat])
  useEffect(() => { if (tab === 'kelola') loadPeriode() }, [tab, loadPeriode])

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500) }

  const lihatLampiran = async (hasilId) => {
    try {
      const url = await api.getHealthFile(hasilId)
      window.open(url, '_blank')
    } catch (e) { flash('err', e.message || 'Gagal membuka lampiran.') }
  }

  // ---- render ----
  return (
    <div className="hl">
      <div className="hl__head">
        <div>
          <h1 className="hl__title"><HeartPulse size={22} /> My Health — Medical Check-Up</h1>
          <p className="hl__sub">Arsip hasil pemeriksaan kesehatan (MCU) Anda beserta tindak lanjutnya.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="hl__tabs">
          <button className={`hl__tab ${tab === 'riwayat' ? 'is-on' : ''}`} onClick={() => setTab('riwayat')}>
            <ClipboardList size={15} /> Riwayat Saya
          </button>
          <button className={`hl__tab ${tab === 'kelola' ? 'is-on' : ''}`} onClick={() => setTab('kelola')}>
            <Users size={15} /> Kelola MCU (Admin Kepatuhan)
          </button>
        </div>
      )}

      {msg && <div className={`hl__msg hl__msg--${msg.type}`}>{msg.text}</div>}
      {err && <div className="hl__alert">{err}</div>}

      {loading ? (
        <div className="hl__loading"><Loader2 className="hl__spin" size={20} /> Memuat…</div>
      ) : tab === 'riwayat' ? (
        <RiwayatView riwayat={riwayat} onLihat={setLihatHasil} onLampiran={lihatLampiran} />
      ) : (
        <KelolaView
          periodeList={periodeList}
          onReload={loadPeriode}
          onOpenPeriode={async (id) => {
            try { setDetail(await api.getHealthPeriodeDetail(id)) }
            catch (e) { flash('err', e.message) }
          }}
          onNewPeriode={() => setPeriodeForm({ mode: 'buat', data: { tahun: new Date().getFullYear(), status: 'Direncanakan' } })}
          onEditPeriode={(p) => setPeriodeForm({ mode: 'ubah', data: p })}
          onDelPeriode={async (p) => {
            if (!window.confirm(`Hapus periode "${p.judul}" beserta semua hasilnya?`)) return
            try { await api.hapusHealthPeriode(p.id); flash('ok', 'Periode dihapus.'); loadPeriode() }
            catch (e) { flash('err', e.message) }
          }}
        />
      )}

      {/* Detail periode (admin) */}
      {detail && (
        <PeriodeDetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onLampiran={lihatLampiran}
          onNewHasil={() => setHasilForm({ mode: 'buat', idPeriode: detail.periode.id, data: { statusUmum: 'Sehat', statusTindakLanjut: 'Tidak Perlu' } })}
          onEditHasil={(h) => setHasilForm({ mode: 'ubah', idPeriode: detail.periode.id, data: h })}
          onDelHasil={async (h) => {
            if (!window.confirm(`Hapus hasil MCU ${h.nama || h.nik}?`)) return
            try {
              await api.hapusHealthHasil(h.id); flash('ok', 'Hasil dihapus.')
              setDetail(await api.getHealthPeriodeDetail(detail.periode.id)); loadPeriode()
            } catch (e) { flash('err', e.message) }
          }}
        />
      )}

      {/* Form periode */}
      {periodeForm && (
        <PeriodeForm
          state={periodeForm}
          onClose={() => setPeriodeForm(null)}
          onSaved={() => { setPeriodeForm(null); flash('ok', 'Periode disimpan.'); loadPeriode() }}
          onError={(m) => flash('err', m)}
        />
      )}

      {/* Form hasil */}
      {hasilForm && (
        <HasilForm
          state={hasilForm}
          onClose={() => setHasilForm(null)}
          onSaved={async () => {
            setHasilForm(null); flash('ok', 'Hasil MCU disimpan.')
            if (detail) setDetail(await api.getHealthPeriodeDetail(detail.periode.id))
            loadPeriode()
          }}
          onError={(m) => flash('err', m)}
        />
      )}

      {/* Detail hasil (karyawan) */}
      {lihatHasil && (
        <HasilDetailModal hasil={lihatHasil} onClose={() => setLihatHasil(null)} onLampiran={lihatLampiran} />
      )}
    </div>
  )
}

/* =========================== Riwayat (karyawan) =========================== */
function RiwayatView({ riwayat, onLihat, onLampiran }) {
  const items = riwayat?.items || []
  const aktif = riwayat?.periodeAktif || []
  return (
    <>
      {aktif.length > 0 && (
        <div className="hl__aktif">
          <div className="hl__aktif-h"><CalendarDays size={15} /> Jadwal MCU</div>
          <div className="hl__aktif-list">
            {aktif.map((p) => (
              <div key={p.id} className="hl__acard">
                <div className="hl__acard-top">
                  <span className="hl__acard-judul">{p.judul}</span>
                  <span className={`hl__badge hl__badge--${clsPer(p.status)}`}>{p.status}</span>
                </div>
                <div className="hl__acard-meta">
                  {p.penyelenggara && <span>{p.penyelenggara}</span>}
                  {(p.tglMulai || p.tglSelesai) && <span>{fmtTgl(p.tglMulai)} – {fmtTgl(p.tglSelesai)}</span>}
                  {p.lokasi && <span>{p.lokasi}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="hl__empty">Belum ada hasil MCU yang tercatat untuk Anda.</div>
      ) : (
        <div className="hl__tablewrap">
          <table className="hl__table">
            <thead>
              <tr>
                <th>Periode</th><th>Tgl Periksa</th><th>Status</th><th>Tindak Lanjut</th>
                <th>BMI</th><th>Tekanan</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id}>
                  <td><span className="hl__pj">{h.periodeJudul}</span><span className="hl__muted"> · {h.tahun}</span></td>
                  <td>{fmtTgl(h.tglPemeriksaan)}</td>
                  <td><span className={`hl__badge hl__badge--${clsUmum(h.statusUmum)}`}>{h.statusUmum}</span></td>
                  <td><span className={`hl__badge hl__badge--${clsTl(h.statusTindakLanjut)}`}>{h.statusTindakLanjut}</span></td>
                  <td>{h.bmi ? <span>{h.bmi} <span className="hl__muted">{h.kategoriBmi}</span></span> : '—'}</td>
                  <td>{h.tekananDarah || '—'}</td>
                  <td className="hl__rowact">
                    <button className="hl__ibtn" title="Lihat detail" onClick={() => onLihat(h)}><FileText size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* =========================== Kelola (admin) =========================== */
function KelolaView({ periodeList, onOpenPeriode, onNewPeriode, onEditPeriode, onDelPeriode }) {
  const items = periodeList?.items || []
  return (
    <>
      <div className="hl__bar">
        <span className="hl__muted">{items.length} periode MCU</span>
        <button className="hl__btn" onClick={onNewPeriode}><Plus size={15} /> Tambah Periode</button>
      </div>
      {items.length === 0 ? (
        <div className="hl__empty">Belum ada periode MCU. Buat periode terlebih dahulu.</div>
      ) : (
        <div className="hl__tablewrap">
          <table className="hl__table">
            <thead>
              <tr><th>Judul</th><th>Tahun</th><th>Penyelenggara</th><th>Jadwal</th><th>Peserta</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td><button className="hl__link" onClick={() => onOpenPeriode(p.id)}>{p.judul}</button></td>
                  <td>{p.tahun}</td>
                  <td>{p.penyelenggara || '—'}</td>
                  <td className="hl__muted">{fmtTgl(p.tglMulai)} – {fmtTgl(p.tglSelesai)}</td>
                  <td><span className="hl__count"><Users size={13} /> {p.jumlahHasil}</span></td>
                  <td><span className={`hl__badge hl__badge--${clsPer(p.status)}`}>{p.status}</span></td>
                  <td className="hl__rowact">
                    <button className="hl__ibtn" title="Kelola hasil" onClick={() => onOpenPeriode(p.id)}><ClipboardList size={15} /></button>
                    <button className="hl__ibtn" title="Ubah" onClick={() => onEditPeriode(p)}><Pencil size={15} /></button>
                    <button className="hl__ibtn hl__ibtn--danger" title="Hapus" onClick={() => onDelPeriode(p)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function PeriodeDetailModal({ detail, onClose, onNewHasil, onEditHasil, onDelHasil, onLampiran }) {
  const p = detail.periode
  const hasil = detail.hasil || []
  return (
    <div className="hl__overlay" onClick={onClose}>
      <div className="hl__modal hl__modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="hl__modal-head">
          <h3>{p.judul} · {p.tahun}</h3>
          <button className="hl__x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="hl__modal-body">
          <div className="hl__meta">
            <span className={`hl__badge hl__badge--${clsPer(p.status)}`}>{p.status}</span>
            {p.penyelenggara && <span className="hl__tag">{p.penyelenggara}</span>}
            {p.lokasi && <span className="hl__tag">{p.lokasi}</span>}
            {(p.tglMulai || p.tglSelesai) && <span className="hl__tag">{fmtTgl(p.tglMulai)} – {fmtTgl(p.tglSelesai)}</span>}
          </div>
          {p.catatan && <p className="hl__desk">{p.catatan}</p>}

          <div className="hl__vhead">
            <span><Users size={15} /> Hasil Peserta ({hasil.length})</span>
            <button className="hl__btn hl__btn--sm" onClick={onNewHasil}><Plus size={14} /> Catat Hasil</button>
          </div>
          {hasil.length === 0 ? (
            <div className="hl__empty">Belum ada hasil tercatat pada periode ini.</div>
          ) : (
            <table className="hl__vtable">
              <thead>
                <tr><th>Peserta</th><th>Tgl</th><th>Status</th><th>Tindak Lanjut</th><th>BMI</th><th></th></tr>
              </thead>
              <tbody>
                {hasil.map((h) => (
                  <tr key={h.id}>
                    <td><span className="hl__pj">{h.nama || '—'}</span><br /><span className="hl__muted">{h.nik}</span></td>
                    <td>{fmtTgl(h.tglPemeriksaan)}</td>
                    <td><span className={`hl__badge hl__badge--${clsUmum(h.statusUmum)}`}>{h.statusUmum}</span></td>
                    <td><span className={`hl__badge hl__badge--${clsTl(h.statusTindakLanjut)}`}>{h.statusTindakLanjut}</span></td>
                    <td>{h.bmi ? `${h.bmi}` : '—'}</td>
                    <td className="hl__rowact">
                      {h.adaLampiran && <button className="hl__ibtn" title="Lampiran" onClick={() => onLampiran(h.id)}><FileText size={14} /></button>}
                      <button className="hl__ibtn" title="Ubah" onClick={() => onEditHasil(h)}><Pencil size={14} /></button>
                      <button className="hl__ibtn hl__ibtn--danger" title="Hapus" onClick={() => onDelHasil(h)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function HasilDetailModal({ hasil: h, onClose, onLampiran }) {
  return (
    <div className="hl__overlay" onClick={onClose}>
      <div className="hl__modal" onClick={(e) => e.stopPropagation()}>
        <div className="hl__modal-head">
          <h3>Hasil MCU — {h.periodeJudul} {h.tahun}</h3>
          <button className="hl__x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="hl__modal-body">
          <div className="hl__meta">
            <span className={`hl__badge hl__badge--${clsUmum(h.statusUmum)}`}>{h.statusUmum}</span>
            <span className={`hl__badge hl__badge--${clsTl(h.statusTindakLanjut)}`}>Tindak lanjut: {h.statusTindakLanjut}</span>
          </div>
          <div className="hl__grid2">
            <Info label="Tanggal periksa" value={fmtTgl(h.tglPemeriksaan)} />
            <Info label="Tekanan darah" value={h.tekananDarah || '—'} />
            <Info label="Tinggi / Berat" value={`${h.tinggi ?? '—'} cm / ${h.berat ?? '—'} kg`} />
            <Info label="BMI" value={h.bmi ? `${h.bmi} (${h.kategoriBmi})` : '—'} />
          </div>
          {h.ringkasan && <Blok label="Ringkasan / Kesimpulan" text={h.ringkasan} />}
          {h.rekomendasi && <Blok label="Rekomendasi" text={h.rekomendasi} />}
          {h.adaLampiran && (
            <button className="hl__btn hl__btn--ghost" onClick={() => onLampiran(h.id)}>
              <FileText size={15} /> Lihat laporan MCU ({h.namaFile || 'lampiran'})
            </button>
          )}
          <p className="hl__foot-note">Dicatat oleh {h.namaPencatat || '—'} · {fmtTgl(h.tglDicatat)}</p>
        </div>
      </div>
    </div>
  )
}

const Info = ({ label, value }) => (
  <div className="hl__info"><span className="hl__info-l">{label}</span><span className="hl__info-v">{value}</span></div>
)
const Blok = ({ label, text }) => (
  <div className="hl__blok"><span className="hl__info-l">{label}</span><p>{text}</p></div>
)

/* =========================== Forms =========================== */
function PeriodeForm({ state, onClose, onSaved, onError }) {
  const [f, setF] = useState({
    judul: state.data.judul || '', tahun: state.data.tahun || new Date().getFullYear(),
    penyelenggara: state.data.penyelenggara || '', lokasi: state.data.lokasi || '',
    tglMulai: state.data.tglMulai || '', tglSelesai: state.data.tglSelesai || '',
    status: state.data.status || 'Direncanakan', catatan: state.data.catatan || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    if (!f.judul.trim()) return onError('Judul periode wajib diisi.')
    setSaving(true)
    try {
      const payload = { ...f, tahun: Number(f.tahun) }
      if (state.mode === 'buat') await api.buatHealthPeriode(payload)
      else await api.ubahHealthPeriode(state.data.id, payload)
      onSaved()
    } catch (err) { onError(err.message || 'Gagal menyimpan periode.') }
    finally { setSaving(false) }
  }

  return (
    <div className="hl__overlay" onClick={onClose}>
      <form className="hl__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="hl__modal-head">
          <h3>{state.mode === 'buat' ? 'Tambah Periode MCU' : 'Ubah Periode MCU'}</h3>
          <button type="button" className="hl__x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="hl__modal-body">
          <div className="hl__fgrid">
            <label className="hl__f hl__f--full">Judul<input value={f.judul} onChange={set('judul')} placeholder="MCU Tahunan 2026" /></label>
            <label className="hl__f">Tahun<input type="number" value={f.tahun} onChange={set('tahun')} /></label>
            <label className="hl__f">Status<select value={f.status} onChange={set('status')}>{STATUS_PERIODE.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="hl__f">Penyelenggara<input value={f.penyelenggara} onChange={set('penyelenggara')} placeholder="RS / Klinik / Vendor" /></label>
            <label className="hl__f">Lokasi<input value={f.lokasi} onChange={set('lokasi')} /></label>
            <label className="hl__f">Tgl mulai<input type="date" value={f.tglMulai || ''} onChange={set('tglMulai')} /></label>
            <label className="hl__f">Tgl selesai<input type="date" value={f.tglSelesai || ''} onChange={set('tglSelesai')} /></label>
            <label className="hl__f hl__f--full">Catatan<textarea rows={2} value={f.catatan} onChange={set('catatan')} /></label>
          </div>
        </div>
        <div className="hl__modal-foot">
          <button type="button" className="hl__btn hl__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="hl__btn" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  )
}

function HasilForm({ state, onClose, onSaved, onError }) {
  const d = state.data
  const [f, setF] = useState({
    pesertaNik: d.nik || '', pesertaNama: d.nama || '', tglPemeriksaan: d.tglPemeriksaan || '',
    tinggi: d.tinggi ?? '', berat: d.berat ?? '', tekananDarah: d.tekananDarah || '',
    statusUmum: d.statusUmum || 'Sehat', statusTindakLanjut: d.statusTindakLanjut || 'Tidak Perlu',
    ringkasan: d.ringkasan || '', rekomendasi: d.rekomendasi || '',
  })
  const [file, setFile] = useState(null)
  const [hapusLampiran, setHapus] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    if (!f.pesertaNik.trim()) return onError('NIK peserta wajib diisi.')
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('idPeriode', String(state.idPeriode))
      fd.append('pesertaNik', f.pesertaNik.trim())
      fd.append('pesertaNama', f.pesertaNama || '')
      fd.append('tglPemeriksaan', f.tglPemeriksaan || '')
      if (f.tinggi !== '') fd.append('tinggi', String(f.tinggi))
      if (f.berat !== '') fd.append('berat', String(f.berat))
      fd.append('tekananDarah', f.tekananDarah || '')
      fd.append('statusUmum', f.statusUmum)
      fd.append('statusTindakLanjut', f.statusTindakLanjut)
      fd.append('ringkasan', f.ringkasan || '')
      fd.append('rekomendasi', f.rekomendasi || '')
      fd.append('hapusLampiran', String(hapusLampiran))
      if (file) fd.append('file', file)
      if (state.mode === 'buat') await api.buatHealthHasil(state.idPeriode, fd)
      else await api.ubahHealthHasil(d.id, fd)
      onSaved()
    } catch (err) { onError(err.message || 'Gagal menyimpan hasil.') }
    finally { setSaving(false) }
  }

  return (
    <div className="hl__overlay" onClick={onClose}>
      <form className="hl__modal hl__modal--lg" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="hl__modal-head">
          <h3>{state.mode === 'buat' ? 'Catat Hasil MCU' : 'Ubah Hasil MCU'}</h3>
          <button type="button" className="hl__x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="hl__modal-body">
          <div className="hl__fgrid">
            <label className="hl__f">NIK Peserta<input value={f.pesertaNik} onChange={set('pesertaNik')} disabled={state.mode === 'ubah'} /></label>
            <label className="hl__f">Nama Peserta<input value={f.pesertaNama} onChange={set('pesertaNama')} /></label>
            <label className="hl__f">Tgl pemeriksaan<input type="date" value={f.tglPemeriksaan || ''} onChange={set('tglPemeriksaan')} /></label>
            <label className="hl__f">Tekanan darah<input value={f.tekananDarah} onChange={set('tekananDarah')} placeholder="120/80" /></label>
            <label className="hl__f">Tinggi (cm)<input type="number" step="0.1" value={f.tinggi} onChange={set('tinggi')} /></label>
            <label className="hl__f">Berat (kg)<input type="number" step="0.1" value={f.berat} onChange={set('berat')} /></label>
            <label className="hl__f">Status umum<select value={f.statusUmum} onChange={set('statusUmum')}>{STATUS_UMUM.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="hl__f">Tindak lanjut<select value={f.statusTindakLanjut} onChange={set('statusTindakLanjut')}>{STATUS_TL.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="hl__f hl__f--full">Ringkasan / Kesimpulan<textarea rows={2} value={f.ringkasan} onChange={set('ringkasan')} /></label>
            <label className="hl__f hl__f--full">Rekomendasi<textarea rows={2} value={f.rekomendasi} onChange={set('rekomendasi')} /></label>
            <label className="hl__f hl__f--full">Lampiran laporan MCU (opsional)<input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
            {state.mode === 'ubah' && d.adaLampiran && !file && (
              <label className="hl__check hl__f--full"><input type="checkbox" checked={hapusLampiran} onChange={(e) => setHapus(e.target.checked)} /> Hapus lampiran yang ada</label>
            )}
          </div>
        </div>
        <div className="hl__modal-foot">
          <button type="button" className="hl__btn hl__btn--ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="hl__btn" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  )
}
