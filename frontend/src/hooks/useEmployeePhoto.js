import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

// Foto profil karyawan (avatar bundar) - dipakai di header, My Team, Struktur Organisasi,
// dan tempat lain yg menampilkan avatar orang lain (diminta 2026-08-24). `self=true` pakai
// endpoint diri sendiri (getProfilePhoto, tidak perlu idKaryawan); selain itu pakai
// getEmployeePhoto(idKaryawan). Null saat belum ada foto - PEMANGGIL tetap render fallback
// inisial huruf spt sebelumnya, hook ini TIDAK menampilkan error (404 = wajar, belum upload).
export function useEmployeePhoto(idKaryawan, { self = false } = {}) {
  const [url, setUrl] = useState(null)
  const urlRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    setUrl(null)
    if (!self && !idKaryawan) return undefined

    const loader = self ? api.getProfilePhoto : () => api.getEmployeePhoto(idKaryawan)
    loader()
      .then((doc) => {
        if (cancelled) { URL.revokeObjectURL(doc.url); return }
        urlRef.current = doc.url
        setUrl(doc.url)
      })
      .catch(() => { /* belum ada foto - biarkan fallback inisial */ })

    return () => { cancelled = true }
  }, [idKaryawan, self])

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  return url
}
