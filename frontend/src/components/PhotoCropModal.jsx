import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import './PhotoCropModal.css'

// Penyesuaian foto profil di dalam bingkai LINGKARAN sebelum disimpan. Pengguna
// menggeser (drag) dan mengubah zoom; area di dalam lingkaran itulah yang dipakai.
// Keluaran = JPEG persegi 1:1 (OUT x OUT) berisi seluruh isi bingkai; lingkaran
// hanya panduan visual, tampilannya dibulatkan lewat CSS di mana pun ditampilkan.
const VIEW = 300   // sisi viewport tampilan (px); lingkaran menyinggung tepinya
const OUT = 512    // sisi keluaran (px)
const MAX_ZOOM = 4

export default function PhotoCropModal({ src, busy = false, onCancel, onConfirm }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  // Geometri gambar & posisi (top-left) dalam koordinat viewport tampilan.
  const geo = useRef({ iw: 0, ih: 0, base: 1, ox: 0, oy: 0 })
  const dragRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)

  // eff = skala efektif (cover * zoom); drawW/H = ukuran gambar saat digambar.
  const dims = useCallback((z) => {
    const { iw, ih, base } = geo.current
    const eff = base * z
    return { eff, drawW: iw * eff, drawH: ih * eff }
  }, [])

  const clamp = useCallback((ox, oy, z) => {
    const { drawW, drawH } = dims(z)
    // Gambar selalu menutupi viewport: top-left di [VIEW - draw, 0].
    return {
      ox: Math.min(0, Math.max(VIEW - drawW, ox)),
      oy: Math.min(0, Math.max(VIEW - drawH, oy)),
    }
  }, [dims])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, VIEW, VIEW)
    const { ox, oy } = geo.current
    const { drawW, drawH } = dims(zoom)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, ox, oy, drawW, drawH)
  }, [dims, zoom])

  // Muat gambar dari src, hitung skala "cover", posisikan di tengah.
  useEffect(() => {
    setReady(false)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const base = Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight)
      geo.current.iw = img.naturalWidth
      geo.current.ih = img.naturalHeight
      geo.current.base = base
      const drawW = img.naturalWidth * base
      const drawH = img.naturalHeight * base
      geo.current.ox = (VIEW - drawW) / 2
      geo.current.oy = (VIEW - drawH) / 2
      setZoom(1)
      setReady(true)
    }
    img.src = src
  }, [src])

  // Gambar ulang setiap zoom/ready berubah.
  useEffect(() => { if (ready) draw() }, [ready, zoom, draw])

  // Ubah zoom sambil mempertahankan titik tengah viewport.
  const applyZoom = useCallback((next) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next))
    const { eff: effOld } = dims(zoom)
    const { ox, oy } = geo.current
    const cx = (VIEW / 2 - ox) / effOld
    const cy = (VIEW / 2 - oy) / effOld
    const { eff: effNew } = dims(z)
    const c = clamp(VIEW / 2 - cx * effNew, VIEW / 2 - cy * effNew, z)
    geo.current.ox = c.ox
    geo.current.oy = c.oy
    setZoom(z)
  }, [zoom, dims, clamp])

  // Drag untuk menggeser.
  const onPointerDown = (e) => {
    if (!ready) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: geo.current.ox, oy: geo.current.oy }
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const c = clamp(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y), zoom)
    geo.current.ox = c.ox
    geo.current.oy = c.oy
    draw()
  }
  const onPointerUp = (e) => {
    dragRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }
  const onWheel = (e) => {
    if (!ready) return
    e.preventDefault()
    applyZoom(zoom + (e.deltaY < 0 ? 0.15 : -0.15))
  }

  function reset() {
    const { iw, ih, base } = geo.current
    geo.current.ox = (VIEW - iw * base) / 2
    geo.current.oy = (VIEW - ih * base) / 2
    setZoom(1)
  }

  // Render area viewport (persegi) ke kanvas keluaran lalu ekspor JPEG.
  function confirm() {
    const img = imgRef.current
    if (!img) return
    const out = document.createElement('canvas')
    out.width = OUT
    out.height = OUT
    const ctx = out.getContext('2d')
    ctx.fillStyle = '#ffffff' // latar untuk sumber PNG transparan (JPEG tak beralfa)
    ctx.fillRect(0, 0, OUT, OUT)
    const k = OUT / VIEW
    const { ox, oy } = geo.current
    const { drawW, drawH } = dims(zoom)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, ox * k, oy * k, drawW * k, drawH * k)
    out.toBlob((blob) => { if (blob) onConfirm(blob) }, 'image/jpeg', 0.9)
  }

  return (
    <div className="crop__backdrop" role="dialog" aria-modal="true" aria-label="Sesuaikan foto profil">
      <div className="crop__modal">
        <div className="crop__head">
          <h3>Sesuaikan Foto Profil</h3>
          <button type="button" className="crop__x" onClick={onCancel} disabled={busy} aria-label="Tutup"><X size={18} /></button>
        </div>

        <p className="crop__hint">Geser untuk mengatur posisi, gunakan zoom untuk memperbesar. Bagian di dalam lingkaran yang akan disimpan.</p>

        <div
          className="crop__stage"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
        >
          <canvas ref={canvasRef} width={VIEW * (window.devicePixelRatio || 1)} height={VIEW * (window.devicePixelRatio || 1)} style={{ width: VIEW, height: VIEW }} />
          <div className="crop__mask" />
          {!ready && <div className="crop__loading"><Loader2 size={22} className="crop__spin" /></div>}
        </div>

        <div className="crop__zoom">
          <button type="button" className="crop__zoom-btn" onClick={() => applyZoom(zoom - 0.2)} disabled={!ready || zoom <= 1} aria-label="Perkecil"><ZoomOut size={16} /></button>
          <input
            type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))} disabled={!ready} aria-label="Zoom"
          />
          <button type="button" className="crop__zoom-btn" onClick={() => applyZoom(zoom + 0.2)} disabled={!ready || zoom >= MAX_ZOOM} aria-label="Perbesar"><ZoomIn size={16} /></button>
          <button type="button" className="crop__zoom-btn" onClick={reset} disabled={!ready} title="Atur ulang" aria-label="Atur ulang"><RotateCcw size={15} /></button>
        </div>

        <div className="crop__actions">
          <button type="button" className="crop__btn crop__btn--ghost" onClick={onCancel} disabled={busy}>Batal</button>
          <button type="button" className="crop__btn" onClick={confirm} disabled={!ready || busy}>
            {busy ? <><Loader2 size={15} className="crop__spin" /> Menyimpan…</> : 'Simpan Foto'}
          </button>
        </div>
      </div>
    </div>
  )
}
