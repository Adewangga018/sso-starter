import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserPlus, Trash2, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { tgl, useConfirm } from './asetShared'
import AsetPegawaiPicker from './AsetPegawaiPicker'
import './AsetPage.css'

// Kelola "Operator Aktivitas" - pegawai dgn hak terbatas Catat Aktivitas SAJA (bukan
// Admin Aset penuh). Syarat digrant: pegawai HARUS sudah ditunjuk sebagai PIC aktif atas
// aset apa pun (aset.pic_assignment) - divalidasi lagi di server saat submit. Hak ini
// otomatis hilang kalau PIC-nya dicabut/dipindahkan, walau baris di sini masih "Aktif" -
// makanya kolom "Status PIC" dicek ulang tiap halaman dimuat, bukan cuma saat digrant.
export default function AsetAktivitasOperator() {
  const [rows, setRows] = useState([])
  const [isAdmin, setIsAdmin] = useState(null) // null = belum dicek
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [admin, list] = await Promise.all([api.getAsetAdminStatus(), api.listAktivitasOperator()])
      setIsAdmin(admin.isAdminAset); setRows(admin.isAdminAset ? list : []); setError('')
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat data.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function tambah(p) {
    setSaving(true)
    try {
      await api.tambahAktivitasOperator({ nik: p.nik, nama: p.nama })
      setMsg({ t: 'ok', m: `${p.nama} ditambahkan sebagai Operator Aktivitas.` })
      await load()
    } catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menambahkan.' }) }
    finally { setSaving(false) }
  }

  async function cabut(row) {
    if (!(await confirm(`Cabut hak Operator Aktivitas dari "${row.nama}"?`, { danger: true }))) return
    try { await api.cabutAktivitasOperator(row.id); setMsg({ t: 'ok', m: 'Hak akses dicabut.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal mencabut.' }) }
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title"><ShieldCheck size={18} style={{ verticalAlign: '-3px' }} /> Operator Aktivitas</h2>
          <p className="aset__sub">
            Pegawai di sini hanya bisa mencatat "Catat Aktivitas" di Detail Aset - tidak bisa mengubah/menghapus, dan
            hanya untuk aset yang mereka jadi PIC-nya. Syarat: pegawai harus sudah ditunjuk sebagai PIC aktif oleh Admin Aset.
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="aset__btn" onClick={() => setPickerOpen(true)} disabled={saving}>
            <UserPlus size={15} /> Tambah Operator
          </button>
        )}
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : isAdmin === false ? <div className="aset__alert">Halaman ini khusus Admin Aset (Departemen Kepatuhan).</div>
        : error ? <div className="aset__alert">{error}</div>
        : rows.length === 0 ? <div className="aset__empty">Belum ada Operator Aktivitas. Klik "Tambah Operator".</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr>
                <th>Nama</th><th>NIK</th><th>Status PIC</th><th>Hak Akses</th><th>Ditambahkan</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nama}</td>
                    <td className="aset__muted">{r.nik}</td>
                    <td>
                      {r.masihPic
                        ? <span className="aset__badge aset__badge--ok">PIC Aktif</span>
                        : <span className="aset__badge aset__badge--off" title="PIC-nya sudah dicabut/dipindahkan - hak catat aktivitas otomatis tidak berlaku walau masih tercatat di sini.">Bukan PIC lagi</span>}
                    </td>
                    <td>{r.aktif ? <span className="aset__badge aset__badge--info">Aktif</span> : <span className="aset__badge aset__badge--off">Dicabut</span>}</td>
                    <td className="aset__muted">{tgl(r.tglDibuat)}</td>
                    <td>
                      {r.aktif && (
                        <div className="aset__row-act">
                          <button type="button" className="aset__ibtn aset__ibtn--danger" title="Cabut" aria-label="Cabut" onClick={() => cabut(r)}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {pickerOpen && (
        <AsetPegawaiPicker
          onClose={() => setPickerOpen(false)}
          onPick={(p) => tambah(p)}
        />
      )}
      {ConfirmUI}
    </div>
  )
}