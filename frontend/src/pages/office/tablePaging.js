// Helper penomoran halaman tabel My Office. Dipisah dari TablePager.jsx supaya
// berkas komponen hanya mengekspor komponen (syarat React Fast Refresh).

export const UKURAN_HALAMAN = [10, 25, 50, 100]

// Halaman berjalan dijaga agar tidak melewati batas — pencarian/penyaringan bisa
// memperkecil hasil setelah pengguna berpindah ke halaman belakang.
export function halamanAman(total, halaman, perHalaman) {
  return Math.min(halaman, Math.max(1, Math.ceil(total / perHalaman)))
}

// Potong daftar (yang sudah disaring & diurutkan) ke halaman berjalan.
export function potongHalaman(rows, halaman, perHalaman) {
  const kini = halamanAman(rows.length, halaman, perHalaman)
  const mulai = (kini - 1) * perHalaman
  return rows.slice(mulai, mulai + perHalaman)
}
