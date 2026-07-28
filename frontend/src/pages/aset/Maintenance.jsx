import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, Wrench } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { MaintenanceFormModal, MaintStatusBadge, rupiah, tgl } from './asetShared'
import './AsetPage.css'

export default function Maintenance() {
  const [data, setData] = useState({ items: [], isAdminAset: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [edit, setEdit] = useState(null) // maintenance row
  const [filter, setFilter] = useState('Terjadwal')

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.getMaintenanceList()); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], isAdminAset: false })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat maintenance.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const isAdmin = data.isAdminAset
  const rows = data.items.filter((m) => filter === 'Semua' || m.status === filter)

  async function simpan(payload) { await api.ubahMaintenance(edit.id, payload); setEdit(null); setMsg({ t: 'ok', m: 'Maintenance diperbarui.' }); await load() }
  async function hapus(m) {
    if (!window.confirm(`Hapus jadwal maintenance ${m.namaAset} (${tgl(m.tglJadwal)})?`)) return
    try { await api.hapusMaintenance(m.id); setMsg({ t: 'ok', m: 'Maintenance dihapus.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title"><Wrench size={18} style={{ verticalAlign: '-3px' }} /> Jadwal Maintenance</h2>
          <p className="aset__sub">Jadwal & riwayat pemeliharaan seluruh aset. Tambah jadwal dari halaman Inventaris (detail aset).</p>
        </div>
        <select className="aset__search" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {['Terjadwal', 'Selesai', 'Batal', 'Semua'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : rows.length === 0 ? <div className="aset__empty">Tidak ada jadwal maintenance{filter !== 'Semua' ? ` berstatus ${filter}` : ''}.</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr>
                <th>Aset</th><th>Jenis</th><th>Tgl Jadwal</th><th>Tgl Selesai</th><th>Status</th><th>Pelaksana</th><th>Biaya</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td><span className="aset__kode">{m.kodeAset}</span> <span className="aset__muted">{m.namaAset}</span></td>
                    <td>{m.jenis}</td>
                    <td>{tgl(m.tglJadwal)}</td>
                    <td className="aset__muted">{tgl(m.tglSelesai)}</td>
                    <td><MaintStatusBadge status={m.status} /></td>
                    <td className="aset__muted">{m.pelaksana || '—'}</td>
                    <td className="aset__muted">{m.biaya != null ? rupiah(m.biaya) : '—'}</td>
                    <td>
                      {isAdmin && (
                        <div className="aset__row-act">
                          <button type="button" className="aset__ibtn" title="Ubah" onClick={() => setEdit(m)}><Pencil size={15} /></button>
                          <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" onClick={() => hapus(m)}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {edit && <MaintenanceFormModal initial={edit} namaAset={edit.namaAset} onClose={() => setEdit(null)} onSubmit={simpan} />}
    </div>
  )
}
