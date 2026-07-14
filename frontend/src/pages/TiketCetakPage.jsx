import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import './TiketCetakPage.css'

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTanggal(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

function formatCetak(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${formatTanggal(value)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Kalimat rincian mengikuti EASy: "Booking Tiket Bus pada tgl. 14-07-2026, rute <keterangan>".
// Hotel bukan "rute", jadi kata sambungnya menyesuaikan.
function kalimatRincian(r) {
  const tgl = formatTanggal(r.tglIn)
  const sampai = r.tglOut && formatTanggal(r.tglOut) !== tgl ? ` s/d ${formatTanggal(r.tglOut)}` : ''

  return r.jenisTiket === 'Hotel'
    ? `Booking Hotel pada tgl. ${tgl}${sampai}, ${r.keterangan}`
    : `Booking Tiket ${r.jenisTiket} pada tgl. ${tgl}${sampai}, rute ${r.keterangan}`
}

export default function TiketCetakPage() {
  const { id } = useParams()
  const [surat, setSurat] = useState(null)
  const [error, setError] = useState('')
  const printed = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await api.printTiket(id)
        if (!cancelled) setSurat(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Gagal menyiapkan surat pemesanan tiket.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!surat || printed.current) return
    printed.current = true
    const t = setTimeout(() => window.print(), 250)
    return () => clearTimeout(t)
  }, [surat])

  if (error) {
    return <div className="cetak__state">{error}</div>
  }

  if (!surat) {
    return <div className="cetak__state">Menyiapkan surat pemesanan tiket...</div>
  }

  return (
    <div className="cetak">
      <div className="cetak__toolbar">
        <button type="button" onClick={() => window.print()}>
          Cetak
        </button>
      </div>

      <div className="cetak__sheet">
        {/* Tanpa QR: berbeda dari Surat Izin dan SPPD, dokumen ini tidak didaftarkan ke
            registry validasi service.gcs-gresik.com - EASy pun mencetaknya tanpa QR. */}
        <header className="cetak__header">
          <img src="/LOGO GCS.png" alt="Gresik Cipta Sejahtera" className="cetak__logo" />
          <div className="cetak__title">
            <h1>PEMESANAN TIKET</h1>
            <div className="cetak__no">No. {surat.kodeTiket}</div>
            <div className="cetak__no">Tgl. {formatTanggal(surat.tglSurat)}</div>
          </div>
          <div className="cetak__spacer" />
        </header>

        <section className="cetak__pengantar">
          <p>
            Mohon diterbitkan (issued tiket/Booking Hotel) sesuai dengan Pemesanan Tiket, nomor dokumen :
          </p>
          <p>{surat.kodeTiket}</p>
          <p>Pegawai Ybs : {surat.nama}</p>
        </section>

        {/* Kotaknya dipegang wadah, bukan tabelnya. Kalau tinggi dipasang pada <table>,
            browser membagi sisa ruang ke tiap baris - itulah yang bikin barisnya berjauhan
            dengan garis horizontal di antaranya. */}
        <div className="cetak__tabel-box">
          <table className="cetak__tabel">
            <thead>
              <tr>
                <th className="cetak__c-no">No</th>
                <th className="cetak__c-ket">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {surat.rincian.map((r, i) => (
                <tr key={r.idDet}>
                  <td className="cetak__c-no">{i + 1}</td>
                  <td className="cetak__c-ket">{kalimatRincian(r)}</td>
                </tr>
              ))}

              {/* Baris pengisi: menyerap seluruh sisa tinggi kotak, sehingga sekat vertikal
                  di sebelah kolom No ikut turun sampai dasar - tanpa ini garisnya berhenti
                  di baris terakhir. Barisnya sendiri kosong dan tak terlihat. */}
              <tr className="cetak__filler">
                <td className="cetak__c-no" />
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <section className="cetak__ttd">
          <div className="cetak__ttd-kolom">
            <div>Pemohon,</div>
            <div>&nbsp;</div>
            <div className="cetak__ttd-garis">( .............................................. )</div>
          </div>
          <div className="cetak__ttd-kolom">
            <div>Menyetujui,</div>
            <div>Atasan Ybs,</div>
            <div className="cetak__ttd-garis">( .............................................. )</div>
          </div>
        </section>

        <footer className="cetak__footer">Cetak: {formatCetak(surat.dicetakPada)}</footer>
      </div>
    </div>
  )
}
