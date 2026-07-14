import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api, ApiError } from '../lib/api'
import './IzinCetakPage.css'

// Sentence fragments that make the letter read naturally, matching the EASy wording:
// "...saya mohon ijin untuk datang terlambat karena kepentingan pribadi yaitu <keterangan>".
const JENIS_FRASA = {
  'Datang Terlambat': 'datang terlambat',
  Sakit: 'tidak masuk kerja karena sakit',
  'Tidak Masuk Kerja': 'tidak masuk kerja',
  'Pulang Lebih Awal': 'pulang lebih awal',
  'Meninggalkan Pekerjaan': 'meninggalkan pekerjaan',
  'Tidak Clocking In': 'tidak clocking in',
  'Tidak Clocking Out': 'tidak clocking out',
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTanggal(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

function formatJam(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatCetak(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${formatTanggal(value)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function IzinCetakPage() {
  const { id } = useParams()
  const [surat, setSurat] = useState(null)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')

  // The print dialog must fire only once, and only after the QR image exists - otherwise
  // the printed sheet would carry an empty box where the code should be.
  const printed = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await api.printIzin(id)
        if (cancelled) return
        const dataUrl = await QRCode.toDataURL(data.qrUrl, { margin: 1, width: 320 })
        if (cancelled) return
        setSurat(data)
        setQr(dataUrl)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Gagal menyiapkan surat izin.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!surat || !qr || printed.current) return
    printed.current = true
    // Let the browser paint the letter (logo + QR) before opening the dialog.
    const t = setTimeout(() => window.print(), 250)
    return () => clearTimeout(t)
  }, [surat, qr])

  if (error) {
    return <div className="cetak__state">{error}</div>
  }

  if (!surat) {
    return <div className="cetak__state">Menyiapkan surat izin...</div>
  }

  const frasa = JENIS_FRASA[surat.jenisIjin] ?? surat.jenisIjin.toLowerCase()
  const kepentingan = (surat.kepentinganIjin ?? '').toLowerCase()

  return (
    <div className="cetak">
      <div className="cetak__toolbar">
        <button type="button" onClick={() => window.print()}>
          Cetak
        </button>
      </div>

      <div className="cetak__sheet">
        <header className="cetak__header">
          <img src="/LOGO GCS.png" alt="Gresik Cipta Sejahtera" className="cetak__logo" />
          <div className="cetak__title">
            <h1>SURAT IJIN</h1>
            <div className="cetak__no">No. {surat.kodeIjin}</div>
          </div>
          <img src={qr} alt={`QR validasi ${surat.kodeIjin}`} className="cetak__qr" />
        </header>

        <section className="cetak__kepada">
          <div>Kepada Yth.</div>
          <div>{surat.kepada}</div>
          <div>PT. Gresik Cipta Sejahtera</div>
          <div>di Gresik</div>
        </section>

        <section className="cetak__body">
          <p>Dengan hormat,</p>
          <p>Yang bertanda tangan dibawah ini saya,</p>

          <table className="cetak__identitas">
            <tbody>
              <tr>
                <td className="cetak__label">Nama</td>
                <td className="cetak__sep">:</td>
                <td>{surat.nama}</td>
              </tr>
              <tr>
                <td className="cetak__label">NIK</td>
                <td className="cetak__sep">:</td>
                <td>{surat.nik}</td>
              </tr>
              <tr>
                <td className="cetak__label">Kelompok</td>
                <td className="cetak__sep">:</td>
                <td>{surat.kelompok ?? '-'}</td>
              </tr>
            </tbody>
          </table>

          <p className="cetak__isi">
            Dengan ini saya mohon ijin untuk {frasa} karena kepentingan {kepentingan} yaitu {surat.keterangan}
            <br />
            pada hari {surat.namaHari} tanggal {formatTanggal(surat.jamMulai)} jam {formatJam(surat.jamMulai)} -{' '}
            {formatJam(surat.jamSelesai)}
          </p>

          <p>Demikian untuk menjadi periksa.</p>
        </section>

        <section className="cetak__ttd">
          <div className="cetak__ttd-kolom">
            <div>Gresik, {formatTanggal(surat.dicetakPada)}</div>
            <div>Hormat saya,</div>
            <div className="cetak__ttd-nama">{surat.nama}</div>
          </div>
          <div className="cetak__ttd-kolom">
            <div>Mengetahui/Menyetujui</div>
            <div>Tanggal,</div>
            <div className="cetak__ttd-nama">{surat.namaAtasan ?? '-'}</div>
          </div>
        </section>

        <footer className="cetak__footer">
          <div className="cetak__catatan">Catatan Asisen Manager/Manager.</div>
          <div className="cetak__opsi">
            [ diijinkan / tidak diijinkan / sudah ada ijin sebelumnya (surat pernyataan / bukti terlampir) ] <sup>*)</sup>
          </div>

          <div className="cetak__terima">
            <span>Diterima Bagian SDM tanggal : ...............................</span>
            <span>Penerima : ...............................</span>
          </div>

          <div className="cetak__meta">
            <span>
              <sup>*)</sup> coret yang tidak perlu
            </span>
            <span>Cetak: {formatCetak(surat.dicetakPada)}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
