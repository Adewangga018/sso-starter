import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Loader2,
  X,
  Clock,
  AlertCircle,
  CalendarDays,
  FileSignature,
  Clock3,
  Plane,
  Wallet,
  FileText,
  RotateCw,
  Search,
  Briefcase,
  Check,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './PersetujuanPage.css'

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

function StatusBadge({ status }) {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'menunggu' || s === 'pending') {
    return (
      <span className="apr__badge apr__badge--pending">
        <Clock size={11} />
        <span>{status}</span>
      </span>
    )
  }
  if (s === 'disetujui' || s === 'approved') {
    return (
      <span className="apr__badge apr__badge--success">
        <CheckCircle2 size={11} />
        <span>{status}</span>
      </span>
    )
  }
  if (s === 'ditolak' || s === 'rejected') {
    return (
      <span className="apr__badge apr__badge--danger">
        <AlertCircle size={11} />
        <span>{status}</span>
      </span>
    )
  }
  return (
    <span className="apr__badge apr__badge--neutral">
      <span>{status || '-'}</span>
    </span>
  )
}

function JenisBadge({ jenis }) {
  const j = (jenis ?? '').toLowerCase()
  let badgeClass = 'apr__badge--neutral'
  let IconComponent = FileText

  if (j.includes('cuti')) {
    badgeClass = 'apr__badge--cuti'
    IconComponent = CalendarDays
  } else if (j.includes('izin') || j.includes('ijin')) {
    badgeClass = 'apr__badge--izin'
    IconComponent = FileSignature
  } else if (j.includes('lembur') || j.includes('spl')) {
    badgeClass = 'apr__badge--lembur'
    IconComponent = Clock3
  } else if (j.includes('sppd')) {
    badgeClass = 'apr__badge--sppd'
    IconComponent = Plane
  } else if (j.includes('tiket')) {
    badgeClass = 'apr__badge--tiket'
    IconComponent = Plane
  } else if (j.includes('umdl')) {
    badgeClass = 'apr__badge--umdl'
    IconComponent = Wallet
  }

  return (
    <span className={`apr__badge ${badgeClass}`}>
      <IconComponent size={11} />
      <span>{jenis || '-'}</span>
    </span>
  )
}

