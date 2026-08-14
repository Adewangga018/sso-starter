import { userManager } from './auth'

// Same-origin in both dev (Vite proxy) and prod (subfolder). Override only if the
// backend is ever hosted on a different host.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// The list endpoints answer 404 when the signed-in account cannot be matched to an
// employee record. The pages treat that as "no rows" and render an empty table rather
// than an error banner. Only 404 is swallowed - a 500 or a network failure still surfaces,
// so a genuinely broken backend never masquerades as an empty list.
export function isEmptyDataError(err) {
  return err instanceof ApiError && err.status === 404
}

async function apiFetch(path, options = {}) {
  const user = await userManager.getUser()
  const headers = { ...(options.headers || {}) }
  // Only JSON bodies get the header. A FormData body must be left alone so the browser can
  // set multipart/form-data with its own boundary - overriding it breaks the upload.
  if (typeof options.body === 'string') headers['Content-Type'] = 'application/json'
  if (user && !user.expired) headers.Authorization = `Bearer ${user.access_token}`

  // credentials:'include' so cookie-based endpoints (login, 2FA step) send/receive
  // the Identity session cookie; same-origin so no CORS concern.
  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', ...options, headers })
  } catch {
    // fetch() itself throws (not an HTTP response) when the connection is dropped mid-upload -
    // mis. server/proxy menolak body yang kelewat besar sebelum sempat balas JSON. Tanpa ini,
    // pemakai cuma lihat "TypeError: Failed to fetch" / "NetworkError" mentah dari browser.
    throw new ApiError(0, 'Gagal terhubung ke server. Kalau ini terjadi saat unggah berkas, coba periksa ukuran berkasnya lalu ulangi.')
  }

  if (!res.ok) {
    let message = `Terjadi kesalahan (${res.status}).`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // response has no JSON body, keep default message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return null
  return res.json()
}

