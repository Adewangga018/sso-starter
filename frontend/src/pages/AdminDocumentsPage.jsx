import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronRight, FileWarning, FolderLock, Search, Users } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import PdfPopupModal from '../components/PdfPopupModal'
import './AdminDocumentsPage.css'

const emptyModal = { open: false, title: '', loading: false, doc: null, error: '' }

export default function AdminDocumentsPage() {
  const { isAdmin } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null) // manifest of the chosen employee
  const [manifestError, setManifestError] = useState('')
  const [modal, setModal] = useState(emptyModal)

  // Debounced employee search: only query once the user pauses typing (>= 2 chars).
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const rows = await api.searchEmployees(term)
        if (!cancelled) setResults(rows)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  async function selectEmployee(row) {
    setResults([])
    setQuery(row.nama)
    setManifestError('')
    setSelected(null)
    try {
      setSelected(await api.getEmployeeDocuments(row.idPegawai))
    } catch (err) {
      setManifestError(err instanceof ApiError ? err.message : 'Gagal memuat dokumen pegawai.')
    }
  }

  function revokeCurrentDoc() {
    setModal((m) => {
      if (m.doc?.url) URL.revokeObjectURL(m.doc.url)
      return m
    })
  }

  async function openDoc(title, loader) {
    revokeCurrentDoc()
    setModal({ open: true, title, loading: true, doc: null, error: '' })
    try {
      const doc = await loader()
      setModal((m) => ({ ...m, loading: false, doc }))
    } catch (err) {
      setModal((m) => ({ ...m, loading: false, error: err instanceof ApiError ? err.message : 'Gagal memuat dokumen.' }))
    }
  }

  function closeModal() {
    if (modal.doc?.url) URL.revokeObjectURL(modal.doc.url)
    setModal(emptyModal)
  }

  if (!isAdmin) {
    return <div className="admin-docs"><p className="admin-docs__forbidden">Akses ditolak. Hanya Admin.</p></div>
  }

  return (
    <div className="admin-docs">
      <div className="admin-docs__head">
        <Link to="/dashboard" className="admin-docs__back"><ArrowLeft size={16} /> Dashboard</Link>
        <h1><FolderLock size={20} /> Dokumen Karyawan</h1>
      </div>

      <div className="admin-docs__search">
        <Search size={16} className="admin-docs__search-icon" />
        <input
          placeholder="Cari nama, NIK, atau ID karyawan..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <span className="admin-docs__search-hint">Mencari...</span>}
      </div>

      {results.length > 0 && (
        <ul className="admin-docs__results">
          {results.map((r) => (
            <li key={r.idPegawai}>
              <button type="button" onClick={() => selectEmployee(r)}>
                <div className="admin-docs__result-name">{r.nama}</div>
                <div className="admin-docs__result-sub">
                  {r.idKaryawan} · NIK {r.nik} · {r.statusKaryawan ?? '-'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {manifestError && <div className="admin-docs__error">{manifestError}</div>}

      {selected && (
        <div className="admin-docs__panel">
          <div className="admin-docs__emp">
            <div className="admin-docs__emp-avatar">{selected.nama?.charAt(0)?.toUpperCase() ?? '?'}</div>
            <div>
              <div className="admin-docs__emp-name">{selected.nama}</div>
              <div className="admin-docs__emp-sub">
                {selected.idKaryawan} · NIK {selected.nik} · {selected.statusKaryawan ?? '-'}
              </div>
            </div>
          </div>

          <div className="admin-docs__section-title">Berkas</div>
          <div className="admin-docs__list">
            {selected.berkas.map((b) => (
              <button
                type="button"
                className="admin-docs__item"
                key={b.key}
                disabled={!b.available}
                onClick={() => openDoc(b.label, () => api.getEmployeeDocument(selected.idPegawai, b.key))}
              >
                {b.available ? (
                  <CheckCircle2 size={18} className="admin-docs__icon admin-docs__icon--ok" />
                ) : (
                  <FileWarning size={18} className="admin-docs__icon" />
                )}
                <div className="admin-docs__item-text">
                  <div className="admin-docs__item-label">{b.label}</div>
                  <div className="admin-docs__item-sub">{b.available ? 'Tersedia' : 'Belum tersedia'}</div>
                </div>
                {b.available && <ChevronRight size={16} className="admin-docs__chevron" />}
              </button>
            ))}
          </div>

          {selected.anak.length > 0 && (
            <>
              <div className="admin-docs__section-title">Akta Anak</div>
              <div className="admin-docs__list">
                {selected.anak.map((a) => (
                  <button
                    type="button"
                    className="admin-docs__item"
                    key={a.id}
                    disabled={!a.aktaAvailable}
                    onClick={() =>
                      openDoc(`Akta - ${a.nama ?? `Anak ke-${a.urutan}`}`, () =>
                        api.getEmployeeAktaAnak(selected.idPegawai, a.id),
                      )
                    }
                  >
                    <Users size={18} className={`admin-docs__icon${a.aktaAvailable ? ' admin-docs__icon--ok' : ''}`} />
                    <div className="admin-docs__item-text">
                      <div className="admin-docs__item-label">{a.nama ?? `Anak ke-${a.urutan}`}</div>
                      <div className="admin-docs__item-sub">{a.aktaAvailable ? 'Akta tersedia' : 'Belum tersedia'}</div>
                    </div>
                    {a.aktaAvailable && <ChevronRight size={16} className="admin-docs__chevron" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <PdfPopupModal
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        loading={modal.loading}
        doc={modal.doc}
        error={modal.error}
      />
    </div>
  )
}
