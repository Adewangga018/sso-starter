import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api, ApiError } from '../../lib/api'
import { encodeAsetId, decodeAsetId } from './asetShared'
import './AsetQrCetak.css'

// Cetak label QR aset - bisa multi-sekaligus lewat ?ids=OBJECTID1,OBJECTID2,... (tiap
// OBJECTID disamarkan lewat encodeAsetId - lihat asetShared.jsx).
export default function AsetQrCetak() {
  const [params] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').map((s) => decodeAsetId(s.trim())).filter(Boolean)
  const [labels, setLabels] = useState(null)
  const [error, setError] = useState('')
  const printed = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (ids.length === 0) { setError('Tidak ada aset dipilih untuk dicetak.'); return }
      try {
        const rows = await Promise.all(ids.map((id) => api.getAsetDetail(id)))
        if (cancelled) return
        const withQr = await Promise.all(rows.map(async (a) => ({
          ...a,
          qr: await QRCode.toDataURL(`${window.location.origin}/my-asset/detail/${encodeAsetId(a.objectId)}`, { margin: 1, width: 200 }),
        })))
        if (cancelled) return
        setLabels(withQr)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Gagal menyiapkan label QR.')
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!labels || printed.current) return
    printed.current = true
    const t = setTimeout(() => window.print(), 250)
    return () => clearTimeout(t)
  }, [labels])

  if (error) return <div className="qrcetak__state">{error}</div>
  if (!labels) return <div className="qrcetak__state">Menyiapkan label QR...</div>

  return (
    <div className="qrcetak">
      <div className="qrcetak__toolbar">
        <button type="button" onClick={() => window.print()}>Cetak</button>
      </div>
      <div className="qrcetak__sheet">
        {labels.map((a) => (
          <div className="qrcetak__label" key={a.objectId}>
            <div className="qrcetak__left">
              <img src="/LOGO GCS.png" alt="GCS" className="qrcetak__logo" />
              <div className="qrcetak__kode">{a.objectId}</div>
              <div className="qrcetak__nama">{a.nama || '—'}</div>
              <div className="qrcetak__property">Property of PT Gresik Cipta Sejahtera</div>
            </div>
            <div className="qrcetak__right">
              <img src={a.qr} alt={`QR ${a.objectId}`} className="qrcetak__qr" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}