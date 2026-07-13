import { FileWarning, Loader2, X } from 'lucide-react'
import './PdfPopupModal.css'

export default function PdfPopupModal({ open, onClose, title, loading, doc, error }) {
  if (!open) return null

  return (
    <div className="pdf-modal__overlay" onClick={onClose}>
      <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-modal__header">
          <h2>{title}</h2>
          <button type="button" className="pdf-modal__close" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="pdf-modal__body">
          {loading && (
            <div className="pdf-modal__state">
              <Loader2 size={22} className="pdf-modal__spinner" />
              <span>Memuat dokumen...</span>
            </div>
          )}

          {!loading && (error || !doc?.available) && (
            <div className="pdf-modal__state">
              <FileWarning size={22} />
              <span>{error || 'Dokumen belum tersedia. Hubungi HR/SDM.'}</span>
            </div>
          )}

          {!loading && !error && doc?.available && (
            <iframe title={title} src={doc.url} className="pdf-modal__frame" />
          )}
        </div>
      </div>
    </div>
  )
}
