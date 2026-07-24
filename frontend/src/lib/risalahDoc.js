// Ekspor risalah inovasi (SS / GIO / 5R) ke berkas Word (.doc).
//
// Pendekatan: menghasilkan dokumen HTML yang kompatibel Microsoft Word lalu
// mengunduhnya sebagai .doc (MIME application/msword). Word membuka berkas ini
// dan pengguna dapat menyimpannya kembali sebagai .docx bila perlu. Tanpa
// dependensi tambahan sehingga andal di lingkungan offline.
//
// Tata letak mengikuti Form Risalah Sistem Saran (PDCA): Identitas, Anggota,
// PLAN (P.1-P.8) + Lembar Pengesahan PLAN, lalu DO/CHECK/ACTION + Pengesahan
// Akhir bila tahapannya sudah terisi. Bagian yang kosong otomatis dilewati,
// sehingga ekspor setelah PLAN disahkan hanya memuat bagian PLAN.

import { jenisLabel } from '../pages/inovasi/statusClass'

function esc(v) {
  if (v === null || v === undefined || v === '') return '-'
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

const arr = (v) => (Array.isArray(v) ? v : [])
const has = (v) => arr(v).length > 0
const txt = (v) => (v !== null && v !== undefined && String(v).trim() !== '')

// Penanda posisi diagram fishbone (disisipkan komponen React di modal Detail).
const FISH_MARKER = '<!--@@FISHBONE@@-->'

// Tabel generik: headers = [{label, width?}], rows = [[cell, cell, ...]]
function table(headers, rows) {
  const th = headers.map((h) => `<th${h.width ? ` style="width:${h.width}"` : ''}>${esc(h.label)}</th>`).join('')
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c) => `<td>${c === '' || c == null ? '-' : c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" style="text-align:center;color:#888">Belum ada data.</td></tr>`
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`
}

// P.3 Jadwal (PDCA) sebagai grid: kolom bulan dikelompokkan per tahun sesuai
// Periode, sel terarsir bila terjadwal & memuat rentang tanggal (dari `rentang`).
function jadwalGrid(d) {
  const MONTHS = [[6, 'Jun'], [7, 'Jul'], [8, 'Agu'], [9, 'Sep'], [10, 'Okt'], [11, 'Nov'], [12, 'Des'], [1, 'Jan'], [2, 'Feb'], [3, 'Mar'], [4, 'Apr'], [5, 'Mei']]
  const [a, b] = String(d.periode || '').split('/')
  const y1 = Number(a) || ''
  const y2 = Number(b) || (y1 ? y1 + 1 : '')
  const cols = MONTHS.map(([m, l]) => ({ m, l, year: m >= 6 ? y1 : y2 }))
  const yg = []
  cols.forEach((c) => { const last = yg[yg.length - 1]; if (last && last.year === c.year) last.span += 1; else yg.push({ year: c.year, span: 1 }) })

  const parseR = (s) => { if (!s) return {}; try { const o = JSON.parse(s); const r = {}; for (const [m, v] of Object.entries(o)) if (Array.isArray(v) && v[0]) r[Number(m)] = { start: v[0], end: v[1] || v[0] }; return r } catch { return {} } }
  const dayRange = (rg) => { if (!rg?.start) return ''; const s = Number(rg.start.slice(8, 10)); const e = rg.end ? Number(rg.end.slice(8, 10)) : s; return s === e ? `${s}` : `${s}-${e}` }
  const getRow = (t, j) => arr(d.jadwal).find((x) => x.tahapan === t && x.jenis === j)

  const bodyRows = []
  for (const t of ['PLAN', 'DO', 'CHECK', 'ACTION']) {
    ['Rencana', 'Realisasi'].forEach((j, ji) => {
      const row = getRow(t, j)
      const bulan = row?.bulan ? String(row.bulan).split(',').map(Number).filter(Boolean) : []
      const ranges = parseR(row?.rentang)
      const cells = cols.map((c) => {
        const on = bulan.includes(c.m) || ranges[c.m]
        const fill = on ? (j === 'Rencana' ? '#1f4f2c' : '#a7d3b0') : ''
        const fg = on && j === 'Rencana' ? '#fff' : '#22402c'
        return `<td style="text-align:center;background:${fill};color:${fg};font-size:8.5pt">${dayRange(ranges[c.m])}</td>`
      }).join('')
      const tahCell = ji === 0 ? `<td rowspan="2" style="font-weight:bold;vertical-align:middle">${t}</td>` : ''
      const jmlCell = ji === 0 ? `<td rowspan="2" style="text-align:center;vertical-align:middle;font-weight:bold">${esc(getRow(t, 'Rencana')?.jumlah ?? '')}</td>` : ''
      bodyRows.push(`<tr>${tahCell}<td>${j}</td>${cells}${jmlCell}</tr>`)
    })
  }

  const yHead = yg.map((g) => `<th colspan="${g.span}" style="text-align:center">${esc(g.year)}</th>`).join('')
  const mHead = cols.map((c) => `<th style="text-align:center">${esc(c.l)}</th>`).join('')
  return `<table><thead>`
    + `<tr><th rowspan="2" style="width:11%">Tahapan</th><th rowspan="2" style="width:11%">Ket.</th>${yHead}<th rowspan="2" style="width:6%">Jml.</th></tr>`
    + `<tr>${mHead}</tr></thead><tbody>${bodyRows.join('')}</tbody></table>`
}

function sectionTitle(t) {
  return `<p class="sec">${esc(t)}</p>`
}
function stageBanner(t) {
  return `<h2>${esc(t)}</h2>`
}
function paragraph(v) {
  return `<div class="para">${esc(v)}</div>`
}

// Blok tanda tangan pengesahan (Ketua, Fasilitator, Pembina Dep., Pembina Komp.)
function signBlock(pengesahan, tahap) {
  const rows = arr(pengesahan).filter((p) => (p.tahap ?? '').toUpperCase().includes(tahap))
  const src = rows.length ? rows : [{ peran: 'Ketua Gugus' }, { peran: 'Fasilitator' }, { peran: 'Pembina Tk. Departemen' }, { peran: 'Pembina Tk. Kompartemen' }]
  const cells = src.map((p) => `
    <td style="width:25%;vertical-align:top">
      <div style="font-weight:bold">${esc(p.peran)}</div>
      <div style="font-size:9pt;color:#555">Tgl: ${p.tgl ? esc(new Date(p.tgl).toLocaleDateString('id-ID')) : '-'}</div>
      <div style="font-size:9pt;color:#555">Status: ${esc(p.status ?? '-')}</div>
      ${txt(p.komentar) ? `<div style="font-size:9pt">Komentar: ${esc(p.komentar)}</div>` : ''}
      <div style="height:36pt"></div>
      <div style="border-top:1px solid #000;text-align:center;padding-top:2pt">( ${esc(p.nama ?? '................')} )</div>
    </td>`).join('')
  return `<table><tbody><tr>${cells}</tr></tbody></table>`
}

function buildBody(d, mode) {
  const parts = []

  // A. Identitas
  parts.push(sectionTitle('A. Identitas Gugus'))
  parts.push(table(
    [{ label: 'Keterangan', width: '30%' }, { label: 'Isi' }],
    [
      ['No. Registrasi', esc(d.noRegistrasi)],
      ['Nama Gugus', esc(d.namaGugus)],
      ['Metodologi', esc(jenisLabel(d.jenis))],
      ['Departemen', esc(d.namaDepartemen)],
      ['Kompartemen', esc(d.namaKompartemen)],
      ['Tema ke-', esc(d.temaKe)],
      ['Periode Inovasi', esc(d.periode)],
    ],
  ))

  // B. Anggota
  parts.push(sectionTitle('B. Susunan Anggota Gugus'))
  parts.push(table(
    [{ label: 'No', width: '5%' }, { label: 'Peran', width: '15%' }, { label: 'Nama Lengkap' }, { label: 'NIK', width: '12%' }, { label: 'Jabatan' }, { label: 'Dep / Bagian' }],
    arr(d.anggota).map((a, i) => [i + 1, esc(a.nama), esc(a.peran), esc(a.nik), esc(a.jabatan), esc(a.depBagian)]),
  ))

  // ---- PLAN ----
  parts.push(stageBanner('PLAN — Mengungkap Kondisi Awal, Analisa Masalah, dan Rencana Perbaikan'))

  parts.push(sectionTitle('P.1 Latar Belakang Masalah'))
  parts.push(paragraph(d.latarBelakang))
  if (txt(d.masalahUtama)) { parts.push(sectionTitle('Masalah Utama')); parts.push(paragraph(d.masalahUtama)) }

  if (has(d.dataPendukung)) {
    parts.push(sectionTitle('P.2 Data Pendukung (Kondisi Awal)'))
    parts.push(table(
      [{ label: 'No', width: '5%' }, { label: 'Indikator / Data Pendukung' }, { label: 'Kondisi Awal' }, { label: 'Sumber / Keterangan' }],
      arr(d.dataPendukung).map((x, i) => [i + 1, esc(x.indikator), esc(x.kondisiAwal), esc(x.sumberKeterangan ?? x.lampiranLink ?? x.lampiranNama)]),
    ))
  }

  if (has(d.jadwal)) {
    parts.push(sectionTitle('P.3 Jadwal Kegiatan (PDCA)'))
    parts.push(jadwalGrid(d))
  }

  if (has(d.sasaran)) {
    parts.push(sectionTitle('P.4 Penentuan Sasaran (SMART)'))
    parts.push(table(
      [{ label: 'No', width: '5%' }, { label: 'Sasaran' }, { label: 'Kondisi Sebelum' }, { label: 'Target' }, { label: 'Indikator Keberhasilan' }],
      arr(d.sasaran).map((x, i) => [i + 1, esc(x.sasaran), esc(x.kondisiSebelum), esc(x.target), esc(x.indikator)]),
    ))
  }

  if (has(d.qcdse)) {
    parts.push(sectionTitle('P.5 Dampak Masalah terhadap QCDSE'))
    parts.push(table(
      [{ label: 'Aspek', width: '18%' }, { label: 'Dampak Kualitatif' }, { label: 'Dampak Kuantitatif' }],
      arr(d.qcdse).map((x) => [esc(x.aspek), esc(x.dampakKualitatif), esc(x.dampakKuantitatif)]),
    ))
  }

  if (has(d.fishbone)) {
    parts.push(sectionTitle('P.6 Analisa Akar Penyebab Masalah (Diagram Tulang Ikan / Fishbone)'))
    parts.push(table(
      [{ label: 'Faktor', width: '18%' }, { label: 'Penyebab Teridentifikasi' }, { label: 'Akar Penyebab Dominan' }, { label: 'Prioritas', width: '10%' }],
      arr(d.fishbone).map((x) => [esc(x.faktor), esc(x.penyebab), esc(x.akarDominan), esc(x.prioritas)]),
    ))
    parts.push(FISH_MARKER) // titik sisip diagram fishbone (React) tepat di bawah tabel P.6
  }
  if (txt(d.verifikasiAkar)) { parts.push(sectionTitle('Verifikasi Akar (Pareto)')); parts.push(paragraph(d.verifikasiAkar)) }
  if (has(d.pareto)) {
    parts.push(table(
      [{ label: 'No', width: '5%' }, { label: 'Kategori' }, { label: 'Frekuensi', width: '15%' }],
      arr(d.pareto).map((x, i) => [i + 1, esc(x.kategori), esc(x.frekuensi)]),
    ))
  }

  if (has(d.rencanaPerbaikan)) {
    parts.push(sectionTitle('P.7 Rencana Perbaikan (5W + 2H)'))
    parts.push(table(
      [{ label: 'Akar Penyebab' }, { label: 'What' }, { label: 'Why' }, { label: 'Where' }, { label: 'When' }, { label: 'Who' }, { label: 'How' }, { label: 'How Much' }],
      arr(d.rencanaPerbaikan).map((x) => [esc(x.akarPenyebab), esc(x.what), esc(x.why), esc(x.where), esc(x.when), esc(x.who), esc(x.how), esc(x.howMuch)]),
    ))
  }

  if (txt(d.judul)) {
    parts.push(sectionTitle(`P.8 Judul ${d.jenis === 'GIO' ? 'Gugus Inovasi Operasi (GIO)' : d.jenis === '5R' ? 'Program 5R' : 'Sistem Saran (SS)'}`))
    parts.push(`<p style="text-align:center;font-weight:bold;font-size:12pt">"${esc(d.judul)}"</p>`)
  }

  parts.push(sectionTitle('Lembar Pengesahan Tahap PLAN'))
  parts.push(signBlock(d.pengesahan, 'PLAN'))

  // ---- DO / CHECK / ACTION (hanya bila terisi) ----
  const adaDo = has(d.doPelaksanaan) || has(d.doKendala)
  const adaCheck = has(d.checkPerbandingan) || has(d.checkSasaran) || has(d.checkBiaya) || has(d.checkRisiko)
  const adaAction = has(d.actionStandarisasi) || has(d.actionTindakLanjut) || txt(d.actionTemaBerikutnya)

  if (mode === 'full' && adaDo) {
    parts.push(stageBanner('DO — Melaksanakan Perbaikan'))
    if (has(d.doPelaksanaan)) {
      parts.push(sectionTitle('D.1 Pelaksanaan Perbaikan & Monitoring'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Tahapan Pelaksanaan' }, { label: 'Tanggal', width: '14%' }, { label: 'Monitoring Hasil' }, { label: 'Evidence' }],
        arr(d.doPelaksanaan).map((x, i) => [i + 1, esc(x.tahapanKegiatan), esc(x.tanggal), esc(x.monitoringHasil), esc(x.evidenceNama)]),
      ))
    }
    if (has(d.doKendala)) {
      parts.push(sectionTitle('D.2 Kendala Selama Pelaksanaan & Solusinya'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Kendala' }, { label: 'Solusi / Tindakan' }, { label: 'Waktu', width: '14%' }, { label: 'PIC', width: '14%' }],
        arr(d.doKendala).map((x, i) => [i + 1, esc(x.kendala), esc(x.solusi), esc(x.waktu), esc(x.pic)]),
      ))
    }
  }

  if (mode === 'full' && adaCheck) {
    parts.push(stageBanner('CHECK — Evaluasi Hasil Perbaikan'))
    if (has(d.checkPerbandingan)) {
      parts.push(sectionTitle('C.1 Perbandingan Kondisi Sebelum & Sesudah'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Sebelum' }, { label: 'Sesudah' }],
        arr(d.checkPerbandingan).map((x, i) => [i + 1, esc(x.sebelum), esc(x.sesudah)]),
      ))
    }
    if (has(d.checkSasaran)) {
      parts.push(sectionTitle('C.2 Pencapaian Sasaran Perbaikan'))
      parts.push(table(
        [{ label: 'Sasaran' }, { label: 'Sebelum' }, { label: 'Target' }, { label: 'Sesudah' }, { label: '% Capaian', width: '12%' }],
        arr(d.checkSasaran).map((x) => [esc(x.sasaran), esc(x.sebelum), esc(x.target), esc(x.sesudah), esc(x.persenCapaian)]),
      ))
    }
    if (has(d.checkBiaya)) {
      parts.push(sectionTitle('C.3 Analisa Manfaat & Biaya'))
      parts.push(table(
        [{ label: 'Komponen' }, { label: 'Perhitungan / Dasar' }, { label: 'Nilai' }],
        arr(d.checkBiaya).map((x) => [esc(x.komponen), esc(x.perhitungan), esc(x.nilai)]),
      ))
    }
    if (has(d.checkRisiko)) {
      parts.push(sectionTitle('C.4 Analisa Risiko / Dampak Negatif'))
      parts.push(table(
        [{ label: 'Potensi Dampak Negatif' }, { label: 'Rencana Penanganan / Mitigasi' }],
        arr(d.checkRisiko).map((x) => [esc(x.dampakNegatif), esc(x.mitigasi)]),
      ))
    }
  }

  if (mode === 'full' && adaAction) {
    parts.push(stageBanner('ACTION — Standarisasi & Rencana Tindak Lanjut'))
    if (has(d.actionStandarisasi)) {
      parts.push(sectionTitle('A.1 Standarisasi Hasil Perbaikan'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Standar Baru (SOP/IK/Format)' }, { label: 'No. Dokumen' }, { label: 'Tgl. Berlaku', width: '14%' }, { label: 'PIC', width: '14%' }],
        arr(d.actionStandarisasi).map((x, i) => [i + 1, esc(x.standarBaru), esc(x.noDokumen), esc(x.tglBerlaku), esc(x.pic)]),
      ))
    }
    if (has(d.actionTindakLanjut)) {
      parts.push(sectionTitle('A.2 Rencana Tindak Lanjut & Perbaikan Berkelanjutan'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Rencana Tindak Lanjut' }, { label: 'Target Waktu', width: '16%' }, { label: 'PIC', width: '14%' }, { label: 'Status', width: '14%' }],
        arr(d.actionTindakLanjut).map((x, i) => [i + 1, esc(x.rencana), esc(x.targetWaktu), esc(x.pic), esc(x.status)]),
      ))
    }
    if (txt(d.actionTemaBerikutnya)) { parts.push(sectionTitle('A.3 Rencana Tema / Inovasi Berikutnya')); parts.push(paragraph(d.actionTemaBerikutnya)) }
  }

  if (mode === 'full' && (adaDo || adaCheck || adaAction)) {
    parts.push(sectionTitle('Lembar Pengesahan Akhir (Tahap DO–CHECK–ACTION)'))
    parts.push(signBlock(d.pengesahan, 'AKHIR'))
  }

  return parts.join('\n')
}

// CSS diberi prefiks ".rd" agar tidak bocor ke seluruh aplikasi saat disisipkan
// lewat dangerouslySetInnerHTML pada modal Detail.
const SCOPED_CSS = `
.rd { font-family: inherit; font-size: 13px; color: #1a1f1b; }
.rd .rd-h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
.rd .rd-sub { text-align: center; color: #667; font-size: 12px; margin-bottom: 12px; }
.rd h2 { background: #1f4f2c; color: #fff; padding: 6px 9px; font-size: 13px; margin: 16px 0 6px; border-radius: 5px; }
.rd p.sec { font-weight: 700; background: #eef3ec; border-left: 3px solid #1f4f2c; padding: 4px 7px; margin: 10px 0 4px; }
.rd div.para { border: 1px solid #d7ded8; border-radius: 5px; padding: 7px; margin-bottom: 10px; white-space: pre-wrap; }
.rd table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
.rd th, .rd td { border: 1px solid #c4cec6; padding: 4px 6px; vertical-align: top; font-size: 12px; text-align: left; }
.rd th { background: #e9efe6; font-weight: 700; }
`

/**
 * Menghasilkan HTML (ter-scope) seluruh isi risalah untuk modal Detail, terpecah
 * di titik diagram fishbone (tepat di bawah tabel P.6) sehingga komponen diagram
 * React dapat disisipkan di antara `before` dan `after`. Bukan untuk diunduh.
 * @param {object} data - GugusDetailDto lengkap (hasil api.getInovasi).
 * @param {{ mode?: 'plan'|'full' }} opts
 * @returns {{ before: string, after: string }}
 */
export function renderRisalahHtml(data, { mode = 'full' } = {}) {
  const jl = jenisLabel(data.jenis)
  const header = `
    <h1 class="rd-h1">RISALAH ${esc((jl || '').toUpperCase())}</h1>
    <div class="rd-sub">PT Gresik Cipta Sejahtera &middot; No. Reg: ${esc(data.noRegistrasi)} &middot; Status: ${esc(data.status)}</div>`
  const body = buildBody(data, mode)
  const [b, a] = body.split(FISH_MARKER)
  return {
    before: `<style>${SCOPED_CSS}</style><div class="rd">${header}${b}</div>`,
    after: a != null ? `<div class="rd">${a}</div>` : '',
  }
}
