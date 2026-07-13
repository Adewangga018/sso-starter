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

const emptyModal = { open: false, title: '', loading: false, doc: null, error: '' }

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
    setModal({ open: true, title, loading: true, doc: null, error: '' })
    try {
      const doc = await api.getDocument(key)
      setModal((m) => ({ ...m, loading: false, doc }))
    } catch (err) {
      setModal((m) => ({ ...m, loading: false, error: err instanceof ApiError ? err.message : 'Gagal memuat dokumen.' }))
    }
  }

  async function openAktaModal(anak) {
    setModal({ open: true, title: `Akta Kelahiran - ${anak.nama ?? 'Anak'}`, loading: true, doc: null, error: '' })
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
          <InfoRow label="ID_PEGAWAI" value={profile.idPegawai} />
          <InfoRow label="ID_KARYAWAN" value={profile.idKaryawan} />
          <InfoRow label="NAMA_LENGKAP" value={profile.namaLengkap} />
          <InfoRow label="NIK" value={profile.nik} />
          <InfoRow label="STATUS_KARYAWAN" value={profile.statusKaryawan} />
          <InfoRow label="TEMPAT_LAHIR" value={profile.tempatLahir} />
          <InfoRow label="TGL_LAHIR" value={formatTanggal(profile.tglLahir)} />
          <InfoRow label="JENIS_KELAMIN" value={profile.jenisKelamin} />
          <InfoRow label="AGAMA" value={profile.agama} />
          <InfoRow label="PENDIDIKAN" value={profile.pendidikan} />
          <InfoRow label="STATUS PERNIKAHAN">
            {profile.isMarried ? (
              <button type="button" className="profil__link" onClick={() => openDocumentModal('kk', 'Kartu Keluarga')}>
                {profile.statusNikah}
              </button>
            ) : (
              profile.statusNikah ?? '-'
            )}
          </InfoRow>
          <InfoRow label="TERDAFTAR_SEJAK" value={formatTanggal(profile.terdaftarSejak)} />
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Kontak &amp; Alamat</div>
        <div className="profil__grid">
          <InfoRow label="NO_HP" value={profile.noHp} />
          <InfoRow label="EMAIL" value={profile.email} />
          <InfoRow label="ALAMAT" value={profile.alamat?.alamat} />
          <InfoRow label="RT" value={profile.alamat?.rt} />
          <InfoRow label="RW" value={profile.alamat?.rw} />
          <InfoRow label="DESA" value={profile.alamat?.desa} />
          <InfoRow label="KECAMATAN" value={profile.alamat?.kecamatan} />
          <InfoRow label="KABUPATEN" value={profile.alamat?.kabupaten} />
          <InfoRow label="PROVINSI" value={profile.alamat?.provinsi} />
          <InfoRow label="KODE_POS" value={profile.alamat?.kodePos} />
        </div>
      </div>

      <div className="profil__card">
        <div className="profil__section-title">Kesehatan &amp; Darurat</div>
        <div className="profil__grid">
          <InfoRow label="RIWAYAT_KESEHATAN" value={profile.riwayatKesehatan} />
          <InfoRow label="NAMA_DARURAT" value={profile.namaDarurat} />
          <InfoRow label="HP_DARURAT" value={profile.hpDarurat} />
        </div>
      </div>

      {profile.isMarried && profile.pasangan && (
        <div className="profil__card">
          <div className="profil__section-title">Data Pasangan</div>
          <div className="profil__grid">
            <InfoRow label="NAMA_PASANGAN" value={profile.pasangan.nama} />
            <InfoRow label="TEMPAT_LAHIR_PASANGAN" value={profile.pasangan.tempatLahir} />
            <InfoRow label="TGL_LAHIR_PASANGAN" value={formatTanggal(profile.pasangan.tglLahir)} />
            <InfoRow label="BUKU_NIKAH">
              <button type="button" className="profil__link" onClick={() => openDocumentModal('buku-nikah', 'Buku Nikah')}>
                Lihat Buku Nikah
              </button>
            </InfoRow>
          </div>
        </div>
      )}

      <div className="profil__card">
        <div className="profil__section-title">Data Anak {profile.jumlahAnak != null && `(${profile.jumlahAnak})`}</div>
        {profile.anak.length === 0 && <div className="profil__empty-inline">Belum ada data anak.</div>}
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
      </div>

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
      />
    </div>
  )
}
