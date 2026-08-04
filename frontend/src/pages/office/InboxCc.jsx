import Inbox from './Inbox'

// Menu "Inbox CC Otomatis" (mengikuti DOF): tampilannya sama persis dengan Kotak Masuk —
// lima tab berbadge, pencarian, pengurutan kolom, dan penomoran halaman — hanya isinya
// yang dibatasi ke surat yang saya terima sebagai TEMBUSAN (surat_distribusi.tipe = 'CC').
// Karena itu tidak ada salinan komponen di sini, cukup Inbox dengan cc=true.
export default function InboxCc() {
  return (
    <Inbox
      cc
      judul="Inbox CC Otomatis"
      subjudul="Surat yang ditembuskan (CC) kepada Anda secara otomatis."
    />
  )
}
