// Nama panjang metodologi inovasi. 5R memakai template yang sama dengan SS (PDCA).
export function jenisLabel(jenis) {
  switch (jenis) {
    case 'GIO':
      return 'Gugus Inovasi Operasi'
    case '5R':
      return 'Program 5R'
    default:
      return 'Sistem Saran'
  }
}

// Memetakan status risalah/gagasan inovasi ke kelas badge (lihat inovasi.css).
export function statusClass(status) {
  switch (status) {
    case 'Draft':
      return 'inv__status--draft'
    case 'Dikirim':
    case 'Diajukan':
      return 'inv__status--diajukan'
    case 'Disetujui Verifikator':
    case 'Diverifikasi':
      return 'inv__status--diverifikasi'
    case 'Disetujui GM Kompartemen Asal':
    case 'Disetujui GM Kompartemen Tujuan':
    case 'Divalidasi':
      return 'inv__status--divalidasi'
    case 'Terdaftar':
    case 'Selesai':
      return 'inv__status--selesai'
    case 'Ditolak':
      return 'inv__status--ditolak'
    case 'Revisi':
    case 'Revisi Verifikator':
    case 'Revisi GM':
      return 'inv__status--revisi'
    default:
      return 'inv__status--draft'
  }
}
