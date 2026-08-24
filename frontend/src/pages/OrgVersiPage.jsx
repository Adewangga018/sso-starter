import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, Eye, FileClock, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useDialog } from '../components/DialogProvider'
import './OrgStruktur.css'

function formatTanggal(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatWaktu(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const emptyForm = { jenis: 'Minor', nomorSk: '', tanggalSk: '', ringkasan: '' }

function buildUnitTree(units) {
  const byInduk = new Map()
  units.forEach((u) => {
    const key = u.idUnitInduk ?? 0
    if (!byInduk.has(key)) byInduk.set(key, [])
    byInduk.get(key).push(u)
  })
  const sortNama = (a, b) => a.nama.localeCompare(b.nama)
  byInduk.forEach((list) => list.sort(sortNama))
  function attach(idUnit) {
    return (byInduk.get(idUnit) ?? []).map((u) => ({ ...u, children: attach(u.idUnit) }))
  }
  return attach(0)
}

// Panel pembaca snapshot versi lama - read-only, sengaja TIDAK memakai komponen chart
// zoom/pan OrgStrukturPage (kompleks, terikat data live) - cukup daftar bertingkat
// sederhana supaya aman dipakai utk data historis yg sudah dibekukan.
function SnapshotViewer({ snapshot, onClose }) {
  const bandById = useMemo(() => new Map((snapshot.band ?? []).map((b) => [b.idBand, b])), [snapshot])
  const jabatanByUnit = useMemo(() => {
    const m = new Map()
    ;(snapshot.jabatan ?? []).forEach((j) => {
      const key = j.idUnit ?? 0
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(j)
    })
    m.forEach((list) => list.sort((a, b) => a.namaJabatan.localeCompare(b.namaJabatan)))
    return m
  }, [snapshot])
  const penempatanByJabatan = useMemo(() => {
    const m = new Map()
    ;(snapshot.penempatan ?? []).forEach((p) => {
      if (!m.has(p.idJabatan)) m.set(p.idJabatan, [])
      m.get(p.idJabatan).push(p)
    })
    return m
  }, [snapshot])
  const ptsByJabatan = useMemo(() => {
    const m = new Map()
    ;(snapshot.pts ?? []).forEach((p) => {
      if (!m.has(p.idJabatanPengganti)) m.set(p.idJabatanPengganti, [])
      m.get(p.idJabatanPengganti).push(p)
    })
    return m
  }, [snapshot])
  const tree = useMemo(() => buildUnitTree(snapshot.unit ?? []), [snapshot])

  function renderJabatan(j) {
    const incumbent = penempatanByJabatan.get(j.idJabatan) ?? []
    const ptsList = ptsByJabatan.get(j.idJabatan) ?? []
    return (
      <li key={j.idJabatan} className="org-versi__snap-jabatan">
        <div className="org-versi__snap-jabatan-head">
          <span className="org-versi__snap-jabatan-nama">{j.namaJabatan}</span>
          <span className="org-versi__snap-jabatan-band">{bandById.get(j.idBand)?.kode ?? `Band ${j.idBand}`}{j.jg ? ` · JG${j.jg}` : ''}</span>
          {!j.aktif && <span className="org-versi__snap-badge org-versi__snap-badge--nonaktif">Nonaktif</span>}
        </div>
        {incumbent.length > 0 && (
          <div className="org-versi__snap-incumbent">
            {incumbent.map((p) => <span key={p.id}>{p.nama} <em>({p.idKaryawan})</em></span>)}
          </div>
        )}
        {ptsList.length > 0 && (
          <div className="org-versi__snap-incumbent org-versi__snap-incumbent--pts">
            {ptsList.map((p) => <span key={p.id}>PTS: {p.idKaryawan}</span>)}
          </div>
        )}
        {incumbent.length === 0 && ptsList.length === 0 && <div className="org-versi__snap-kosong">Formasi kosong</div>}
      </li>
    )
  }

  function renderUnit(u) {
    const jabatanUnit = jabatanByUnit.get(u.idUnit) ?? []
    return (
      <li key={u.idUnit} className="org-versi__snap-unit">
        <div className="org-versi__snap-unit-head">
          <span className={`org-versi__snap-tipe org-versi__snap-tipe--${u.tipe.toLowerCase()}`}>{u.tipe}</span>
          <span className="org-versi__snap-unit-nama">{u.nama}</span>
        </div>
        {jabatanUnit.length > 0 && <ul className="org-versi__snap-jabatan-list">{jabatanUnit.map(renderJabatan)}</ul>}
        {u.children.length > 0 && <ul className="org-versi__snap-tree">{u.children.map(renderUnit)}</ul>}
      </li>
    )
  }

  return (
    <div className="org-versi__viewer">
      <div className="org-versi__viewer-head">
        <div>
          <h3>Struktur Organisasi {snapshot.label} <span className={`org-versi__badge org-versi__badge--${snapshot.jenis.toLowerCase()}`}>{snapshot.jenis}</span></h3>
          <p className="org-penempatan__hint">
            Arsip per {formatWaktu(snapshot.diterbitkanPada)} — hanya bisa dilihat, tidak bisa diedit.
            {snapshot.ringkasan ? ` ${snapshot.ringkasan}` : ''}
          </p>
        </div>
        <button type="button" className="org-penempatan__iconbtn" onClick={onClose} title="Kembali ke versi berjalan"><X size={16} /></button>
      </div>
      {tree.length === 0
        ? <div className="org-penempatan__empty">Tidak ada unit organisasi pada versi ini.</div>
        : <ul className="org-versi__snap-tree org-versi__snap-tree--root">{tree.map(renderUnit)}</ul>}
    </div>
  )
}

export default function OrgVersiPage() {
  const dialog = useDialog()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [snapshot, setSnapshot] = useState(null)
  const [snapshotLoading, setSnapshotLoading] = useState(null) // id sedang dimuat
  const [busyId, setBusyId] = useState(null) // id sedang diberlakukan/dihapus

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setList(await api.getOrgVersiList())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat versi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const berlaku = useMemo(() => list.find((v) => v.adalahVersiBerlaku), [list])

  function openModal() {
    setForm(emptyForm)
    setFile(null)
    setFormError('')
    setModalOpen(true)
  }

  async function submit(e) {
    e.preventDefault()
    setFormError('')
    if (!file) { setFormError('Berkas SK wajib diunggah.'); return }

    setSaving(true)
    try {
      const body = new FormData()
      body.append('jenis', form.jenis)
      if (form.nomorSk.trim()) body.append('nomorSk', form.nomorSk.trim())
      if (form.tanggalSk) body.append('tanggalSk', form.tanggalSk)
      if (form.ringkasan.trim()) body.append('ringkasan', form.ringkasan.trim())
      body.append('file', file)
      await api.buatDraftOrgVersi(body)
      setModalOpen(false)
      setMsg({ type: 'ok', text: 'Draft versi baru tersimpan. Berlakukan dari tabel di bawah kapan pun sudah siap.' })
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan draft versi baru.')
    } finally {
      setSaving(false)
    }
  }

  async function lihatVersi(v) {
    setSnapshotLoading(v.id)
    setError('')
    try {
      const s = await api.getOrgVersiSnapshot(v.id)
      setSnapshot(s)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat snapshot versi ini.')
    } finally {
      setSnapshotLoading(null)
    }
  }

  async function unduhSk(v) {
    try {
      await api.unduhOrgVersiSk(v.id, `SK-${v.label}${v.namaFileSk ? `-${v.namaFileSk}` : '.pdf'}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengunduh berkas SK.')
    }
  }

  async function berlakukan(v) {
    const ok = await dialog.confirm({
      title: `Berlakukan Versi ${v.label}`,
      message: v.jenis === 'Major'
        ? 'Sistem akan membekukan kondisi Unit & Jabatan SAAT INI sebagai versi resmi berjalan, menggantikan versi berlaku sebelumnya. Pastikan seluruh perubahan struktur sudah selesai diedit. Setelah diberlakukan, snapshot tidak bisa diubah lagi.'
        : 'Sistem akan membekukan kondisi Penempatan Karyawan SAAT INI sebagai versi resmi berjalan, menggantikan versi berlaku sebelumnya. Pastikan seluruh mutasi/penempatan sudah selesai diedit. Setelah diberlakukan, snapshot tidak bisa diubah lagi.',
      confirmText: 'Berlakukan',
    })
    if (!ok) return
    setBusyId(v.id)
    setError('')
    try {
      await api.berlakukanOrgVersi(v.id)
      setMsg({ type: 'ok', text: `Versi ${v.label} kini resmi berlaku.` })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memberlakukan versi ini.')
    } finally {
      setBusyId(null)
    }
  }

  async function hapusDraft(v) {
    const ok = await dialog.confirm({
      title: 'Hapus Draft',
      message: `Hapus draft versi ${v.label} beserta berkas SK yang sudah diunggah? Nomor versi ini tidak akan dipakai ulang.`,
      danger: true,
      confirmText: 'Hapus',
    })
    if (!ok) return
    setBusyId(v.id)
    setError('')
    try {
      await api.hapusDraftOrgVersi(v.id)
      setMsg({ type: 'ok', text: `Draft versi ${v.label} dihapus.` })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus draft.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="org-penempatan">
      <div className="org-penempatan__head">
        <h1>Riwayat Versi Struktur Organisasi</h1>
        <p className="org-penempatan__hint">
          Struktur Organisasi bersifat adaptif mengikuti SK yang diterbitkan Direksi. Perubahan
          <strong> Minor</strong> (v1.0 → v1.1 → ...) mencakup penempatan karyawan saja; perubahan
          <strong> Major</strong> (v1.x → v2.0) mencakup perubahan struktur unit &amp; jabatan.
          Edit Unit/Jabatan/Penempatan seperti biasa, lampirkan SK sbg <strong>Draft</strong> di sini,
          lalu tekan <strong>Berlakukan</strong> kapan pun sudah siap — baru pada saat itu kondisi
          saat ini dibekukan jadi versi resmi.
        </p>
      </div>

      {berlaku && (
        <div className="org-versi__current">
          <ShieldCheck size={18} />
          <div>
            <strong>Versi berjalan: {berlaku.label}</strong>
            <span> · diterbitkan {formatWaktu(berlaku.diterbitkanPada)}{berlaku.namaPenerbit ? ` oleh ${berlaku.namaPenerbit}` : ''}</span>
          </div>
        </div>
      )}

      {error && <div className="org-penempatan__alert org-penempatan__alert--err">{error}</div>}
      {msg && <div className={`org-penempatan__alert org-penempatan__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {snapshot && <SnapshotViewer snapshot={snapshot} onClose={() => setSnapshot(null)} />}

      <div className="org-penempatan__toolbar">
        <button type="button" className="org-struktur__add" onClick={openModal}>
          <Sparkles size={14} /> Lampirkan SK (Draft Versi Baru)
        </button>
        {loading && <span className="org-struktur__hint-inline">Memuat...</span>}
      </div>

      <div className="org-penempatan__panel">
        <div className="org-penempatan__table-wrap">
          <table className="org-penempatan__table">
            <thead>
              <tr>
                <th>Versi</th>
                <th>Jenis</th>
                <th>Status</th>
                <th>Nomor SK</th>
                <th>Tanggal SK</th>
                <th>Ringkasan</th>
                <th>Diterbitkan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className={busyId === v.id ? 'is-busy' : ''}>
                  <td className="org-penempatan__nama">{v.label}</td>
                  <td><span className={`org-versi__badge org-versi__badge--${v.jenis.toLowerCase()}`}>{v.jenis}</span></td>
                  <td><span className={`org-versi__badge org-versi__badge--status-${v.status.toLowerCase()}`}>{v.status === 'Berlaku' ? 'Berjalan' : v.status}</span></td>
                  <td>{v.nomorSk ?? '-'}</td>
                  <td>{formatTanggal(v.tanggalSk)}</td>
                  <td className="org-versi__ringkasan">{v.ringkasan ?? '-'}</td>
                  <td>{formatWaktu(v.diterbitkanPada)}{v.namaPenerbit ? <><br /><span className="org-struktur__hint-inline">{v.namaPenerbit}</span></> : null}</td>
                  <td>
                    <div className="org-penempatan__row-actions">
                      {v.status === 'Draft' ? (
                        <>
                          <button type="button" className="org-penempatan__iconbtn" title="Berlakukan versi ini" onClick={() => berlakukan(v)} disabled={busyId === v.id}>
                            <CheckCircle2 size={14} />
                          </button>
                          <button type="button" className="org-penempatan__iconbtn org-penempatan__iconbtn--danger" title="Hapus draft" onClick={() => hapusDraft(v)} disabled={busyId === v.id}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <button type="button" className="org-penempatan__iconbtn" title="Lihat versi ini" onClick={() => lihatVersi(v)} disabled={snapshotLoading === v.id}>
                          <Eye size={14} />
                        </button>
                      )}
                      {v.adaFileSk && (
                        <button type="button" className="org-penempatan__iconbtn" title="Unduh SK" onClick={() => unduhSk(v)}>
                          <Download size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && !loading && (
                <tr><td colSpan={8} className="org-penempatan__empty"><FileClock size={16} /> Belum ada riwayat versi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="org-penempatan__modal-backdrop" onClick={() => !saving && setModalOpen(false)}>
          <div className="org-penempatan__modal" onClick={(e) => e.stopPropagation()}>
            <div className="org-penempatan__modal-header">
              <h3>Lampirkan SK — Draft Versi Baru</h3>
              <button type="button" className="org-penempatan__modal-close" onClick={() => setModalOpen(false)} aria-label="Tutup"><X size={18} /></button>
            </div>
            <form className="org-penempatan__modal-body" onSubmit={submit}>
              <div className="org-versi__jenis-pilih">
                <label className={`org-versi__jenis-opsi ${form.jenis === 'Minor' ? 'is-active' : ''}`}>
                  <input type="radio" name="jenis" value="Minor" checked={form.jenis === 'Minor'} onChange={() => setForm((f) => ({ ...f, jenis: 'Minor' }))} />
                  <div>
                    <strong>Minor</strong>
                    <span>Hanya Penempatan Karyawan yang berubah (struktur tetap)</span>
                  </div>
                </label>
                <label className={`org-versi__jenis-opsi ${form.jenis === 'Major' ? 'is-active' : ''}`}>
                  <input type="radio" name="jenis" value="Major" checked={form.jenis === 'Major'} onChange={() => setForm((f) => ({ ...f, jenis: 'Major' }))} />
                  <div>
                    <strong>Major</strong>
                    <span>Unit/Jabatan (struktur) ikut berubah</span>
                  </div>
                </label>
              </div>

              <label className="org-penempatan__field">
                <span>Nomor SK</span>
                <input value={form.nomorSk} onChange={(e) => setForm((f) => ({ ...f, nomorSk: e.target.value }))} placeholder="mis. 012/SK-DIR/2026" />
              </label>
              <label className="org-penempatan__field">
                <span>Tanggal SK</span>
                <input type="date" value={form.tanggalSk} onChange={(e) => setForm((f) => ({ ...f, tanggalSk: e.target.value }))} />
              </label>
              <label className="org-penempatan__field">
                <span>Ringkasan</span>
                <input value={form.ringkasan} onChange={(e) => setForm((f) => ({ ...f, ringkasan: e.target.value }))} placeholder="Ringkasan singkat perubahan" />
              </label>
              <label className="org-penempatan__field">
                <span>Berkas SK</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>

              <p className="org-penempatan__hint">
                Draft belum resmi berlaku dan belum membekukan apa pun — Anda masih bisa melanjutkan
                edit Unit/Jabatan/Penempatan setelah ini. Tekan "Berlakukan" dari tabel saat semua
                perubahan sudah selesai.
              </p>

              {formError && <div className="org-penempatan__alert org-penempatan__alert--err">{formError}</div>}

              <div className="org-penempatan__modal-footer">
                <button type="submit" className="org-struktur__add" disabled={saving}>
                  <Upload size={14} /> {saving ? 'Menyimpan...' : 'Simpan sebagai Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
