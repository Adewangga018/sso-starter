import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Gavel, Info, Pencil, Plus, Trash2, UserCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../components/DialogProvider'
import './AdminJuriPage.css'

const EMPTY_FORM = { id: null, nama: '', keterangan: '', ketua: '', anggota1: '', anggota2: '', anggota3: '', sekretaris: '' }

function gugusLabel(g) {
  const jenis = g.jenis === '5R' ? '5R' : g.jenis
  const nama = g.noRegistrasi || g.namaGugus || g.judul || `#${g.id}`
  return `${jenis} · ${nama}`
}

export default function AdminJuriPage() {
  // Admin IT maupun Pengelola Juri (koordinator penjurian) boleh mengelola
  // Stream Penilai & Penugasan ke Inovasi. `bolehKelola` = hak masuk halaman ini;
  // `isAdmin` dipakai khusus untuk tautan ke area Admin (mis. Manajemen Pengguna).
  const { isPengelolaJuri, isAdmin } = useAuth()
  const bolehKelola = isPengelolaJuri
  const dialog = useDialog()
  const [juriUsers, setJuriUsers] = useState([])
  const [streams, setStreams] = useState([])
  const [gugusOptions, setGugusOptions] = useState([])
  const [penugasan, setPenugasan] = useState([])
  const [form, setForm] = useState(null)
  const [assign, setAssign] = useState({ idGugus: '', idStream: '' })
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadAll = useCallback(async () => {
    setError('')
    try {
      const [users, str, opts, pen] = await Promise.all([
        api.listJuriUsers(),
        api.listPenilaianStream(),
        api.listPenilaianGugusOptions(),
        api.listPenugasan(),
      ])
      setJuriUsers(users)
      setStreams(str)
      setGugusOptions(opts)
      setPenugasan(pen)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.')
    }
  }, [])

  useEffect(() => { if (bolehKelola) loadAll() }, [bolehKelola, loadAll])

  if (!bolehKelola) {
    return <div className="admin-juri"><p className="admin-juri__forbidden">Akses ditolak. Hanya Admin IT atau Pengelola Juri.</p></div>
  }

  const nameOf = (id) => { const u = juriUsers.find((x) => x.id === id); return u ? (u.nama ?? u.email) : id }

  // Opsi untuk satu slot: semua juri kecuali yang sudah dipilih di slot lain.
  const optionsExcept = (currentValue, otherValues) =>
    juriUsers.filter((u) => u.id === currentValue || !otherValues.includes(u.id))

  function openCreate() { setForm({ ...EMPTY_FORM }); setMsg(null) }
  function openEdit(s) {
    const ang = s.anggota.filter((a) => a.peran === 'Anggota')
    setForm({
      id: s.id,
      nama: s.nama,
      keterangan: s.keterangan ?? '',
      ketua: s.anggota.find((a) => a.peran === 'Ketua')?.userId ?? '',
      anggota1: ang[0]?.userId ?? '',
      anggota2: ang[1]?.userId ?? '',
      anggota3: ang[2]?.userId ?? '',
      sekretaris: s.anggota.find((a) => a.peran === 'Sekretaris')?.userId ?? '',
    })
    setMsg(null)
  }

  async function saveStream() {
    const picks = [form.ketua, form.anggota1, form.anggota2, form.anggota3, form.sekretaris]
    if (!form.nama.trim()) return setMsg({ type: 'err', text: 'Nama stream wajib diisi.' })
    if (picks.some((p) => !p)) return setMsg({ type: 'err', text: 'Lengkapi 5 anggota: 1 Ketua, 3 Anggota, 1 Sekretaris.' })
    if (new Set(picks).size !== 5) return setMsg({ type: 'err', text: 'Setiap orang hanya boleh satu peran.' })

    const build = (userId, peran) => {
      const u = juriUsers.find((x) => x.id === userId)
      return { userId, nik: u?.nik ?? null, nama: u?.nama ?? null, peran }
    }
    const payload = {
      nama: form.nama.trim(),
      keterangan: form.keterangan || null,
      aktif: true,
      anggota: [
        build(form.ketua, 'Ketua'),
        build(form.anggota1, 'Anggota'),
        build(form.anggota2, 'Anggota'),
        build(form.anggota3, 'Anggota'),
        build(form.sekretaris, 'Sekretaris'),
      ],
    }
    setBusy(true)
    try {
      if (form.id) await api.updatePenilaianStream(form.id, payload)
      else await api.createPenilaianStream(payload)
      setForm(null)
      await loadAll()
      setMsg({ type: 'ok', text: 'Stream tersimpan.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan stream.' })
    } finally {
      setBusy(false)
    }
  }

  async function deleteStream(s) {
    if (!(await dialog.confirm({ message: `Hapus stream "${s.nama}"?`, danger: true }))) return
    try {
      await api.deletePenilaianStream(s.id)
      await loadAll()
      setMsg({ type: 'ok', text: 'Stream dihapus.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus.' })
    }
  }

  async function createPenugasan() {
    if (!assign.idGugus || !assign.idStream) return setMsg({ type: 'err', text: 'Pilih inovasi dan stream.' })
    setBusy(true)
    try {
      await api.createPenugasan({ idGugus: Number(assign.idGugus), idStream: Number(assign.idStream) })
      setAssign({ idGugus: '', idStream: '' })
      await loadAll()
      setMsg({ type: 'ok', text: 'Penugasan dibuat.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menugaskan.' })
    } finally {
      setBusy(false)
    }
  }

  async function deletePenugasan(p) {
    const label = p.namaGugus || p.judul || `#${p.idGugus}`
    if (!(await dialog.confirm({ message: `Hapus penugasan untuk "${label}"? Skor yang sudah masuk ikut terhapus.`, danger: true }))) return
    try {
      await api.deletePenugasan(p.id)
      await loadAll()
      setMsg({ type: 'ok', text: 'Penugasan dihapus.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menghapus.' })
    }
  }

  return (
    <div className="admin-juri">
      <div className="admin-juri__head">
        <Link to="/my-innovation" className="admin-juri__back"><ArrowLeft size={16} /> My Innovation</Link>
        <h1><Gavel size={20} /> Juri &amp; Penilaian Inovasi</h1>
      </div>

      <div className="admin-juri__note">
        <Info size={15} />
        <span>
          Pengguna harus ditandai sebagai <b>Juri</b> dahulu{isAdmin ? <> di <Link to="/admin/users">Manajemen Pengguna</Link></> : <> oleh Admin IT di Manajemen Pengguna</>}.
          Satu <b>stream</b> berisi 5 orang: <b>1 Ketua, 3 Anggota, 1 Sekretaris</b>. Ketua &amp; Anggota memberi nilai;
          Sekretaris hanya melihat. Tugaskan stream ke sebuah inovasi agar mulai dinilai.
        </span>
      </div>

      {error && <div className="admin-juri__alert admin-juri__alert--err">{error}</div>}
      {msg && <div className={`admin-juri__alert admin-juri__alert--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* ---------------- Streams ---------------- */}
      <div className="admin-juri__section">
        <div className="admin-juri__section-head">
          <h2><UserCheck size={16} /> Stream Penilai</h2>
          {!form && <button type="button" className="admin-juri__btn admin-juri__btn--primary" onClick={openCreate}><Plus size={15} /> Buat Stream</button>}
        </div>

        {form && (
          <div className="admin-juri__form">
            <div className="admin-juri__field">
              <label>Nama Stream</label>
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="mis. Tim Penilai A" />
            </div>
            <div className="admin-juri__field">
              <label>Keterangan (opsional)</label>
              <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="mis. Penilai Konvensi 2026" />
            </div>
            {juriUsers.length < 5 && (
              <div className="admin-juri__alert admin-juri__alert--err">
                Butuh minimal 5 pengguna ber-role Juri. Saat ini {juriUsers.length}. Tandai dulu di Manajemen Pengguna.
              </div>
            )}
            <div className="admin-juri__slots">
              {[
                ['ketua', 'Ketua', [form.anggota1, form.anggota2, form.anggota3, form.sekretaris]],
                ['anggota1', 'Anggota 1', [form.ketua, form.anggota2, form.anggota3, form.sekretaris]],
                ['anggota2', 'Anggota 2', [form.ketua, form.anggota1, form.anggota3, form.sekretaris]],
                ['anggota3', 'Anggota 3', [form.ketua, form.anggota1, form.anggota2, form.sekretaris]],
                ['sekretaris', 'Sekretaris', [form.ketua, form.anggota1, form.anggota2, form.anggota3]],
              ].map(([key, label, others]) => (
                <div className="admin-juri__field" key={key}>
                  <label>{label}</label>
                  <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                    <option value="">— pilih —</option>
                    {optionsExcept(form[key], others).map((u) => (
                      <option key={u.id} value={u.id}>{u.nama ?? u.email}{u.nik ? ` (${u.nik})` : ''}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="admin-juri__card-actions">
              <button type="button" className="admin-juri__btn admin-juri__btn--primary" disabled={busy} onClick={saveStream}>Simpan</button>
              <button type="button" className="admin-juri__btn" disabled={busy} onClick={() => setForm(null)}>Batal</button>
            </div>
          </div>
        )}

        <div className="admin-juri__grid">
          {streams.map((s) => (
            <div className="admin-juri__card" key={s.id}>
              <div className="admin-juri__card-title">
                <span>{s.nama}</span>
                {!s.aktif && <span className="admin-juri__muted">nonaktif</span>}
              </div>
              {s.keterangan && <div className="admin-juri__muted" style={{ fontSize: 12, marginBottom: 6 }}>{s.keterangan}</div>}
              <ul className="admin-juri__members">
                {s.anggota.map((a) => (
                  <li className="admin-juri__member" key={a.id}>
                    <span>{a.nama ?? nameOf(a.userId)}</span>
                    <span className={`admin-juri__role admin-juri__role--${a.peran.toLowerCase()}`}>{a.peran}</span>
                  </li>
                ))}
              </ul>
              <div className="admin-juri__card-actions">
                <button type="button" className="admin-juri__btn" onClick={() => openEdit(s)}><Pencil size={14} /> Ubah</button>
                <button type="button" className="admin-juri__btn admin-juri__btn--danger" onClick={() => deleteStream(s)}><Trash2 size={14} /> Hapus</button>
              </div>
            </div>
          ))}
          {!streams.length && <p className="admin-juri__empty">Belum ada stream.</p>}
        </div>
      </div>

      {/* ---------------- Penugasan ---------------- */}
      <div className="admin-juri__section">
        <div className="admin-juri__section-head">
          <h2><Gavel size={16} /> Penugasan ke Inovasi</h2>
        </div>
        <div className="admin-juri__form">
          <div className="admin-juri__slots">
            <div className="admin-juri__field">
              <label>Inovasi (risalah terdaftar)</label>
              <select value={assign.idGugus} onChange={(e) => setAssign({ ...assign, idGugus: e.target.value })}>
                <option value="">— pilih inovasi —</option>
                {gugusOptions.map((g) => <option key={g.id} value={g.id}>{gugusLabel(g)}</option>)}
              </select>
            </div>
            <div className="admin-juri__field">
              <label>Stream Penilai</label>
              <select value={assign.idStream} onChange={(e) => setAssign({ ...assign, idStream: e.target.value })}>
                <option value="">— pilih stream —</option>
                {streams.filter((s) => s.aktif).map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </div>
          </div>
          <div className="admin-juri__card-actions">
            <button type="button" className="admin-juri__btn admin-juri__btn--primary" disabled={busy} onClick={createPenugasan}><Plus size={15} /> Tugaskan</button>
          </div>
        </div>

        <table className="admin-juri__table">
          <thead>
            <tr><th>Inovasi</th><th>Stream</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {penugasan.map((p) => (
              <tr key={p.id}>
                <td>{gugusLabel({ id: p.idGugus, jenis: p.jenis, noRegistrasi: p.noRegistrasi, namaGugus: p.namaGugus, judul: p.judul })}</td>
                <td>{p.streamNama}</td>
                <td>{p.status}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="admin-juri__btn admin-juri__btn--danger" onClick={() => deletePenugasan(p)}><Trash2 size={14} /> Hapus</button>
                </td>
              </tr>
            ))}
            {!penugasan.length && <tr><td colSpan={4} className="admin-juri__empty">Belum ada penugasan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
