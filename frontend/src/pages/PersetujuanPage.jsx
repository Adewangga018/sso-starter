import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Eye, Loader2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './PersetujuanPage.css'

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

function StatusBadge({ status }) {
  const map = { Menunggu: 'wait', Disetujui: 'ok', Ditolak: 'no', Batal: 'off' }
  return <span className={`apr__st apr__st--${map[status] || 'off'}`}>{status}</span>
}

export default function PersetujuanPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [komentar, setKomentar] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api.getPersetujuan()); setLoading(false) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat persetujuan.'); setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function openDetail(id) {
    setDetailLoading(true); setDetail({ id }); setKomentar('')
    try { setDetail(await api.getPersetujuanDetail(id)) }
    catch (err) { setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat detail.' }); setDetail(null) }
    finally { setDetailLoading(false) }
  }

  async function putusan(id, setuju, fromModal) {
    setBusy(true); setMsg(null)
    try {
      await api.putusanPersetujuan(id, { setuju, komentar: fromModal ? (komentar.trim() || null) : null })
      setMsg({ type: 'ok', text: setuju ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.' })
      if (fromModal) setDetail(null)
      await load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Aksi gagal.' })
    } finally { setBusy(false) }
  }

  if (loading) return <div className="apr"><div className="apr__loading"><Loader2 className="apr__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="apr"><div className="apr__alert">{error}</div></div>
  if (!data) return null

  const menunggu = data.menunggu ?? []
  const riwayat = data.riwayat ?? []

  return (
    <div className="apr">
      <div className="apr__intro">
        <h2 className="apr__title">Kotak Persetujuan</h2>
        <p className="apr__sub">Pengajuan tim (Izin, Lembur, SPPD, UMDL, Tiket). <b>Manager</b> berhak menyetujui/menolak; <b>atasan langsung</b> dapat meninjau & melihat detail.</p>
      </div>

      {msg && <div className={`apr__msg apr__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="apr__card">
        <div className="apr__card-head"><ClipboardCheck size={16} /> Menunggu <span className="apr__count">{menunggu.length}</span></div>
        {menunggu.length === 0 ? (
          <div className="apr__empty">Tidak ada pengajuan yang perlu Anda tinjau/setujui.</div>
        ) : (
          <div className="apr__list">
            {menunggu.map((p) => (
              <div className="apr__item" key={p.id}>
                <div className="apr__item-main">
                  <div className="apr__item-top">
                    <span className="apr__jenis">{p.jenis}</span>
                    <span className="apr__pemohon">{p.nama || p.idKaryawan}</span>
                    <span className={`apr__peran${p.bisaAksi ? ' apr__peran--mgr' : ''}`}>{p.peranSaya}</span>
                  </div>
                  <div className="apr__ringkasan">{p.ringkasan || '-'}</div>
                  <div className="apr__tgl">Diajukan {formatTgl(p.tglPengajuan)}</div>
                </div>
                <div className="apr__actions">
                  <button type="button" className="apr__btn apr__btn--ghost" onClick={() => openDetail(p.id)}><Eye size={15} /> Detail</button>
                  {p.bisaAksi && (
                    <>
                      <button type="button" className="apr__btn apr__btn--ghost" onClick={() => putusan(p.id, false, false)} disabled={busy}>Tolak</button>
                      <button type="button" className="apr__btn" onClick={() => putusan(p.id, true, false)} disabled={busy}><CheckCircle2 size={15} /> Setujui</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {riwayat.length > 0 && (
        <div className="apr__card">
          <div className="apr__card-head">Riwayat</div>
          <div className="apr__table-wrap">
            <table className="apr__table">
              <thead><tr><th>Jenis</th><th>Pemohon</th><th>Peran</th><th>Status</th><th>Tanggal</th><th></th></tr></thead>
              <tbody>
                {riwayat.map((p) => (
                  <tr key={p.id}>
                    <td>{p.jenis}</td>
                    <td>{p.nama || p.idKaryawan}</td>
                    <td>{p.peranSaya}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{formatTgl(p.tglKeputusan)}</td>
                    <td><button type="button" className="apr__icon-btn" onClick={() => openDetail(p.id)} title="Detail"><Eye size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal detail / tinjauan */}
      {detail && (
        <div className="apr__overlay" onClick={() => setDetail(null)}>
          <div className="apr__modal" onClick={(e) => e.stopPropagation()}>
            <div className="apr__modal-head">
              <h3>Detail Pengajuan {detail.jenis || ''}</h3>
              <button type="button" className="apr__modal-x" onClick={() => setDetail(null)} aria-label="Tutup"><X size={18} /></button>
            </div>
            {detailLoading ? (
              <div className="apr__loading"><Loader2 className="apr__spin" size={20} /> Memuat…</div>
            ) : (
              <div className="apr__modal-body">
                <div className="apr__dgrid">
                  <div><span>Pemohon</span><b>{detail.nama || detail.idKaryawan}</b></div>
                  <div><span>Peran Anda</span><b>{detail.peranSaya}</b></div>
                  {detail.jenis === 'Izin' ? (
                    <>
                      <div><span>Jenis Izin</span><b>{detail.izinJenis || '-'}</b></div>
                      <div><span>Kepentingan</span><b>{detail.izinKepentingan || '-'}</b></div>
                      <div><span>Mulai</span><b>{formatTgl(detail.izinMulai)}</b></div>
                      <div><span>Selesai</span><b>{formatTgl(detail.izinSelesai)}</b></div>
                      <div><span>Kode</span><b>{detail.izinKode || '-'}</b></div>
                      <div><span>Status SDM</span><b>{detail.izinStatusSdm || '-'}</b></div>
                      <div className="apr__dfull"><span>Keterangan</span><b>{detail.izinKeterangan || '-'}</b></div>
                    </>
                  ) : (
                    <div className="apr__dfull"><span>Ringkasan</span><b>{detail.ringkasan || '-'}</b></div>
                  )}
                </div>

                {detail.bisaAksi && detail.status === 'Menunggu' ? (
                  <div className="apr__modal-foot">
                    <textarea className="apr__note" rows={2} placeholder="Komentar (opsional)…" value={komentar} onChange={(e) => setKomentar(e.target.value)} />
                    <div className="apr__modal-actions">
                      <button type="button" className="apr__btn apr__btn--ghost" onClick={() => putusan(detail.id, false, true)} disabled={busy}>Tolak</button>
                      <button type="button" className="apr__btn" onClick={() => putusan(detail.id, true, true)} disabled={busy}>{busy ? <Loader2 size={15} className="apr__spin" /> : <CheckCircle2 size={15} />} Setujui</button>
                    </div>
                  </div>
                ) : (
                  <div className="apr__hint">
                    {detail.status !== 'Menunggu' ? `Sudah diproses: ${detail.status}.` : 'Tinjauan saja — persetujuan dilakukan oleh manager terkait.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
