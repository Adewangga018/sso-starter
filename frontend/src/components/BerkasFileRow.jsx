import { CheckCircle2, ChevronRight, FileWarning } from 'lucide-react'

// Single-document "berkas" row: same look as an item in the "Berkas Pribadi" grid, reused
// wherever a document stands alone (Kartu Keluarga, Buku Nikah, akta anak) instead of living
// in that grid. `uploadSlot` renders whatever upload control the caller needs (or nothing, for
// a view-only file) to the right of the view button.
export default function BerkasFileRow({ label, available, onClick, uploadSlot }) {
  return (
    <div className="profil__berkas-item">
      <button type="button" className="profil__berkas-view" disabled={!available} onClick={onClick}>
        {available ? (
          <CheckCircle2 size={18} className="profil__berkas-icon profil__berkas-icon--available" />
        ) : (
          <FileWarning size={18} className="profil__berkas-icon" />
        )}
        <div className="profil__berkas-text">
          <div className="profil__berkas-label">{label}</div>
          <div className="profil__berkas-sub">{available ? 'Tersedia · klik untuk lihat' : 'Belum tersedia'}</div>
        </div>
        {available && <ChevronRight size={16} className="profil__anak-chevron" />}
      </button>
      {uploadSlot}
    </div>
  )
}
