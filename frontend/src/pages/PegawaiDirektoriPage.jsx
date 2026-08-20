import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, ChevronRight, FileWarning, Search, ShieldAlert, UserSquare2, Users,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import PdfPopupModal from '../components/PdfPopupModal'
import './PegawaiDirektoriPage.css'

const emptyModal = { open: false, title: '', loading: false, doc: null, error: '' }

function fmtTanggal(v) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PegawaiDirektoriPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [modal, setModal] = useState(emptyModal)

  // Daftar default (100 pertama) langsung tampil begitu halaman dibuka - kotak cari
  // cuma menyaring lewat query >=2 huruf (sama pola dgn PayrollManualPage).
  useEffect(() => {
    const term = query.trim()
    setSearching(true)
    const t = setTimeout(() => {
      api.cariPegawaiDirektori(term)
        .then((rows) => setResults(rows))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, term ? 300 : 0)
    return () => clearTimeout(t)
  }, [query])

  async function selectEmployee(row) {
    setDetailError('')
    setSelected(null)
    try {
      setSelected(await api.getPegawaiDirektoriDetail(row.idPegawai))
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Gagal memuat data pegawai.')
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

  if (!isAdminModulSdm) {
    return (
      <div className="pgd">
        <div className="pgd__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Data Karyawan hanya untuk Admin Modul SDM (Kepala Bagian SDM ke atas hingga GM SKP).</p>
          <Link to="/dashboard" className="pgd__back"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pgd">
      <div className="pgd__top">
        <Link to="/dashboard" className="pgd__back"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="pgd__role">Admin Modul SDM{summary?.nama ? <> · <span className="u-nama">{summary.nama}</span></> : ''}</span>
      </div>

      <div className="pgd__head">
        <h2 className="pgd__title"><UserSquare2 size={20} /> Data Karyawan</h2>
        <p className="pgd__sub">Seluruh data biodata karyawan (semua status kepegawaian) beserta berkas yang sudah diunggah.</p>
      </div>

      <div className="pgd__layout">
        <div className="pgd__list-panel">
          <div className="pgd__search">
            <Search size={15} />
            <input
              placeholder="Cari nama, NIK, atau ID karyawan… (opsional - daftar sudah tampil)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pgd__results">
            {results.map((r) => (
              <button
                type="button" key={r.idPegawai}
                className={`pgd__result${selected?.idPegawai === r.idPegawai ? ' is-active' : ''}`}
                onClick={() => selectEmployee(r)}
              >
                <span className="pgd__result-avatar">{r.nama?.charAt(0)?.toUpperCase() ?? '?'}</span>
                <span className="pgd__result-text">
                  <span className="pgd__result-nama">{r.nama}</span>
                  <span className="pgd__result-sub">{r.idKaryawan} · NIK {r.nik} · {r.statusKaryawan ?? '-'}</span>
                </span>
              </button>
            ))}
            {!searching && results.length === 0 && (
              <div className="pgd__empty">Tidak ada pegawai yang cocok.</div>
            )}
          </div>
        </div>

        <div className="pgd__detail-panel">
          {detailError && <div className="pgd__alert">{detailError}</div>}

          {!selected ? (
            <div className="pgd__placeholder">Pilih pegawai dari daftar untuk melihat data lengkapnya.</div>
          ) : (
            <>
              <div className="pgd__ident">
                <div className="pgd__ident-avatar">{selected.namaLengkap?.charAt(0)?.toUpperCase() ?? '?'}</div>
                <div>
                  <div className="pgd__ident-nama">{selected.namaLengkap}</div>
                  <div className="pgd__ident-sub">
                    {selected.idKaryawan} · NIK {selected.nik}
                    {selected.jabatan && <> · {selected.jabatan}</>}
                    {selected.unit && <> · {selected.unit}</>}
                  </div>
                </div>
                <span className="pgd__ident-status">{selected.statusKaryawan ?? '-'}</span>
              </div>

              {selected.band == null && (
                <div className="pgd__alert pgd__alert--warn">
                  <ShieldAlert size={15} style={{ verticalAlign: -2, marginRight: 4 }} />
                  Belum ditempatkan di sistem grading (tidak ada baris aktif di Struktur Organisasi &gt; Penempatan Karyawan).
                  {selected.jabatan && <> Jabatan "{selected.jabatan}" di atas cuma teks lama dari data SDM, bukan posisi struktural.</>}
                  {' '}Akibatnya komponen gaji berbasis Band/JG (Gaji Pokok, Tunjangan Jabatan, Lembur, dst) tidak bisa dihitung untuknya di Payroll.{' '}
                  <Link to="/org/penempatan" style={{ fontWeight: 700 }}>Buka Penempatan Karyawan →</Link>
                </div>
              )}

              <div className="pgd__grid">
                <div className="pgd__field"><span>Tempat, Tgl Lahir</span><b>{selected.tempatLahir ?? '-'}, {fmtTanggal(selected.tglLahir)}</b></div>
                <div className="pgd__field"><span>Jenis Kelamin</span><b>{selected.jenisKelamin ?? '-'}</b></div>
                <div className="pgd__field"><span>Agama</span><b>{selected.agama ?? '-'}</b></div>
                <div className="pgd__field"><span>Pendidikan</span><b>{selected.pendidikan ?? '-'}</b></div>
                <div className="pgd__field"><span>No. HP</span><b>{selected.noHp ?? '-'}</b></div>
                <div className="pgd__field"><span>Email</span><b>{selected.email ?? '-'}</b></div>
                <div className="pgd__field"><span>Tanggal Masuk Kerja</span><b>{fmtTanggal(selected.tanggalMasukKerja)}</b></div>
                <div className="pgd__field"><span>Terdaftar di MyGCS</span><b>{fmtTanggal(selected.terdaftarSejak)}</b></div>
                {selected.band != null && <div className="pgd__field"><span>Band / Tingkatan</span><b>{selected.band} · {selected.tingkatan ?? '-'}</b></div>}
                <div className="pgd__field pgd__field--wide">
                  <span>Alamat</span>
                  <b>
                    {[selected.alamat?.alamat, selected.alamat?.rt && `RT ${selected.alamat.rt}`, selected.alamat?.rw && `RW ${selected.alamat.rw}`, selected.alamat?.desa, selected.alamat?.kecamatan, selected.alamat?.kabupaten, selected.alamat?.provinsi, selected.alamat?.kodePos]
                      .filter(Boolean).join(', ') || '-'}
                  </b>
                </div>
                <div className="pgd__field"><span>Status Nikah</span><b>{selected.statusNikah ?? '-'}</b></div>
                {selected.isMarried && selected.pasangan && (
                  <div className="pgd__field"><span>Pasangan</span><b>{selected.pasangan.nama ?? '-'}</b></div>
                )}
                <div className="pgd__field"><span>Kontak Darurat</span><b>{selected.namaDarurat ?? '-'}{selected.hpDarurat ? ` · ${selected.hpDarurat}` : ''}</b></div>
                <div className="pgd__field pgd__field--wide"><span>Riwayat Kesehatan</span><b>{selected.riwayatKesehatan ?? '-'}</b></div>
              </div>

              <div className="pgd__section-title">Berkas Pribadi</div>
              <div className="pgd__doc-list">
                {selected.berkas.map((b) => (
                  <button
                    type="button" className="pgd__doc-item" key={b.key}
                    disabled={!b.available}
                    onClick={() => openDoc(b.label, () => api.getPegawaiDirektoriFile(selected.idPegawai, b.key))}
                  >
                    {b.available ? (
                      <CheckCircle2 size={18} className="pgd__doc-icon pgd__doc-icon--ok" />
                    ) : (
                      <FileWarning size={18} className="pgd__doc-icon" />
                    )}
                    <div className="pgd__doc-text">
                      <div className="pgd__doc-label">{b.label}</div>
                      <div className="pgd__doc-sub">{b.available ? 'Tersedia' : 'Belum tersedia'}</div>
                    </div>
                    {b.available && <ChevronRight size={16} className="pgd__doc-chevron" />}
                  </button>
                ))}
              </div>

              {selected.anak.length > 0 && (
                <>
                  <div className="pgd__section-title">Data Anak &amp; Akta</div>
                  <div className="pgd__doc-list">
                    {selected.anak.map((a) => (
                      <button
                        type="button" className="pgd__doc-item" key={a.id}
                        disabled={!a.hasAkta}
                        onClick={() => openDoc(`Akta - ${a.nama ?? `Anak ke-${a.urutan}`}`, () => api.getPegawaiDirektoriAktaAnak(selected.idPegawai, a.id))}
                      >
                        <Users size={18} className={`pgd__doc-icon${a.hasAkta ? ' pgd__doc-icon--ok' : ''}`} />
                        <div className="pgd__doc-text">
                          <div className="pgd__doc-label">{a.nama ?? `Anak ke-${a.urutan}`}</div>
                          <div className="pgd__doc-sub">{a.hasAkta ? 'Akta tersedia' : 'Belum tersedia'}</div>
                        </div>
                        {a.hasAkta && <ChevronRight size={16} className="pgd__doc-chevron" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

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
