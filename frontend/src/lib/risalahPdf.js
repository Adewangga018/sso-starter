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

  /* Lembar pengesahan: baris keterangan dan baris garis+nama harus tetap satu
     halaman - kalau terbelah, garis tanda tangannya pindah ke halaman
     berikutnya terlepas dari nama penandatangannya. (Aturan "tr" di atas hanya
     menjaga tiap baris tidak terpotong di tengah, bukan menjaga kedua baris
     ini tetap berdampingan.) Ruang tanda tangan disamakan dengan 36pt. */
  body .rd table.rd-sign { break-inside: avoid; page-break-inside: avoid; }
  body .rd table.rd-sign tr.rd-sign__ket td { padding-bottom: 36pt; }

  /* --- Diagram fishbone -----------------------------------------------------
     SVG-nya disalin apa adanya dari DOM modal Detail, jadi inline style-nya
     ikut terbawa: pembungkusnya overflow-x: auto dan SVG-nya min-width: 820px
     / max-width: 1240px. Di layar itu benar (diagram lebar bisa digulir), tapi
     di kertas A4 potret lebar isi hanya 186mm (~700px): min-width memaksa SVG
     melampaui halaman, dan karena di kertas tidak ada gulir, pembungkusnya
     MEMOTONG sisi kanan diagram - inilah penyebab fishbone terpotong pada
     unduhan PDF SS & GIO.
     Perbaikannya: matikan min-width dan biarkan SVG menyusut mengikuti lebar
     halaman (viewBox membuatnya menskala utuh), lalu pembungkusnya tidak boleh
     memotong lagi. !important diperlukan karena yang dilawan inline style. */
  body .rd svg {
    min-width: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
    height: auto;
  }
  body .rd .inv__fishwrap {
    overflow: visible !important;
    /* Sekaligus jaga agar diagram tidak terbelah dua halaman. */
    break-inside: avoid;
    page-break-inside: avoid;
  }
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
