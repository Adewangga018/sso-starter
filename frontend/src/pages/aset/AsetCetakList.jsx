import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api'
import { rupiah } from './asetShared'
import './AsetQrCetak.css'
import './AsetCetakList.css'

// Cetak/export PDF daftar Inventaris - dibuka tab baru dari Inventaris.jsx dengan filter
// yang lagi aktif dibawa lewat query string (q/kelompok/lokasi/pic/klasifikasi), diterapkan
// lagi di sini persis seperti logika client-side di Inventaris.jsx supaya hasilnya sama
// dengan yang tampil di layar. Sama seperti AsetQrCetak.jsx: browser print-to-PDF ("Save as
// PDF" di dialog cetak), bukan file PDF yang di-generate server.
export default function AsetCetakList() {
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim().toLowerCase()
  const kelompok = params.get('kelompok') || ''
  const lokasi = params.get('lokasi') || ''
  const pic = params.get('pic') || ''
  const klasifikasi = params.get('klasifikasi') || ''

  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const printed = useRef(false)

  useEffect(() => {
    let cancelled = false
    api.getAsetList().then((data) => {
      if (cancelled) return
      const filtered = data.items
        .filter((a) => !q
          || a.nama?.toLowerCase().includes(q)
          || a.objectId?.toLowerCase().includes(q)
          || a.lokasi?.toLowerCase().includes(q)
          || a.noPol?.toLowerCase().includes(q)
          || a.nomorAset?.toLowerCase().includes(q)
          || a.klasifikasi?.toLowerCase().includes(q))
        .filter((a) => !kelompok || a.kelompok === kelompok)
        .filter((a) => !lokasi || a.lokasi === lokasi)
        .filter((a) => !pic || a.picSaatIni === pic)
        .filter((a) => !klasifikasi || a.klasifikasi === klasifikasi)
      setRows(filtered)
    }).catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Gagal memuat data aset.') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!rows || printed.current) return
    printed.current = true
    const t = setTimeout(() => window.print(), 250)
    return () => clearTimeout(t)
  }, [rows])

  if (error) return <div className="qrcetak__state">{error}</div>
  if (!rows) return <div className="qrcetak__state">Menyiapkan daftar aset…</div>

  const totalNilaiBuku = rows.reduce((sum, a) => sum + (a.nilaiBuku || 0), 0)

  return (
    <div className="qrcetak" style={{ background: '#e9eaea' }}>
      <div className="qrcetak__toolbar">
        <button type="button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
      </div>
      <div className="asetcetak__sheet">
        <div className="asetcetak__head">
          <img src="/LOGO GCS.png" alt="GCS" className="asetcetak__logo" />
          <div>
            <h1>Daftar Inventaris Aset</h1>
            <p>PT Gresik Cipta Sejahtera — dicetak {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · {rows.length} aset</p>
          </div>
        </div>
        <table className="asetcetak__table">
          <thead>
            <tr>
              <th>Kode</th><th>Nama</th><th>Kategori</th><th>Lokasi</th><th>PIC</th>
              <th>Qty</th><th>Nilai Perolehan</th><th>Nilai Buku</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.objectId}>
                <td>{a.objectId}</td>
                <td>{a.nama || '—'}</td>
                <td>{a.kategori || '—'}</td>
                <td>{a.lokasi || '—'}</td>
                <td>{a.picSaatIni || '—'}</td>
                <td>{a.qty != null ? `${a.qty} ${a.satuan ?? ''}` : '—'}</td>
                <td>{a.nilaiPerolehan != null ? rupiah(a.nilaiPerolehan) : '—'}</td>
                <td>{a.nilaiBuku != null ? rupiah(a.nilaiBuku) : '—'}</td>
                <td>{a.aktif === 'Y' ? 'Aktif' : 'Tidak Aktif'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={7} style={{ textAlign: 'right', fontWeight: 700 }}>Total Nilai Buku</td><td colSpan={2} style={{ fontWeight: 700 }}>{rupiah(totalNilaiBuku)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
