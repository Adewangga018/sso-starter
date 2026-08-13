import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Eye, Search, ChevronLeft, ChevronRight, QrCode } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { rupiah, encodeAsetId } from './asetShared'
import './AsetPage.css'

const PAGE_SIZE = 20

// Inventaris: sumber datanya GCS.dbo.assets (modul Aktiva Tetap ERP), read-only.
// Nilai/lokasi/kategori mengikuti data akunting - tidak diinput/diubah dari MyGCS.
export default function Inventaris() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filterKelompok, setFilterKelompok] = useState('Semua')
  const [filterLokasi, setFilterLokasi] = useState('Semua')
  const [filterPic, setFilterPic] = useState('Semua')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set())

  const load = useCallback(async (term) => {
    setLoading(true)
    try { setData(await api.getAsetList(term)); setError('') }
    catch (err) {
      if (isEmptyDataError(err)) setData({ items: [], total: 0 })
      else setError(err instanceof ApiError ? err.message : 'Gagal memuat aset.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load('') }, [load])
  useEffect(() => { setPage(1) }, [filterKelompok, filterLokasi, filterPic, data.items])

  const kelompokList = ['Semua', ...new Set(data.items.map((a) => a.kelompok).filter(Boolean))]
  const lokasiList = ['Semua', ...new Set(data.items.map((a) => a.lokasi).filter(Boolean))]
  const picList = ['Semua', ...new Set(data.items.map((a) => a.picSaatIni).filter(Boolean))]
  const rows = data.items
    .filter((a) => filterKelompok === 'Semua' || a.kelompok === filterKelompok)
    .filter((a) => filterLokasi === 'Semua' || a.lokasi === filterLokasi)
    .filter((a) => filterPic === 'Semua' || a.picSaatIni === filterPic)
  const totalNilaiBuku = rows.reduce((sum, a) => sum + (a.nilaiBuku ?? 0), 0)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageIdsSelected = pageRows.length > 0 && pageRows.every((a) => selected.has(a.objectId))

  function toggleSelect(objectId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(objectId)) next.delete(objectId); else next.add(objectId)
      return next
    })
  }
  function toggleSelectPage() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (pageIdsSelected) pageRows.forEach((a) => next.delete(a.objectId))
      else pageRows.forEach((a) => next.add(a.objectId))
      return next
    })
  }
  function cetakTerpilih() {
    if (selected.size === 0) return
    window.open(`/cetak/aset-qr?ids=${encodeURIComponent([...selected].map(encodeAsetId).join(','))}`, '_blank')
  }

  return (
    <div className="aset">
      <div className="aset__head">
        <h2 className="aset__title">Inventaris Aset</h2>
      </div>

      {!loading && !error && rows.length > 0 && (
        <div className="aset__total aset__total--wide">
          <span className="aset__total-label">Total Nilai Buku{filterKelompok !== 'Semua' ? ` — ${filterKelompok}` : ''}</span>
          <span className="aset__total-value">{rupiah(totalNilaiBuku)}</span>
          <span className="aset__muted">{rows.length} aset{filterKelompok !== 'Semua' ? ` dari total ${data.items.length}` : ''}</span>
        </div>
      )}

      <div className="aset__tools">
        {selected.size > 0 && (
          <button type="button" className="aset__btn" onClick={cetakTerpilih}><QrCode size={15} /> Cetak QR Terpilih ({selected.size})</button>
        )}
        {!loading && !error && data.items.length > 0 && (
          <select className="aset__search" value={filterKelompok} onChange={(e) => setFilterKelompok(e.target.value)}>
            {kelompokList.map((k) => (
              <option key={k} value={k}>{k === 'Semua' ? 'Semua Kelompok' : k} {k !== 'Semua' ? `(${data.items.filter((a) => a.kelompok === k).length})` : ''}</option>
            ))}
          </select>
        )}
        {!loading && !error && data.items.length > 0 && (
          <select className="aset__search" value={filterLokasi} onChange={(e) => setFilterLokasi(e.target.value)}>
            {lokasiList.map((l) => (
              <option key={l} value={l}>{l === 'Semua' ? 'Semua Lokasi' : l} {l !== 'Semua' ? `(${data.items.filter((a) => a.lokasi === l).length})` : ''}</option>
            ))}
          </select>
        )}
        {!loading && !error && data.items.length > 0 && (
          <select className="aset__search" value={filterPic} onChange={(e) => setFilterPic(e.target.value)}>
            {picList.map((p) => (
              <option key={p} value={p}>{p === 'Semua' ? 'Semua PIC' : p} {p !== 'Semua' ? `(${data.items.filter((a) => a.picSaatIni === p).length})` : ''}</option>
            ))}
          </select>
        )}
        <form onSubmit={(e) => { e.preventDefault(); load(q) }} style={{ display: 'flex', gap: 6 }}>
          <input className="aset__search" placeholder="Cari kode/nama/lokasi/nopol…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" className="aset__ibtn" aria-label="Cari"><Search size={16} /></button>
        </form>
      </div>

      {loading ? <div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div>
        : error ? <div className="aset__alert">{error}</div>
        : data.items.length === 0 ? <div className="aset__empty">Tidak ada aset ditemukan.</div>
        : rows.length === 0 ? <div className="aset__empty">Tidak ada aset untuk filter yang dipilih.</div>
        : (
          <>
            <div className="aset__tablewrap">
              <table className="aset__table">
                <thead><tr>
                  <th><input type="checkbox" checked={pageIdsSelected} onChange={toggleSelectPage} /></th>
                  <th></th>
                  <th>Kode</th><th>No. Aset Internal</th><th>Nama</th><th>Kategori</th><th>Kelompok</th><th>Lokasi</th><th>PIC</th><th>Qty</th><th>Nilai Perolehan</th><th>Nilai Buku</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {pageRows.map((a) => (
                    <tr key={a.objectId}>
                      <td><input type="checkbox" checked={selected.has(a.objectId)} onChange={() => toggleSelect(a.objectId)} /></td>
                      <td>
                        <div className="aset__row-act">
                          <Link className="aset__ibtn" title="Detail" to={`/my-asset/detail/${encodeAsetId(a.objectId)}`}><Eye size={15} /></Link>
                        </div>
                      </td>
                      <td className="aset__kode"><Link to={`/my-asset/detail/${encodeAsetId(a.objectId)}`}>{a.objectId}</Link></td>
                      <td className="aset__muted">{a.nomorAset || '—'}</td>
                      <td>{a.nama || '—'}</td>
                      <td className="aset__muted">{a.kategori || '—'}</td>
                      <td className="aset__muted">{a.kelompok || '—'}</td>
                      <td className="aset__muted">{a.lokasi || '—'}</td>
                      <td className="aset__muted">{a.picSaatIni || '—'}</td>
                      <td className="aset__muted">{a.qty != null ? `${a.qty} ${a.satuan ?? ''}` : '—'}</td>
                      <td className="aset__muted">{a.nilaiPerolehan != null ? rupiah(a.nilaiPerolehan) : '—'}</td>
                      <td className="aset__muted">{a.nilaiBuku != null ? rupiah(a.nilaiBuku) : '—'}</td>
                      <td className="aset__muted">{a.aktif === 'Y' ? 'Aktif' : a.aktif === 'T' ? 'Tidak Aktif' : (a.status || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="aset__pagination">
              <span className="aset__muted">Halaman {page} dari {totalPages} ({rows.length} aset)</span>
              <div className="aset__page-nav">
                <button type="button" className="aset__ibtn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Sebelumnya"><ChevronLeft size={15} /></button>
                <button type="button" className="aset__ibtn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Berikutnya"><ChevronRight size={15} /></button>
              </div>
            </div>
          </>
        )}
    </div>
  )
}