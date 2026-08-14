import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Pencil, Trash2, PackageX } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { TidakProduktifFormModal, rupiah, tgl, useConfirm } from './asetShared'
import './AsetPage.css'

export default function AsetTidakProduktif() {
  const [data, setData] = useState({ items: [], isAdminAset: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [modal, setModal] = useState(null) // {mode:'buat'|'ubah', row?}
  const [filterJenis, setFilterJenis] = useState('Semua')
  const { confirm, ConfirmUI } = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.getAsetTidakProduktifList()); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], isAdminAset: false })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat data.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const isAdmin = data.isAdminAset
  const jenisList = ['Semua', ...new Set(data.items.map((r) => r.jenis))]
  const rows = filterJenis === 'Semua' ? data.items : data.items.filter((r) => r.jenis === filterJenis)
  const totalAppraisal = rows.reduce((sum, r) => sum + (r.appraisalHarga ?? 0), 0)
  const countAppraisal = rows.filter((r) => r.appraisalHarga != null).length

  async function buat(payload) { await api.buatAsetTidakProduktif(payload); setModal(null); setMsg({ t: 'ok', m: 'Data ditambahkan.' }); await load() }
  async function ubah(payload) { await api.ubahAsetTidakProduktif(modal.row.id, payload); setModal(null); setMsg({ t: 'ok', m: 'Data diperbarui.' }); await load() }
  async function hapus(row) {
    if (!(await confirm(`Hapus data "${row.nama || row.jenis}"? Data akan hilang permanen.`, { danger: true }))) return
    try { await api.hapusAsetTidakProduktif(row.id); setMsg({ t: 'ok', m: 'Data dihapus.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <div>
          <h2 className="aset__title"><PackageX size={18} style={{ verticalAlign: '-3px' }} /> Aset Tidak Produktif</h2>
          <p className="aset__sub">Daftar aset yang sudah tidak digunakan secara produktif (idle, rusak, atau menunggu penghapusan/dijual).</p>
          {!loading && !error && rows.length > 0 && (
            <div className="aset__total">
              <span className="aset__total-label">Total nilai aset Tidak Produktif (berdasar Appraisal){filterJenis !== 'Semua' ? ` — ${filterJenis}` : ''}</span>
              <span className="aset__total-value">{rupiah(totalAppraisal)}</span>
              <span className="aset__muted">dari {countAppraisal} dari {rows.length} aset yang punya nilai appraisal</span>
            </div>
          )}
        </div>
        {isAdmin && <button type="button" className="aset__btn" onClick={() => setModal({ mode: 'buat' })}><Plus size={15} /> Tambah</button>}
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      {!loading && !error && data.items.length > 0 && (
        <div className="aset__chips">
          {jenisList.map((j) => (
            <button
              key={j}
              type="button"
              className={`aset__chip${filterJenis === j ? ' aset__chip--active' : ''}`}
              onClick={() => setFilterJenis(j)}
            >
              {j}{j !== 'Semua' && <span className="aset__chip-count">{data.items.filter((r) => r.jenis === j).length}</span>}
            </button>
          ))}
        </div>
      )}

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : data.items.length === 0 ? <div className="aset__empty">Belum ada data aset tidak produktif.{isAdmin ? ' Klik “Tambah”.' : ''}</div>
        : rows.length === 0 ? <div className="aset__empty">Tidak ada data untuk jenis "{filterJenis}".</div>
        : (
          <div className="aset__tablewrap">
            <table className="aset__table">
              <thead><tr>
                <th>No.</th><th>Jenis</th><th>Sertifikat</th><th>Lokasi</th><th>Qty</th><th>Status Jaminan</th>
                <th>Harga Pasar (Rp)</th><th>Appraisal</th><th>PBB</th><th>Catatan Akt</th><th>Perijinan ke Pemegang Saham</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="aset__muted">{idx + 1}</td>
                    <td>{r.jenis}{r.nama ? <><br /><span className="aset__muted">{r.nama}</span></> : null}</td>
                    <td>
                      {r.sertifikatHak || r.sertifikatNo ? (
                        <>
                          {r.sertifikatHak && <div>{r.sertifikatHak}</div>}
                          {r.sertifikatNo && <div className="aset__muted">{r.sertifikatNo}{r.sertifikatTahun ? ` (${r.sertifikatTahun})` : ''}</div>}
                          {r.sertifikatJangkaWaktu && <div className="aset__muted">s/d {tgl(r.sertifikatJangkaWaktu)}</div>}
                          {r.sertifikatKeterangan && <div className="aset__muted">{r.sertifikatKeterangan}</div>}
                        </>
                      ) : <span className="aset__muted">—</span>}
                    </td>
                    <td className={r.perijinanPemegangSaham ? '' : 'aset__muted'}>{r.lokasi || '—'}</td>
                    <td className="aset__muted">{r.qty != null ? `${r.qty} ${r.satuan}` : '—'}</td>
                    <td className="aset__muted">{r.statusJaminan || '—'}</td>
                    <td className="aset__muted">{r.hargaPasar != null ? rupiah(r.hargaPasar) : '—'}</td>
                    <td>
                      {r.appraisalHarga != null || r.appraisalKjpp ? (
                        <>
                          {r.appraisalHarga != null && <div>{rupiah(r.appraisalHarga)}</div>}
                          {r.appraisalKjpp && <div className="aset__muted">{r.appraisalKjpp}{r.appraisalTahun ? ` (${r.appraisalTahun})` : ''}</div>}
                          {r.appraisalNo && <div className="aset__muted">{r.appraisalNo}</div>}
                        </>
                      ) : <span className="aset__muted">—</span>}
                    </td>
                    <td>
                      {r.pbbNop || r.pbbNominal != null ? (
                        <>
                          {r.pbbNop && <div>{r.pbbNop}</div>}
                          {r.pbbNominal != null && <div className="aset__muted">{rupiah(r.pbbNominal)}</div>}
                          {r.pbbTglPembayaran && <div className="aset__muted">{tgl(r.pbbTglPembayaran)}</div>}
                        </>
                      ) : <span className="aset__muted">—</span>}
                    </td>
                    <td className="aset__muted">{r.catatanAkt || '—'}</td>
                    <td className="aset__muted">{r.perijinanPemegangSaham || '—'}</td>
                    <td>
                      {isAdmin && (
                        <div className="aset__row-act">
                          <button type="button" className="aset__ibtn" title="Ubah" aria-label="Ubah" onClick={() => setModal({ mode: 'ubah', row: r })}><Pencil size={15} /></button>
                          <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" aria-label="Hapus" onClick={() => hapus(r)}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal?.mode === 'buat' && <TidakProduktifFormModal onClose={() => setModal(null)} onSubmit={buat} />}
      {modal?.mode === 'ubah' && <TidakProduktifFormModal initial={modal.row} onClose={() => setModal(null)} onSubmit={ubah} />}
      {ConfirmUI}
    </div>
  )
}