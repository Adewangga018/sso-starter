// Pembersih HTML minimal untuk konten "Isi Surat" (dari editor kaya sederhana
// di Buat Surat). Tanpa ini, isi surat yang memuat <script> atau atribut event
// (onerror, onclick) akan tereksekusi di browser SIAPA SAJA yang membuka detail
// surat itu (reviewer, approver, tujuan/CC) — XSS tersimpan lewat data, bukan
// lewat celah kode. Kebijakan: hanya tag pemformatan dasar yang lolos, SELURUH
// atribut dibuang (termasuk href/src) karena editornya tidak pernah
// menghasilkan tautan/gambar, jadi tidak ada javascript: URL yang perlu diizinkan.
const TAG_DIIZINKAN = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'DIV', 'SPAN'])

export function sanitizeHtml(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  bersihkan(doc.body)
  return doc.body.innerHTML
}

function bersihkan(node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (!TAG_DIIZINKAN.has(child.tagName)) {
        // Elemen tak dikenal (mis. <script>, <img>, atau apa pun bawaan paste):
        // pertahankan isinya (biasanya teks berformat), buang wadahnya saja —
        // lebih ramah daripada menghapus seluruh kontennya.
        while (child.firstChild) node.insertBefore(child.firstChild, child)
        node.removeChild(child)
        continue
      }
      for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name)
      bersihkan(child)
    } else if (child.nodeType !== Node.TEXT_NODE) {
      node.removeChild(child)
    }
  }
}
