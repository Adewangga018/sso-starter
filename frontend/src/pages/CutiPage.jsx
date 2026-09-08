import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flag,
  Info,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
  Clock,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { api, ApiError, isEmptyDataError } from '../lib/api'
import './CutiPage.css'

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// Jumlah hari kerja (Sen–Jum) inklusif — untuk pratinjau di form.
function hariKerja(mulai, selesai) {
  if (!mulai || !selesai) return 0
  const a = new Date(mulai), b = new Date(selesai)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  let n = 0
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const w = d.getDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

function StatusBadge({ status }) {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'menunggu' || s === 'pending') {
    return (
      <span className="cuti__badge cuti__badge--pending">
        <Clock size={11} />
        <span>{status}</span>
      </span>
    )
  }
  if (s === 'disetujui' || s === 'approved') {
    return (
      <span className="cuti__badge cuti__badge--success">
        <CheckCircle2 size={11} />
        <span>{status}</span>
      </span>
    )
  }
  if (s === 'ditolak' || s === 'rejected') {
    return (
      <span className="cuti__badge cuti__badge--danger">
        <AlertCircle size={11} />
        <span>{status}</span>
      </span>
    )
  }
  return (
    <span className="cuti__badge cuti__badge--neutral">
      <span>{status || '-'}</span>
    </span>
  )
}

const EMPTY_CB = { tglMulai: '', tglSelesai: '', keterangan: '', mengurangiHak: true }
const EMPTY_NAS = { tglMulai: '', tglSelesai: '', keterangan: '' }

