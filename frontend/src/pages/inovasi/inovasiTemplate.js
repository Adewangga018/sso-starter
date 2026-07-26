// Perbedaan struktur form antar metodologi inovasi.
//
// SS & 5R mengikuti siklus PDCA sederhana. GIO mengikuti Form F-GIO-01 dengan
// metode Delapan Langkah Tujuh Alat (DELTA): ada Stratifikasi & Pareto (P.3),
// jadwal per 8 langkah DELTA (P.4), verifikasi akar penyebab (P.8), dan
// verifikasi statistik hasil perbaikan (C.3) - sehingga penomoran bagiannya
// bergeser dibanding SS.

// --- Susunan Anggota Gugus (slot tetap per metodologi) ----------------------
// Jumlah & peran anggota pasti, tidak bisa ditambah manual:
//   SS  = 3  : Ketua, Sekretaris, Fasilitator
//   GIO = 7  : Ketua, Sekretaris, Anggota 1-4, Fasilitator
//   5R  = 10 : Ketua, Sekretaris, Anggota 1-7, Fasilitator
export function komposisiAnggota(jenis) {
  const jumlahAnggota = jenis === '5R' ? 7 : jenis === 'GIO' ? 4 : 0
  const slots = [
    { peran: 'Ketua', label: 'Ketua' },
    { peran: 'Sekretaris', label: 'Sekretaris' },
  ]
  for (let i = 1; i <= jumlahAnggota; i++) slots.push({ peran: 'Anggota', label: `Anggota ${i}` })
  slots.push({ peran: 'Fasilitator', label: 'Fasilitator' })
  return slots
}

// Petakan daftar anggota tersimpan ke slot tetap (isi berdasarkan peran & urutan).
export function anggotaKeSlot(jenis, tersimpan) {
  const byPeran = { Ketua: [], Sekretaris: [], Fasilitator: [], Anggota: [] }
  for (const a of [...(tersimpan ?? [])].sort((x, y) => (x.urutan ?? 0) - (y.urutan ?? 0))) {
    (byPeran[a.peran] ?? (byPeran[a.peran] = [])).push(a)
  }
  return komposisiAnggota(jenis).map((slot) => {
    const src = byPeran[slot.peran]?.shift()
    return {
      peran: slot.peran, label: slot.label,
      id: src?.id ?? 0, nik: src?.nik ?? '', nama: src?.nama ?? '',
      jabatan: src?.jabatan ?? '', depBagian: src?.depBagian ?? '',
    }
  })
}

// --- Tahapan pada tabel Jadwal Kegiatan -------------------------------------
// `kode` disimpan ke kolom inovasi.jadwal.tahapan; `label` hanya untuk tampilan.
export const TAHAPAN_PDCA = [
  { kode: 'PLAN', label: 'PLAN' },
  { kode: 'DO', label: 'DO' },
  { kode: 'CHECK', label: 'CHECK' },
  { kode: 'ACTION', label: 'ACTION' },
]

export const TAHAPAN_DELTA = [
  { kode: 'L1', label: '1. Menentukan Tema' },
  { kode: 'L2', label: '2. Menganalisis Penyebab' },
  { kode: 'L3', label: '3. Menguji & Menentukan Penyebab Dominan' },
  { kode: 'L4', label: '4. Membuat Rencana Penanggulangan' },
  { kode: 'L5', label: '5. Melaksanakan Penanggulangan' },
  { kode: 'L6', label: '6. Meneliti Hasil' },
  { kode: 'L7', label: '7. Standardisasi' },
  { kode: 'L8', label: '8. Menentukan Rencana Berikutnya' },
]

// 5R memakai jadwal per tahap kegiatan (Persiapan, R1-R5, Evaluasi), namun kolom
// bulan tetap kalender mengikuti Periode - sama seperti SS/GIO (lihat LIMA_R_TAHAP).
export const tahapanJadwal = (jenis) =>
  jenis === 'GIO' ? TAHAPAN_DELTA : jenis === '5R' ? LIMA_R_TAHAP : TAHAPAN_PDCA