const post = (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

// Fetches a binary document (KTP/KK/ijazah, etc.) as a blob and returns an object URL the
// viewer can point an <iframe> at. An <iframe src> can't carry an Authorization header, so we
// fetch with the Bearer token here and hand back a blob: URL instead. The caller MUST call
// URL.revokeObjectURL(url) when done to free the blob. Throws ApiError on failure (e.g. 404
// when the document isn't available), so callers can show a friendly message.
async function apiBlob(path) {
  const user = await userManager.getUser()
  const headers = {}
  if (user && !user.expired) headers.Authorization = `Bearer ${user.access_token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers })
  if (!res.ok) {
    let message = `Terjadi kesalahan (${res.status}).`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // response has no JSON body, keep default message
    }
    throw new ApiError(res.status, message)
  }

  const blob = await res.blob()
  return { url: URL.createObjectURL(blob), contentType: blob.type }
}

// Fetches a file and triggers a browser "Save as" using the server-provided filename
// (from Content-Disposition). Like apiBlob it carries the Bearer token, which a plain
// <a href> download can't. Throws ApiError on failure so callers can show a message.
async function apiDownload(path, fallbackName = 'download') {
  const user = await userManager.getUser()
  const headers = {}
  if (user && !user.expired) headers.Authorization = `Bearer ${user.access_token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers })
  if (!res.ok) {
    let message = `Terjadi kesalahan (${res.status}).`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // no JSON body, keep default message
    }
    throw new ApiError(res.status, message)
  }

  // Parse filename from Content-Disposition (filename*=UTF-8''… or filename="…").
  let name = fallbackName
  const cd = res.headers.get('Content-Disposition') || ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)
  const plain = /filename="?([^";]+)"?/i.exec(cd)
  if (star) name = decodeURIComponent(star[1])
  else if (plain) name = plain[1]

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  // dashboard / personal (Bearer)
  getDashboardSummary: () => apiFetch('/api/dashboard/summary'),
  // My Team (Bearer): struktur tim + kehadiran. semua=true -> seluruh tingkat bawahan.
  getMyTeam: (semua) => apiFetch(`/api/team${semua ? '?semua=true' : ''}`),
  beriTugas: (payload) => apiFetch('/api/team/tugas', { method: 'POST', body: JSON.stringify(payload) }),
  ubahStatusTugas: (id, status) =>
    apiFetch(`/api/team/tugas/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  hapusTugas: (id) => apiFetch(`/api/team/tugas/${id}`, { method: 'DELETE' }),
  // Rekap Tim (monitoring operasional: kehadiran + produktivitas tugas).
  getRekapTim: () => apiFetch('/api/team/rekap'),
  // Unduh laporan tim (CSV) — mencakup seluruh level bawahan. Nama file dari server.
  unduhLaporanTim: () => apiDownload('/api/team/laporan', 'Laporan-Tim.csv'),

  // My Office (persuratan)
  cariPegawaiOffice: (q) => apiFetch(`/api/office/pegawai?q=${encodeURIComponent(q ?? '')}`),
  // Statistik dashboard My Office; tahun opsional (default: tahun terbaru yang ada datanya).
  getOfficeDashboard: (tahun) => apiFetch(`/api/office/dashboard${tahun ? `?tahun=${tahun}` : ''}`),
  // Master kode surat (jenis/bagian/klasifikasi) + tebakan bagian pembuat.
  getReferensiOffice: () => apiFetch('/api/office/referensi'),
  getDaftarSurat: (status) => apiFetch(`/api/office/surat${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getSuratDetail: (id) => apiFetch(`/api/office/surat/${id}`),
  buatSurat: (payload) => apiFetch('/api/office/surat', { method: 'POST', body: JSON.stringify(payload) }),
  kirimSurat: (id) => apiFetch(`/api/office/surat/${id}/kirim`, { method: 'POST' }),
  batalSurat: (id) => apiFetch(`/api/office/surat/${id}/batal`, { method: 'POST' }),
  // tab: belum-dibaca | dibaca | dalam-proses | selesai | dibatalkan
  getInboxOffice: (tab) => apiFetch(`/api/office/inbox${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`),
  // Inbox CC Otomatis: bentuk balasan sama, isinya hanya surat tembusan (tipe CC).
  getInboxCcOffice: (tab) => apiFetch(`/api/office/inbox-cc${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`),
  // Notifikasi persuratan. filter: all | read | unread
  getNotifikasiOffice: (filter) =>
    apiFetch(`/api/office/notifikasi${filter ? `?filter=${encodeURIComponent(filter)}` : ''}`),
  bacaNotifikasiOffice: (id) => apiFetch(`/api/office/notifikasi/${id}/baca`, { method: 'POST' }),
  bacaSemuaNotifikasiOffice: () => apiFetch('/api/office/notifikasi/baca-semua', { method: 'POST' }),
  // Angka badge sidebar My Office (inbox belum dibuka + notifikasi belum dibaca).
  getBadgeOffice: () => apiFetch('/api/office/badge'),
  getMenungguReviewOffice: () => apiFetch('/api/office/review'),
  getMenungguApprovalOffice: () => apiFetch('/api/office/approval'),
  aksiPengesahanSurat: (id, payload) =>
    apiFetch(`/api/office/surat/${id}/pengesahan`, { method: 'POST', body: JSON.stringify(payload) }),
  // Tab "Tindak Lanjut" & "Hirarki" pada detail surat.
  getTindakLanjutSurat: (id) => apiFetch(`/api/office/surat/${id}/tindak-lanjut`),
  tambahTindakLanjutSurat: (id, payload) =>
    apiFetch(`/api/office/surat/${id}/tindak-lanjut`, { method: 'POST', body: JSON.stringify(payload) }),
  getHirarkiSurat: (id) => apiFetch(`/api/office/surat/${id}/hirarki`),
  uploadLampiranSurat: (id, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/office/surat/${id}/lampiran`, { method: 'POST', body })
  },
  hapusLampiranSurat: (id, lampId) => apiFetch(`/api/office/surat/${id}/lampiran/${lampId}`, { method: 'DELETE' }),
  unduhLampiranSurat: (id, lampId, nama) => apiDownload(`/api/office/surat/${id}/lampiran/${lampId}`, nama || 'lampiran'),
  getPersonalProfile: () => apiFetch('/api/personal/profile'),
  updateProfile: (payload) => apiFetch('/api/personal/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  // Foto profil (avatar lingkaran). getProfilePhoto mengembalikan { url, contentType }
  // (blob object URL) - caller wajib URL.revokeObjectURL saat selesai; 404 = belum ada foto.
  getProfilePhoto: () => apiBlob('/api/personal/profile/photo'),
  uploadProfilePhoto: (blob) => {
    const body = new FormData()
    body.append('file', blob, 'profile.jpg')
    return apiFetch('/api/personal/profile/photo', { method: 'POST', body })
  },
  deleteProfilePhoto: () => apiFetch('/api/personal/profile/photo', { method: 'DELETE' }),
  uploadDocument: (key, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/personal/documents/${key}`, { method: 'POST', body })
  },
  uploadAktaAnak: (idAnak, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/personal/documents/anak/${idAnak}/akta`, { method: 'POST', body })
  },
  createAnak: (payload) => apiFetch('/api/personal/anak', { method: 'POST', body: JSON.stringify(payload) }),
  updateAnak: (idAnak, payload) =>
    apiFetch(`/api/personal/anak/${idAnak}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAnak: (idAnak) => apiFetch(`/api/personal/anak/${idAnak}`, { method: 'DELETE' }),
  getPersetujuan: () => apiFetch('/api/persetujuan'),
  getPersetujuanDetail: (id) => apiFetch(`/api/persetujuan/${id}/detail`),
  putusanPersetujuan: (id, payload) => apiFetch(`/api/persetujuan/${id}/putusan`, { method: 'POST', body: JSON.stringify(payload) }),
  getCuti: () => apiFetch('/api/personal/cuti'),
  ajukanCuti: (payload) => apiFetch('/api/personal/cuti/ajukan', { method: 'POST', body: JSON.stringify(payload) }),
  batalCuti: (id) => apiFetch(`/api/personal/cuti/${id}/batal`, { method: 'POST' }),
  putusanCuti: (id, payload) => apiFetch(`/api/personal/cuti/${id}/putusan`, { method: 'POST', body: JSON.stringify(payload) }),
  // Cuti Bersama (CRUD, Admin SDM)
  buatCutiBersama: (payload) => apiFetch('/api/personal/cuti/cuti-bersama', { method: 'POST', body: JSON.stringify(payload) }),
  ubahCutiBersama: (id, payload) => apiFetch(`/api/personal/cuti/cuti-bersama/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  hapusCutiBersama: (id) => apiFetch(`/api/personal/cuti/cuti-bersama/${id}`, { method: 'DELETE' }),
  // Cuti Nasional (CRUD, Admin SDM)
  buatCutiNasional: (payload) => apiFetch('/api/personal/cuti/cuti-nasional', { method: 'POST', body: JSON.stringify(payload) }),
  ubahCutiNasional: (id, payload) => apiFetch(`/api/personal/cuti/cuti-nasional/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  hapusCutiNasional: (id) => apiFetch(`/api/personal/cuti/cuti-nasional/${id}`, { method: 'DELETE' }),
  // My Prosedur (SOP & Kebijakan)
  getProsedurList: (q, jenis, kompartemen, lingkup) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (jenis) p.set('jenis', jenis)
    if (kompartemen) p.set('kompartemen', kompartemen)
    if (lingkup) p.set('lingkup', lingkup)
    const s = p.toString()
    return apiFetch(`/api/prosedur${s ? `?${s}` : ''}`)
  },
  getProsedurOpsi: () => apiFetch('/api/prosedur/opsi'),
  getProsedurDetail: (id) => apiFetch(`/api/prosedur/${id}`),
  getProsedurFile: (versiId) => apiBlob(`/api/prosedur/versi/${versiId}/file`),
  unduhProsedurFile: (versiId, filename) => apiDownload(`/api/prosedur/versi/${versiId}/file`, filename || 'dokumen'),
  ackProsedur: (id) => apiFetch(`/api/prosedur/${id}/ack`, { method: 'POST' }),
  getProsedurAck: (id) => apiFetch(`/api/prosedur/${id}/acknowledgement`),
  buatProsedur: (formData) => apiFetch('/api/prosedur', { method: 'POST', body: formData }),
  tambahVersiProsedur: (id, formData) => apiFetch(`/api/prosedur/${id}/versi`, { method: 'POST', body: formData }),
  ubahProsedur: (id, payload) => apiFetch(`/api/prosedur/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  statusVersiProsedur: (versiId, status) => apiFetch(`/api/prosedur/versi/${versiId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  hapusProsedur: (id) => apiFetch(`/api/prosedur/${id}`, { method: 'DELETE' }),

  // My Health (MCU / Kesehatan)
  getHealthRiwayat: () => apiFetch('/api/health/riwayat'),
  getHealthHasil: (id) => apiFetch(`/api/health/hasil/${id}`),
  getHealthFile: (id) => apiBlob(`/api/health/hasil/${id}/file`),
  getHealthPeriodeList: () => apiFetch('/api/health/periode'),
  getHealthPeriodeDetail: (id) => apiFetch(`/api/health/periode/${id}`),
  buatHealthPeriode: (payload) => apiFetch('/api/health/periode', { method: 'POST', body: JSON.stringify(payload) }),
  ubahHealthPeriode: (id, payload) => apiFetch(`/api/health/periode/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  hapusHealthPeriode: (id) => apiFetch(`/api/health/periode/${id}`, { method: 'DELETE' }),
  buatHealthHasil: (idPeriode, formData) => apiFetch(`/api/health/periode/${idPeriode}/hasil`, { method: 'POST', body: formData }),
  ubahHealthHasil: (id, formData) => apiFetch(`/api/health/hasil/${id}`, { method: 'PUT', body: formData }),
  hapusHealthHasil: (id) => apiFetch(`/api/health/hasil/${id}`, { method: 'DELETE' }),

  // Coaching (My Team)
  getCoachingInbox: () => apiFetch('/api/coaching'),
  getCoachingLawanBicara: () => apiFetch('/api/coaching/lawan-bicara'),
  buatCoachingSesi: (payload) => apiFetch('/api/coaching/sesi', { method: 'POST', body: JSON.stringify(payload) }),
  getCoachingSesi: (id) => apiFetch(`/api/coaching/sesi/${id}`),
  kirimPesanSesi: (id, isi) => apiFetch(`/api/coaching/sesi/${id}/pesan`, { method: 'POST', body: JSON.stringify({ isi }) }),
  statusSesi: (id, status) => apiFetch(`/api/coaching/sesi/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  tambahTindakLanjut: (id, isi) => apiFetch(`/api/coaching/sesi/${id}/tindak-lanjut`, { method: 'POST', body: JSON.stringify({ isi }) }),
  statusTindakLanjut: (tlId, status) => apiFetch(`/api/coaching/tindak-lanjut/${tlId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getCoachingRuang: (ownerNik) => apiFetch(`/api/coaching/ruang/${encodeURIComponent(ownerNik)}`),
  kirimPesanRuang: (ownerNik, isi) => apiFetch(`/api/coaching/ruang/${encodeURIComponent(ownerNik)}/pesan`, { method: 'POST', body: JSON.stringify({ isi }) }),
  // Download transkrip PDF + panel admin SDM (semua coaching)
  downloadCoachingSesi: (id) => apiDownload(`/api/coaching/sesi/${id}/download`, `coaching-sesi-${id}.pdf`),
  downloadCoachingRuang: (ownerNik) => apiDownload(`/api/coaching/ruang/${encodeURIComponent(ownerNik)}/download`, `coaching-ruang-${ownerNik}.pdf`),
  getCoachingAdminSemua: () => apiFetch('/api/coaching/admin/semua'),

  // My Asset > Inventaris - sumber datanya GCS.dbo.assets (ERP Aktiva Tetap), read-only.
  getAsetList: (q) => apiFetch(`/api/aset${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getAsetDetail: (objectId) => apiFetch(`/api/aset/${objectId}`),
  // My Asset > Pendaftaran Aset Baru (MyGCS -> dbo.assets, SSOT tetap ERP).
  listGroupAssetErp: () => apiFetch('/api/aset/group-asset'),
  listKelompokErp: (groupAsset) => apiFetch(`/api/aset/kelompok${groupAsset ? `?groupAsset=${encodeURIComponent(groupAsset)}` : ''}`),
  listKodeCcErp: () => apiFetch('/api/aset/kode-cc'),
  daftarAsetBaru: (payload) => apiFetch('/api/aset/daftar', { method: 'POST', body: JSON.stringify(payload) }),
  getAsetTidakProduktifList: () => apiFetch('/api/aset/tidak-produktif'),
  buatAsetTidakProduktif: (payload) => apiFetch('/api/aset/tidak-produktif', { method: 'POST', body: JSON.stringify(payload) }),
  ubahAsetTidakProduktif: (id, payload) => apiFetch(`/api/aset/tidak-produktif/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getAktivitasList: (idAset) => apiFetch(`/api/aset/tidak-produktif/aktivitas${idAset ? `?idAset=${idAset}` : ''}`),
  buatAktivitas: (payload) => apiFetch('/api/aset/tidak-produktif/aktivitas', { method: 'POST', body: JSON.stringify(payload) }),
  ubahAktivitas: (id, payload) => apiFetch(`/api/aset/tidak-produktif/aktivitas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  hapusAktivitas: (id) => apiFetch(`/api/aset/tidak-produktif/aktivitas/${id}`, { method: 'DELETE' }),
  hapusAsetTidakProduktif: (id) => apiFetch(`/api/aset/tidak-produktif/${id}`, { method: 'DELETE' }),
  // My Asset > overlay (kondisi/PIC/aktivitas umum/clearance) - lihat AsetOverlayService.
  getAsetAdminStatus: () => apiFetch('/api/aset/admin-status'),
  cariPegawaiAset: (q) => apiFetch(`/api/aset/pegawai?q=${encodeURIComponent(q ?? '')}`),
  listBagianAset: () => apiFetch('/api/aset/bagian'),
  listJenisAktivitasAset: () => apiFetch('/api/aset/jenis-aktivitas'),
  getAsetOverlay: (objectId) => apiFetch(`/api/aset/${objectId}/overlay`),
  setAsetKondisi: (objectId, payload) => apiFetch(`/api/aset/${objectId}/kondisi`, { method: 'POST', body: JSON.stringify(payload) }),
  setAsetNomorInternal: (objectId, payload) => apiFetch(`/api/aset/${objectId}/nomor`, { method: 'PUT', body: JSON.stringify(payload) }),
  assignAsetPic: (objectId, payload) => apiFetch(`/api/aset/${objectId}/pic`, { method: 'POST', body: JSON.stringify(payload) }),
  kembalikanAsetPic: (id) => apiFetch(`/api/aset/pic/${id}/kembalikan`, { method: 'POST' }),
  buatAsetAktivitas: (objectId, payload) => apiFetch(`/api/aset/${objectId}/aktivitas`, { method: 'POST', body: JSON.stringify(payload) }),
  ubahAsetAktivitas: (id, payload) => apiFetch(`/api/aset/aktivitas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  hapusAsetAktivitas: (id) => apiFetch(`/api/aset/aktivitas/${id}`, { method: 'DELETE' }),
  getAsetClearance: (nik) => apiFetch(`/api/aset/clearance?nik=${encodeURIComponent(nik)}`),
  // My Asset > Operator Aktivitas (hak terbatas "Catat Aktivitas SAJA", admin-only).
  listAktivitasOperator: () => apiFetch('/api/aset/aktivitas-operator'),
  tambahAktivitasOperator: (payload) => apiFetch('/api/aset/aktivitas-operator', { method: 'POST', body: JSON.stringify(payload) }),
  cabutAktivitasOperator: (id) => apiFetch(`/api/aset/aktivitas-operator/${id}`, { method: 'DELETE' }),
  // My Asset > Riwayat PIC lintas-aset (read-only, filter opsional).
  getAsetRiwayatPic: ({ nik, idUnit, dari, sampai } = {}) => {
    const p = new URLSearchParams()
    if (nik) p.set('nik', nik)
    if (idUnit) p.set('idUnit', idUnit)
    if (dari) p.set('dari', dari)
    if (sampai) p.set('sampai', sampai)
    const qs = p.toString()
    return apiFetch(`/api/aset/pic/riwayat${qs ? `?${qs}` : ''}`)
  },
  // My Asset > Dokumen (sertifikat/BPKB/STNK/IMB/polis) + reminder jatuh tempo.
  uploadAsetDokumen: (objectId, fields, file) => {
    const body = new FormData()
    Object.entries(fields).forEach(([k, v]) => { if (v != null && v !== '') body.append(k, v) })
    if (file) body.append('file', file)
    return apiFetch(`/api/aset/${objectId}/dokumen`, { method: 'POST', body })
  },
  ubahAsetDokumen: (id, payload) => apiFetch(`/api/aset/dokumen/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  hapusAsetDokumen: (id) => apiFetch(`/api/aset/dokumen/${id}`, { method: 'DELETE' }),
  getAsetDokumenJatuhTempo: (hari) => apiFetch(`/api/aset/dokumen/jatuh-tempo${hari ? `?hari=${hari}` : ''}`),
  // Return { url, contentType } - blob object URL; revoke saat viewer ditutup. <a href> polos
  // tidak bisa dipakai karena endpoint ini butuh header Authorization Bearer.
  getAsetDokumenFile: (id) => apiBlob(`/api/aset/dokumen/${id}/file`),
  cariRekananAset: (q) => apiFetch(`/api/aset/rekanan?q=${encodeURIComponent(q ?? '')}`),
  listLokasiAset: () => apiFetch('/api/aset/lokasi'),
  // My Asset > Stock Opname (scan QR)
  getAsetOpnameSesiList: () => apiFetch('/api/aset/opname-sesi'),
  buatAsetOpnameSesi: (payload) => apiFetch('/api/aset/opname-sesi', { method: 'POST', body: JSON.stringify(payload) }),
  getAsetOpnameSesiDetail: (id) => apiFetch(`/api/aset/opname-sesi/${id}`),
  selesaikanAsetOpnameSesi: (id) => apiFetch(`/api/aset/opname-sesi/${id}/selesai`, { method: 'POST' }),
  submitAsetOpnameScan: (idSesi, fields, foto) => {
    const body = new FormData()
    Object.entries(fields).forEach(([k, v]) => { if (v != null && v !== '') body.append(k, v) })
    if (foto) body.append('foto', foto)
    return apiFetch(`/api/aset/opname-sesi/${idSesi}/scan`, { method: 'POST', body })
  },

  // My Progress (KPI)
  getKpiSaya: () => apiFetch('/api/progress'),
  getKpiPerusahaan: () => apiFetch('/api/progress/perusahaan'),
  buatKpiPerusahaan: (payload) => apiFetch('/api/progress/perusahaan', { method: 'POST', body: JSON.stringify(payload) }),
  getKpiTim: () => apiFetch('/api/progress/tim'),
  getKpiKaryawan: (nik) => apiFetch(`/api/progress/tim/${encodeURIComponent(nik)}`),
  turunkanKpi: (nik, payload) => apiFetch(`/api/progress/tim/${encodeURIComponent(nik)}`, { method: 'POST', body: JSON.stringify(payload) }),
  ubahKpi: (id, payload) => apiFetch(`/api/progress/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  nilaiKpi: (id, payload) => apiFetch(`/api/progress/${id}/nilai`, { method: 'PUT', body: JSON.stringify(payload) }),
  hapusKpi: (id) => apiFetch(`/api/progress/${id}`, { method: 'DELETE' }),

  getSlipGaji: (tahun, bulan) => {
    const qs = new URLSearchParams()
    if (tahun) qs.set('tahun', tahun)
    if (bulan) qs.set('bulan', bulan)
    const q = qs.toString()
    return apiFetch(`/api/personal/gaji${q ? `?${q}` : ''}`)
  },
  // Admin Modul SDM: konfigurasi tarif gaji (matriks JG x PG).
  getGajiGradeOpsi: () => apiFetch('/api/personal/gaji/admin/grade'),
  getGajiTarif: (tahun, jg, pg) => apiFetch(`/api/personal/gaji/admin/tarif?tahun=${tahun}&jg=${jg}&pg=${pg}`),
  simpanGajiTarif: (payload) => apiFetch('/api/personal/gaji/admin/tarif', { method: 'PUT', body: JSON.stringify(payload) }),
  // Pendapatan Dasar: tarif satu dimensi (Band/JG/PG) - Gaji Pokok, Tunjangan Jabatan/Perumahan/Pangan/Angkutan
  getPendapatanDasar: (tahun) => apiFetch(`/api/personal/gaji/admin/pendapatan-dasar?tahun=${tahun}`),
  simpanPendapatanDasar: (payload) => apiFetch('/api/personal/gaji/admin/pendapatan-dasar', { method: 'PUT', body: JSON.stringify(payload) }),
  // Komponen berbasis rumus (mis. Tunjangan BPJS Kesehatan = % dari Pendapatan Dasar)
  getGajiFormula: () => apiFetch('/api/personal/gaji/admin/formula'),
  simpanGajiFormula: (payload) => apiFetch('/api/personal/gaji/admin/formula', { method: 'PUT', body: JSON.stringify(payload) }),
  // Potongan per Band/JG/PG (mis. Potongan DPLK per Band) - mekanisme sama dgn Pendapatan Dasar
  getPotonganTunggal: (tahun) => apiFetch(`/api/personal/gaji/admin/potongan-tunggal?tahun=${tahun}`),
  simpanPotonganTunggal: (payload) => apiFetch('/api/personal/gaji/admin/potongan-tunggal', { method: 'PUT', body: JSON.stringify(payload) }),
  // Komponen basis 'Flat': nilai sama untuk semua karyawan
  getGajiFlat: () => apiFetch('/api/personal/gaji/admin/flat'),
  simpanGajiFlat: (payload) => apiFetch('/api/personal/gaji/admin/flat', { method: 'PUT', body: JSON.stringify(payload) }),
  // Nominal manual per karyawan (basis Karyawan_Periode: Lembur, RIT, Potongan Presensi, dst)
  cariPegawaiGaji: (q) => apiFetch(`/api/personal/gaji/admin/pegawai?q=${encodeURIComponent(q)}`),
  getGajiManual: (nik, tahun, bulan) => apiFetch(`/api/personal/gaji/admin/manual?nik=${encodeURIComponent(nik)}&tahun=${tahun}&bulan=${bulan}`),
  simpanGajiManual: (payload) => apiFetch('/api/personal/gaji/admin/manual', { method: 'PUT', body: JSON.stringify(payload) }),
  // Potongan Presensi: preview hitung otomatis dari Absensi + Surat Ijin disetujui (TIDAK menyimpan)
  hitungPotonganPresensi: (nik, tahun, bulan) =>
    apiFetch(`/api/personal/gaji/admin/potongan-presensi?nik=${encodeURIComponent(nik)}&tahun=${tahun}&bulan=${bulan}`),
  getAbsensi: () => apiFetch('/api/personal/absensi'),
  getLocations: () => apiFetch('/api/personal/locations'),
  submitAbsensi: (payload) =>
    apiFetch('/api/personal/absensi', { method: 'POST', body: JSON.stringify(payload) }),
  getSpl: () => apiFetch('/api/personal/spl'),
  createSpl: (payload) => apiFetch('/api/personal/spl', { method: 'POST', body: JSON.stringify(payload) }),
  updateSpl: (id, payload) =>
    apiFetch(`/api/personal/spl/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSpl: (id) => apiFetch(`/api/personal/spl/${id}`, { method: 'DELETE' }),
  getIzin: () => apiFetch('/api/personal/izin'),
  createIzin: (payload) => apiFetch('/api/personal/izin', { method: 'POST', body: JSON.stringify(payload) }),
  updateIzin: (id, payload) =>
    apiFetch(`/api/personal/izin/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteIzin: (id) => apiFetch(`/api/personal/izin/${id}`, { method: 'DELETE' }),
  // POST, not GET: printing registers the document in the QR-validation registry.
  printIzin: (id) => apiFetch(`/api/personal/izin/${id}/print`, { method: 'POST' }),
  getTiket: () => apiFetch('/api/personal/tiket'),
  createTiket: (payload) => apiFetch('/api/personal/tiket', { method: 'POST', body: JSON.stringify(payload) }),
  updateTiket: (id, payload) =>
    apiFetch(`/api/personal/tiket/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTiket: (id) => apiFetch(`/api/personal/tiket/${id}`, { method: 'DELETE' }),
  getTiketDetail: (id) => apiFetch(`/api/personal/tiket/${id}/detail`),
  addTiketRincian: (id, payload) =>
    apiFetch(`/api/personal/tiket/${id}/detail`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTiketRincian: (id, idDet, payload) =>
    apiFetch(`/api/personal/tiket/${id}/detail/${idDet}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTiketRincian: (id, idDet) =>
    apiFetch(`/api/personal/tiket/${id}/detail/${idDet}`, { method: 'DELETE' }),
  printTiket: (id) => apiFetch(`/api/personal/tiket/${id}/print`, { method: 'POST' }),

  getUmdl: () => apiFetch('/api/personal/umdl'),
  // Hanya izin "Meninggalkan Pekerjaan" + "Dinas" yang belum dipakai UMDL lain.
  cariIjinUmdl: () => apiFetch('/api/personal/umdl/izin'),
  createUmdl: (payload) => apiFetch('/api/personal/umdl', { method: 'POST', body: JSON.stringify(payload) }),
  updateUmdl: (id, payload) =>
    apiFetch(`/api/personal/umdl/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteUmdl: (id) => apiFetch(`/api/personal/umdl/${id}`, { method: 'DELETE' }),

  getSppd: () => apiFetch('/api/personal/sppd'),
  createSppd: (payload) => apiFetch('/api/personal/sppd', { method: 'POST', body: JSON.stringify(payload) }),
  updateSppd: (id, payload) =>
    apiFetch(`/api/personal/sppd/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSppd: (id) => apiFetch(`/api/personal/sppd/${id}`, { method: 'DELETE' }),
  getSppdDetail: (id) => apiFetch(`/api/personal/sppd/${id}/detail`),
  addSppdPeserta: (id, payload) =>
    apiFetch(`/api/personal/sppd/${id}/detail`, { method: 'POST', body: JSON.stringify(payload) }),
  // Hanya posisi & tugas yang bisa diubah; pegawainya tidak.
  updateSppdPeserta: (id, idDet, payload) =>
    apiFetch(`/api/personal/sppd/${id}/detail/${idDet}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSppdPeserta: (id, idDet) =>
    apiFetch(`/api/personal/sppd/${id}/detail/${idDet}`, { method: 'DELETE' }),
  cariPegawai: (q) => apiFetch(`/api/personal/sppd/pegawai?q=${encodeURIComponent(q ?? '')}`),
  // POST, not GET: printing registers the document in the QR-validation registry.
  printSppd: (id) => apiFetch(`/api/personal/sppd/${id}/print`, { method: 'POST' }),
  uploadSuratDokter: (id, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/personal/izin/${id}/surat-dokter`, { method: 'POST', body })
  },
  // Return { url, contentType } - url is a blob: object URL; revoke it when the viewer closes.
  getDocument: (key) => apiBlob(`/api/personal/documents/${key}`),
  getAktaAnak: (idAnak) => apiBlob(`/api/personal/documents/anak/${idAnak}/akta`),

  // My Innovation (SS / GIO / 5R) - Bearer. Tanpa jenis = semua metodologi.
  listInovasi: (jenis) => apiFetch(`/api/inovasi/gugus${jenis ? `?jenis=${encodeURIComponent(jenis)}` : ''}`),
  createInovasi: (payload) => apiFetch('/api/inovasi/gugus', { method: 'POST', body: JSON.stringify(payload) }),
  getInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}`),
  saveInovasiPlan: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/plan`, { method: 'PUT', body: JSON.stringify(payload) }),
  submitInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}/submit`, { method: 'POST' }),
  submitFinalInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}/submit-final`, { method: 'POST' }),
  actPengesahan: (id, pid, payload) => apiFetch(`/api/inovasi/gugus/${id}/pengesahan/${pid}`, { method: 'POST', body: JSON.stringify(payload) }),
  saveInovasiDo: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/do`, { method: 'PUT', body: JSON.stringify(payload) }),
  saveInovasiCheck: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/check`, { method: 'PUT', body: JSON.stringify(payload) }),
  saveInovasiAction: (id, payload) => apiFetch(`/api/inovasi/gugus/${id}/action`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteInovasi: (id) => apiFetch(`/api/inovasi/gugus/${id}`, { method: 'DELETE' }),
  uploadInovasiFile: (id, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/inovasi/gugus/${id}/upload`, { method: 'POST', body })
  },
  cariPegawaiInovasi: (q, gugusId) => apiFetch(`/api/inovasi/pegawai?q=${encodeURIComponent(q ?? '')}${gugusId ? `&gugusId=${encodeURIComponent(gugusId)}` : ''}`),
  // Direktori pegawai (halaman Daftar Pegawai): seluruh pegawai + filter dep/komp.
  listPegawaiDirektori: ({ q, departemenId, kompartemenId } = {}) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (departemenId) p.set('departemenId', departemenId)
    if (kompartemenId) p.set('kompartemenId', kompartemenId)
    const qs = p.toString()
    return apiFetch(`/api/inovasi/pegawai-direktori${qs ? `?${qs}` : ''}`)
  },
  listKompartemenInovasi: () => apiFetch('/api/inovasi/kompartemen'),
  // Return { url, contentType } - blob object URL; revoke it when done.
  getInovasiFile: (id, path) => apiBlob(`/api/inovasi/gugus/${id}/file?path=${encodeURIComponent(path)}`),

  // Sumbang Gagasan (Bearer)
  listGagasan: () => apiFetch('/api/inovasi/gagasan'),
  createGagasan: (payload) => apiFetch('/api/inovasi/gagasan', { method: 'POST', body: JSON.stringify(payload) }),
  getGagasan: (id) => apiFetch(`/api/inovasi/gagasan/${id}`),
  updateGagasan: (id, payload) => apiFetch(`/api/inovasi/gagasan/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  actGagasanApproval: (id, payload) => apiFetch(`/api/inovasi/gagasan/${id}/approval`, { method: 'POST', body: JSON.stringify(payload) }),
  daftarGagasan: (id, payload) => apiFetch(`/api/inovasi/gagasan/${id}/daftar`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteGagasan: (id) => apiFetch(`/api/inovasi/gagasan/${id}`, { method: 'DELETE' }),
  listDepartemenInovasi: () => apiFetch('/api/inovasi/departemen'),
  getInovasiPeran: () => apiFetch('/api/inovasi/peran'),

  // History Approval - jejak langkah persetujuan (siapa memproses apa, kapan)
  historyApprovalGagasan: () => apiFetch('/api/inovasi/history/gagasan'),
  historyApprovalInovasi: () => apiFetch('/api/inovasi/history/gugus'),

  // Penilaian Juri (Bearer). Rubrik + stream (Admin) + penugasan + sisi juri.
  getPenilaianKriteria: (jenisForm) => apiFetch(`/api/inovasi/penilaian/kriteria?jenisForm=${encodeURIComponent(jenisForm ?? '')}`),
  // Admin: seluruh pengguna ber-role Juri (tanpa batas 100)
  listJuriUsers: () => apiFetch('/api/inovasi/penilaian/juri-users'),
  // Admin: kelola stream
  listPenilaianStream: () => apiFetch('/api/inovasi/penilaian/stream'),
  getPenilaianStream: (id) => apiFetch(`/api/inovasi/penilaian/stream/${id}`),
  createPenilaianStream: (payload) => apiFetch('/api/inovasi/penilaian/stream', { method: 'POST', body: JSON.stringify(payload) }),
  updatePenilaianStream: (id, payload) => apiFetch(`/api/inovasi/penilaian/stream/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePenilaianStream: (id) => apiFetch(`/api/inovasi/penilaian/stream/${id}`, { method: 'DELETE' }),
  // Admin: penugasan
  listPenilaianGugusOptions: () => apiFetch('/api/inovasi/penilaian/gugus-options'),
  listPenugasan: () => apiFetch('/api/inovasi/penilaian/penugasan'),
  createPenugasan: (payload) => apiFetch('/api/inovasi/penilaian/penugasan', { method: 'POST', body: JSON.stringify(payload) }),
  updatePenugasan: (id, payload) => apiFetch(`/api/inovasi/penilaian/penugasan/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  tutupPenugasan: (id) => apiFetch(`/api/inovasi/penilaian/penugasan/${id}/tutup`, { method: 'POST' }),
  deletePenugasan: (id) => apiFetch(`/api/inovasi/penilaian/penugasan/${id}`, { method: 'DELETE' }),
  // Juri
  listTugasPenilaian: () => apiFetch('/api/inovasi/penilaian/tugas'),
  getPenilaian: (penugasanId) => apiFetch(`/api/inovasi/penilaian/${penugasanId}`),
  savePenilaianSkor: (penugasanId, payload) => apiFetch(`/api/inovasi/penilaian/${penugasanId}/skor`, { method: 'PUT', body: JSON.stringify(payload) }),
  getPenilaianHasil: (penugasanId) => apiFetch(`/api/inovasi/penilaian/${penugasanId}/hasil`),
  // Rekap nilai akhir + kategori penghargaan seluruh risalah (Roadmap Inovasi).
  getRekapNilai: () => apiFetch('/api/inovasi/penilaian/rekap'),

  // authentication (cookie flow)
  login: (email, password) => post('/api/account/login', { email, password }),
  loginTwoFactor: (code, rememberMachine) => post('/api/account/login-2fa', { code, rememberMachine }),

  // self-service password
  forgotPassword: (email) => post('/api/account/forgot-password', { email }),
  resetPassword: (email, token, newPassword) => post('/api/account/reset-password', { email, token, newPassword }),
  changePassword: (currentPassword, newPassword) => post('/api/account/change-password', { currentPassword, newPassword }),

  // MFA (authenticator app, Bearer)
  getMe: () => apiFetch('/api/account/me'),
  twoFactorSetup: () => apiFetch('/api/account/2fa/setup'),
  enableTwoFactor: (code) => post('/api/account/2fa/enable', { code }),
  disableTwoFactor: () => post('/api/account/2fa/disable'),

  // admin document browser (Admin, Bearer)
  searchEmployees: (q) => apiFetch(`/api/admin/documents/search?q=${encodeURIComponent(q ?? '')}`),
  getEmployeeDocuments: (idPegawai) => apiFetch(`/api/admin/documents/${idPegawai}`),
  // Return { url, contentType } - blob object URL; revoke it when the viewer closes.
  getEmployeeDocument: (idPegawai, key) => apiBlob(`/api/admin/documents/${idPegawai}/file/${key}`),
  getEmployeeAktaAnak: (idPegawai, idAnak) =>
    apiBlob(`/api/admin/documents/${idPegawai}/anak/${idAnak}/akta`),

  // admin control panel (Admin IT, Bearer)
  getAdminOverview: () => apiFetch('/api/admin/overview'),
  getAdminUsers: (q) => apiFetch(`/api/admin/users?q=${encodeURIComponent(q ?? '')}`),
  setUserAdmin: (id, enabled) =>
    apiFetch(`/api/admin/users/${id}/role/admin`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  setUserJuri: (id, enabled) =>
    apiFetch(`/api/admin/users/${id}/role/juri`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  setUserPengelolaJuri: (id, enabled) =>
    apiFetch(`/api/admin/users/${id}/role/pengelola-juri`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  setUserActive: (id, enabled) =>
    apiFetch(`/api/admin/users/${id}/active`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  unlockUser: (id) => apiFetch(`/api/admin/users/${id}/unlock`, { method: 'POST' }),

  // admin: akses modul portal (Admin IT, Bearer). payload = { enabled, access }
  // dengan access 'semua' | 'admin'.
  getAdminModules: () => apiFetch('/api/admin/modules'),
  updateAdminModule: (key, payload) =>
    apiFetch(`/api/admin/modules/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  // Mendaftarkan modul baru. payload = { key, label, subtitle, icon, enabled, access }.
  createAdminModule: (payload) =>
    apiFetch('/api/admin/modules', { method: 'POST', body: JSON.stringify(payload) }),
  // Upload/ganti logo modul (berlaku untuk modul katalog maupun modul custom).
  uploadAdminModuleLogo: (key, file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch(`/api/admin/modules/${encodeURIComponent(key)}/logo`, { method: 'POST', body })
  },

  // admin: lock/unlock fitur (item menu) per modul
  getAdminFeatures: () => apiFetch('/api/admin/modules/features'),
  updateAdminFeature: (key, enabled) =>
    apiFetch(`/api/admin/modules/features/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),

  // admin: lokasi geofence absensi (Admin IT, Bearer)
  getAdminLocations: () => apiFetch('/api/admin/locations'),
  createLocation: (payload) => apiFetch('/api/admin/locations', { method: 'POST', body: JSON.stringify(payload) }),
  updateLocation: (id, payload) =>
    apiFetch(`/api/admin/locations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLocation: (id) => apiFetch(`/api/admin/locations/${id}`, { method: 'DELETE' }),

  // audit (Admin, Bearer)
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString()
    return apiFetch('/api/audit' + (q ? `?${q}` : ''))
  },
}
