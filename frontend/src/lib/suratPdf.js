// Cetak / unduh Isi Surat My Office. Membuka jendela cetak berisi surat yang
// diberi kop & tata letak dokumen, lalu memanggil dialog cetak peramban -
// pengguna memilih tujuan "Save as PDF" untuk mengunduh, atau printer sungguhan
// untuk mencetak. Pola yang sama dipakai halaman cetak Izin/SPPD/Tiket dan
// risalah inovasi (lihat risalahPdf.js), jadi tanpa dependensi tambahan.
import { sanitizeHtml } from './sanitizeHtml'

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 18mm 20mm; }
  * { box-sizing: border-box; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1a1f1b; }
  .sp-kop { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #0f261f; padding-bottom: 10px; margin-bottom: 18px; }
  .sp-kop img { height: 46px; }
  .sp-kop__nama { font-size: 14pt; font-weight: 700; color: #0f261f; margin: 0; }
  .sp-kop__sub { font-size: 8.5pt; color: #667; margin: 1px 0 0; }
  .sp-meta { font-size: 9.5pt; color: #445; margin-bottom: 4px; }
  .sp-judul { font-size: 12.5pt; font-weight: 700; text-align: center; text-decoration: underline; margin: 14px 0 18px; }
  .sp-isi { font-size: 10.5pt; line-height: 1.6; }
  .sp-isi p, .sp-isi div { margin: 0 0 10px; }
  .sp-isi ul, .sp-isi ol { margin: 0 0 10px; padding-left: 22px; }
  .sp-kosong { color: #778; font-style: italic; }
  .sp-ttd { margin-top: 46px; display: flex; justify-content: flex-end; break-inside: avoid; }
  .sp-ttd__col { text-align: center; font-size: 10pt; min-width: 200px; }
  .sp-ttd__nama { margin-top: 46px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .sp-ttd__jabatan { font-size: 9pt; color: #556; }
`

function esc(v) {
  return v === null || v === undefined ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function namaBerkas(data) {
  const parts = ['Surat', data.nomor || data.jenis, data.judul]
  return parts.filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
}

function formatTgl(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
}

/**
 * Membuka dialog cetak berisi Isi Surat, dipakai baik oleh tombol "Cetak"
 * maupun "Unduh" (peramban menyatukan keduanya lewat pilihan printer/"Save as PDF").
 * @param {object} data  SuratDetailDto (hasil api.getSuratDetail).
 * @returns {boolean} false bila jendela cetak diblokir peramban.
 */
export function cetakSurat(data) {
  const judul = namaBerkas(data)
  const approver = (data.penanggungJawab ?? [])
    .filter((p) => p.peran === 'Approver')
    .sort((a, b) => (b.urutan ?? 0) - (a.urutan ?? 0))[0]
  const isiBersih = sanitizeHtml(data.isi || '')

  const w = window.open('', '_blank')
  if (!w) return false

  w.document.write(
    '<!doctype html><html lang="id"><head><meta charset="utf-8" />'
    + `<title>${esc(judul)}</title>`
    + `<style>${PRINT_CSS}</style>`
    + '</head><body>'
    + '<div class="sp-kop">'
    + '<img src="/LOGO GCS.png" alt="" />'
    + `<div><p class="sp-kop__nama">PT. Gresik Cipta Sejahtera</p><p class="sp-kop__sub">My Office &middot; Persuratan</p></div>`
    + '</div>'
    + `<div class="sp-meta">No. Surat: ${esc(data.nomor || '-')}<br/>Jenis: ${esc(data.jenisNama || data.jenis)}<br/>Tanggal: ${esc(formatTgl(data.tanggalSurat))}</div>`
    + `<div class="sp-judul">${esc(data.judul)}</div>`
    + `<div class="sp-isi">${isiBersih || '<p class="sp-kosong">(Isi surat belum ditambahkan.)</p>'}</div>`
    + (approver ? (
      '<div class="sp-ttd"><div class="sp-ttd__col">'
      + '<div>Menyetujui,</div>'
      + `<div class="sp-ttd__nama">${esc(approver.nama || approver.nik)}</div>`
      + `<div class="sp-ttd__jabatan">${esc(approver.jabatan || '-')}</div>`
      + '</div></div>'
    ) : '')
    + '</body></html>',
  )
  w.document.close()

  // Tunggu sampai layout & font siap sebelum mencetak.
  const cetak = () => { w.focus(); w.print() }
  if (w.document.readyState === 'complete') setTimeout(cetak, 150)
  else w.addEventListener('load', () => setTimeout(cetak, 150))

  return true
}
