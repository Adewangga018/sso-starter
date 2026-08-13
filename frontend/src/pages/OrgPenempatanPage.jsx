import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Plus, UserCog, UserMinus, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useDialog } from '../components/DialogProvider'
import './OrgStruktur.css'

function formatTanggal(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function OrgPenempatanPage() {
  const dialog = useDialog()
  const [penempatan, setPenempatan] = useState([])
  const [jabatan, setJabatan] = useState([])
  const [pts, setPts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [cari, setCari] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('tempatkan') // 'tempatkan' | 'mutasi'
  const [form, setForm] = useState({ idJabatan: '', idKaryawan: '', tmt: '', catatan: '' })
  const [pegawaiQuery, setPegawaiQuery] = useState('')
  const [pegawaiHasil, setPegawaiHasil] = useState([])
  const [pegawaiTerpilih, setPegawaiTerpilih] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const [ptsModalOpen, setPtsModalOpen] = useState(false)
  const [ptsForm, setPtsForm] = useState({ idKaryawan: '', idJabatanPengganti: '', tmt: '', catatan: '' })
  const [ptsPegawaiQuery, setPtsPegawaiQuery] = useState('')
  const [ptsPegawaiHasil, setPtsPegawaiHasil] = useState([])
  const [ptsPegawaiTerpilih, setPtsPegawaiTerpilih] = useState(null)
  const [ptsFormError, setPtsFormError] = useState('')
  const [ptsSaving, setPtsSaving] = useState(false)
  const [ptsBusyId, setPtsBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [p, j, pt] = await Promise.all([api.getOrgPenempatan(), api.getOrgJabatan(), api.getOrgPts()])
      setPenempatan(p); setJabatan(j); setPts(pt)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data penempatan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const term = pegawaiQuery.trim()
    if (term.length < 2) { setPegawaiHasil([]); return }
    const t = setTimeout(async () => {
      try {
        setPegawaiHasil(await api.cariPegawaiGaji(term))
      } catch {
        setPegawaiHasil([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [pegawaiQuery])

  useEffect(() => {
    const term = ptsPegawaiQuery.trim()
    if (term.length < 2) { setPtsPegawaiHasil([]); return }
    const t = setTimeout(async () => {
      try {
        setPtsPegawaiHasil(await api.cariPegawaiGaji(term))
      } catch {
        setPtsPegawaiHasil([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [ptsPegawaiQuery])

  const tampil = useMemo(() => {
    const term = cari.trim().toLowerCase()
    if (!term) return penempatan
    return penempatan.filter((p) =>
      p.namaJabatan.toLowerCase().includes(term) ||
      p.nama.toLowerCase().includes(term) ||
      p.idKaryawan.toLowerCase().includes(term))
  }, [penempatan, cari])

  function openTempatkan() {
    setModalMode('tempatkan')
    setForm({ idJabatan: '', idKaryawan: '', tmt: '', catatan: '' })
    setPegawaiTerpilih(null)
    setPegawaiQuery('')
    setPegawaiHasil([])
    setFormError('')
    setModalOpen(true)
  }

  function openMutasi(p) {
    setModalMode('mutasi')
    setForm({ idJabatan: '', idKaryawan: p.idKaryawan, tmt: '', catatan: '' })
    setPegawaiTerpilih({ nik: p.idKaryawan, nama: p.nama })
    setPegawaiQuery('')
    setPegawaiHasil([])
    setFormError('')
    setModalOpen(true)
  }

  function pilihPegawai(p) {
    setPegawaiTerpilih(p)
    setForm((f) => ({ ...f, idKaryawan: p.nik }))
    setPegawaiQuery('')
    setPegawaiHasil([])
  }

  async function submit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.idJabatan) { setFormError('Jabatan wajib dipilih.'); return }
    if (!form.idKaryawan) { setFormError('Karyawan wajib dipilih.'); return }
    setSaving(true)
    try {
      await api.tempatkanKaryawan({
        idJabatan: Number(form.idJabatan),
        idKaryawan: form.idKaryawan,
        tmt: form.tmt || null,
        catatan: form.catatan.trim() || null,
      })
      setModalOpen(false)
      setMsg({ type: 'ok', text: modalMode === 'mutasi' ? 'Karyawan berhasil dimutasi.' : 'Karyawan berhasil ditempatkan.' })
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan penempatan.')
    } finally {
      setSaving(false)
    }
  }

  async function akhiri(p) {
    if (!(await dialog.confirm({
      title: 'Akhiri Penempatan',
      message: `Akhiri penempatan ${p.nama} di jabatan "${p.namaJabatan}"?`,
      danger: true,
      confirmText: 'Akhiri',
    }))) return
    setBusyId(p.id)
    try {
      await api.akhiriPenempatan(p.id, {})
      setMsg({ type: 'ok', text: 'Penempatan diakhiri.' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengakhiri penempatan.')
    } finally {
      setBusyId(null)
    }
  }

  // --- Pemangku Tugas Sementara (PTS) ---

  function openTandaiPts() {
    setPtsForm({ idKaryawan: '', idJabatanPengganti: '', tmt: '', catatan: '' })
    setPtsPegawaiTerpilih(null)
    setPtsPegawaiQuery('')
    setPtsPegawaiHasil([])
    setPtsFormError('')
    setPtsModalOpen(true)
  }

  function pilihPtsPegawai(p) {
    setPtsPegawaiTerpilih(p)
    setPtsForm((f) => ({ ...f, idKaryawan: p.nik }))
    setPtsPegawaiQuery('')
    setPtsPegawaiHasil([])
  }

  async function submitPts(e) {
    e.preventDefault()
    setPtsFormError('')
    if (!ptsForm.idKaryawan) { setPtsFormError('Karyawan wajib dipilih.'); return }
    if (!ptsForm.idJabatanPengganti) { setPtsFormError('Jabatan yang digantikan wajib dipilih.'); return }
    setPtsSaving(true)
    try {
      await api.tandaiPts({
        idKaryawan: ptsForm.idKaryawan,
        idJabatanPengganti: Number(ptsForm.idJabatanPengganti),
        tmt: ptsForm.tmt || null,
        catatan: ptsForm.catatan.trim() || null,
      })
      setPtsModalOpen(false)
      setMsg({ type: 'ok', text: 'Penandaan PTS tersimpan.' })
      await load()
    } catch (err) {
      setPtsFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan penandaan PTS.')
    } finally {
      setPtsSaving(false)
    }
  }

  async function akhiriPtsRow(p) {
    if (!(await dialog.confirm({
      title: 'Akhiri PTS',
      message: `Akhiri penandaan PTS ${p.namaKaryawan} untuk jabatan "${p.namaJabatanPengganti}"?`,
      danger: true,
      confirmText: 'Akhiri',
    }))) return
    setPtsBusyId(p.id)
    try {
      await api.akhiriPts(p.id, {})
      setMsg({ type: 'ok', text: 'Penandaan PTS diakhiri.' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengakhiri penandaan PTS.')
    } finally {
      setPtsBusyId(null)
    }
  }

  return (
    <div className="org-penempatan">
      <div className="org-penempatan__head">
        <h1>Penempatan Karyawan</h1>
        <p className="org-penempatan__hint">
          Siapa mengisi jabatan mana saat ini. Menempatkan karyawan yang sudah punya penempatan aktif
          otomatis mengakhiri penempatan lamanya (mutasi).
        </p>
      </div>

      {error && <div className="org-penempatan__alert org-penempatan__alert--err">{error}</div>}
      {msg && <div className={`org-penempatan__alert org-penempatan__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="org-penempatan__toolbar">
        <input
          className="org-penempatan__search"
          placeholder="Cari jabatan, nama, atau NIK..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <button type="button" className="org-struktur__add" onClick={openTempatkan}>
          <Plus size={14} /> Tempatkan Karyawan
        </button>
        {loading && <span className="org-struktur__hint-inline">Memuat...</span>}
      </div>

      <div className="org-penempatan__panel">
        <div className="org-penempatan__table-wrap">
          <table className="org-penempatan__table">
            <thead>
              <tr>
                <th>Jabatan</th>
                <th>NIK</th>
                <th>Nama</th>
                <th>TMT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((p) => (
                <tr key={p.id} className={busyId === p.id ? 'is-busy' : ''}>
                  <td className="org-penempatan__nama">{p.namaJabatan}</td>
                  <td>{p.idKaryawan}</td>
                  <td>{p.nama}</td>
                  <td>{formatTanggal(p.tmt)}</td>
                  <td>
                    <div className="org-penempatan__row-actions">
                      <button type="button" className="org-penempatan__iconbtn" title="Mutasi" onClick={() => openMutasi(p)} disabled={busyId === p.id}>
                        <ArrowRightLeft size={14} />
                      </button>
                      <button type="button" className="org-penempatan__iconbtn org-penempatan__iconbtn--danger" title="Akhiri Penempatan" onClick={() => akhiri(p)} disabled={busyId === p.id}>
                        <UserMinus size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!tampil.length && !loading && (
                <tr><td colSpan={5} className="org-penempatan__empty">Belum ada penempatan aktif.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="org-penempatan__head" style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: '1.1rem' }}>Pemangku Tugas Sementara (PTS)</h1>
        <p className="org-penempatan__hint">
          Karyawan yang menggantikan sementara formasi atasannya yang kosong. Penandaan di sini dibaca
          otomatis oleh kalkulator Tunjangan PTS di Payroll &gt; Manual per Karyawan.
        </p>
      </div>

      <div className="org-penempatan__toolbar">
        <button type="button" className="org-struktur__add" onClick={openTandaiPts}>
          <UserCog size={14} /> Tandai PTS
        </button>
      </div>

      <div className="org-penempatan__panel">
        <div className="org-penempatan__table-wrap">
          <table className="org-penempatan__table">
            <thead>
              <tr>
                <th>NIK</th>
                <th>Nama</th>
                <th>Jabatan Asli</th>
                <th>Menggantikan</th>
                <th>TMT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.id} className={ptsBusyId === p.id ? 'is-busy' : ''}>
                  <td>{p.idKaryawan}</td>
                  <td className="org-penempatan__nama">{p.namaKaryawan}</td>
                  <td>{p.jabatanAsli ?? '-'}</td>
                  <td>{p.namaJabatanPengganti}</td>
                  <td>{formatTanggal(p.tmt)}</td>
                  <td>
                    <div className="org-penempatan__row-actions">
                      <button type="button" className="org-penempatan__iconbtn org-penempatan__iconbtn--danger" title="Akhiri PTS" onClick={() => akhiriPtsRow(p)} disabled={ptsBusyId === p.id}>
                        <UserMinus size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pts.length && !loading && (
                <tr><td colSpan={6} className="org-penempatan__empty">Belum ada penandaan PTS aktif.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="org-penempatan__modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="org-penempatan__modal" onClick={(e) => e.stopPropagation()}>
            <div className="org-penempatan__modal-header">
              <h3>{modalMode === 'mutasi' ? `Mutasi ${pegawaiTerpilih?.nama}` : 'Tempatkan Karyawan'}</h3>
              <button type="button" className="org-penempatan__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup"><X size={18} /></button>
            </div>
            <form className="org-penempatan__modal-body" onSubmit={submit}>
              {modalMode === 'tempatkan' && (
                <label className="org-penempatan__field">
                  <span>Karyawan</span>
                  <div>
                    <input
                      value={pegawaiTerpilih ? `${pegawaiTerpilih.nik} — ${pegawaiTerpilih.nama}` : pegawaiQuery}
                      onChange={(e) => { setPegawaiTerpilih(null); setForm((f) => ({ ...f, idKaryawan: '' })); setPegawaiQuery(e.target.value) }}
                      placeholder="Cari NIK atau nama..."
                    />
                    {pegawaiHasil.length > 0 && !pegawaiTerpilih && (
                      <div className="org-penempatan__picker-results">
                        {pegawaiHasil.map((p) => (
                          <button type="button" key={p.nik} className="org-penempatan__picker-item" onClick={() => pilihPegawai(p)}>
                            {p.nik} — {p.nama}{p.jabatan ? ` (${p.jabatan})` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              )}
              <label className="org-penempatan__field">
                <span>Jabatan Baru</span>
                <select value={form.idJabatan} onChange={(e) => setForm((f) => ({ ...f, idJabatan: e.target.value }))} required>
                  <option value="">(pilih jabatan)</option>
                  {jabatan.filter((j) => j.aktif).map((j) => (
                    <option key={j.idJabatan} value={j.idJabatan}>{j.namaJabatan}{j.namaUnit ? ` — ${j.namaUnit}` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="org-penempatan__field">
                <span>TMT</span>
                <input type="date" value={form.tmt} onChange={(e) => setForm((f) => ({ ...f, tmt: e.target.value }))} />
              </label>
              <label className="org-penempatan__field">
                <span>Catatan</span>
                <input value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} placeholder="opsional" />
              </label>
              {formError && <div className="org-penempatan__alert org-penempatan__alert--err">{formError}</div>}
              <div className="org-penempatan__modal-footer">
                <button type="submit" className="org-penempatan__submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ptsModalOpen && (
        <div className="org-penempatan__modal-backdrop" onClick={() => setPtsModalOpen(false)}>
          <div className="org-penempatan__modal" onClick={(e) => e.stopPropagation()}>
            <div className="org-penempatan__modal-header">
              <h3>Tandai Pemangku Tugas Sementara</h3>
              <button type="button" className="org-penempatan__modal-close" onClick={() => setPtsModalOpen(false)} aria-label="Tutup"><X size={18} /></button>
            </div>
            <form className="org-penempatan__modal-body" onSubmit={submitPts}>
              <label className="org-penempatan__field">
                <span>Karyawan</span>
                <div>
                  <input
                    value={ptsPegawaiTerpilih ? `${ptsPegawaiTerpilih.nik} — ${ptsPegawaiTerpilih.nama}` : ptsPegawaiQuery}
                    onChange={(e) => { setPtsPegawaiTerpilih(null); setPtsForm((f) => ({ ...f, idKaryawan: '' })); setPtsPegawaiQuery(e.target.value) }}
                    placeholder="Cari NIK atau nama..."
                  />
                  {ptsPegawaiHasil.length > 0 && !ptsPegawaiTerpilih && (
                    <div className="org-penempatan__picker-results">
                      {ptsPegawaiHasil.map((p) => (
                        <button type="button" key={p.nik} className="org-penempatan__picker-item" onClick={() => pilihPtsPegawai(p)}>
                          {p.nik} — {p.nama}{p.jabatan ? ` (${p.jabatan})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <label className="org-penempatan__field">
                <span>Menggantikan Jabatan</span>
                <select
                  value={ptsForm.idJabatanPengganti}
                  onChange={(e) => setPtsForm((f) => ({ ...f, idJabatanPengganti: e.target.value }))}
                  required
                >
                  <option value="">(pilih jabatan atasan yang kosong)</option>
                  {jabatan.filter((j) => j.aktif).map((j) => (
                    <option key={j.idJabatan} value={j.idJabatan}>
                      {j.namaJabatan}{j.namaUnit ? ` — ${j.namaUnit}` : ''} (Band {j.idBand}{j.incumbent.length ? `, terisi ${j.incumbent.length}` : ', kosong'})
                    </option>
                  ))}
                </select>
              </label>
              <label className="org-penempatan__field">
                <span>TMT</span>
                <input type="date" value={ptsForm.tmt} onChange={(e) => setPtsForm((f) => ({ ...f, tmt: e.target.value }))} />
              </label>
              <label className="org-penempatan__field">
                <span>Catatan</span>
                <input value={ptsForm.catatan} onChange={(e) => setPtsForm((f) => ({ ...f, catatan: e.target.value }))} placeholder="opsional" />
              </label>
              {ptsFormError && <div className="org-penempatan__alert org-penempatan__alert--err">{ptsFormError}</div>}
              <div className="org-penempatan__modal-footer">
                <button type="submit" className="org-penempatan__submit" disabled={ptsSaving}>{ptsSaving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
