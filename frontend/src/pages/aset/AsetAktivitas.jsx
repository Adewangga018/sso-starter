import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Pencil, Trash2, Activity } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { AktivitasFormModal, rupiah, tgl } from './asetShared'
import './AsetPage.css'

export default function AsetAktivitas() {
  const [data, setData] = useState({ items: [], daftarAset: [], isAdminAset: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [modal, setModal] = useState(null) // {mode:'buat'|'ubah', row?}
  const [filterAset, setFilterAset] = useState('')

  const load = useCallback(async (idAset) => {
    setLoading(true)
    try { setData(await api.getAktivitasList(idAset || undefined)); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], daftarAset: [], isAdminAset: false })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat data.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(filterAset) }, [load, filterAset])

  const isAdmin = data.isAdminAset

  async function buat(payload) { await api.buatAktivitas(payload); setModal(null); setMsg({ t: 'ok', m: 'Aktivitas dicatat.' }); await load(filterAset) }
  async function ubah(payload) { await api.ubahAktivitas(modal.row.id, payload); setModal(null); setMsg({ t: 'ok', m: 'Aktivitas diperbarui.' }); await load(filterAset) }
  async function hapus(row) {
    if (!window.confirm(`Hapus aktivitas "${row.jenis}" pada ${tgl(row.tglAktivitas)}?`)) return
    try { await api.hapusAktivitas(row.id); setMsg({ t: 'ok', m: 'Aktivitas dihapus.' }); await load(filterAset) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title"><Activity size={18} style={{ verticalAlign: '-3px' }} /> Aktivitas Aset Tidak Produktif</h2>
          <p className="aset__sub">Riwayat kegiatan terhadap aset tidak produktif — pembersihan lingkungan, kunjungan calon pembeli, negosiasi harga, dsb.</p>
        </div>
        <div className="aset__tools">
          <select className="aset__search" value={filterAset} onChange={(e) => setFilterAset(e.target.value)}>
            <option value="">Semua aset</option>
            {data.daftarAset.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          {isAdmin && <button type="button" className="aset__btn" onClick={() => setModal({ mode: 'buat' })}><Plus size={15} /> Catat Aktivitas</button>}
        </div>
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : data.items.length === 0 ? <div className="aset__empty">Belum ada aktivitas tercatat.{isAdmin ? ' Klik “Catat Aktivitas”.' : ''}</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr>
                <th>Tanggal</th><th>Aset</th><th>Jenis</th><th>Deskripsi</th><th>Pihak Terkait</th><th>Nilai Nego</th><th></th>
              </tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="aset__muted">{tgl(r.tglAktivitas)}</td>
                    <td>{r.asetLabel}</td>
                    <td>{r.jenis}</td>
                    <td className="aset__muted">{r.deskripsi || '—'}</td>
                    <td className="aset__muted">{r.pihakTerkait || '—'}</td>
                    <td className="aset__muted">{r.nilaiNego != null ? rupiah(r.nilaiNego) : '—'}</td>
                    <td>
                      {isAdmin && (
                        <div className="aset__row-act">
                          <button type="button" className="aset__ibtn" title="Ubah" onClick={() => setModal({ mode: 'ubah', row: r })}><Pencil size={15} /></button>
                          <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" onClick={() => hapus(r)}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal?.mode === 'buat' && <AktivitasFormModal daftarAset={data.daftarAset} onClose={() => setModal(null)} onSubmit={buat} />}
      {modal?.mode === 'ubah' && <AktivitasFormModal initial={modal.row} daftarAset={data.daftarAset} onClose={() => setModal(null)} onSubmit={ubah} />}
    </div>
  )
}