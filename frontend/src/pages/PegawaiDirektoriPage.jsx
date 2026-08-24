import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, ChevronRight, FileWarning, ListChecks, Loader2, PieChart, Search, ShieldAlert, UserSquare2, Users,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useEmployeePhoto } from '../hooks/useEmployeePhoto'
import PdfPopupModal from '../components/PdfPopupModal'
import './PegawaiDirektoriPage.css'

const emptyModal = { open: false, title: '', loading: false, doc: null, error: '' }

function fmtTanggal(v) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

function ResultAvatar({ idKaryawan, nama }) {
  const photoUrl = useEmployeePhoto(idKaryawan)
  return (
    <span className="pgd__result-avatar">
      {photoUrl ? <img src={photoUrl} alt={nama} className="pgd__avatar-img" /> : (nama?.charAt(0)?.toUpperCase() ?? '?')}
    </span>
  )
}

export default function PegawaiDirektoriPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const [mode, setMode] = useState('semua') // 'semua' | 'belum-diplot'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const selectedPhotoUrl = useEmployeePhoto(selected?.idKaryawan)
  const [detailError, setDetailError] = useState('')
  const [modal, setModal] = useState(emptyModal)

  // Rekap "belum diplot" (semua jenis_pegawai, termasuk Kontrak, yg belum punya
  // penempatan grading) - diambil sekali per aktivasi mode, disaring di klien lewat
  // kotak cari yg sama (bukan lewat server spt mode "Semua").
  const [belumDiplotAll, setBelumDiplotAll] = useState(null)
  const [belumDiplotLoading, setBelumDiplotLoading] = useState(false)

  // Dashboard "Kelengkapan Profil" (biodata + dokumen dasar) SELURUH karyawan (diminta
  // 2026-08-24) - sama pola dgn belumDiplotAll: diambil sekali per aktivasi tab, disaring
  // di klien lewat kotak cari yg sama, diurutkan yg paling belum lengkap dulu.
  const [kelengkapan, setKelengkapan] = useState(null) // { totalKaryawan, sudahLengkap, belumBiodata, belumDokumen, items }
  const [kelengkapanLoading, setKelengkapanLoading] = useState(false)
  const [kelengkapanFilter, setKelengkapanFilter] = useState('belum') // 'belum' | 'semua'

  // Daftar default (100 pertama) langsung tampil begitu halaman dibuka - kotak cari
  // cuma menyaring lewat query >=2 huruf (sama pola dgn PayrollManualPage).
  useEffect(() => {
    if (mode !== 'semua') return
    const term = query.trim()
    setSearching(true)
    const t = setTimeout(() => {
      api.cariPegawaiDirektori(term)
        .then((rows) => setResults(rows))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, term ? 300 : 0)
    return () => clearTimeout(t)
  }, [mode, query])

  useEffect(() => {
    if (mode !== 'belum-diplot' || belumDiplotAll !== null) return
    setBelumDiplotLoading(true)
    api.getPegawaiBelumDiplot()
      .then((rows) => setBelumDiplotAll(rows))
      .catch(() => setBelumDiplotAll([]))
      .finally(() => setBelumDiplotLoading(false))
  }, [mode, belumDiplotAll])

  useEffect(() => {
    if (mode !== 'belum-diplot' || belumDiplotAll === null) return
    const term = query.trim().toLowerCase()
    setResults(term
      ? belumDiplotAll.filter((r) => r.nama.toLowerCase().includes(term) || r.idKaryawan.toLowerCase().includes(term))
      : belumDiplotAll)
  }, [mode, query, belumDiplotAll])

  useEffect(() => {
    if (mode !== 'kelengkapan' || kelengkapan !== null) return
    setKelengkapanLoading(true)
    api.getPegawaiKelengkapan()
      .then((rekap) => setKelengkapan(rekap))
      .catch(() => setKelengkapan({ totalKaryawan: 0, sudahLengkap: 0, belumBiodata: 0, belumDokumen: 0, items: [] }))
      .finally(() => setKelengkapanLoading(false))
  }, [mode, kelengkapan])

  useEffect(() => {
    if (mode !== 'kelengkapan' || kelengkapan === null) return
    const term = query.trim().toLowerCase()
    let list = kelengkapan.items
    if (kelengkapanFilter === 'belum') list = list.filter((r) => !r.biodataLengkap || !r.dokumenLengkap)
    if (term) list = list.filter((r) => r.nama.toLowerCase().includes(term) || r.idKaryawan.toLowerCase().includes(term))
    setResults([...list].sort((a, b) => a.persenKelengkapan - b.persenKelengkapan || a.nama.localeCompare(b.nama)))
  }, [mode, query, kelengkapan, kelengkapanFilter])

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
          <div className="pgd__tabs">
            <button type="button" className={`pgd__tab${mode === 'semua' ? ' is-active' : ''}`} onClick={() => { setMode('semua'); setSelected(null); setResults([]) }}>
              Semua
            </button>
            <button type="button" className={`pgd__tab${mode === 'belum-diplot' ? ' is-active' : ''}`} onClick={() => { setMode('belum-diplot'); setSelected(null); setResults([]) }}>
              <ListChecks size={13} /> Belum Diplot{belumDiplotAll !== null && ` (${belumDiplotAll.length})`}
            </button>
            <button type="button" className={`pgd__tab${mode === 'kelengkapan' ? ' is-active' : ''}`} onClick={() => { setMode('kelengkapan'); setSelected(null); setResults([]) }}>
              <PieChart size={13} /> Kelengkapan Profil
            </button>
          </div>

          {mode === 'belum-diplot' && (
            <p className="pgd__tab-note">
              Karyawan roster aktif (termasuk Kontrak) yang belum punya penempatan jabatan/grading - buat lacak progres onboarding bertahap.
            </p>
          )}

          {mode === 'kelengkapan' && kelengkapan && (
            <>
              <div className="pgd__kelengkapan-stats">
                <div className="pgd__kelengkapan-stat">
                  <span className="pgd__kelengkapan-stat-val">{kelengkapan.sudahLengkap}/{kelengkapan.totalKaryawan}</span>
                  <span className="pgd__kelengkapan-stat-label">Lengkap Penuh</span>
                </div>
                <div className="pgd__kelengkapan-stat pgd__kelengkapan-stat--warn">
                  <span className="pgd__kelengkapan-stat-val">{kelengkapan.belumBiodata}</span>
                  <span className="pgd__kelengkapan-stat-label">Belum Biodata</span>
                </div>
                <div className="pgd__kelengkapan-stat pgd__kelengkapan-stat--warn">
                  <span className="pgd__kelengkapan-stat-val">{kelengkapan.belumDokumen}</span>
                  <span className="pgd__kelengkapan-stat-label">Belum Dokumen</span>
                </div>
              </div>
              <div className="pgd__kelengkapan-toggle">
                <button type="button" className={kelengkapanFilter === 'belum' ? 'is-active' : ''} onClick={() => setKelengkapanFilter('belum')}>
                  Belum Lengkap
                </button>
                <button type="button" className={kelengkapanFilter === 'semua' ? 'is-active' : ''} onClick={() => setKelengkapanFilter('semua')}>
                  Semua Karyawan
                </button>
              </div>
            </>
          )}

          <div className="pgd__search">
            <Search size={15} />
            <input
              placeholder={mode === 'semua' ? 'Cari nama, NIK, atau ID karyawan… (opsional - daftar sudah tampil)' : 'Saring nama atau ID karyawan…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pgd__results">
            {(mode === 'belum-diplot' && belumDiplotLoading) || (mode === 'kelengkapan' && kelengkapanLoading) ? (
              <div className="pgd__empty"><Loader2 size={16} className="pgd__spin" /> Memuat…</div>
            ) : (
              <>
                {results.map((r) => (
                  <button
                    type="button" key={r.idPegawai}
                    className={`pgd__result${selected?.idPegawai === r.idPegawai ? ' is-active' : ''}`}
                    onClick={() => selectEmployee(r)}
                  >
                    <ResultAvatar idKaryawan={r.idKaryawan} nama={r.nama} />
                    <span className="pgd__result-text">
                      <span className="pgd__result-nama">{r.nama}</span>
                      <span className="pgd__result-sub">
                        {mode === 'semua' && <>{r.idKaryawan} · NIK {r.nik} · {r.statusKaryawan ?? '-'}</>}
                        {mode === 'belum-diplot' && <>{r.idKaryawan} · {r.jenisPegawai ?? r.statusKaryawan ?? '-'}{r.jabatanLegacy ? ` · ${r.jabatanLegacy}` : ''}</>}
                        {mode === 'kelengkapan' && (
                          <>{r.idKaryawan} · Kurang: {[...(r.biodataKurang ?? []), ...(r.dokumenKurang ?? [])].join(', ') || '-'}</>
                        )}
                      </span>
                    </span>
                    {mode === 'kelengkapan' && (
                      <span className={`pgd__kelengkapan-pill${r.persenKelengkapan >= 100 ? ' is-ok' : ''}`}>{r.persenKelengkapan}%</span>
                    )}
                  </button>
                ))}
                {results.length === 0 && (mode === 'semua' ? !searching : true) && (
                  <div className="pgd__empty">
                    {mode === 'belum-diplot' && 'Semua karyawan sudah punya penempatan grading.'}
                    {mode === 'kelengkapan' && (kelengkapanFilter === 'belum' ? 'Semua karyawan sudah lengkap.' : 'Tidak ada pegawai yang cocok.')}
                    {mode === 'semua' && 'Tidak ada pegawai yang cocok.'}
                  </div>
                )}
              </>
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
                <div className="pgd__ident-avatar">
                  {selectedPhotoUrl ? <img src={selectedPhotoUrl} alt={selected.namaLengkap} className="pgd__avatar-img" /> : (selected.namaLengkap?.charAt(0)?.toUpperCase() ?? '?')}
                </div>
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
