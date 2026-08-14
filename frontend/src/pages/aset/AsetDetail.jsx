import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  ArrowLeft, Loader2, Pencil, UserPlus, UserMinus, Plus, Trash2, Printer, User, Building2, FileText, Upload, X, FileCheck2,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import {
  rupiah, tgl, KondisiBadge, PicBadge, AktivitasStatusBadge, DokumenStatusBadge,
  KondisiFormModal, PicFormModal, AktivitasUmumFormModal, NomorInternalFormModal, DokumenFormModal,
  encodeAsetId, decodeAsetId, useConfirm,
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
  const [sesiAktifDicek, setSesiAktifDicek] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
  // Riwayat (Kondisi/PIC/Aktivitas) dibatasi 5 baris awal supaya halaman tidak jadi
  // sangat panjang di aset yang sudah lama - tombol "Lihat semua" membuka sisanya.
  const BATAS_RIWAYAT = 5
  const [showSemuaKondisi, setShowSemuaKondisi] = useState(false)
  const [showSemuaPic, setShowSemuaPic] = useState(false)
  const [showSemuaAktivitas, setShowSemuaAktivitas] = useState(false)

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
  // Admin Aset penuh, ATAU Operator Aktivitas yang jadi PIC aset ini - hanya boleh
  // MENCATAT aktivitas baru (Ubah/Hapus tetap admin-only, lihat AsetOverlayService).
  const canCatatAktivitas = overlay?.canCatatAktivitas ?? false

  // Untuk tombol jalan pintas "Catat di Opname" - sesi yang masih berjalan saja.
  // sesiAktifDicek dipakai supaya pesan "belum ada sesi" tidak sempat kelihatan
  // sebelum daftar sesi selesai dimuat.
  useEffect(() => {
    if (!isAdmin) return
    api.getAsetOpnameSesiList()
      .then((rows) => setSesiAktif(rows.filter((s) => s.status === 'Berjalan')))
      .catch(() => setSesiAktif([]))
      .finally(() => setSesiAktifDicek(true))
  }, [isAdmin])

  async function simpanKondisi(payload) { await api.setAsetKondisi(objectId, payload); setModal(null); setMsg({ t: 'ok', m: 'Kondisi dicatat.' }); await load() }
  async function simpanNomor(payload) { await api.setAsetNomorInternal(objectId, payload); setModal(null); setMsg({ t: 'ok', m: 'Nomor aset internal disimpan.' }); await load() }
  async function assignPic(payload) { await api.assignAsetPic(objectId, payload); setModal(null); setMsg({ t: 'ok', m: 'PIC ditetapkan.' }); await load() }
  async function kembalikanPic(id) {
    if (!(await confirm('Tandai PIC ini sudah mengembalikan aset? Status PIC akan berubah jadi "Dikembalikan".'))) return
    try { await api.kembalikanAsetPic(id); setMsg({ t: 'ok', m: 'PIC ditandai sudah mengembalikan aset.' }); await load() }
    catch (err) { setMsg({ t: 'err', m: err instanceof ApiError ? err.message : 'Gagal.' }) }
  }
  async function simpanAktivitas(payload) {
    if (modal.mode === 'aktivitas-ubah') await api.ubahAsetAktivitas(modal.row.id, payload)
    else await api.buatAsetAktivitas(objectId, payload)
    setModal(null); setMsg({ t: 'ok', m: 'Aktivitas disimpan.' }); await load()
  }
  async function hapusAktivitas(row) {
    if (!(await confirm(`Hapus aktivitas "${row.jenis}"? Data akan hilang permanen.`, { danger: true }))) return
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
    if (!(await confirm(`Hapus dokumen "${row.jenisDokumen}"? Berkas & data akan hilang permanen.`, { danger: true }))) return
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
          <h2 className="aset__title">
            {aset.nama || aset.objectId}
            {aset.klasifikasi && <span className="aset__badge aset__badge--info" title="Aset yang disetujui untuk dijual sesuai keputusan pemegang saham" style={{ marginLeft: 10, verticalAlign: 'middle' }}>{aset.klasifikasi}</span>}
          </h2>
          <p className="aset__sub">
            {aset.objectId}{aset.nomorAset ? ` · No. Internal: ${aset.nomorAset}` : ''} · {aset.kategori || '—'} · {aset.kelompok || '—'}
          </p>
        </div>
        {aset.klasifikasiDetail && (
          <button type="button" className="aset__btn aset__btn--highlight" onClick={() => setModal('klasifikasi')}>
            <FileCheck2 size={14} /> Detail {aset.klasifikasi || 'Klasifikasi'}
          </button>
        )}
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
        {isAdmin && sesiAktifDicek && sesiAktif.length === 0 && (
          <span className="aset__hint--warn">Belum ada sesi Stock Opname yang berjalan.</span>
        )}
      </div>

      {msg && <div className={`aset__msg aset__msg--${msg.t === 'ok' ? 'ok' : 'err'}`}>{msg.m}</div>}

      <div className="aset__detailgrid">
        <div className="aset__card aset__card--wide">
          <div className="aset__mhead">
            <h3 className="aset__card-title">Info Aset (ERP) & Kondisi</h3>
            {isAdmin && <button type="button" className="aset__ibtn" title="Catat Kondisi" aria-label="Catat Kondisi" onClick={() => setModal('kondisi')}><Pencil size={14} /></button>}
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
            {isAdmin && <button type="button" className="aset__ibtn" title="Ubah Nomor Aset" aria-label="Ubah Nomor Aset" onClick={() => setModal('nomor')}><Pencil size={14} /></button>}
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
                ? <button type="button" className="aset__ibtn" title="Kembalikan / lepas PIC" aria-label="Kembalikan / lepas PIC" onClick={() => kembalikanPic(overlay.picAktif.id)}><UserMinus size={14} /></button>
                : <button type="button" className="aset__ibtn" title="Tetapkan PIC" aria-label="Tetapkan PIC" onClick={() => setModal('pic')}><UserPlus size={14} /></button>
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
            {(showSemuaKondisi ? overlay.riwayatKondisi : overlay.riwayatKondisi.slice(0, BATAS_RIWAYAT)).map((k) => (
              <div className="aset__mrow" key={k.id}>
                <span>{tgl(k.tglDibuat)}{k.catatan ? <small> — {k.catatan}</small> : null}</span>
                <KondisiBadge kondisi={k.kondisi} />
              </div>
            ))}
          </div>
          {!showSemuaKondisi && overlay.riwayatKondisi.length > BATAS_RIWAYAT && (
            <button type="button" className="aset__btn aset__btn--ghost" style={{ marginTop: 10 }} onClick={() => setShowSemuaKondisi(true)}>
              Lihat semua ({overlay.riwayatKondisi.length})
            </button>
          )}
        </div>
      )}

      {overlay && overlay.riwayatPic.length > 0 && (
        <div className="aset__card">
          <h3 className="aset__card-title">Riwayat PIC</h3>
          <div className="aset__mlist">
            {(showSemuaPic ? overlay.riwayatPic : overlay.riwayatPic.slice(0, BATAS_RIWAYAT)).map((p) => (
              <div className="aset__mrow" key={p.id}>
                <span>
                  <b>{p.jenisPic === 'Bagian' ? p.namaUnit : p.namaPic}</b>
                  {p.jenisPic === 'Bagian' ? ' (Bagian)' : ` (${p.nik})`} · {tgl(p.tglMulai)}{p.tglSelesai ? ` – ${tgl(p.tglSelesai)}` : ' – sekarang'}
                </span>
                <PicBadge status={p.status} />
              </div>
            ))}
          </div>
          {!showSemuaPic && overlay.riwayatPic.length > BATAS_RIWAYAT && (
            <button type="button" className="aset__btn aset__btn--ghost" style={{ marginTop: 10 }} onClick={() => setShowSemuaPic(true)}>
              Lihat semua ({overlay.riwayatPic.length})
            </button>
          )}
        </div>
      )}

      <div className="aset__card">
        <div className="aset__mhead">
          <h3 className="aset__card-title">Riwayat Aktivitas</h3>
          {canCatatAktivitas && <button type="button" className="aset__btn" onClick={() => setModal({ mode: 'aktivitas-buat' })}><Plus size={14} /> Catat Aktivitas</button>}
        </div>
        {!overlay || overlay.aktivitas.length === 0 ? (
          <div className="aset__muted" style={{ fontSize: '0.84rem' }}>Belum ada aktivitas tercatat.</div>
        ) : (
          <div className="aset__mlist">
            {(showSemuaAktivitas ? overlay.aktivitas : overlay.aktivitas.slice(0, BATAS_RIWAYAT)).map((a) => (
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
                      <button type="button" className="aset__ibtn" title="Ubah" aria-label="Ubah" onClick={() => setModal({ mode: 'aktivitas-ubah', row: a })}><Pencil size={13} /></button>
                      <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" aria-label="Hapus" onClick={() => hapusAktivitas(a)}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {overlay && !showSemuaAktivitas && overlay.aktivitas.length > BATAS_RIWAYAT && (
          <button type="button" className="aset__btn aset__btn--ghost" style={{ marginTop: 10 }} onClick={() => setShowSemuaAktivitas(true)}>
            Lihat semua ({overlay.aktivitas.length})
          </button>
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
                      <button type="button" className="aset__ibtn aset__ibtn--danger" title="Hapus" aria-label="Hapus dokumen" onClick={() => hapusDokumen(d)}><Trash2 size={13} /></button>
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
      {modal === 'klasifikasi' && <KlasifikasiDetailModal aset={aset} onClose={() => setModal(null)} />}
      {ConfirmUI}
    </div>
  )
}

// Popup read-only (bukan form) - detail sertifikat/appraisal/perijinan ke pemegang saham
// utk aset berklasifikasi "Tidak Bergerak", dipisah dari halaman utama Detail Aset supaya
// tidak memenuhi halaman (cuma tampil lewat tombol "Detail Tidak Bergerak").
function KlasifikasiDetailModal({ aset, onClose }) {
  const d = aset.klasifikasiDetail
  return (
    <div className="aset__overlay" onClick={onClose}>
      <div className="aset__modal" onClick={(e) => e.stopPropagation()}>
        <div className="aset__modal-head"><h3>Detail {aset.klasifikasi || 'Klasifikasi'}</h3><button type="button" className="aset__x" aria-label="Tutup" onClick={onClose}><X size={18} /></button></div>
        <div className="aset__modal-body">
          <div className="aset__dgrid">
            <div><span>Sertifikat Hak</span><b>{d.sertifikatHak || '—'}</b></div>
            <div><span>No. Sertifikat</span><b>{d.sertifikatNo || '—'}</b></div>
            <div><span>Tahun Sertifikat</span><b>{d.sertifikatTahun || '—'}</b></div>
            <div><span>Jangka Waktu</span><b>{d.sertifikatJangkaWaktu || '—'}</b></div>
            <div><span>Status Jaminan</span><b>{d.statusJaminan || '—'}</b></div>
            <div><span>Nilai Pasar</span><b>{d.nilaiPasar != null ? rupiah(d.nilaiPasar) : '—'}</b></div>
            <div><span>Nilai Appraisal</span><b>{d.nilaiAppraisal != null ? rupiah(d.nilaiAppraisal) : '—'}</b></div>
            <div><span>KJPP</span><b>{d.kjpp || '—'}</b></div>
            <div><span>Tahun Appraisal</span><b>{d.kjppTahun || '—'}</b></div>
            <div><span>No. Laporan Appraisal</span><b>{d.kjppNo || '—'}</b></div>
          </div>
          {d.keteranganPemegangSaham && <p className="aset__muted" style={{ marginTop: 10 }}>Perijinan ke Pemegang Saham: {d.keteranganPemegangSaham}</p>}
          {d.catatan && <p className="aset__muted" style={{ fontSize: '0.74rem' }}>Catatan pencocokan: {d.catatan}</p>}
        </div>
        <div className="aset__modal-foot">
          <button type="button" className="aset__btn aset__btn--ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}