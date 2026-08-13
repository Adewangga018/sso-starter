import { CheckCircle2, ChevronRight, FileCheck, FileWarning } from 'lucide-react'

// Single-document "berkas" card tile for employee documents
export default function BerkasFileRow({ label, available, onClick, uploadSlot }) {
  return (
    <div className={`profil__berkas-item${available ? ' is-available' : ' is-empty'}`}>
      <button
        type="button"
        className="profil__berkas-view"
        disabled={!available}
        onClick={onClick}
        title={available ? `Lihat ${label}` : `${label} belum diunggah`}
      >
        <div className={`profil__berkas-icon${available ? ' profil__berkas-icon--available' : ''}`}>
          {available ? <FileCheck size={20} /> : <FileWarning size={20} />}
        </div>

        <div className="profil__berkas-text">
          <div className="profil__berkas-label">{label}</div>
          <div className="profil__berkas-sub">
            {available ? (
              <span className="profil__berkas-badge profil__berkas-badge--ok">
                <CheckCircle2 size={12} /> Tersedia
              </span>
            ) : (
              <span className="profil__berkas-badge profil__berkas-badge--muted">
                Belum diunggah
              </span>
            )}
          </div>
        </div>

        {available && <ChevronRight size={16} className="profil__berkas-chevron" />}
      </button>

      {uploadSlot}
    </div>
  )
}