export default function PersetujuanPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [tab, setTab] = useState('menunggu')
  const [search, setSearch] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [komentar, setKomentar] = useState('')
  const [busy, setBusy] = useState(false)
  const [buktiPreview, setBuktiPreview] = useState(null) // { url } | null
  const [buktiLoading, setBuktiLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api.getPersetujuan())
      setLoading(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat persetujuan.')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openDetail(id) {
    setDetailLoading(true)
    setDetail({ id })
    setKomentar('')
    try {
      setDetail(await api.getPersetujuanDetail(id))
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat detail.' })
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  // Foto perlu Bearer token (bukan <img src> biasa) - diambil sbg blob, ditampilkan di modal
  // preview, lalu object URL-nya di-revoke saat modal ditutup.
  async function lihatBukti(fotoUrl) {
    setBuktiLoading(true)
    try {
      const { url } = await api.getBlob(fotoUrl)
      setBuktiPreview({ url })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat foto bukti dinas.' })
    } finally {
      setBuktiLoading(false)
    }
  }

  function closeBuktiPreview() {
    if (buktiPreview?.url) URL.revokeObjectURL(buktiPreview.url)
    setBuktiPreview(null)
  }

  async function putusan(id, setuju, fromModal) {
    setBusy(true)
    setMsg(null)
    try {
      await api.putusanPersetujuan(id, {
        setuju,
        komentar: fromModal ? komentar.trim() || null : null,
      })
      setMsg({ type: 'ok', text: setuju ? 'Pengajuan berhasil disetujui.' : 'Pengajuan telah ditolak.' })
      if (fromModal) setDetail(null)
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    } finally {
      setBusy(false)
    }
  }

  const menunggu = useMemo(() => data?.menunggu ?? [], [data])
  const riwayat = useMemo(() => data?.riwayat ?? [], [data])

  // Ringkasan metrik statistik
  const stats = useMemo(() => {
    const totalMenunggu = menunggu.length
    const perluAksi = menunggu.filter((p) => p.bisaAksi).length
    const totalRiwayat = riwayat.length
    const disetujui = riwayat.filter((r) => (r.status ?? '').toLowerCase().includes('setuju')).length

    return {
      totalMenunggu,
      perluAksi,
      totalRiwayat,
      disetujui,
    }
  }, [menunggu, riwayat])

  // Filtered lists
  const filteredMenunggu = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return menunggu
    return menunggu.filter((p) =>
      [p.jenis, p.nama, p.idKaryawan, p.jabatanPemohon, p.ringkasan, formatTgl(p.tglPengajuan)]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))
    )
  }, [menunggu, search])

  const filteredRiwayat = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return riwayat
    return riwayat.filter((p) =>
      [p.jenis, p.nama, p.idKaryawan, p.jabatanPemohon, p.status, p.ringkasan, formatTgl(p.tglKeputusan)]
        .some((v) => (v ?? '').toString().toLowerCase().includes(term))
    )
  }, [riwayat, search])

  if (loading) {
    return (
      <div className="apr">
        <div className="apr__card apr__state-card">
          <Loader2 className="apr__spin" size={32} />
          <h4 className="apr__state-title">Memuat Kotak Persetujuan</h4>
          <p className="apr__state-desc">Sedang mengambil daftar pengajuan tim Anda...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="apr">
        <div className="apr__card apr__state-card">
          <AlertCircle size={36} className="apr__state-icon apr__state-icon--err" />
          <h4 className="apr__state-title">Gagal Memuat Persetujuan</h4>
          <p className="apr__state-desc">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="apr">
      {/* Header Halaman */}
      <div className="apr__page-header">
        <div className="apr__page-header-info">
          <div className="apr__page-header-icon">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h2 className="apr__title">Kotak Persetujuan</h2>
            <p className="apr__sub">
              Daftar pengajuan tim (Cuti, Izin, Lembur, SPPD, UMDL, Tiket). Manager berhak memberi putusan; atasan langsung dapat meninjau detail.
            </p>
          </div>
        </div>
      </div>

      {msg && <div className={`apr__msg apr__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* Ringkasan Metrik Statistik */}
      <div className="apr__stats-grid">
        <div className="apr__stat-card">
          <div className="apr__stat-icon apr__stat-icon--pending">
            <Clock size={18} />
          </div>
          <div className="apr__stat-body">
            <span className="apr__stat-label">Menunggu Persetujuan</span>
            <span className="apr__stat-val apr__stat-val--pending">{stats.totalMenunggu}</span>
          </div>
        </div>

        <div className="apr__stat-card">
          <div className="apr__stat-icon apr__stat-icon--action">
            <ClipboardCheck size={18} />
          </div>
          <div className="apr__stat-body">
            <span className="apr__stat-label">Perlu Aksi Anda</span>
            <span className="apr__stat-val apr__stat-val--action">{stats.perluAksi}</span>
          </div>
        </div>

        <div className="apr__stat-card">
          <div className="apr__stat-icon apr__stat-icon--history">
            <CheckCircle2 size={18} />
          </div>
          <div className="apr__stat-body">
            <span className="apr__stat-label">Disetujui</span>
            <span className="apr__stat-val apr__stat-val--approved">{stats.disetujui}</span>
          </div>
        </div>

        <div className="apr__stat-card">
          <div className="apr__stat-icon apr__stat-icon--total">
            <FileText size={18} />
          </div>
          <div className="apr__stat-body">
            <span className="apr__stat-label">Total Riwayat</span>
            <span className="apr__stat-val">{stats.totalRiwayat}</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="apr__card">
        {/* Tab Selector & Actions */}
        <div className="apr__nav-bar">
          <div className="apr__tabs">
            <button
              type="button"
              className={`apr__tab ${tab === 'menunggu' ? 'apr__tab--active' : ''}`}
              onClick={() => {
                setTab('menunggu')
                setSearch('')
              }}
            >
              <span>Menunggu Persetujuan</span>
              <span className="apr__tab-count">{menunggu.length}</span>
            </button>

            <button
              type="button"
              className={`apr__tab ${tab === 'riwayat' ? 'apr__tab--active' : ''}`}
              onClick={() => {
                setTab('riwayat')
                setSearch('')
              }}
            >
              <span>Riwayat Keputusan</span>
              <span className="apr__tab-count">{riwayat.length}</span>
            </button>
          </div>

          <div className="apr__nav-actions">
            <button
              type="button"
              className="apr__icon-btn"
              onClick={load}
              title="Muat ulang data"
              aria-label="Muat ulang data"
            >
              <RotateCw size={15} />
            </button>
          </div>
        </div>

        {/* Toolbar Pencarian */}
        <div className="apr__toolbar">
          <div className="apr__search-box">
            <Search size={15} className="apr__search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pemohon, jabatan, jenis, ringkasan..."
            />
            {search && (
              <button
                type="button"
                className="apr__search-clear"
                onClick={() => setSearch('')}
                aria-label="Bersihkan pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Menunggu Persetujuan */}
        {tab === 'menunggu' && (
          <div>
            {filteredMenunggu.length === 0 ? (
              <div className="apr__empty-state">
                <CheckCircle2 size={36} className="apr__empty-icon" />
                <span className="apr__empty-title">Semua Beres!</span>
                <span className="apr__empty-sub">
                  {search
                    ? `Tidak ada pengajuan yang sesuai dengan pencarian "${search}".`
                    : 'Tidak ada pengajuan permohonan tim yang perlu Anda tinjau atau setujui saat ini.'}
                </span>
              </div>
            ) : (
              <div className="apr__list">
                {filteredMenunggu.map((p) => (
                  <div className="apr__item" key={p.id}>
                    <div className="apr__item-main">
                      <div className="apr__item-top">
                        <JenisBadge jenis={p.jenis} />
                        <span className="apr__pemohon">{p.nama || p.idKaryawan}</span>
                        {p.jabatanPemohon && (
                          <span className="apr__peran">
                            <Briefcase size={10} /> {p.jabatanPemohon}
                          </span>
                        )}
                      </div>
                      <div className="apr__ringkasan">{p.ringkasan || '-'}</div>
                      <div className="apr__tgl">
                        <Clock size={11} /> Diajukan {formatTgl(p.tglPengajuan)}
                      </div>
                    </div>
                    <div className="apr__actions">
                      <button
                        type="button"
                        className="apr__btn apr__btn--detail"
                        onClick={() => openDetail(p.id)}
                      >
                        <Eye size={14} /> <span>Detail</span>
                      </button>
                      {p.bisaAksi && (
                        <>
                          <button
                            type="button"
                            className="apr__btn apr__btn--reject"
                            onClick={() => putusan(p.id, false, false)}
                            disabled={busy}
                          >
                            <X size={14} /> <span>Tolak</span>
                          </button>
                          <button
                            type="button"
                            className="apr__btn apr__btn--approve"
                            onClick={() => putusan(p.id, true, false)}
                            disabled={busy}
                          >
                            <Check size={14} /> <span>Setujui</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Tabel Riwayat Keputusan (Padat, Tanpa Scroll Berlebih, Baris Bisa Diklik) */}
        {tab === 'riwayat' && (
          <div className="apr__table-wrap">
            <table className="apr__table">
              <thead>
                <tr>
                  <th className="apr__col-jenis">Jenis</th>
                  <th className="apr__col-pemohon">Pemohon & Jabatan</th>
                  <th className="apr__col-ringkasan">Ringkasan</th>
                  <th className="apr__col-status">Status</th>
                  <th className="apr__col-tgl">Tanggal Keputusan</th>
                  <th className="apr__col-aksi">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRiwayat.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="apr__no-data">
                      <div className="apr__empty-state">
                        <FileText size={32} className="apr__empty-icon" />
                        <span className="apr__empty-title">Tidak ada riwayat</span>
                        <span className="apr__empty-sub">
                          {search
                            ? `Tidak ditemukan riwayat yang sesuai dengan "${search}".`
                            : 'Belum ada riwayat persetujuan yang tercatat.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRiwayat.map((p) => (
                    <tr
                      key={p.id}
                      className="apr__row apr__row--clickable"
                      onClick={() => openDetail(p.id)}
                      title="Klik untuk melihat detail pengajuan"
                    >
                      <td className="apr__col-jenis" data-label="Jenis">
                        <JenisBadge jenis={p.jenis} />
                      </td>
                      <td className="apr__col-pemohon" data-label="Pemohon">
                        <div className="apr__user-cell">
                          <span className="apr__user-name">{p.nama || p.idKaryawan}</span>
                          {p.jabatanPemohon && (
                            <span className="apr__user-jabatan">{p.jabatanPemohon}</span>
                          )}
                        </div>
                      </td>
                      <td className="apr__col-ringkasan" data-label="Ringkasan">
                        <span className="apr__ringkasan-text" title={p.ringkasan}>
                          {p.ringkasan || '-'}
                        </span>
                      </td>
                      <td className="apr__col-status" data-label="Status">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="apr__col-tgl" data-label="Tanggal">
                        <span className="apr__date-text">{formatTgl(p.tglKeputusan)}</span>
                      </td>
                      <td
                        className="apr__col-aksi"
                        data-label="Aksi"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="apr__icon-btn apr__icon-btn--view"
                          onClick={() => openDetail(p.id)}
                          title="Lihat Detail"
                          aria-label="Lihat Detail"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail / Tinjauan Pengajuan */}
      {detail && (
        <div className="apr__overlay" onClick={() => setDetail(null)}>
          <div className="apr__modal" onClick={(e) => e.stopPropagation()}>
            <div className="apr__modal-head">
              <div className="apr__modal-head-title">
                <ClipboardCheck size={18} />
                <h3>Detail Pengajuan {detail.jenis || ''}</h3>
              </div>
              <button
                type="button"
                className="apr__modal-x"
                onClick={() => setDetail(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="apr__state-card" style={{ padding: '36px 20px' }}>
                <Loader2 className="apr__spin" size={24} />
                <span style={{ fontSize: '13px', color: 'var(--gcs-text-muted)', marginTop: '8px' }}>
                  Memuat data rincian...
                </span>
              </div>
            ) : (
              <div className="apr__modal-body">
                <div className="apr__detail-top">
                  <div className="apr__detail-ident">
                    <JenisBadge jenis={detail.jenis} />
                    <span className="apr__pemohon-title">{detail.nama || detail.idKaryawan}</span>
                  </div>
                  <StatusBadge status={detail.status} />
                </div>

                <div className="apr__dgrid">
                  <div className="apr__ditem">
                    <span>Pemohon</span>
                    <b>{detail.nama || detail.idKaryawan}</b>
                  </div>
                  <div className="apr__ditem">
                    <span>Jabatan</span>
                    <b>{detail.jabatanPemohon || '-'}</b>
                  </div>

                  {detail.jenis === 'Izin' ? (
                    <>
                      <div className="apr__ditem">
                        <span>Jenis Izin</span>
                        <b>{detail.izinJenis || '-'}</b>
                      </div>
                      <div className="apr__ditem">
                        <span>Kepentingan</span>
                        <b>{detail.izinKepentingan || '-'}</b>
                      </div>
                      <div className="apr__ditem">
                        <span>Waktu Mulai</span>
                        <b>{formatTgl(detail.izinMulai)}</b>
                      </div>
                      <div className="apr__ditem">
                        <span>Waktu Selesai</span>
                        <b>{formatTgl(detail.izinSelesai)}</b>
                      </div>
                      <div className="apr__ditem">
                        <span>Kode Izin</span>
                        <b style={{ fontFamily: 'monospace' }}>{detail.izinKode || '-'}</b>
                      </div>
                      <div className="apr__ditem">
                        <span>Status SDM</span>
                        <b>{detail.izinStatusSdm || '-'}</b>
                      </div>
                      <div className="apr__ditem apr__dfull">
                        <span>Keterangan Alasan</span>
                        <div className="apr__detail-box">{detail.izinKeterangan || '-'}</div>
                      </div>
                    </>
                  ) : (
                    <div className="apr__ditem apr__dfull">
                      <span>Ringkasan / Keterangan</span>
                      <div className="apr__detail-box">{detail.ringkasan || '-'}</div>
                    </div>
                  )}

                  {(detail.jenis === 'UMDL' || detail.jenis === 'SPPD') && detail.rentangKm && (
                    <div className="apr__ditem">
                      <span>Rentang Jarak</span>
                      <b>{detail.rentangKm} km (PP)</b>
                    </div>
                  )}
                </div>

                {(detail.jenis === 'UMDL' || detail.jenis === 'SPPD') && detail.fotoUrl && (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      className="apr__btn apr__btn--photo"
                      onClick={() => lihatBukti(detail.fotoUrl)}
                      disabled={buktiLoading}
                    >
                      {buktiLoading ? <Loader2 size={14} className="apr__spin" /> : <Camera size={14} />}
                      <span>Lihat Foto Bukti Dinas</span>
                    </button>
                  </div>
                )}

                {detail.bisaAksi && detail.status === 'Menunggu' ? (
                  <div className="apr__modal-foot">
                    <span className="apr__foot-label">Beri Catatan / Komentar (opsional):</span>
                    <textarea
                      className="apr__note"
                      rows={2}
                      placeholder="Tuliskan catatan persetujuan atau alasan penolakan..."
                      value={komentar}
                      onChange={(e) => setKomentar(e.target.value)}
                    />
                    <div className="apr__modal-actions">
                      <button
                        type="button"
                        className="apr__btn apr__btn--reject"
                        onClick={() => putusan(detail.id, false, true)}
                        disabled={busy}
                      >
                        <X size={14} /> <span>Tolak Pengajuan</span>
                      </button>
                      <button
                        type="button"
                        className="apr__btn apr__btn--approve"
                        onClick={() => putusan(detail.id, true, true)}
                        disabled={busy}
                      >
                        {busy ? <Loader2 size={14} className="apr__spin" /> : <Check size={14} />}
                        <span>Setujui Pengajuan</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="apr__hint">
                    {detail.status !== 'Menunggu'
                      ? `Pengajuan ini telah selesai diproses dengan status: ${detail.status}.`
                      : 'Mode tinjauan — wewenang persetujuan akhir dilakukan oleh manager/pejabat terkait.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Preview Bukti Foto Dinas */}
      {buktiPreview && (
        <div className="apr__overlay" onClick={closeBuktiPreview}>
          <div className="apr__modal apr__modal--photo" onClick={(e) => e.stopPropagation()}>
            <div className="apr__modal-head">
              <div className="apr__modal-head-title">
                <Camera size={18} />
                <h3>Foto Bukti Dinas</h3>
              </div>
              <button
                type="button"
                className="apr__modal-x"
                onClick={closeBuktiPreview}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <div className="apr__modal-body" style={{ textAlign: 'center', padding: '16px' }}>
              <img
                src={buktiPreview.url}
                alt="Foto bukti dinas"
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
