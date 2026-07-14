import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api, ApiError } from '../lib/api'
import './SppdCetakPage.css'

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

export default function SppdCetakPage() {
  const { id } = useParams()
  const [surat, setSurat] = useState(null)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')

  // Cetak hanya sekali, dan hanya setelah QR jadi - kalau tidak, kotak QR keluar kosong.
  const printed = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await api.printSppd(id)
        if (cancelled) return
        const dataUrl = await QRCode.toDataURL(data.qrUrl, { margin: 1, width: 320 })
        if (cancelled) return
        setSurat(data)
        setQr(dataUrl)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Gagal menyiapkan SPPD.')
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
    const t = setTimeout(() => window.print(), 250)
    return () => clearTimeout(t)
  }, [surat, qr])

  if (error) {
    return <div className="cetak__state">{error}</div>
  }

  if (!surat) {
    return <div className="cetak__state">Menyiapkan SPPD...</div>
  }

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
            <h1>SURAT PERINTAH PERJALANAN DINAS</h1>
            <div className="cetak__no">No. {surat.kodeSppd}</div>
            <div className="cetak__no">Tgl. {formatTanggal(surat.tglSurat)}</div>
          </div>
          <img src={qr} alt={`QR validasi ${surat.kodeSppd}`} className="cetak__qr" />
        </header>

        {/* Kotaknya dipegang wadah, bukan tabelnya: tinggi pada <table> membuat browser
            membagi sisa ruang ke tiap baris, sehingga peserta jadi berjauhan. */}
        <div className="cetak__tabel-box">
        <table className="cetak__tabel">
          <thead>
            <tr>
              <th className="cetak__c-no">NO</th>
              <th className="cetak__c-org">NAMA, NIK, GOLONGAN, JABATAN</th>
              <th className="cetak__c-tujuan">TUJUAN</th>
              <th className="cetak__c-tugas">TUGAS YANG HARUS DILAKSANAKAN</th>
              <th className="cetak__c-ttd">TANDA TANGAN</th>
            </tr>
          </thead>
          <tbody>
            {surat.peserta.map((p, i) => (
              <tr key={p.nik}>
                <td className="cetak__c-no">{i + 1}</td>
                <td className="cetak__c-org">
                  <div className="cetak__nama">{p.nama}</div>
                  <div>{p.nik}</div>
                  <div>{p.golongan}</div>
                  <div>{p.jabatan}</div>
                  <div className="cetak__posisi">{p.posisi}</div>
                </td>
                <td className="cetak__c-tujuan">{surat.tujuan}</td>
                <td className="cetak__c-tugas">{p.tugas}</td>
                {/* Nomor yang sama dengan kolom NO, supaya jelas tanda tangan siapa yang
                    dibubuhkan di baris ini - kolomnya kosong dan mudah tertukar. */}
                <td className="cetak__c-ttd">{i + 1}.</td>
              </tr>
            ))}

            {/* Baris pengisi: menyerap sisa tinggi kotak supaya sekat vertikal antar kolom
                turun sampai dasar - tanpa ini garisnya berhenti di peserta terakhir. */}
            <tr className="cetak__filler">
              <td className="cetak__c-no" />
              <td className="cetak__c-org" />
              <td className="cetak__c-tujuan" />
              <td className="cetak__c-tugas" />
              <td className="cetak__c-ttd" />
            </tr>
          </tbody>
        </table>
        </div>

        <section className="cetak__ringkas">
          <table className="cetak__ringkas-kiri">
            <tbody>
              <tr>
                <td className="cetak__label">Selama</td>
                <td className="cetak__sep">:</td>
                <td>{surat.lamaHari} hari</td>
              </tr>
              <tr>
                <td className="cetak__label">Tgl. Berangkat</td>
                <td className="cetak__sep">:</td>
                <td>{formatTanggal(surat.tglBerangkat)}</td>
              </tr>
              <tr>
                <td className="cetak__label">Tgl. Pulang</td>
                <td className="cetak__sep">:</td>
                <td>{formatTanggal(surat.tglPulang)}</td>
              </tr>
              <tr>
                <td className="cetak__label">Kendaraan</td>
                <td className="cetak__sep">:</td>
                <td>{surat.kendaraan}</td>
              </tr>
            </tbody>
          </table>

          <div className="cetak__ttd-kolom">
            <div>Menyetujui</div>
            <div>Direksi,</div>
            <div className="cetak__ttd-garis">( ......................................... )</div>
          </div>

          <div className="cetak__ttd-kolom">
            <div>Yang memerintahkan,</div>
            <div>&nbsp;</div>
            <div className="cetak__ttd-garis">( ......................................... )</div>
          </div>
        </section>

        <footer className="cetak__footer">Cetak: {formatCetak(surat.dicetakPada)}</footer>
      </div>
    </div>
  )
}
