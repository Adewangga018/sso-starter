import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Gauge, Loader2, Lock, Pencil, Plus, Rocket, Save, ShieldAlert, Trash2, UserCog2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../components/DialogProvider'
import './PayrollShared.css'
import './OrgStruktur.css'
import './PersonGradePage.css'

const emptyForm = { pg: '', golonganLama: '', tahunBerlaku: new Date().getFullYear(), catatan: '' }

// Pencarian pegawai (sama pola dgn PayrollManualPage.jsx) - daftar default (100 pertama)
// langsung tampil, kotak cari cuma menyaring lewat query >=2 huruf.
function PegawaiSearch({ selected, onSelect }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      api.cariPegawaiGaji(q).then((res) => setItems(res)).catch(() => setItems([])).finally(() => setLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])

  if (selected) {
    return (
      <div className="agt__pegawai-sel">
        <div>
          <div className="agt__pegawai-nama">{selected.nama}</div>
          <div className="agt__pegawai-sub">{selected.nik}{selected.jabatan ? ` · ${selected.jabatan}` : ''}</div>
        </div>
        <button type="button" className="agt__ibtn" onClick={() => onSelect(null)}><X size={16} /></button>
      </div>
    )
  }

  return (
    <div className="agt__pegawai-search">
      <div className="agt__input-wrap">
        <input
          type="text" placeholder="Cari nama atau NIK… (opsional - daftar di bawah sudah tampil)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading && <Loader2 size={15} className="agt__spin" />}
      </div>
      <div className="agt__pegawai-list agt__pegawai-list--static">
        {items.map((p) => (
          <button
            type="button" key={p.nik} className="agt__pegawai-item"
            onClick={() => onSelect(p)}
          >
            <span className="agt__pegawai-nama">{p.nama}</span>
            <span className="agt__pegawai-sub">{p.nik}{p.jabatan ? ` · ${p.jabatan}` : ''}{p.unit ? ` · ${p.unit}` : ''}</span>
          </button>
        ))}
        {!loading && items.length === 0 && (
          <div className="agt__empty">Tidak ada pegawai yang cocok.</div>
        )}
      </div>
    </div>
  )
}

