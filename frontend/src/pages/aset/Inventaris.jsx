import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Eye, Pencil, Trash2, X, Wrench, Search } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { AsetFormModal, MaintenanceFormModal, KondisiBadge, StatusBadge, MaintStatusBadge, rupiah, tgl } from './asetShared'
import './AsetPage.css'

export default function Inventaris() {
  const [data, setData] = useState({ items: [], isAdminAset: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)       // {mode:'buat'|'ubah', aset?}
  const [detail, setDetail] = useState(null)      // AsetDetailDto
  const [detailLoading, setDetailLoading] = useState(false)
  const [maintModal, setMaintModal] = useState(null) // {aset}

  const load = useCallback(async (term) => {
    setLoading(true)
    try { setData(await api.getAsetList(term)); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], isAdminAset: false })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat aset.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load('') }, [load])

  const isAdmin = data.isAdminAset

  async function buat(payload) { await api.buatAset(payload); setModal(null); setMsg({ t: 'ok', m: 'Aset ditambahkan.' }); await load(q) }
  async function ubah(payload) { await api.ubahAset(modal.aset.id, payload); setModal(null); setMsg({ t: 'ok', m: 'Aset diperbarui.' }); await load(q) }
  async function hapus(a) {
    if (!window.confirm(`Hapus aset "${a.nama}"? Riwayat maintenance-nya ikut terhapus.`)) return
    try { await api.hapusAset(a.id); setMsg({ t: 'ok', m: 'Aset dihapus.' }); await load(q) }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }
  async function openDetail(id) {
    setDetailLoading(true); setDetail({ loading: true })
    try { setDetail(await api.getAsetDetail(id)) }
    catch { setMsg({ t: 'err', m: 'Gagal memuat detail.' }); setDetail(null) }
    finally { setDetailLoading(false) }
  }
  async function tambahMaint(payload) {
    await api.tambahMaintenance(maintModal.aset.id, payload)
    setMaintModal(null); setMsg({ t: 'ok', m: 'Jadwal maintenance ditambahkan.' })
    await load(q)
    if (detail?.aset?.id) openDetail(detail.aset.id)
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title">Inventaris Aset</h2>
          <p className="aset__sub">Daftar aset perusahaan beserta lokasi, penanggung jawab, kondisi & jadwal maintenance.</p>
        </div>
        <div className="aset__tools">
          <form onSubmit={(e) => { e.preventDefault(); load(q) }} style={{ display: 'flex', gap: 6 }}>
            <input className="aset__search" placeholder="Cari kode/nama/kategori/PIC…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="aset__ibtn" aria-label="Cari"><Search size={16} /></button>
          </form>
          {isAdmin && <button type="button" className="aset__btn" onClick={() => setModal({ mode: 'buat' })}><Plus size={15} /> Tambah Aset</button>}
        </div>
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : data.items.length === 0 ? <div className="aset__empty">Belum ada aset tercatat.{isAdmin ? ' Klik “Tambah Aset”.' : ''}</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr>
                <th>Kode</th><th>Nama</th><th>Kategori</th><th>Lokasi</th><th>PIC</th><th>Kondisi</th><th>Status</th><th>Maint. Berikutnya</th><th></th>
              </tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="aset__kode">{a.kode}</td>
                    <td>{a.nama}</td>
                    <td className="aset__muted">{a.kategori || '—'}</td>
                    <td className="aset__muted">{a.lokasi || '—'}</td>
                    <td className="aset__muted">{a.namaPic || '—'}</td>
                    <td><KondisiBadge kondisi={a.kondisi} /></td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className={a.maintenanceBerikutnya ? 'aset__due' : 'aset__muted'}>{a.maintenanceBerikutnya ? tgl(a.maintenanceBerikutnya) : '—'}</td>
                    <td>
                      <div className="aset__row-act">
                        <button type="button" className="aset__ibtn" title="Detail" onClick={() => openDetail(a.id)}><Eye size={15} /></button>
                        {isAdmin && <button type="button" className="aset__ibtn" title="Ubah" onClick={() => setModal({ mode: 'ubah', aset: a })}><Pencil size={15} /></button>}
                        {isAdmin && <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" onClick={() => hapus(a)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal?.mode === 'buat' && <AsetFormModal onClose={() => setModal(null)} onSubmit={buat} />}
      {modal?.mode === 'ubah' && <AsetFormModal initial={modal.aset} onClose={() => setModal(null)} onSubmit={ubah} />}
      {maintModal && <MaintenanceFormModal namaAset={maintModal.aset.nama} onClose={() => setMaintModal(null)} onSubmit={tambahMaint} />}

      {detail && (
        <div className="aset__overlay" onClick={() => setDetail(null)}>
          <div className="aset__modal" onClick={(e) => e.stopPropagation()}>
            <div className="aset__modal-head">
              <h3>{detailLoading ? 'Memuat…' : `${detail.aset?.kode} · ${detail.aset?.nama}`}</h3>
              <button type="button" className="aset__x" onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="aset__modal-body">
              {detailLoading || detail.loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={20} /> Memuat…</div> : (
                <>
                  <div className="aset__dgrid">
                    <div><span>Kategori</span><b>{detail.aset.kategori || '—'}</b></div>
                    <div><span>Merk / Model</span><b>{detail.aset.merk || '—'}</b></div>
                    <div><span>Nomor Seri</span><b>{detail.aset.nomorSeri || '—'}</b></div>
                    <div><span>Lokasi</span><b>{detail.aset.lokasi || '—'}</b></div>
                    <div><span>Penanggung Jawab</span><b>{detail.aset.namaPic || '—'}</b></div>
                    <div><span>Nilai</span><b>{rupiah(detail.aset.nilai)}</b></div>
                    <div><span>Tgl Perolehan</span><b>{tgl(detail.aset.tglPerolehan)}</b></div>
                    <div><span>Kondisi / Status</span><b><KondisiBadge kondisi={detail.aset.kondisi} /> <StatusBadge status={detail.aset.status} /></b></div>
                    {detail.aset.catatan && <div style={{ gridColumn: '1 / -1' }}><span>Catatan</span><b>{detail.aset.catatan}</b></div>}
                  </div>

                  <div className="aset__mhead">
                    <h4><Wrench size={15} style={{ verticalAlign: '-2px' }} /> Riwayat & Jadwal Maintenance</h4>
                    {detail.isAdminAset && <button type="button" className="aset__btn" onClick={() => setMaintModal({ aset: detail.aset })}><Plus size={14} /> Tambah</button>}
                  </div>
                  <div className="aset__mlist">
                    {detail.maintenance.length === 0 ? <div className="aset__muted" style={{ fontSize: '0.84rem' }}>Belum ada data maintenance.</div>
                      : detail.maintenance.map((m) => (
                        <div className="aset__mrow" key={m.id}>
                          <span>
                            <b>{m.jenis}</b> · {tgl(m.tglJadwal)}
                            {m.pelaksana ? <small> — {m.pelaksana}</small> : null}
                            {m.biaya != null ? <small> · {rupiah(m.biaya)}</small> : null}
                          </span>
                          <MaintStatusBadge status={m.status} />
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
