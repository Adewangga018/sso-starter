import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Eye, MessageSquarePlus, RotateCw, Search, Trash2 } from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../../lib/api'
import { useDialog } from '../../components/DialogProvider'
import { statusClass } from './statusClass'
import './inovasi.css'

// Daftar Inovasi (risalah) - lintas metodologi (SS/GIO/5R). Risalah dibuat dari
// Sumbang Gagasan yang disetujui GM, jadi tidak ada "buat langsung" di sini.
export default function InovasiList() {
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const isApprover = ctx.isApprover === true
  const navigate = useNavigate()
  const dialog = useDialog()

  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  async function load() {
    try {
      const d = await api.listInovasi()
      setRows(d.items)
      setErr('')
    } catch (e) {
      if (isEmptyDataError(e)) { setRows([]); setErr(''); return }
      setErr(e instanceof ApiError ? e.message : 'Gagal memuat data.')
    }
  }
  useEffect(() => { load() }, [])

  // Opsi status diturunkan dari data yang ada (bukan daftar statis) agar selalu relevan.
  const statusOptions = useMemo(() => [...new Set((rows ?? []).map((r) => r.status).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rows ?? []).filter((r) =>
      (!status || r.status === status) &&
      (!term || [r.noRegistrasi, r.jenis, r.namaGugus, r.judul, r.status, r.namaDepartemen, r.ketuaNama]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))))
  }, [rows, search, status])

  // Menghapus risalah sekaligus menghapus Sumbang Gagasan sumbernya (lihat
  // InovasiController.Delete) - disebutkan di konfirmasi agar tidak mengejutkan.
  async function handleDelete(row) {
    if (!(await dialog.confirm({
      title: 'Hapus Risalah',
      message: `Hapus risalah "${row.namaGugus || row.noRegistrasi || row.id}"? Sumbang Gagasan sumbernya${row.gagasanJudul ? ` ("${row.gagasanJudul}")` : ''} beserta riwayat persetujuannya ikut terhapus.`,
      danger: true,
      confirmText: 'Hapus',
    }))) return
    try { await api.deleteInovasi(row.id); await load() } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal menghapus.') }
  }

  if (!rows && !err) return <div className="inv"><p className="inv__subtitle">Memuat data inovasi...</p></div>

  return (
    <div className="inv">
      <h2 className="inv__title">Daftar Inovasi</h2>
      <p className="inv__subtitle">Risalah inovasi Anda (SS / GIO / 5R). Risalah muncul di sini setelah Sumbang Gagasan disetujui & didaftarkan.</p>

      {err && <div className="inv__banner inv__banner--err">{err}</div>}

      <div className="inv__toolbar">
        <div className="inv__filters">
          <div className="inv__search">
            <span className="inv__search-icon"><Search size={16} /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. registrasi, metodologi, nama gugus, judul, status..." />
          </div>
          {isApprover && (
            <select className="inv__select" value={status} onChange={(e) => setStatus(e.target.value)} title="Filter status">
              <option value="">Semua Status</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="inv__btn inv__btn--ghost" onClick={load} title="Muat ulang"><RotateCw size={15} /></button>
          <button type="button" className="inv__btn inv__btn--primary" onClick={() => navigate(`${base}/gagasan`)}>
            <MessageSquarePlus size={16} /> Sumbang Gagasan
          </button>
        </div>
      </div>

      <div className="inv__table-wrap">
        <table className="inv__table">
          <thead>
            <tr>
              <th>Status</th><th>No. Registrasi</th><th>Metodologi</th><th>Nama Gugus</th>
              <th>Tema</th><th>Judul</th><th>Departemen</th><th>Peran</th><th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td className="inv__no-data" colSpan={9}>Belum ada risalah. Mulai dari menu Sumbang Gagasan.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`inv__status ${statusClass(r.status)}`}>{r.status}</span>
                  {r.sudahDinilai && <span className="inv__status inv__status--dinilai" style={{ marginLeft: 6 }}>Sudah Dinilai</span>}
                </td>
                <td>{r.noRegistrasi ?? <span style={{ color: '#9aa79d' }}>-</span>}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.jenis}</td>
                <td>{r.namaGugus ?? '-'}</td>
                <td style={{ textAlign: 'center' }}>{r.temaKe ?? '-'}</td>
                <td style={{ maxWidth: 240 }}>{r.judul ?? <span style={{ color: '#9aa79d' }}>(belum ada judul)</span>}</td>
                <td>{r.namaDepartemen ?? r.namaKompartemen ?? '-'}</td>
                <td>{r.peranSaya}</td>
                <td>
                  <div className="inv__row-actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="inv__icon-btn" title="Buka" onClick={() => navigate(`${base}/daftar/${r.id}`)}><Eye size={15} /></button>
                    {r.peranSaya === 'Pengaju' && (r.status === 'Draft' || r.status === 'Revisi') && (
                      <button type="button" className="inv__icon-btn inv__icon-btn--danger" title="Hapus" onClick={() => handleDelete(r)}><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