export default function PersonGradePage() {
  const { isAdminModulSdm, summary } = useAuth()
  const dialog = useDialog()
  const [pegawai, setPegawai] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pgOpsi, setPgOpsi] = useState([])
  const [jgInfo, setJgInfo] = useState(null)
  const [akselerasi, setAkselerasi] = useState(null)
  const [akselerasiBusy, setAkselerasiBusy] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getGajiGradeOpsi().then((r) => setPgOpsi(r.pg ?? [])).catch(() => setPgOpsi([]))
  }, [])

  const load = useCallback(async () => {
    if (!pegawai) { setRows([]); setJgInfo(null); setAkselerasi(null); return }
    setLoading(true); setMsg(null)
    try {
      const [pg, penempatan, jabatanList, aksel] = await Promise.all([
        api.getOrgPersonGrade(pegawai.nik),
        api.getOrgPenempatan({ idKaryawan: pegawai.nik, hanyaAktif: true }),
        api.getOrgJabatan(),
        api.getPgAkselerasi(pegawai.nik),
      ])
      setRows(pg)
      const aktif = penempatan[0]
      const jabatan = aktif ? jabatanList.find((j) => j.idJabatan === aktif.idJabatan) : null
      setJgInfo(jabatan ? { jg: jabatan.jg, namaJabatan: jabatan.namaJabatan } : null)
      setAkselerasi(aksel)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat data PG.' })
    } finally { setLoading(false) }
  }, [pegawai])

  useEffect(() => { load() }, [load])

  async function toggleAkselerasi() {
    if (!pegawai || !akselerasi) return
    setAkselerasiBusy(true)
    try {
      if (akselerasi.aktif) {
        await api.hapusPgAkselerasi(pegawai.nik)
        setMsg({ type: 'ok', text: `Akselerasi ${pegawai.nama} dimatikan - siklus naik PG kembali ke 3 tahun.` })
      } else {
        await api.setPgAkselerasi(pegawai.nik, {})
        setMsg({ type: 'ok', text: `Akselerasi ${pegawai.nama} diaktifkan - PG naik tiap 2 tahun.` })
      }
      setAkselerasi(await api.getPgAkselerasi(pegawai.nik))
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal mengubah status akselerasi.' })
    } finally { setAkselerasiBusy(false) }
  }

  // PG tertinggi yg tercatat (baris tahun_berlaku terbaru) - dipakai cek "mentok" thd JG.
  const pgTerkini = useMemo(() => {
    if (rows.length === 0) return null
    return rows.reduce((a, b) => (a.tahunBerlaku >= b.tahunBerlaku ? a : b))
  }, [rows])
  const mentok = jgInfo?.jg != null && pgTerkini != null && pgTerkini.pg >= jgInfo.jg

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, tahunBerlaku: new Date().getFullYear() })
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(row) {
    setEditingId(row.id)
    setForm({
      pg: String(row.pg), golonganLama: row.golonganLama ?? '',
      tahunBerlaku: row.tahunBerlaku, catatan: row.catatan ?? '',
    })
    setFormError('')
    setFormOpen(true)
  }

  async function submitForm(e) {
    e.preventDefault()
    setFormError('')
    if (!form.pg) { setFormError('PG wajib diisi.'); return }
    if (!form.tahunBerlaku) { setFormError('Tahun berlaku wajib diisi.'); return }
    setSaving(true)
    try {
      const payload = {
        idKaryawan: pegawai.nik,
        pg: Number(form.pg),
        golonganLama: form.golonganLama.trim() || null,
        tahunBerlaku: Number(form.tahunBerlaku),
        catatan: form.catatan.trim() || null,
      }
      if (editingId) await api.ubahOrgPersonGrade(editingId, payload)
      else await api.buatOrgPersonGrade(payload)
      setFormOpen(false)
      setMsg({ type: 'ok', text: 'PG tersimpan.' })
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan PG.')
    } finally { setSaving(false) }
  }

  async function hapus(row) {
    if (!(await dialog.confirm({
      title: 'Hapus PG',
      message: `Hapus PG ${row.pg} untuk ${row.nama} tahun ${row.tahunBerlaku}?`,
      danger: true, confirmText: 'Hapus',
    }))) return
    try {
      await api.hapusOrgPersonGrade(row.id)
      setMsg({ type: 'ok', text: 'PG dihapus.' })
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus PG.' })
    }
  }

  const tahunOpsi = useMemo(() => {
    const now = new Date().getFullYear()
    return [now + 1, now, now - 1, now - 2, now - 3]
  }, [])

  if (!isAdminModulSdm) {
    return (
      <div className="agt">
        <div className="agt__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Pengelolaan PG hanya untuk Admin Modul SDM (Kepala Bagian SDM ke atas hingga GM SKP).</p>
          <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="agt">
      <div className="agt__top">
        <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="agt__role">Admin Modul SDM{summary?.nama ? <> · <span className="u-nama">{summary.nama}</span></> : ''}</span>
      </div>

      <div className="agt__head">
        <h2 className="agt__title"><UserCog2 size={20} /> Person Grade (PG)</h2>
        <p className="agt__sub">
          PG melekat ke ORANGNYA (senioritas individu), per tahun berlaku — beda dari JG yang melekat ke jabatan
          (diatur lewat Struktur Organisasi &gt; Ubah Jabatan). Dipakai basis tarif JG × PG di Payroll.
        </p>
      </div>

      <div className="agt__manual-bar">
        <PegawaiSearch selected={pegawai} onSelect={setPegawai} />
      </div>

      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {!pegawai ? (
        <div className="agt__empty">Pilih pegawai terlebih dahulu.</div>
      ) : (
        <>
          {jgInfo && (
            <div className="pgpg__jg-info">
              <span>JG saat ini (mengikuti jabatan, bukan diatur di sini):</span>
              <b>{jgInfo.jg ?? '-'}</b>
              <span className="pgpg__jg-info-jabatan">{jgInfo.namaJabatan}</span>
            </div>
          )}

          <div className="pgpg__auto-panel">
            <div className="pgpg__auto-info">
              <Gauge size={16} className="pgpg__auto-icon" />
              <div>
                <div className="pgpg__auto-title">Siklus naik PG otomatis</div>
                <div className="pgpg__auto-sub">
                  PG naik +1 tiap <b>{akselerasi?.aktif ? '2 tahun (diakselerasi)' : '3 tahun'}</b> — dihitung sejak PG terakhir tercatat,
                  dan tidak akan pernah melebihi JG jabatan aktifnya.
                </div>
              </div>
            </div>
            {akselerasi && (
              <button
                type="button"
                className={`pgpg__aksel-btn${akselerasi.aktif ? ' is-active' : ''}`}
                onClick={toggleAkselerasi}
                disabled={akselerasiBusy}
              >
                {akselerasiBusy ? <Loader2 size={14} className="pgpg__spin" /> : <Rocket size={14} />}
                {akselerasi.aktif ? 'Akselerasi Aktif — Matikan' : 'Aktifkan Akselerasi (2 tahun)'}
              </button>
            )}
          </div>

          {mentok && (
            <div className="pgpg__mentok">
              <Lock size={15} />
              PG {pegawai.nama} sudah mentok di {pgTerkini.pg} (= JG jabatannya saat ini) — tidak bisa naik otomatis lagi
              sampai dipromosikan ke jabatan dengan JG lebih tinggi.
            </div>
          )}

          <div className="pgpg__panel">
            <div className="pgpg__panel-head">
              <h3>Riwayat PG — {pegawai.nama}</h3>
              <button type="button" className="agt__save agt__save--sm" onClick={openCreate}>
                <Plus size={14} /> Tambah PG
              </button>
            </div>

            {loading ? (
              <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
            ) : rows.length === 0 ? (
              <div className="agt__empty">Belum ada PG tercatat untuk pegawai ini.</div>
            ) : (
              <table className="pgpg__table">
                <thead>
                  <tr>
                    <th>Tahun Berlaku</th>
                    <th>PG</th>
                    <th>Catatan</th>
                    <th className="pgpg__col-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.tahunBerlaku}</td>
                      <td><span className="pgpg__pg-badge">{r.pg}</span></td>
                      <td>
                        {r.catatan ?? '-'}
                        {r.catatan?.startsWith('Naik otomatis') && <span className="pgpg__auto-tag">Otomatis</span>}
                      </td>
                      <td className="pgpg__col-right">
                        <div className="org-row-actions">
                          <button type="button" className="org-iconbtn" title="Ubah" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                          <button type="button" className="org-iconbtn org-iconbtn--danger" title="Hapus" onClick={() => hapus(r)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {formOpen && (
        <div className="org-modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="org-modal org-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <h3>{editingId ? 'Ubah PG' : 'Tambah PG'} — {pegawai?.nama}</h3>
              <button type="button" className="org-modal-close" onClick={() => setFormOpen(false)}><X size={20} /></button>
            </div>
            <form className="org-modal-body" onSubmit={submitForm}>
              <div className="org-form-grid">
                <label className="org-form-group">
                  <span>Tahun Berlaku *</span>
                  <select value={form.tahunBerlaku} onChange={(e) => setForm((f) => ({ ...f, tahunBerlaku: e.target.value }))}>
                    {tahunOpsi.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label className="org-form-group">
                  <span>PG *</span>
                  <select value={form.pg} onChange={(e) => setForm((f) => ({ ...f, pg: e.target.value }))}>
                    <option value="">Pilih PG</option>
                    {pgOpsi.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="org-form-group org-col-span-2">
                  <span>Catatan</span>
                  <input value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} placeholder="opsional" />
                </label>
              </div>

              {formError && <div className="agt__msg agt__msg--err">{formError}</div>}

              <div className="org-modal-footer">
                <button type="button" className="org-btn org-btn--sec" onClick={() => setFormOpen(false)}>Batal</button>
                <button type="submit" className="agt__save" disabled={saving}>
                  {saving ? <Loader2 size={16} className="agt__spin" /> : <Save size={16} />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
