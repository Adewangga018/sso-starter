import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, RotateCcw, MapPin, Navigation, AlertTriangle } from 'lucide-react'
import '../pages/AbsensiKamera.css'

// Adaptasi AbsensiKamera.jsx (absensi kamera kantor) untuk foto bukti perjalanan DINAS -
// kamera + GPS + stempel timestamp/peta SAMA, tapi TANPA validasi radius kantor (geofence
// tidak relevan: justru pegawai sedang di LUAR kantor saat dinas) dan TANPA tombol submit
// sendiri - hasil (foto+lat+lng+accuracy) diserahkan ke form induk (UMDL/SPPD) lewat onChange,
// baru benar-benar terkirim saat form induk disimpan.
const ACCURACY_WARNING_METERS = 75

function wibStamp() {
  const now = new Date()
  const tgl = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(now)
  const jam = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now)
  return `${tgl} ${jam.replace(/\./g, ':')} WIB`
}

function tileInfo(lat, lng, z) {
  const n = 2 ** z
  const latRad = (lat * Math.PI) / 180
  const xf = ((lng + 180) / 360) * n
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const x = Math.floor(xf)
  const y = Math.floor(yf)
  return { x, y, z, px: (xf - x) * 256, py: (yf - y) * 256 }
}

const TILE_PROVIDERS = [
  (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  (z, x, y) => `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
]

export default function DinasKameraCapture({ value, onChange }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const mapCacheRef = useRef(null)

  const [facing, setFacing] = useState('user')
  const [location, setLocation] = useState(null)
  const [geoError, setGeoError] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [tempat, setTempat] = useState('')
  const [camError, setCamError] = useState('')
  const [capturing, setCapturing] = useState(false)

  const captured = value?.foto ?? null

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

  useEffect(() => { readLocation() }, [readLocation])

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

  useEffect(() => { ensureMapBitmap().catch(() => {}) }, [ensureMapBitmap])

  const stopCamera = useCallback(() => {
    const s = streamRef.current
    if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null }
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
        video: { facingMode: facing, width: 1280, height: 960 }, audio: false,
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
    if (captured) { stopCamera(); return undefined }
    startCamera()
    return () => stopCamera()
  }, [captured, startCamera, stopCamera])

  function switchCamera() {
    setFacing((f) => (f === 'user' ? 'environment' : 'user'))
  }

  function drawStamp(ctx, w, h, map) {
    const base = w / 1000
    const pad = Math.round(17 * base)
    const f1 = Math.round(23 * base)
    const f2 = Math.round(18 * base)
    const lineGap = Math.round(10 * base)
    const textH = f1 + lineGap + f2 + lineGap + f2
    const barH = textH + pad * 2
    const top = h - barH

    ctx.fillStyle = 'rgba(15, 38, 31, 0.66)'
    ctx.fillRect(0, top, w, barH)

    let textX = pad
    if (map) {
      const size = textH
      const mx = pad
      const my = top + pad
      ctx.save()
      ctx.beginPath()
      ctx.rect(mx, my, size, size)
      ctx.clip()
      ctx.drawImage(map.img, mx, my, size, size)
      ctx.restore()
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
    if (!video || !canvas || !location) return
    if (video.readyState < 2) {
      setCamError('Kamera belum siap, coba lagi sebentar.')
      return
    }

    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const ratio = 4 / 3
    let sw = vw
    let sh = vh
    if (vw / vh > ratio) sw = Math.round(vh * ratio)
    else sh = Math.round(vw / ratio)
    const sx = Math.round((vw - sw) / 2)
    const sy = Math.round((vh - sh) / 2)
    const w = sw
    const h = sh
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.save()
    if (facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1) }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)
    ctx.restore()

    setCapturing(true)
    let map = null
    try { map = await ensureMapBitmap() } catch { map = null }
    drawStamp(ctx, w, h, map)
    setCapturing(false)

    onChange({
      foto: canvas.toDataURL('image/jpeg', 0.85),
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy ?? null,
    })
    setCamError('')
  }

  function retake() {
    onChange(null)
  }

  const accuracyLow = location?.accuracy != null && location.accuracy > ACCURACY_WARNING_METERS

  return (
    <div className="kamera__card kamera__card--compact">
      <div className="kamera__section-title">
        <Camera size={17} />
        Foto Bukti Lokasi Dinas
      </div>

      <div className="kamera__body">
        <div className="kamera__stage">
          <div className={`kamera__viewport${facing === 'user' && !captured ? ' kamera__viewport--mirror' : ''}`}>
            {captured ? (
              <img className="kamera__shot" src={captured} alt="Foto bukti dinas" />
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
              <button type="button" className="kamera__btn kamera__btn--ghost" onClick={retake}>
                <RotateCcw size={16} />
                Ambil Ulang
              </button>
            ) : (
              <button
                type="button"
                className="kamera__btn kamera__btn--capture"
                onClick={capture}
                disabled={Boolean(camError) || capturing || !location}
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
                    : geoLoading ? 'Mengambil lokasi…' : 'Belum tersedia'}
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

          {geoError && (
            <div className="kamera__alert kamera__alert--error">
              <AlertTriangle size={15} />
              <span>{geoError}</span>
              <button type="button" className="kamera__retry" onClick={readLocation}>
                Coba lagi
              </button>
            </div>
          )}

          {location && accuracyLow && (
            <div className="kamera__alert kamera__alert--warn">
              <AlertTriangle size={15} />
              <span>
                Sinyal GPS kurang akurat (~{Math.round(location.accuracy)} m). Boleh dilanjutkan,
                tapi coba pindah ke area terbuka bila memungkinkan.
              </span>
            </div>
          )}

          {captured && (
            <div className="kamera__feedback kamera__feedback--success">
              Foto bukti siap - lanjutkan mengisi form lalu Simpan.
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="kamera__canvas" />
    </div>
  )
}
