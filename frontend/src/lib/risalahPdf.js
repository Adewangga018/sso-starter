// Unduh risalah inovasi (SS / GIO / 5R) sebagai PDF.
//
// Isinya memakai perakit HTML yang sama dengan modal Detail (risalahDoc.js),
// dibungkus dokumen A4 lalu dicetak lewat dialog cetak peramban - pengguna
// memilih tujuan "Save as PDF" / "Simpan sebagai PDF". Pendekatan yang sama
// dipakai halaman cetak Izin/SPPD/Tiket, jadi tanpa dependensi tambahan dan
// hasilnya PDF teks (bukan gambar): tulisan tetap tajam & bisa dicari, tabel
// lebar dipecah antar halaman dengan benar.
//
// Diagram fishbone digambar komponen React sebagai SVG inline. Karena tidak bisa
// dirender ulang di luar React, SVG-nya disalin dari DOM modal Detail (lihat
// parameter fishboneHtml) dan disisipkan di posisi yang sama seperti di layar.

import { renderRisalahHtml } from './risalahDoc'
import { jenisLabel } from '../pages/inovasi/statusClass'

// Gaya cetak: A4 potret dengan margin wajar, header tabel berulang tiap halaman,
// dan aturan agar judul bagian tidak tertinggal sendirian di dasar halaman.
//
// Selektornya sengaja diawali `body`: renderRisalahHtml menyisipkan <style>
// miliknya sendiri di dalam isi dokumen (setelah <head> ini), jadi aturan ".rd"
// polos di sini akan kalah urutan. `body .rd` menang lewat spesifisitas -
// ukuran huruf layar (px) tidak boleh mengalahkan ukuran cetak (pt).
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  /* Warna latar bagian & header tabel ikut tercetak, bukan jadi putih polos. */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1a1f1b; }
  body .rd { font-size: 10pt; }
  body .rd .rd-h1 { font-size: 14pt; }
  body .rd h2 { font-size: 11pt; break-after: avoid; page-break-after: avoid; }
  body .rd p.sec { font-size: 10.5pt; break-after: avoid; page-break-after: avoid; }
  body .rd table { break-inside: auto; page-break-inside: auto; }
  body .rd thead { display: table-header-group; }
  body .rd tr { break-inside: avoid; page-break-inside: avoid; }
  body .rd th, body .rd td { font-size: 8.5pt; padding: 3px 5px; }
  body .rd div.para { break-inside: avoid; page-break-inside: avoid; }
  body .rd svg { max-width: 100%; height: auto; }
`

// Nama berkas yang disodorkan dialog cetak: peramban memakai <title> dokumen
// sebagai nama bawaan berkas PDF-nya.
function namaBerkas(data) {
  const bagian = ['Risalah', jenisLabel(data.jenis) || data.jenis, data.noRegistrasi || data.namaGugus || data.id]
  return bagian.filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '-')
}

/**
 * Membuka dialog cetak berisi risalah lengkap agar dapat disimpan sebagai PDF.
 *
 * @param {object} data        GugusDetailDto lengkap (hasil api.getInovasi).
 * @param {string} fishboneHtml  outerHTML SVG diagram fishbone dari modal Detail
 *                               (opsional; kosongkan bila diagram tidak tampil).
 * @returns {boolean} false bila jendela cetak diblokir peramban.
 */
export function unduhRisalahPdf(data, fishboneHtml = '') {
  const { before, after } = renderRisalahHtml(data, { mode: 'full' })
  const judul = namaBerkas(data)

  // Jendela terpisah, bukan iframe tersembunyi: dialog cetak Chrome/Edge memakai
  // <title> jendela yang dicetak sebagai nama berkas bawaan.
  const w = window.open('', '_blank')
  if (!w) return false

  w.document.write(
    '<!doctype html><html lang="id"><head><meta charset="utf-8" />'
    + `<title>${judul.replace(/</g, '&lt;')}</title>`
    + `<style>${PRINT_CSS}</style>`
    + '</head><body>'
    + before
    + (fishboneHtml ? `<div class="rd" style="margin:2px 0 12px">${fishboneHtml}</div>` : '')
    + after
    + '</body></html>',
  )
  w.document.close()

  // Tunggu sampai layout & font siap; tanpa ini halaman pertama bisa tercetak
  // sebelum tabel selesai ditata.
  const cetak = () => {
    w.focus()
    w.print()
  }
  if (w.document.readyState === 'complete') setTimeout(cetak, 150)
  else w.addEventListener('load', () => setTimeout(cetak, 150))

  return true
}
