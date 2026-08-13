import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  ArrowLeft, Loader2, Pencil, UserPlus, UserMinus, Plus, Trash2, Printer, User, Building2, FileText, Upload,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import {
  rupiah, tgl, KondisiBadge, PicBadge, AktivitasStatusBadge, DokumenStatusBadge,
  KondisiFormModal, PicFormModal, AktivitasUmumFormModal, NomorInternalFormModal, DokumenFormModal,
  encodeAsetId, decodeAsetId,
} from './asetShared'
import './AsetPage.css'

export default function AsetDetail() {
  // URL-nya menyamarkan kode aset (lihat asetShared.encodeAsetId) - decode dulu sebelum
  // dipakai ke API/QR/link lain, yang lalu di-encode ulang saat membangun URL baru.
  const { objectId: encodedObjectId } = useParams()
  const objectId = decodeAsetId(encodedObjectId)
  const [aset, setAset] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)
  const [qr, setQr] = useState('')
  const [modal, setModal] = useState(null) // 'kondisi' | 'pic' | {mode:'aktivitas-buat'|'aktivitas-ubah', row?}
  const [sesiAktif, setSesiAktif] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, o] = await Promise.all([api.getAsetDetail(objectId), api.getAsetOverlay(objectId)])
      setAset(a); setOverlay(o); setError('')
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Gagal memuat aset.') }
    finally { setLoading(false) }
  }, [objectId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const url = `${window.location.origin}/my-asset/detail/${encodeAsetId(objectId)}`
    QRCode.toDataURL(url, { margin: 1, width: 260 }).then(setQr).catch(() => setQr(''))
  }, [objectId])

  const isAdmin = overlay?.isAdminAset ?? false

  // Untuk tombol jalan pintas "Catat di Opname" - sesi yang masih berjalan saja.
  useEffect(() => {
    if (!isAdmin) return
    api.getAsetOpnameSesiList().then((rows) => setSesiAktif(rows.filter((s) => s.status === 'Berjalan'))).catch(() => setSesiAktif([]))
  }, [isAdmin])

  async function simpanKondisi(payload) { await api.setAsetKondisi(objectId, payload); setModal(null); setMsg({ t: 'ok', m: 'Kondisi dicatat.' }); await load() }
  async function simpanNomor(payload) { await api.setAsetNomorInternal(objectId, payload); setModal(null); setMsg({ t: 'ok', m: 'Nomor aset internal disimpan.' }); await load() }
  async function assignPic(payload) { await api.assignAsetPic(objectId, payload); setModal(null); setMsg({ t: 'ok', m: 'PIC ditetapkan.' }); await load() }
  async function kembalikanPic(id) {
    if (!window.confirm('Tandai PIC ini sudah mengembalikan aset?')) return
    try { await api.kembalikanAsetPic(id); setMsg({ t: 'ok', m: 'PIC ditandai sudah mengembalikan aset.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }
  async function simpanAktivitas(payload) {
    if (modal.mode === 'aktivitas-ubah') await api.ubahAsetAktivitas(modal.row.id, payload)
    else await api.buatAsetAktivitas(objectId, payload)
    setModal(null); setMsg({ t: 'ok', m: 'Aktivitas disimpan.' }); await load()
  }
  async function hapusAktivitas(row) {
    if (!window.confirm(`Hapus aktivitas "${row.jenis}"?`)) return
    try { await api.hapusAsetAktivitas(row.id); setMsg({ t: 'ok', m: 'Aktivitas dihapus.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }
  async function simpanDokumen(fields, file) {
    await api.uploadAsetDokumen(objectId, fields, file)
    setModal(null); setMsg({ t: 'ok', m: 'Dokumen disimpan.' })
    window.dispatchEvent(new Event('aset-dokumen-changed'))
    await load()
  }
  async function hapusDokumen(row) {
    if (!window.confirm(`Hapus dokumen "${row.jenisDokumen}"?`)) return
    try {
      await api.hapusAsetDokumen(row.id)
      setMsg({ t: 'ok', m: 'Dokumen dihapus.' })
      window.dispatchEvent(new Event('aset-dokumen-changed'))
      await load()
    } catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal menghapus.' }) }
  }
  // <a href> polos tidak bisa dipakai (endpoint file butuh header Authorization Bearer) -
  // fetch sebagai blob dulu baru dibuka di tab baru.
  async function previewDokumen(row) {
    try {
      const { url } = await api.getAsetDokumenFile(row.id)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal membuka berkas.' }) }
  }

  if (loading) return <div className="aset"><div className="aset__loading"><Loader2 className="aset__spin" size={22} /> Memuat…</div></div>
  if (error) return <div className="aset"><div className="aset__alert">{error}</div></div>
  if (!aset) return null

  return (
    <div className="aset">
      <Link to="/my-asset" className="aset__back"><ArrowLeft size={15} /> Kembali ke Inventaris</Link>

      <div className="aset__head">
        <div>
          <h2 className="aset__title">{aset.nama || aset.objectId}</h2>
          <p className="aset__sub">
            {aset.objectId}{aset.nomorAset ? ` · No. Internal: ${aset.nomorAset}` : ''} · {aset.kategori || '—'} · {aset.kelompok || '—'}
          </p>
        </div>
        {sesiAktif.length === 1 && (
          <Link className="aset__btn aset__btn--ghost" to={`/my-asset/opname/${sesiAktif[0].id}?objectId=${encodeURIComponent(encodeAsetId(aset.objectId))}`}>
            Catat di Opname "{sesiAktif[0].namaSesi}"
          </Link>
        )}
        {sesiAktif.length > 1 && (
          <select className="aset__search" defaultValue="" onChange={(e) => { if (e.target.value) window.location.href = `/my-asset/opname/${e.target.value}?objectId=${encodeURIComponent(encodeAsetId(aset.objectId))}` }}>
            <option value="" disabled>Catat di sesi opname…</option>
            {sesiAktif.map((s) => <option key={s.id} value={s.id}>{s.namaSesi}</option>)}
          </select>
        )}
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      <div className="aset__detailgrid">
        <div className="aset__card aset__card--wide">
          <div className="aset__mhead">
            <h3 className="aset__card-title">Info Aset (ERP) & Kondisi</h3>
            {isAdmin && <button type="button" className="aset__ibtn" title="Catat Kondisi" onClick={() => setModal('kondisi')}><Pencil size={14} /></button>}
          </div>
          <div className="aset__dgrid">
            <div><span>Lokasi</span><b>{aset.lokasi || '—'}</b></div>
            <div><span>No. Polisi</span><b>{aset.noPol || '—'}</b></div>
            <div><span>Qty</span><b>{aset.qty != null ? `${aset.qty} ${aset.satuan ?? ''}` : '—'}</b></div>
            <div><span>Status ERP</span><b>{aset.aktif === 'Y' ? 'Aktif' : aset.aktif === 'T' ? 'Tidak Aktif' : (aset.status || '—')}</b></div>
            <div><span>Nilai Perolehan</span><b>{aset.nilaiPerolehan != null ? rupiah(aset.nilaiPerolehan) : '—'}</b></div>
            <div><span>Nilai Buku</span><b>{aset.nilaiBuku != null ? rupiah(aset.nilaiBuku) : '—'}</b></div>
            <div><span>Tgl Perolehan</span><b>{tgl(aset.tglPerolehan)}</b></div>
            <div><span>Masa Manfaat</span><b>{aset.masaManfaatBulan != null ? `${aset.masaManfaatBulan} bulan (${(aset.masaManfaatBulan / 12).toFixed(1)} thn)` : '—'}</b></div>
            <div><span>Kondisi</span><b><KondisiBadge kondisi={overlay?.kondisi?.kondisi ?? 'Baik'} /></b></div>
          </div>
          {overlay?.kondisi?.catatan && <p className="aset__muted" style={{ marginTop: 10 }}>Catatan kondisi: {overlay.kondisi.catatan}</p>}
          {overlay?.kondisi && <p className="aset__muted" style={{ fontSize: '0.74rem' }}>Kondisi dicatat {tgl(overlay.kondisi.tglDibuat)}</p>}
        </div>

        <div className="aset__card">
          <h3 className="aset__card-title">QR Code</h3>
          {qr && <img src={qr} alt={`QR ${aset.objectId}`} style={{ width: 140, height: 140 }} />}
          <button type="button" className="aset__btn" style={{ marginTop: 8 }} onClick={() => window.open(`/cetak/aset-qr?ids=${encodeURIComponent(encodeAsetId(aset.objectId))}`, '_blank')}>
            <Printer size={14} /> Cetak Label
          </button>
        </div>

        <div className="aset__card">
          <div className="aset__mhead">
            <h3 className="aset__card-title">Nomor Aset Internal</h3>
            {isAdmin && <button type="button" className="aset__ibtn" title="Ubah Nomor Aset" onClick={() => setModal('nomor')}><Pencil size={14} /></button>}
          </div>
          {overlay?.nomorInternal ? (
            <>
              <b style={{ fontSize: '1.1rem' }}>{overlay.nomorInternal.nomorAset}</b>
              {overlay.nomorInternal.catatan && <p className="aset__muted" style={{ marginTop: 6 }}>{overlay.nomorInternal.catatan}</p>}
            </>
          ) : <div className="aset__muted">Belum ada nomor aset internal.</div>}

          <div className="aset__card-divider" />

          <div className="aset__mhead">
            <h3 className="aset__card-title">PIC Saat Ini</h3>
            {isAdmin && (
              overlay?.picAktif
                ? <button type="button" className="aset__ibtn" title="Kembalikan / lepas PIC" onClick={() => kembalikanPic(overlay.picAktif.id)}><UserMinus size={14} /></button>
                : <button type="button" className="aset__ibtn" title="Tetapkan PIC" onClick={() => setModal('pic')}><UserPlus size={14} /></button>
            )}
          </div>
          {overlay?.picAktif ? (
            overlay.picAktif.jenisPic === 'Bagian' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={16} /> <b>{overlay.picAktif.namaUnit}</b></div>
                <p className="aset__muted" style={{ fontSize: '0.74rem' }}>Bagian · Sejak {tgl(overlay.picAktif.tglMulai)}</p>
                {isAdmin && <button type="button" className="aset__btn aset__btn--ghost" style={{ marginTop: 8 }} onClick={() => setModal('pic')}>Ganti PIC</button>}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><User size={16} /> <b>{overlay.picAktif.namaPic}</b></div>
                <p className="aset__muted" style={{ fontSize: '0.82rem' }}>{overlay.picAktif.nik} · {overlay.picAktif.departemen || '—'}</p>
                <p className="aset__muted" style={{ fontSize: '0.74rem' }}>Sejak {tgl(overlay.picAktif.tglMulai)}</p>
                {isAdmin && <button type="button" className="aset__btn aset__btn--ghost" style={{ marginTop: 8 }} onClick={() => setModal('pic')}>Ganti PIC</button>}
              </>
            )
          ) : <div className="aset__muted">Belum ada PIC ditetapkan.</div>}
        </div>
      </div>

      {overlay && overlay.riwayatKondisi.length > 1 && (
        <div className="aset__card">
          <h3 className="aset__card-title">Riwayat Kondisi</h3>
          <div className="aset__mlist">
            {overlay.riwayatKondisi.map((k) => (
              <div className="aset__mrow" key={k.id}>
                <span>{tgl(k.tglDibuat)}{k.catatan ? <small> — {k.catatan}</small> : null}</span>
                <KondisiBadge kondisi={k.kondisi} />
              </div>
            ))}
          </div>
        </div>
      )}

      {overlay && overlay.riwayatPic.length > 0 && (
        <div className="aset__card">
          <h3 className="aset__card-title">Riwayat PIC</h3>
          <div className="aset__mlist">
            {overlay.riwayatPic.map((p) => (
              <div className="aset__mrow" key={p.id}>
                <span>
                  <b>{p.jenisPic === 'Bagian' ? p.namaUnit : p.namaPic}</b>
                  {p.jenisPic === 'Bagian' ? ' (Bagian)' : ` (${p.nik})`} · {tgl(p.tglMulai)}{p.tglSelesai ? ` – ${tgl(p.tglSelesai)}` : ' – sekarang'}
                </span>
                <PicBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="aset__card">
        <div className="aset__mhead">
          <h3 className="aset__card-title">Riwayat Aktivitas</h3>
          {isAdmin && <button type="button" className="aset__btn" onClick={() => setModal({ mode: 'aktivitas-buat' })}><Plus size={14} /> Catat Aktivitas</button>}
        </div>
        {!overlay || overlay.aktivitas.length === 0 ? (
          <div className="aset__muted" style={{ fontSize: '0.84rem' }}>Belum ada aktivitas tercatat.</div>
        ) : (
          <div className="aset__mlist">
            {overlay.aktivitas.map((a) => (
              <div className="aset__mrow" key={a.id}>
                <span>
                  <b>{a.jenis}</b> · {tgl(a.tglAktivitas)}
                  {a.vendorPelaksana ? <small> — {a.vendorPelaksana}</small> : null}
                  {a.biaya != null ? <small> · {rupiah(a.biaya)}</small> : null}
                  {a.deskripsi ? <><br /><small>{a.deskripsi}</small></> : null}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AktivitasStatusBadge status={a.status} />
                  {isAdmin && (
                    <div className="aset__row-act">
                      <button type="button" className="aset__ibtn" title="Ubah" onClick={() => setModal({ mode: 'aktivitas-ubah', row: a })}><Pencil size={13} /></button>
                      <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" onClick={() => hapusAktivitas(a)}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="aset__card">
        <div className="aset__mhead">
          <h3 className="aset__card-title">Dokumen Aset</h3>
          {isAdmin && <button type="button" className="aset__btn" onClick={() => setModal('dokumen')}><Upload size={14} /> Tambah Dokumen</button>}
        </div>
        {!overlay || overlay.dokumen.length === 0 ? (
          <div className="aset__muted" style={{ fontSize: '0.84rem' }}>Belum ada dokumen terlampir.</div>
        ) : (
          <div className="aset__mlist">
            {overlay.dokumen.map((d) => (
              <div className="aset__mrow" key={d.id}>
                <span>
                  <b>{d.jenisDokumen}</b>{d.nomorDokumen ? ` — ${d.nomorDokumen}` : ''}
                  {d.tglJatuhTempo ? <small> · Jatuh tempo {tgl(d.tglJatuhTempo)}</small> : null}
                  {d.fileUrl ? <><br /><button type="button" className="aset__linklike" onClick={() => previewDokumen(d)}><FileText size={12} style={{ verticalAlign: 'text-bottom' }} /> {d.fileNamaAsli || 'Lihat berkas'}</button></> : null}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DokumenStatusBadge status={d.status} />
                  {isAdmin && (
                    <div className="aset__row-act">
                      <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" onClick={() => hapusDokumen(d)}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === 'kondisi' && <KondisiFormModal initial={overlay?.kondisi} onClose={() => setModal(null)} onSubmit={simpanKondisi} />}
      {modal === 'dokumen' && <DokumenFormModal groupAssetKode={aset.kategoriKode} onClose={() => setModal(null)} onSubmit={simpanDokumen} />}
      {modal === 'nomor' && <NomorInternalFormModal initial={overlay?.nomorInternal} onClose={() => setModal(null)} onSubmit={simpanNomor} />}
      {modal === 'pic' && <PicFormModal onClose={() => setModal(null)} onSubmit={assignPic} />}
      {modal?.mode === 'aktivitas-buat' && <AktivitasUmumFormModal groupAssetKode={aset.kategoriKode} onClose={() => setModal(null)} onSubmit={simpanAktivitas} />}
      {modal?.mode === 'aktivitas-ubah' && <AktivitasUmumFormModal initial={modal.row} groupAssetKode={aset.kategoriKode} onClose={() => setModal(null)} onSubmit={simpanAktivitas} />}
    </div>
  )
}