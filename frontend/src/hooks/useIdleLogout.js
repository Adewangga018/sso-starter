import { useEffect, useRef } from 'react'

// Batas diam sebelum sesi diakhiri. 30 menit adalah angka lazim untuk aplikasi internal
// perusahaan: cukup ketat untuk komputer bersama, tapi tidak mengusir orang yang sedang
// rapat sebentar. Ubah di sini kalau kebijakan keamanan menghendaki lain.
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

// Disimpan di localStorage, bukan di memori, karena dua alasan:
//  - tab lain ikut memperpanjang sesi (aktivitas di satu tab = pengguna masih ada);
//  - timer JS mati saat tab ditutup/laptop tidur, jadi saat halaman dibuka lagi kita harus
//    bisa menghitung sudah berapa lama ditinggal. Ini yang menutup kasus "web lama tidak
//    dibuka" - tanpa cap waktu ini, sesi seolah baru mulai setiap kali halaman dimuat.
const STORAGE_KEY = 'mygcs.lastActivity'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

// Menulis ke localStorage tiap gerakan mouse itu boros; cukup sekali per interval ini.
const WRITE_THROTTLE_MS = 30 * 1000

function now() {
  return Date.now()
}

function readLastActivity() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Mengakhiri sesi setelah pengguna diam selama IDLE_TIMEOUT_MS.
 *
 * @param {boolean} enabled - hanya aktif saat pengguna benar-benar login.
 * @param {() => void} onIdle - dipanggil sekali saat batas terlampaui (logout).
 */
export function useIdleLogout(enabled, onIdle) {
  // Disimpan di ref supaya perubahan identitas fungsi onIdle tidak me-restart timer.
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return

    let timer
    let lastWrite = 0
    // Logout hanya boleh sekali; tanpa ini, timer dan handler visibilitas bisa
    // memanggilnya bersamaan.
    let firedOnce = false

    function fireIdle() {
      if (firedOnce) return
      firedOnce = true
      window.localStorage.removeItem(STORAGE_KEY)
      onIdleRef.current?.()
    }

    function schedule() {
      clearTimeout(timer)
      const last = readLastActivity() ?? now()
      const sisa = last + IDLE_TIMEOUT_MS - now()

      if (sisa <= 0) {
        fireIdle()
        return
      }

      timer = setTimeout(schedule, sisa)
    }

    function markActive() {
      if (firedOnce) return
      const t = now()
      if (t - lastWrite >= WRITE_THROTTLE_MS) {
        lastWrite = t
        window.localStorage.setItem(STORAGE_KEY, String(t))
        schedule()
      }
    }

    // Kembali ke tab / halaman dibuka lagi: hitung ulang, jangan tunggu timer yang mungkin
    // tidak berjalan selama tab tidur.
    function onVisible() {
      if (document.visibilityState === 'visible') schedule()
    }

    // Aktivitas di tab lain juga memperpanjang sesi tab ini.
    function onStorage(e) {
      if (e.key === STORAGE_KEY) schedule()
    }

    if (readLastActivity() === null) {
      window.localStorage.setItem(STORAGE_KEY, String(now()))
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', onStorage)
    schedule()

    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActive))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  }, [enabled])
}