// --- Risalah 5R (Form F-5R-02) ----------------------------------------------
// C. Jadwal Kegiatan 5R: tahap kegiatan (baris) mengikuti kolom bulan kalender.
export const LIMA_R_TAHAP = [
  { kode: 'P0', label: 'Persiapan & Sosialisasi' },
  { kode: 'R1', label: 'R1 – Ringkas' },
  { kode: 'R2', label: 'R2 – Rapi' },
  { kode: 'R3', label: 'R3 – Resik' },
  { kode: 'R4', label: 'R4 – Rawat' },
  { kode: 'R5', label: 'R5 – Rajin' },
  { kode: 'EV', label: 'Evaluasi & Pelaporan' },
]

// D & F: kelima R beserta deskripsi (dipakai Catatan Pertemuan & Dokumentasi).
export const LIMA_R_STEP = [
  { kode: 'R1', label: 'R1 – Ringkas', desc: 'Menyingkirkan barang yang tidak terkait dengan proses kerja.' },
  { kode: 'R2', label: 'R2 – Rapi', desc: 'Menata agar setiap barang punya tempat yang tetap dan mudah diakses.' },
  { kode: 'R3', label: 'R3 – Resik', desc: 'Membersihkan area kerja sekaligus memeriksa kondisi peralatan.' },
  { kode: 'R4', label: 'R4 – Rawat', desc: 'Menstandarkan agar setiap orang mendapatkan informasi yang cepat dan tepat.' },
  { kode: 'R5', label: 'R5 – Rajin', desc: 'Membudayakan kegiatan 5R secara konsisten.' },
]

// --- Faktor fishbone (4M1E) -------------------------------------------------
// Nama faktor sesuai form cetak. Kode disimpan ke inovasi.fishbone.faktor.
const FAKTOR_LABEL = {
  Man: 'Manusia (Man)',
  Method: 'Metode (Method)',
  Machine: 'Mesin / Alat (Machine)',
  Material: 'Material (Data/Informasi)',
  Environment: 'Lingkungan (Environment)',
}
export const faktorLabel = (f) => FAKTOR_LABEL[f] || f

// --- Penomoran & judul bagian ----------------------------------------------
const BAGIAN_GIO = {
  jadwalTitle: 'Jadwal Kegiatan (8 Langkah 7 Alat / DELTA)',
  pareto: 'P.3',
  jadwal: 'P.4',
  sasaran: 'P.5',
  qcdse: 'P.6',
  fishbone: 'P.7',
  verifikasiAkar: 'P.8',
  rencana: 'P.9',
  judul: 'P.10',
  cPerbandingan: 'C.1',
  cSasaran: 'C.2',
  cStatistik: 'C.3',
  cBiaya: 'C.4',
  cRisiko: 'C.5',
}

const BAGIAN_STD = {
  jadwalTitle: 'Jadwal Kegiatan (PDCA)',
  pareto: null,           // SS/5R tidak memakai stratifikasi & Pareto
  jadwal: 'P.3',
  sasaran: 'P.4',
  qcdse: 'P.5',
  fishbone: 'P.6',
  verifikasiAkar: null,   // SS/5R tidak memakai verifikasi akar terpisah
  rencana: 'P.7',
  judul: 'P.8',
  cPerbandingan: 'C.1',
  cSasaran: 'C.2',
  cStatistik: null,       // SS/5R tidak memakai verifikasi statistik
  cBiaya: 'C.3',
  cRisiko: 'C.4',
}

export const bagian = (jenis) => (jenis === 'GIO' ? BAGIAN_GIO : BAGIAN_STD)

// Judul P.8/P.10 mengikuti metodologi.
export const judulBagianJudul = (jenis) =>
  jenis === 'GIO' ? 'Judul Gugus Inovasi Operasi (GIO)'
    : jenis === '5R' ? 'Judul Program 5R'
      : 'Judul Sistem Saran (SS)'

// Periode pembanding pada C.1 (mis. periode '2026/2027' -> sebelum '2025/2026').
export function periodeSebelum(periode) {
  const y = Number(String(periode || '').split('/')[0])
  return Number.isFinite(y) ? `${y - 1}/${y}` : ''
}
