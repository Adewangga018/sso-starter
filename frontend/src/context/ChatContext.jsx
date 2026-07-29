import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { api, isEmptyDataError } from '../lib/api'
import ChatPanel from '../components/ChatPanel'

const ChatContext = createContext(null)

// Aman dipanggil walau di luar provider (mis. TopBar pada halaman tanpa chat).
export function useChat() {
  return useContext(ChatContext) ?? { open: false, toggle: () => {}, unread: 0 }
}

// Provider chat global: menyimpan kotak masuk coaching + status buka panel, dan
// menyediakan badge "belum dibaca" untuk ikon di topbar. Panel geser dirender di
// sini sekali saja sehingga tersedia di semua modul.
export function ChatProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [inbox, setInbox] = useState({ sesi: [], ruang: [] })

  const refreshInbox = useCallback(async () => {
    try { setInbox(await api.getCoachingInbox()) }
    catch (err) { if (isEmptyDataError(err)) setInbox({ sesi: [], ruang: [] }) }
  }, [])

  // Polling ringan untuk badge, hanya saat sudah login.
  useEffect(() => {
    if (!isAuthenticated) { setInbox({ sesi: [], ruang: [] }); setOpen(false); return }
    refreshInbox()
    const t = setInterval(refreshInbox, 25000)
    return () => clearInterval(t)
  }, [isAuthenticated, refreshInbox])

  const unread =
    (inbox.sesi ?? []).filter((s) => s.belumDibaca).length +
    (inbox.ruang ?? []).filter((r) => r.belumDibaca).length

  const value = {
    open,
    setOpen,
    toggle: useCallback(() => setOpen((o) => !o), []),
    unread,
    inbox,
    refreshInbox,
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
      {isAuthenticated && <ChatPanel />}
    </ChatContext.Provider>
  )
}
