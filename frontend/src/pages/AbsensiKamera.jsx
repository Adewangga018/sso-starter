import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, RotateCcw, MapPin, Navigation, AlertTriangle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import './AbsensiKamera.css'

// Titik & radius geofence kantor. Absensi hanya sah dalam radius ini (divalidasi ulang di server).
const OFFICE_LAT = -7.160305232233935
const OFFICE_LNG = 112.63314286876565
const RADIUS_METERS = 200

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// "Selasa, 15/07/2026 07:03:12 WIB" untuk stempel di foto.
function wibStamp() {
  const now = new Date()
  const tgl = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)
  const jam = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  return `${tgl} ${jam.replace(/\./g, ':')} WIB`
}

// Tile peta untuk titik lokasi (dipakai sebagai thumbnail di stempel foto).
function tileInfo(lat, lng, z) {
  const n = 2 ** z
  const latRad = (lat * Math.PI) / 180
  const xf = ((lng + 180) / 360) * n
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const x = Math.floor(xf)
  const y = Math.floor(yf)
  return { x, y, z, px: (xf - x) * 256, py: (yf - y) * 256 }
}

// Penyedia tile yang ramah embed + CORS (tanpa API key). Esri = citra satelit (mirip
// foto lokasi Google Maps), Carto = peta jalan sebagai cadangan. OSM tidak dipakai karena
// CDN-nya kini memblokir embed pihak ketiga (header x-totp / kebijakan penggunaan).
const TILE_PROVIDERS = [
  (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  (z, x, y) => `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
]

export default function AbsensiKamera({ onSubmitted }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const mapCacheRef = useRef(null) // { key, bitmap, px, py } tile peta CORS-clean per titik

  const [facing, setFacing] = useState('user') // 'user' = depan, 'environment' = belakang
  const [captured, setCaptured] = useState(null) // data URL foto (sudah bertimestamp + peta)
  const [location, setLocation] = useState(null) // { lat, lng, accuracy }
  const [geoError, setGeoError] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [tempat, setTempat] = useState('')
  const [camError, setCamError] = useState('')
  const [busy, setBusy] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', text }

  // Ambil tile peta titik lokasi lewat fetch -> blob -> objectURL -> Image.
  // Object URL bersifat same-origin sehingga aman digambar ke kanvas (tidak menodai).
  const ensureMapBitmap = useCallback(async () => {
    if (!location) return null
    const t = tileInfo(location.lat, location.lng, 18)
    const key = `${t.z}/${t.x}/${t.y}`
    if (mapCacheRef.current?.key === key) return mapCacheRef.current
    for (const build of TILE_PROVIDERS) {
      try {
        const res = await fetch(build(t.z, t.x, t.y))
        if (!res.ok) continue
        const url = URL.createObjectURL(await res.blob())
        const img = await new Promise((resolve, reject) => {
          const im = new Image()
          im.onload = () => resolve(im)
          im.onerror = () => reject(new Error('img gagal'))
          im.src = url
        })
        const entry = { key, img, px: t.px, py: t.py }
        mapCacheRef.current = entry
        return entry
      } catch {
        // coba penyedia berikutnya
      }
    }
    throw new Error('semua penyedia peta gagal')
  }, [location])

  // ---- Lokasi ----
  const readLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Perangkat/browser ini tidak mendukung akses lokasi.')
      return
    }
    setGeoLoading(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setGeoLoading(false)
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Akses lokasi ditolak. Aktifkan izin lokasi untuk situs ini, lalu coba lagi.'
            : 'Gagal mendapatkan lokasi. Pastikan GPS aktif lalu coba lagi.',
        )
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }, [])

  useEffect(() => {
    readLocation()
  }, [readLocation])

  // Nama tempat dari koordinat (reverse geocode). Gagal -> biarkan koordinat saja.
  useEffect(() => {
    if (!location) return undefined
    const controller = new AbortController()
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.lat}&lon=${location.lng}&zoom=18&addressdetails=1`,
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    )
      .then((r) => r.json())
      .then((d) => setTempat(d.name || d.display_name || ''))
      .catch(() => {})
    return () => controller.abort()
  }, [location])

  // Pramuat tile peta agar saat "Ambil Foto" sudah siap (capture tetap menunggu bila belum).
  useEffect(() => {
    ensureMapBitmap().catch(() => {})
  }, [ensureMapBitmap])

  // ---- Kamera ----
  const stopCamera = useCallback(() => {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    stopCamera()
    setCamError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Perangkat/browser ini tidak mendukung akses kamera.')
      return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: 1280, height: 960 },
        audio: false,
      })
    } catch {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch {
        setCamError('Akses kamera ditolak. Aktifkan izin kamera untuk situs ini, lalu coba lagi.')
        return
      }
    }
    const video = videoRef.current
    if (video && streamRef.current) {
      video.srcObject = streamRef.current
      video.onloadedmetadata = () => video.play().catch(() => {})
    }
  }, [facing, stopCamera])

  useEffect(() => {
    if (captured) {
      stopCamera()
      return undefined
    }
    startCamera()
    return () => stopCamera()
  }, [captured, startCamera, stopCamera])

  function switchCamera() {
    setCaptured(null)
    setFeedback(null)
    setFacing((f) => (f === 'user' ? 'environment' : 'user'))
  }

  // Stempel bawah foto: kiri = thumbnail peta titik lokasi, kanan = timestamp + tempat + koordinat.
  // Ukuran dipatok ke lebar foto (bukan tinggi) agar proporsional di rasio apa pun.
  function drawStamp(ctx, w, h, map) {
    // Font & jarak baris relatif lebar; tinggi bar mengikuti isi (tidak berlebihan).
    const base = w / 1000
    const pad = Math.round(17 * base)
    const f1 = Math.round(23 * base) // baris timestamp
    const f2 = Math.round(18 * base) // baris tempat & koordinat
    const lineGap = Math.round(10 * base)
    const textH = f1 + lineGap + f2 + lineGap + f2
    const barH = textH + pad * 2
    const top = h - barH

    ctx.fillStyle = 'rgba(15, 38, 31, 0.66)'
    ctx.fillRect(0, top, w, barH)

    let textX = pad
    if (map) {
      const size = textH // kotak peta setinggi blok teks
      const mx = pad
      const my = top + pad
      // Gambar seluruh tile memenuhi kotak (tanpa offset negatif -> tidak terpotong).
      ctx.save()
      ctx.beginPath()
      ctx.rect(mx, my, size, size)
      ctx.clip()
      ctx.drawImage(map.img, mx, my, size, size)
      ctx.restore()
      // Pin merah pada posisi relatif titik di dalam tile.
      const pinX = mx + (map.px / 256) * size
      const pinY = my + (map.py / 256) * size
      const r = Math.max(3, size * 0.08)
      ctx.fillStyle = '#e6483f'
      ctx.beginPath()
      ctx.arc(pinX, pinY, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = Math.max(1.5, size * 0.02)
      ctx.stroke()
      // Bingkai kotak peta.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = Math.max(1.5, base * 2)
      ctx.strokeRect(mx, my, size, size)
      textX = mx + size + pad
    }

    const maxTextW = w - textX - pad
    const clip = (text, font) => {
      ctx.font = font
      let t = text
      if (ctx.measureText(t).width <= maxTextW) return t
      while (t.length > 1 && ctx.measureText(t + '…').width > maxTextW) t = t.slice(0, -1)
      return t + '…'
    }

    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'top'
    const big = `bold ${f1}px sans-serif`
    const small = `${f2}px sans-serif`
    let y = top + pad
    ctx.fillText(clip(wibStamp(), big), textX, y)
    y += f1 + lineGap
    ctx.fillText(clip(tempat || 'Lokasi tidak diketahui', small), textX, y)
    y += f2 + lineGap
    if (location) {
      ctx.fillText(`(${location.lat.toFixed(6)}, ${location.lng.toFixed(6)})`, textX, y)
    }
  }

  async function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState < 2) {
      setCamError('Kamera belum siap, coba lagi sebentar.')
      return
    }

    // Potong tengah ke rasio 4:3 agar sama persis dengan viewport preview (object-fit: cover).
    // Tanpa ini, foto yang lebih lebar akan terpangkas di layar sehingga peta/awal teks stempel
    // di kiri hilang dari tampilan.
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const ratio = 4 / 3
    let sw = vw
    let sh = vh
    if (vw / vh > ratio) {
      sw = Math.round(vh * ratio)
    } else {
      sh = Math.round(vw / ratio)
    }
    const sx = Math.round((vw - sw) / 2)
    const sy = Math.round((vh - sh) / 2)
    const w = sw
    const h = sh
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.save()
    // Kamera depan dicerminkan agar sesuai preview; transform direset sebelum stempel.
    if (facing === 'user') {
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)
    ctx.restore()

    setCapturing(true)
    let map = null
    try {
      map = await ensureMapBitmap()
    } catch {
      map = null // tile gagal dimuat -> stempel tanpa peta
    }
    drawStamp(ctx, w, h, map)
    setCapturing(false)

    setCaptured(canvas.toDataURL('image/jpeg', 0.85))
    setCamError('')
    setFeedback(null)
  }

  function retake() {
    setCaptured(null)
    setFeedback(null)
  }

  const dist = location ? distanceMeters(location.lat, location.lng, OFFICE_LAT, OFFICE_LNG) : null
  const inRadius = dist != null && dist <= RADIUS_METERS
  const canSubmit = Boolean(captured) && inRadius && !busy

  async function submit() {
    if (!captured) {
      setFeedback({ type: 'error', text: 'Ambil foto terlebih dahulu sebelum absen.' })
      return
    }
    if (!inRadius) {
      setFeedback({ type: 'error', text: 'Anda berada di luar radius kantor. Absensi tidak dapat dilakukan.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      // Server yang menentukan masuk/keluar (berdasarkan status absensi hari ini, bukan jam);
      // "type" di payload cuma legacy field, tidak dipakai server untuk memutuskan apa pun.
      const result = await api.submitAbsensi({
        foto: captured,
        lat: location.lat,
        lng: location.lng,
        tempat: tempat || null,
        type: 'in',
      })
      const isMasuk = Boolean(result?.checkIn)
      setFeedback({
        type: 'success',
        text: isMasuk ? 'Absen masuk berhasil dicatat.' : 'Absen keluar berhasil dicatat.',
      })
      setCaptured(null)
      onSubmitted?.()
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Gagal menyimpan absensi.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="kamera__card">
      <div className="kamera__section-title">
        <Camera size={17} />
        Absensi Kamera
      </div>

      <div className="kamera__body">
        <div className="kamera__stage">
          <div className={`kamera__viewport${facing === 'user' && !captured ? ' kamera__viewport--mirror' : ''}`}>
            {captured ? (
              <img className="kamera__shot" src={captured} alt="Foto absensi" />
            ) : (
              <video ref={videoRef} className="kamera__video" playsInline muted autoPlay />
            )}
            {!captured && !camError && (
              <button type="button" className="kamera__switch" onClick={switchCamera} title="Ganti kamera">
                <RefreshCw size={16} />
                Switch
              </button>
            )}
          </div>

          {camError && (
            <div className="kamera__alert kamera__alert--error">
              <AlertTriangle size={15} />
              <span>{camError}</span>
            </div>
          )}

          <div className="kamera__controls">
            {captured ? (
              <button type="button" className="kamera__btn kamera__btn--ghost" onClick={retake} disabled={busy}>
                <RotateCcw size={16} />
                Ambil Ulang
              </button>
            ) : (
              <button
                type="button"
                className="kamera__btn kamera__btn--capture"
                onClick={capture}
                disabled={Boolean(camError) || capturing}
              >
                <Camera size={16} />
                {capturing ? 'Memproses…' : 'Ambil Foto'}
              </button>
            )}
          </div>
        </div>

        <div className="kamera__panel">
          <ul className="kamera__info">
            <li>
              <span className="kamera__info-icon"><Navigation size={15} /></span>
              <span className="kamera__info-text">
                <span className="kamera__info-label">Lokasi saat ini</span>
                <span className="kamera__info-value">
                  {location
                    ? `(${location.lat.toFixed(6)}, ${location.lng.toFixed(6)})`
                    : geoLoading
                      ? 'Mengambil lokasi…'
                      : 'Belum tersedia'}
                </span>
              </span>
            </li>
            <li>
              <span className="kamera__info-icon kamera__info-icon--gold"><MapPin size={15} /></span>
              <span className="kamera__info-text">
                <span className="kamera__info-label">Tempat</span>
                <span className="kamera__info-value">
                  {tempat || (location ? 'Menentukan tempat…' : '-')}
                </span>
              </span>
            </li>
          </ul>

          {geoError ? (
            <div className="kamera__alert kamera__alert--error">
              <AlertTriangle size={15} />
              <span>{geoError}</span>
              <button type="button" className="kamera__retry" onClick={readLocation}>
                Coba lagi
              </button>
            </div>
          ) : location ? (
            <div className={`kamera__radius ${inRadius ? 'kamera__radius--ok' : 'kamera__radius--out'}`}>
              {inRadius
                ? `Dalam radius kantor (~${Math.round(dist)} m)`
                : `Di luar radius kantor (~${Math.round(dist)} m). Absensi hanya dalam radius ${RADIUS_METERS} m.`}
            </div>
          ) : null}

          {feedback && (
            <div className={`kamera__feedback kamera__feedback--${feedback.type}`}>{feedback.text}</div>
          )}

          <div className="kamera__actions">
            <button type="button" className="kamera__btn kamera__btn--absen" onClick={submit} disabled={!canSubmit}>
              {busy ? 'Menyimpan…' : 'Absen'}
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="kamera__canvas" />
    </div>
  )
}
