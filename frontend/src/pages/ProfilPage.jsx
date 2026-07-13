import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronRight, FileWarning, Users } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import PdfPopupModal from '../components/PdfPopupModal'
import './ProfilPage.css'

function formatTanggal(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function InfoRow({ label, value, children }) {
  return (
    <div className="info-row">
      <div className="info-row__label">{label}</div>
      <div className="info-row__value">{children ?? value ?? '-'}</div>
    </div>
  )
}

const emptyModal = { open: false, key: '', title: '', loading: false, doc: null, error: '' }

export default function ProfilPage() {
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState(emptyModal)

  useEffect(() => {
    let cancelled = false
    api
      .getPersonalProfile()
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat data profil.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function openDocumentModal(key, title) {
    setModal({ open: true, key, title, loading: true, doc: null, error: '' })
    try {
      const doc = await api.getDocument(key)
      setModal((m) => ({ ...m, loading: false, doc }))
    } catch (err) {
      setModal((m) => ({ ...m, loading: false, error: err instanceof ApiError ? err.message : 'Gagal memuat dokumen.' }))
    }
  }

  async function openAktaModal(anak) {
    setModal({ open: true, key: 'akta', title: `Akta Kelahiran - ${anak.nama ?? 'Anak'}`, loading: true, doc: null, error: '' })
    try {
      const doc = await api.getAktaAnak(anak.id)
      setModal((m) => ({ ...m, loading: false, doc }))
    } catch (err) {
      setModal((m) => ({ ...m, loading: false, error: err instanceof ApiError ? err.message : 'Gagal memuat dokumen.' }))
    }
  }

  function closeModal() {
    setModal(emptyModal)
  }

  if (loadError) {
    return <div className="profil__empty">{loadError}</div>
  }

  if (!profile) {
    return <div className="profil__empty">Memuat data profil...</div>
  }

  return (
    <div className="profil">
      <div className="profil__header">
        <div className="profil__avatar">{profile.namaLengkap?.charAt(0)?.toUpperCase() ?? '?'}</div>
        <div className="profil__header-text">
          <h2>{profile.namaLengkap}</h2>
          <div className="profil__jabatan">{profile.jabatan ?? 'Jabatan belum tersedia'}</div>
          <span className={`profil__status-pill${profile.isActive ? '' : ' profil__status-pill--inactive'}`}>
            {profile.isActive ? 'Karyawan Aktif' : 'Karyawan Nonaktif'}
          </span>
        </div>
        <button type="button" className="profil__edit-btn" disabled title="Segera hadir">
          Edit Profil
        </button>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Informasi Pribadi</div>
        <div className="profil__grid">
          <InfoRow label="ID Pegawai" value={profile.idPegawai} />
          <InfoRow label="ID Karyawan" value={profile.idKaryawan} />
          <InfoRow label="Nama Lengkap" value={profile.namaLengkap} />
          <InfoRow label="NIK" value={profile.nik} />
          <InfoRow label="Status Karyawan" value={profile.statusKaryawan} />
          <InfoRow label="Jabatan" value={profile.jabatan} />
          <InfoRow label="Tempat Lahir" value={profile.tempatLahir} />
          <InfoRow label="Tanggal Lahir" value={formatTanggal(profile.tglLahir)} />
          <InfoRow label="Jenis Kelamin" value={profile.jenisKelamin} />
          <InfoRow label="Agama" value={profile.agama} />
          <InfoRow label="Pendidikan" value={profile.pendidikan} />
          <InfoRow label="Status Pernikahan">
            {profile.isMarried ? (
              <button type="button" className="profil__link" onClick={() => openDocumentModal('kk', 'Kartu Keluarga')}>
                {profile.statusNikah}
              </button>
            ) : (
              profile.statusNikah ?? '-'
            )}
          </InfoRow>
          <InfoRow label="Terdaftar Sejak" value={formatTanggal(profile.terdaftarSejak)} />
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Kontak &amp; Alamat</div>
        <div className="profil__grid">
          <InfoRow label="No. HP" value={profile.noHp} />
          <InfoRow label="Email" value={profile.email} />
          <InfoRow label="Alamat" value={profile.alamat?.alamat} />
          <InfoRow label="RT" value={profile.alamat?.rt} />
          <InfoRow label="RW" value={profile.alamat?.rw} />
          <InfoRow label="Desa" value={profile.alamat?.desa} />
          <InfoRow label="Kecamatan" value={profile.alamat?.kecamatan} />
          <InfoRow label="Kabupaten" value={profile.alamat?.kabupaten} />
          <InfoRow label="Provinsi" value={profile.alamat?.provinsi} />
          <InfoRow label="Kode Pos" value={profile.alamat?.kodePos} />
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Kesehatan &amp; Darurat</div>
        <div className="profil__grid">
          <InfoRow label="Riwayat Kesehatan" value={profile.riwayatKesehatan} />
          <InfoRow label="Nama Kontak Darurat" value={profile.namaDarurat} />
          <InfoRow label="No. HP Darurat" value={profile.hpDarurat} />
        </div>
      </div>

      {profile.isMarried && profile.pasangan && (
        <div className="profil__card">
          <div className="profil__section-title">Data Pasangan</div>
          <div className="profil__grid">
            <InfoRow label="Nama Pasangan" value={profile.pasangan.nama} />
            <InfoRow label="Tempat Lahir" value={profile.pasangan.tempatLahir} />
            <InfoRow label="Tanggal Lahir" value={formatTanggal(profile.pasangan.tglLahir)} />
            <InfoRow label="Buku Nikah">
              <button type="button" className="profil__link" onClick={() => openDocumentModal('buku-nikah', 'Buku Nikah')}>
                Lihat Buku Nikah
              </button>
            </InfoRow>
          </div>
        </div>
      )}

      <div className="profil__card">
        <div className="profil__section-title">Berkas Pribadi</div>
        <div className="profil__berkas-list">
          {profile.berkas.map((b) => (
            <button
              type="button"
              className="profil__berkas-item"
              key={b.key}
              onClick={() => openDocumentModal(b.key, b.label)}
            >
              {b.available ? (
                <CheckCircle2 size={18} className="profil__berkas-icon profil__berkas-icon--available" />
              ) : (
                <FileWarning size={18} className="profil__berkas-icon" />
              )}
              <div className="profil__berkas-text">
                <div className="profil__berkas-label">{b.label}</div>
                <div className="profil__berkas-sub">{b.available ? 'Tersedia' : 'Belum tersedia'}</div>
              </div>
              <ChevronRight size={16} className="profil__anak-chevron" />
            </button>
          ))}
        </div>
      </div>

      <PdfPopupModal
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        loading={modal.loading}
        doc={modal.doc}
        error={modal.error}
        // Children belong to the family card, so their akta are reachable from inside the
        // Kartu Keluarga popup rather than from a section of their own on the page.
        footer={
          modal.key === 'kk' ? (
            <div className="profil__anak-panel">
              <div className="profil__anak-panel-title">Data Anak</div>
              {profile.anak.length === 0 ? (
                <div className="profil__empty-inline">Belum ada data anak.</div>
              ) : (
                <div className="profil__anak-list">
                  {profile.anak.map((anak) => (
                    <button type="button" className="profil__anak-item" key={anak.id} onClick={() => openAktaModal(anak)}>
                      <div className="profil__anak-icon">
                        <Users size={16} />
                      </div>
                      <div className="profil__anak-text">
                        <div className="profil__anak-name">{anak.nama ?? `Anak ke-${anak.urutan}`}</div>
                        <div className="profil__anak-sub">
                          {anak.tempatLahir ?? '-'}, {formatTanggal(anak.tglLahir)}
                        </div>
                      </div>
                      <div className="profil__anak-akta">
                        <ChevronRight size={16} className="profil__anak-chevron" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null
        }
      />
    </div>
  )
}