export default function CutiPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ tglMulai: '', tglSelesai: '', keterangan: '' })
  const [busy, setBusy] = useState(false)
  const [detailPengajuan, setDetailPengajuan] = useState(null)
  const [cbModal, setCbModal] = useState(null) // {mode, entry}
  const [nasModal, setNasModal] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await api.getCuti()
      setData(d)
      setLoading(false)
    } catch (err) {
      if (isEmptyDataError(err)) {
        setData({
          sisa: 0,
          adaData: false,
          pengajuan: [],
          persetujuan: [],
          riwayat: [],
          cutiBersamaList: [],
          cutiNasionalList: [],
        })
      } else {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat data cuti.')
      }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flash = (type, text) => {
    setMsg({ type, text })
    if (type === 'ok') setTimeout(() => setMsg(null), 4000)
  }

  async function ajukan(e) {
    e.preventDefault()
    if (!form.tglMulai || !form.tglSelesai) {
      flash('err', 'Tanggal mulai dan selesai wajib diisi.')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await api.ajukanCuti({
        tglMulai: form.tglMulai,
        tglSelesai: form.tglSelesai,
        keterangan: form.keterangan.trim() || null,
      })
      setForm({ tglMulai: '', tglSelesai: '', keterangan: '' })
      setFormOpen(false)
      flash('ok', 'Pengajuan cuti terkirim, menunggu persetujuan atasan.')
      await load()
    } catch (err) {
      flash('err', err instanceof ApiError ? err.message : 'Gagal mengajukan cuti.')
    } finally {
      setBusy(false)
    }
  }

  async function act(fn, okText) {
    setMsg(null)
    try {
      await fn()
      flash('ok', okText)
      await load()
    } catch (err) {
      flash('err', err instanceof ApiError ? err.message : 'Aksi gagal.')
    }
  }

  if (loading) {
    return (
      <div className="cuti">
        <div className="cuti__card cuti__state-card">
          <Loader2 className="cuti__spin" size={32} />
          <h4 className="cuti__state-title">Memuat Data Cuti</h4>
          <p className="cuti__state-desc">Sedang mengambil informasi saldo dan riwayat cuti Anda...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="cuti">
        <div className="cuti__card cuti__state-card">
          <AlertCircle size={36} className="cuti__state-icon cuti__state-icon--err" />
          <h4 className="cuti__state-title">Gagal Memuat Data Cuti</h4>
          <p className="cuti__state-desc">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const previewHari = hariKerja(form.tglMulai, form.tglSelesai)
  const isAdmin = data.isAdminSdm

  return (
    <div className="cuti">
      {/* Header Halaman */}
      <div className="cuti__page-header">
        <div className="cuti__page-header-info">
          <div className="cuti__page-header-icon">
            <CalendarDays size={24} />
          </div>
          <div>
            <h2 className="cuti__title">Cuti Tahunan & Hari Libur</h2>
            <p className="cuti__sub">
              Akrual {data.hakPerTahun ?? 24} hari tiap 2 tahun sekali di ulang tahun kerja (TMT) Anda — batas akumulasi maksimal {data.batasAkumulasi ?? 24} hari.
            </p>
          </div>
        </div>
      </div>

      {msg && <div className={`cuti__msg cuti__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* Saldo Banner Card */}
      <div className="cuti__saldo">
        <div className="cuti__saldo-icon">
          <CalendarDays size={26} />
        </div>
        <div className="cuti__saldo-main">
          <div className="cuti__saldo-value">
            {data.sisa} <span>hari</span>
          </div>
          <div className="cuti__saldo-label">
            Sisa Saldo Cuti Tahunan{data.periode ? ` · Periode ${data.periode}` : ''}
          </div>
          {data.adaData && (
            <div className="cuti__saldo-break">
              Akrual {data.akrual}
              {data.cutiBersama > 0 ? ` − cuti bersama ${data.cutiBersama}` : ''} = <b>hak {data.hak} hari</b> · terpakai {data.diambil} hari
            </div>
          )}
          {data.tmt && (
            <div className="cuti__saldo-break">
              TMT {formatTgl(data.tmt)}
              {data.akrualBerikutnya ? ` · Akrual berikutnya ${formatTgl(data.akrualBerikutnya)}` : ''}
            </div>
          )}
        </div>
        {data.adaData && (
          <button type="button" className="cuti__btn cuti__btn--apply" onClick={() => setFormOpen((v) => !v)}>
            <Plus size={16} /> <span>{formOpen ? 'Tutup Formulir' : 'Ajukan Cuti'}</span>
          </button>
        )}
      </div>

      {!data.adaData && (
        <div className="cuti__nodata">
          <Info size={16} />
          <span>Belum ada data saldo cuti untuk NIK Anda. Silakan hubungi bagian SDM bila seharusnya saldo tercatat.</span>
        </div>
      )}

      {/* Formulir Ajukan Cuti */}
      {formOpen && (
        <form className="cuti__card cuti__form-card" onSubmit={ajukan}>
          <div className="cuti__card-head">
            <span><CalendarDays size={16} /> Ajukan Permohonan Cuti Tahunan</span>
          </div>
          <div className="cuti__form">
            <label className="cuti__form-field">
              <span>Tanggal Mulai *</span>
              <input
                type="date"
                value={form.tglMulai}
                onChange={(e) => setForm((f) => ({ ...f, tglMulai: e.target.value }))}
                required
              />
            </label>
            <label className="cuti__form-field">
              <span>Tanggal Selesai *</span>
              <input
                type="date"
                value={form.tglSelesai}
                min={form.tglMulai || undefined}
                onChange={(e) => setForm((f) => ({ ...f, tglSelesai: e.target.value }))}
                required
              />
            </label>
            <label className="cuti__form-field cuti__form-full">
              <span>Keterangan Alasan Cuti (opsional)</span>
              <input
                value={form.keterangan}
                onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
                placeholder="Tuliskan alasan atau catatan cuti Anda..."
              />
            </label>
          </div>
          <div className="cuti__form-foot">
            <span className="cuti__preview">
              Estimasi: <b>{previewHari > 0 ? `${previewHari} hari kerja` : 'Pilih rentang tanggal'}</b>
            </span>
            <div className="cuti__form-actions">
              <button type="button" className="cuti__btn cuti__btn--ghost" onClick={() => setFormOpen(false)}>
                Batal
              </button>
              <button type="submit" className="cuti__btn cuti__btn--submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="cuti__spin" /> : <CheckCircle2 size={16} />}
                <span>Kirim Pengajuan</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Persetujuan (atasan) */}
      {data.persetujuan?.length > 0 && (
        <div className="cuti__card">
          <div className="cuti__card-head">
            <span><Clock size={16} /> Menunggu Persetujuan Anda ({data.persetujuan.length})</span>
          </div>
          <div className="cuti__list">
            {data.persetujuan.map((p) => (
              <div className="cuti__item" key={p.id}>
                <div className="cuti__item-main">
                  <div className="cuti__item-title">
                    {p.nama || p.idKaryawan} · <b>{p.jumlahHari} hari kerja</b>
                  </div>
                  <div className="cuti__item-sub">
                    {formatTgl(p.tglMulai)} – {formatTgl(p.tglSelesai)}
                    {p.keterangan ? ` · ${p.keterangan}` : ''}
                  </div>
                </div>
                <div className="cuti__item-actions">
                  <button
                    type="button"
                    className="cuti__btn cuti__btn--ghost"
                    onClick={() => act(() => api.putusanCuti(p.id, { setuju: false }), 'Pengajuan cuti ditolak.')}
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    className="cuti__btn cuti__btn--submit"
                    onClick={() => act(() => api.putusanCuti(p.id, { setuju: true }), 'Pengajuan disetujui, saldo pemohon berkurang.')}
                  >
                    Setujui
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabel Pengajuan Saya (Padat, Tanpa Scroll Berlebih, Baris Bisa Diklik) */}
      <div className="cuti__card">
        <div className="cuti__card-head">
          <span><Calendar size={16} /> Pengajuan Saya</span>
        </div>
        <div className="cuti__table-wrap">
          <table className="cuti__table">
            <thead>
              <tr>
                <th className="cuti__col-tgl">Periode Tanggal</th>
                <th className="cuti__col-hari">Hari Kerja</th>
                <th className="cuti__col-ket">Keterangan</th>
                <th className="cuti__col-status">Status</th>
                <th className="cuti__col-aksi">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(data.pengajuan?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="cuti__empty">
                    Belum ada riwayat pengajuan cuti.
                  </td>
                </tr>
              ) : (
                (data.pengajuan ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="cuti__row cuti__row--clickable"
                    onClick={() => setDetailPengajuan(p)}
                    title="Klik untuk melihat detail pengajuan cuti"
                  >
                    <td className="cuti__col-tgl" data-label="Periode Tanggal">
                      <span className="cuti__date-text">
                        {formatTgl(p.tglMulai)} – {formatTgl(p.tglSelesai)}
                      </span>
                    </td>
                    <td className="cuti__col-hari" data-label="Hari Kerja">
                      <span className="cuti__days-badge">{p.jumlahHari} hari</span>
                    </td>
                    <td className="cuti__col-ket" data-label="Keterangan">
                      <span className="cuti__ket-text">
                        {p.keterangan || '-'}
                        {p.komentar ? <span className="cuti__atasan-note"> (Atasan: {p.komentar})</span> : ''}
                      </span>
                    </td>
                    <td className="cuti__col-status" data-label="Status">
                      <StatusBadge status={p.status} />
                    </td>
                    <td
                      className="cuti__col-aksi"
                      data-label="Aksi"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.status === 'Menunggu' && (
                        <button
                          type="button"
                          className="cuti__link-del"
                          onClick={() => act(() => api.batalCuti(p.id), 'Pengajuan cuti dibatalkan.')}
                          title="Batalkan Pengajuan"
                          aria-label="Batalkan Pengajuan"
                        >
                          <X size={14} /> <span>Batal</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cuti Bersama */}
      <div className="cuti__card">
        <div className="cuti__card-head">
          <span><CalendarRange size={16} /> Cuti Bersama</span>
          {isAdmin && (
            <button
              type="button"
              className="cuti__btn cuti__btn--sm"
              onClick={() => setCbModal({ mode: 'buat', entry: { ...EMPTY_CB } })}
            >
              <Plus size={14} /> <span>Tambah Cuti Bersama</span>
            </button>
          )}
        </div>
        <KalenderList
          items={data.cutiBersamaList}
          isAdmin={isAdmin}
          kind="cb"
          onEdit={(x) =>
            setCbModal({
              mode: 'ubah',
              entry: {
                id: x.id,
                tglMulai: x.tglMulai,
                tglSelesai: x.tglSelesai,
                keterangan: x.keterangan,
                mengurangiHak: x.mengurangiHak,
              },
            })
          }
          onDelete={(x) =>
            window.confirm(`Hapus cuti bersama "${x.keterangan}"?`) &&
            act(() => api.hapusCutiBersama(x.id), 'Cuti bersama dihapus, saldo dihitung ulang.')
          }
        />
      </div>

      {/* Cuti Nasional / Hari Libur */}
      <div className="cuti__card">
        <div className="cuti__card-head">
          <span><Flag size={16} /> Cuti Nasional / Hari Libur</span>
          {isAdmin && (
            <button
              type="button"
              className="cuti__btn cuti__btn--sm"
              onClick={() => setNasModal({ mode: 'buat', entry: { ...EMPTY_NAS } })}
            >
              <Plus size={14} /> <span>Tambah Hari Libur</span>
            </button>
          )}
        </div>
        <KalenderList
          items={data.cutiNasionalList}
          isAdmin={isAdmin}
          kind="nas"
          onEdit={(x) =>
            setNasModal({
              mode: 'ubah',
              entry: { id: x.id, tglMulai: x.tglMulai, tglSelesai: x.tglSelesai, keterangan: x.keterangan },
            })
          }
          onDelete={(x) =>
            window.confirm(`Hapus cuti nasional "${x.keterangan}"?`) &&
            act(() => api.hapusCutiNasional(x.id), 'Cuti nasional dihapus.')
          }
        />
      </div>

      {/* Riwayat Cuti Lama */}
      {(data.riwayat?.length ?? 0) > 0 && (
        <div className="cuti__card">
          <div className="cuti__card-head">
            <span>Riwayat Cuti (Data Arsip SDM)</span>
          </div>
          <div className="cuti__table-wrap">
            <table className="cuti__table">
              <thead>
                <tr>
                  <th className="cuti__col-kode">Kode</th>
                  <th className="cuti__col-tgl">Tanggal Pengajuan</th>
                  <th className="cuti__col-ket">Keterangan</th>
                  <th className="cuti__col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.riwayat.map((r, i) => (
                  <tr key={i} className="cuti__row">
                    <td className="cuti__col-kode" data-label="Kode">
                      <span className="cuti__kode-badge">{r.kode || '-'}</span>
                    </td>
                    <td className="cuti__col-tgl" data-label="Tanggal Pengajuan">
                      <span className="cuti__date-text">{formatTgl(r.tanggal)}</span>
                    </td>
                    <td className="cuti__col-ket" data-label="Keterangan">
                      <span className="cuti__ket-text">{r.keterangan || '-'}</span>
                    </td>
                    <td className="cuti__col-status" data-label="Status">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detail Pengajuan Cuti (Muncul Saat Baris Diklik) */}
      {detailPengajuan && (
        <div className="cuti__overlay" onClick={() => setDetailPengajuan(null)}>
          <div className="cuti__modal cuti__modal--detail" onClick={(e) => e.stopPropagation()}>
            <div className="cuti__modal-head">
              <div className="cuti__modal-head-title">
                <CalendarDays size={18} />
                <h3>Detail Pengajuan Cuti</h3>
              </div>
              <button
                type="button"
                className="cuti__x"
                onClick={() => setDetailPengajuan(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="cuti__detail-body">
              <div className="cuti__detail-top">
                <span className="cuti__detail-days">{detailPengajuan.jumlahHari} Hari Kerja</span>
                <StatusBadge status={detailPengajuan.status} />
              </div>

              <div className="cuti__detail-grid">
                <div className="cuti__detail-item">
                  <span className="cuti__detail-label">Tanggal Mulai</span>
                  <span className="cuti__detail-val">{formatTgl(detailPengajuan.tglMulai)}</span>
                </div>

                <div className="cuti__detail-item">
                  <span className="cuti__detail-label">Tanggal Selesai</span>
                  <span className="cuti__detail-val">{formatTgl(detailPengajuan.tglSelesai)}</span>
                </div>

                <div className="cuti__detail-item cuti__detail-item--full">
                  <span className="cuti__detail-label">Keterangan / Alasan Cuti</span>
                  <div className="cuti__detail-box">
                    {detailPengajuan.keterangan ? (
                      <p className="cuti__detail-desc">{detailPengajuan.keterangan}</p>
                    ) : (
                      <span className="cuti__dash">Tidak ada keterangan tambahan.</span>
                    )}
                  </div>
                </div>

                {detailPengajuan.komentar && (
                  <div className="cuti__detail-item cuti__detail-item--full cuti__detail-item--comment">
                    <span className="cuti__detail-label">Catatan Dari Atasan</span>
                    <div className="cuti__detail-box">
                      <p className="cuti__detail-desc">{detailPengajuan.komentar}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="cuti__modal-foot">
              {detailPengajuan.status === 'Menunggu' && (
                <button
                  type="button"
                  className="cuti__btn cuti__btn--danger-outline"
                  onClick={() => {
                    const id = detailPengajuan.id
                    setDetailPengajuan(null)
                    act(() => api.batalCuti(id), 'Pengajuan cuti dibatalkan.')
                  }}
                >
                  <X size={14} /> Batalkan Pengajuan
                </button>
              )}
              <button
                type="button"
                className="cuti__btn cuti__btn--ghost"
                onClick={() => setDetailPengajuan(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cuti Bersama */}
      {cbModal && (
        <KalenderForm
          title={cbModal.mode === 'buat' ? 'Tambah Cuti Bersama' : 'Ubah Cuti Bersama'}
          entry={cbModal.entry}
          withFlag
          onClose={() => setCbModal(null)}
          onSubmit={async (payload) => {
            try {
              if (cbModal.mode === 'buat') await api.buatCutiBersama(payload)
              else await api.ubahCutiBersama(cbModal.entry.id, payload)
              setCbModal(null)
              flash('ok', 'Cuti bersama disimpan, saldo semua karyawan dihitung ulang.')
              await load()
            } catch (err) {
              flash('err', err instanceof ApiError ? err.message : 'Gagal menyimpan.')
            }
          }}
        />
      )}

      {/* Modal Cuti Nasional */}
      {nasModal && (
        <KalenderForm
          title={nasModal.mode === 'buat' ? 'Tambah Cuti Nasional' : 'Ubah Cuti Nasional'}
          entry={nasModal.entry}
          onClose={() => setNasModal(null)}
          onSubmit={async (payload) => {
            try {
              if (nasModal.mode === 'buat') await api.buatCutiNasional(payload)
              else await api.ubahCutiNasional(nasModal.entry.id, payload)
              setNasModal(null)
              flash('ok', 'Cuti nasional disimpan.')
              await load()
            } catch (err) {
              flash('err', err instanceof ApiError ? err.message : 'Gagal menyimpan.')
            }
          }}
        />
      )}
    </div>
  )
}

// Daftar bisa panjang (bertahun-tahun cuti bersama/hari libur menumpuk) - dikelompokkan
// per tahun & bisa dilipat supaya tidak perlu scroll panjang (diminta user 2026-09-03).
// Tahun berjalan (dan tahun² mendatang) terbuka secara default; tahun lampau terlipat.
function KalenderList({ items, isAdmin, kind, onEdit, onDelete }) {
  const list = items || []
  const currentYear = new Date().getFullYear()

  const groups = useMemo(() => {
    const byYear = new Map()
    for (const x of list) {
      const y = new Date(x.tglMulai).getFullYear()
      const key = Number.isNaN(y) ? 0 : y
      if (!byYear.has(key)) byYear.set(key, [])
      byYear.get(key).push(x)
    }
    return [...byYear.entries()].sort(([a], [b]) => b - a)
  }, [list])

  const [openYears, setOpenYears] = useState(() => new Set([currentYear]))
  function toggleYear(y) {
    setOpenYears((prev) => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y)
      else next.add(y)
      return next
    })
  }

  if (list.length === 0) return <div className="cuti__empty cuti__empty--pad">Belum ada data cuti bersama/libur.</div>

  return (
    <div className="cuti__kal">
      {groups.map(([year, rows]) => {
        const open = openYears.has(year) || year >= currentYear
        return (
          <div className="cuti__kal-yeargroup" key={year}>
            <button type="button" className="cuti__kal-yearhead" onClick={() => toggleYear(year)}>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="cuti__kal-yearlabel">{year || 'Lainnya'}</span>
              <span className="cuti__kal-yearcount">{rows.length} hari</span>
            </button>
            {open && rows.map((x) => (
              <div className="cuti__kal-row" key={x.id}>
                <div className="cuti__kal-date">
                  {formatTgl(x.tglMulai)}
                  {x.tglSelesai !== x.tglMulai ? ` – ${formatTgl(x.tglSelesai)}` : ''}
                </div>
                <div className="cuti__kal-main">
                  <span className="cuti__kal-ket">{x.keterangan}</span>
                  <span className="cuti__kal-days">{x.jumlahHari} hari</span>
                  {kind === 'cb' &&
                    (x.mengurangiHak ? (
                      <span className="cuti__tag cuti__tag--red">mengurangi hak</span>
                    ) : (
                      <span className="cuti__tag cuti__tag--grey">tidak mengurangi</span>
                    ))}
                </div>
                {isAdmin && (
                  <div className="cuti__kal-act">
                    <button
                      type="button"
                      className="cuti__ibtn"
                      title="Ubah"
                      onClick={() => onEdit(x)}
                      aria-label="Ubah"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="cuti__ibtn cuti__ibtn--danger"
                      title="Hapus"
                      onClick={() => onDelete(x)}
                      aria-label="Hapus"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function KalenderForm({ title, entry, withFlag, onClose, onSubmit }) {
  const [f, setF] = useState({
    tglMulai: entry.tglMulai || '',
    tglSelesai: entry.tglSelesai || '',
    keterangan: entry.keterangan || '',
    mengurangiHak: entry.mengurangiHak ?? true,
  })
  const [busy, setBusy] = useState(false)
  const hari = hariKerja(f.tglMulai, f.tglSelesai)

  const submit = async (e) => {
    e.preventDefault()
    if (!f.tglMulai || !f.tglSelesai) return
    if (!f.keterangan.trim()) return
    setBusy(true)
    const payload = { tglMulai: f.tglMulai, tglSelesai: f.tglSelesai, keterangan: f.keterangan.trim() }
    if (withFlag) payload.mengurangiHak = f.mengurangiHak
    await onSubmit(payload)
    setBusy(false)
  }

  return (
    <div className="cuti__overlay" onClick={onClose}>
      <form className="cuti__modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="cuti__modal-head">
          <h3>{title}</h3>
          <button type="button" className="cuti__x" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="cuti__modal-body">
          <div className="cuti__form">
            <label className="cuti__form-field">
              <span>Tanggal Mulai</span>
              <input
                type="date"
                value={f.tglMulai}
                onChange={(e) => setF({ ...f, tglMulai: e.target.value })}
                required
              />
            </label>
            <label className="cuti__form-field">
              <span>Tanggal Selesai</span>
              <input
                type="date"
                value={f.tglSelesai}
                min={f.tglMulai || undefined}
                onChange={(e) => setF({ ...f, tglSelesai: e.target.value })}
                required
              />
            </label>
            <label className="cuti__form-field cuti__form-full">
              <span>Keterangan</span>
              <input
                value={f.keterangan}
                onChange={(e) => setF({ ...f, keterangan: e.target.value })}
                placeholder="mis. Cuti Bersama Hari Raya Idul Fitri"
                required
              />
            </label>
          </div>
          {withFlag && (
            <label className="cuti__check">
              <input
                type="checkbox"
                checked={f.mengurangiHak}
                onChange={(e) => setF({ ...f, mengurangiHak: e.target.checked })}
              />
              <span>
                Mengurangi hak cuti semua karyawan ({hari > 0 ? `−${hari} hari` : 'sesuai jumlah hari'})
              </span>
            </label>
          )}
          <div className="cuti__preview cuti__preview--pad">
            Durasi: <b>{hari > 0 ? `${hari} hari kerja` : 'Pilih rentang tanggal'}</b>
          </div>
        </div>
        <div className="cuti__modal-foot">
          <button type="button" className="cuti__btn cuti__btn--ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="cuti__btn cuti__btn--submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="cuti__spin" /> : <CheckCircle2 size={16} />}
            <span>Simpan Data</span>
          </button>
        </div>
      </form>
    </div>
  )
}
