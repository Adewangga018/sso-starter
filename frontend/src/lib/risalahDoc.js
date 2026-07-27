// Ekspor risalah inovasi (SS / GIO / 5R) ke berkas Word (.doc).
//
// Pendekatan: menghasilkan dokumen HTML yang kompatibel Microsoft Word lalu
// mengunduhnya sebagai .doc (MIME application/msword). Word membuka berkas ini
// dan pengguna dapat menyimpannya kembali sebagai .docx bila perlu. Tanpa
// dependensi tambahan sehingga andal di lingkungan offline.
//
// Tata letak & penomoran bagian mengikuti form resmi tiap metodologi (lihat
// pages/inovasi/inovasiTemplate.js): SS/5R memakai PDCA dengan PLAN P.1-P.8,
// GIO memakai form F-GIO-01/DELTA dengan PLAN P.1-P.10 dan CHECK C.1-C.5.
// Urutan: Identitas, Anggota, PLAN + Lembar Pengesahan PLAN, lalu DO/CHECK/ACTION
// + Pengesahan Akhir bila tahapannya sudah terisi. Bagian yang kosong otomatis
// dilewati, sehingga ekspor setelah PLAN disahkan hanya memuat bagian PLAN.

import { jenisLabel } from '../pages/inovasi/statusClass'
import { bagian, faktorLabel, judulBagianJudul, periodeSebelum, tahapanJadwal, LIMA_R_STEP } from '../pages/inovasi/inovasiTemplate'

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

// Jadwal Kegiatan sebagai grid: baris = tahapan (PDCA untuk SS/5R, 8 Langkah DELTA
// untuk GIO). Kolom bulan mengikuti Periode (dua tahun, mis. 2026/2027 -> Jan 2026
// s/d Des 2027), sel dikunci year*100+bulan, lalu dipangkas ke bulan pertama s/d
// terakhir yang terjadwal - bulan yang tidak terpakai tidak ikut tampil (sama
// seperti komponen JadwalPdca saat baca-saja). SS/GIO: tiap tahapan x Rencana/
// Realisasi + kolom Jml. 5R: satu baris per tahapan, tanpa Rencana/Realisasi & Jml.
function jadwalGrid(d) {
  const MONTHS = [[1, 'Jan'], [2, 'Feb'], [3, 'Mar'], [4, 'Apr'], [5, 'Mei'], [6, 'Jun'], [7, 'Jul'], [8, 'Agu'], [9, 'Sep'], [10, 'Okt'], [11, 'Nov'], [12, 'Des']]
  const is5R = d.jenis === '5R'
  const partsY = String(d.periode || '').split('/').map((s) => Number(s.trim())).filter(Boolean)
  const y1 = partsY[0] || new Date().getFullYear()
  const years = partsY.length >= 2 ? [partsY[0], partsY[1]] : [y1, y1 + 1]
  const semuaCols = []
  for (const year of years) for (const [m, l] of MONTHS) semuaCols.push({ ym: year * 100 + m, m, l, year })

  // Kunci sel diturunkan dari tanggal ISO -> tetap benar untuk data lama (kunci bulan 1-12).
  const parseR = (s) => { if (!s) return {}; try { const o = JSON.parse(s); const r = {}; for (const v of Object.values(o)) if (Array.isArray(v) && v[0]) { const ym = Number(v[0].slice(0, 4)) * 100 + Number(v[0].slice(5, 7)); r[ym] = { start: v[0], end: v[1] || v[0] } } return r } catch { return {} } }
  const dayRange = (rg) => { if (!rg?.start) return ''; const s = Number(rg.start.slice(8, 10)); const e = rg.end ? Number(rg.end.slice(8, 10)) : s; return s === e ? `${s}` : `${s}-${e}` }
  const getRow = (t, j) => arr(d.jadwal).find((x) => x.tahapan === t && x.jenis === j)
  const bulanYm = (row) => (row?.bulan ? String(row.bulan).split(',').map(Number).filter(Boolean).map((n) => (n < 100 ? y1 * 100 + n : n)) : [])

  // Pangkas kolom ke rentang bulan yang terjadwal. Bila belum ada jadwal sama
  // sekali, tampilkan seluruh Periode agar tabel tidak kehilangan kolom.
  const terjadwal = new Set()
  for (const row of arr(d.jadwal)) {
    for (const ym of bulanYm(row)) terjadwal.add(ym)
    for (const ym of Object.keys(parseR(row?.rentang))) terjadwal.add(Number(ym))
  }
  const dipakai = semuaCols.map((c, i) => (terjadwal.has(c.ym) ? i : -1)).filter((i) => i >= 0)
  const cols = dipakai.length ? semuaCols.slice(dipakai[0], dipakai[dipakai.length - 1] + 1) : semuaCols

  const yg = []
  cols.forEach((c) => { const last = yg[yg.length - 1]; if (last && last.year === c.year) last.span += 1; else yg.push({ year: c.year, span: 1 }) })

  const cellsFor = (row, dark) => cols.map((c) => {
    const on = bulanYm(row).includes(c.ym) || parseR(row?.rentang)[c.ym]
    const fill = on ? (dark ? '#1f4f2c' : '#a7d3b0') : ''
    const fg = on && dark ? '#fff' : '#22402c'
    return `<td style="text-align:center;background:${fill};color:${fg};font-size:8.5pt">${dayRange(parseR(row?.rentang)[c.ym])}</td>`
  }).join('')

  const bodyRows = []
  for (const t of tahapanJadwal(d.jenis)) {
    if (is5R) {
      const row = getRow(t.kode, 'Rencana') || getRow(t.kode, 'Realisasi')
      bodyRows.push(`<tr><td style="font-weight:bold;vertical-align:middle">${esc(t.label)}</td>${cellsFor(row, true)}</tr>`)
    } else {
      ['Rencana', 'Realisasi'].forEach((j, ji) => {
        const row = getRow(t.kode, j)
        const tahCell = ji === 0 ? `<td rowspan="2" style="font-weight:bold;vertical-align:middle">${esc(t.label)}</td>` : ''
        const jmlCell = ji === 0 ? `<td rowspan="2" style="text-align:center;vertical-align:middle;font-weight:bold">${esc(getRow(t.kode, 'Rencana')?.jumlah ?? '')}</td>` : ''
        bodyRows.push(`<tr>${tahCell}<td>${j}</td>${cellsFor(row, j === 'Rencana')}${jmlCell}</tr>`)
      })
    }
  }

  const yHead = yg.map((g) => `<th colspan="${g.span}" style="text-align:center">${esc(g.year)}</th>`).join('')
  const mHead = cols.map((c) => `<th style="text-align:center">${esc(c.l)}</th>`).join('')
  const ketHead = is5R ? '' : `<th rowspan="2" style="width:9%">Ket.</th>`
  const jmlHead = is5R ? '' : `<th rowspan="2" style="width:6%">Jml.</th>`
  return `<table><thead>`
    + `<tr><th rowspan="2" style="width:18%">Tahapan</th>${ketHead}${yHead}${jmlHead}</tr>`
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

// Risalah 5R (Form F-5R-02) - struktur berbeda dari SS/GIO; sub-bagian C/D/F
// dari kolom JSON. Satu Lembar Pengesahan (tanpa PLAN/DO/CHECK/ACTION).
function buildBody5R(d) {
  const parse = (s) => { try { return s ? JSON.parse(s) : {} } catch { return {} } }
  const catatan = parse(d.limaRCatatan)
  const dok = parse(d.limaRDokumentasi)
  const parts = []

  parts.push(sectionTitle('A. Identitas Gugus'))
  parts.push(table([{ label: 'Keterangan', width: '30%' }, { label: 'Isi' }], [
    ['No. Registrasi', esc(d.noRegistrasi)],
    ['Nama Gugus', esc(d.namaGugus)],
    ['Judul Program 5R', esc(d.judul)],
    ['Kompartemen', esc(d.namaKompartemen)],
    ['Bagian', esc(d.bagianSeksi)],
    ['Area / Lokasi 5R', esc(d.areaLokasi)],
    ['Periode Program', esc(d.periode)],
  ]))

  parts.push(sectionTitle('B. Susunan Anggota Gugus'))
  parts.push(table(
    [{ label: 'No', width: '5%' }, { label: 'Peran', width: '15%' }, { label: 'Nama Lengkap' }, { label: 'NIK', width: '12%' }, { label: 'Jabatan' }, { label: 'Komp. Dep / Bagian' }],
    arr(d.anggota).map((a, i) => [i + 1, esc(a.peran), esc(a.nama), esc(a.nik), esc(a.jabatan), esc(a.depBagian)]),
  ))

  // C. Jadwal - grid bulan kalender + rentang tanggal per sel (sama seperti SS/GIO).
  parts.push(sectionTitle('C. Jadwal Kegiatan'))
  parts.push(jadwalGrid(d))

  // D. Catatan Pertemuan
  parts.push(sectionTitle('D. Catatan Pertemuan'))
  parts.push(table(
    [{ label: 'Tahapan 5R', width: '20%' }, ...LIMA_R_STEP.map((r) => ({ label: r.kode }))],
    [['Tanggal', 'tanggal'], ['Jam', 'jam'], ['% Kehadiran', 'kehadiran']].map(([label, field]) =>
      [`<b>${label}</b>`, ...LIMA_R_STEP.map((r) => esc(catatan?.[r.kode]?.[field]))]),
  ))

  // E. Profil 5R
  parts.push(sectionTitle('E. Profil 5R'))
  parts.push(paragraph(`Gambar Denah Ruang / Area : ${txt(d.areaLokasi) ? d.areaLokasi : '-'}`))
  parts.push(paragraph(d.profilDenahNama ? `Denah: ${d.profilDenahNama}` : '(belum ada denah)'))

  // F. Dokumentasi R1-R5
  for (const r of LIMA_R_STEP) {
    const blok = dok?.[r.kode] || {}
    parts.push(sectionTitle(`F. Dokumentasi ${r.label}`))
    parts.push(table(
      [{ label: 'No', width: '5%' }, { label: 'Kegiatan' }, { label: 'Permasalahan' }, { label: 'Aktivitas Perbaikan' }, { label: 'Hasil yang Dicapai' }],
      arr(blok.rows).map((x, i) => [i + 1, esc(x.kegiatan), esc(x.permasalahan), esc(x.aktivitas), esc(x.hasil)]),
    ))
    // Blok dokumentasi mengikuti template form cetak: judul "DOKUMENTASI Rn"
    // membentang di atas dua kolom SEBELUM | PROSES DAN SESUDAH, tiap sel memuat
    // daftar berkas lalu keterangan (bila diisi).
    const cell = (kategori) => {
      const files = arr(blok[kategori]).map((f) => esc(f.nama)).join('<br/>')
      const ket = txt(blok?.keterangan?.[kategori]) ? `<div style="margin-top:4pt;font-size:9pt">${esc(blok.keterangan[kategori])}</div>` : ''
      return `${files || '-'}${ket}`
    }
    parts.push(
      '<table><thead>'
      + `<tr><th colspan="2" style="text-align:center">DOKUMENTASI ${esc(r.kode)}</th></tr>`
      + '<tr><th style="width:50%;text-align:center">SEBELUM</th><th style="text-align:center">PROSES DAN SESUDAH</th></tr>'
      + '</thead><tbody><tr>'
      + `<td style="vertical-align:top">${cell('sebelum')}</td>`
      + `<td style="vertical-align:top">${cell('prosesSesudah')}</td>`
      + '</tr></tbody></table>',
    )
  }

  // G. Dampak Positif
  parts.push(sectionTitle('G. Dampak Positif Pelaksanaan 5R'))
  parts.push(paragraph(d.dampakPositif))
  if (txt(d.dampakPositifLainnya)) { parts.push(sectionTitle('Dampak Positif Lainnya')); parts.push(paragraph(d.dampakPositifLainnya)) }

  parts.push(sectionTitle('Lembar Pengesahan'))
  parts.push(signBlock(d.pengesahan, 'PLAN'))
  return parts.join('\n')
}

function buildBody(d, mode) {
  if (d.jenis === '5R') return buildBody5R(d)
  const parts = []
  const B = bagian(d.jenis)   // penomoran bagian mengikuti metodologi

  // A. Identitas
  parts.push(sectionTitle('A. Identitas Gugus'))
  parts.push(table(
    [{ label: 'Keterangan', width: '30%' }, { label: 'Isi' }],
    [
      ['No. Registrasi', esc(d.noRegistrasi)],
      ['Nama Gugus', esc(d.namaGugus)],
      ['Metodologi', esc(jenisLabel(d.jenis))],
      ['Unit / Departemen', esc(d.namaDepartemen)],
      ['Bagian / Seksi', esc(d.bagianSeksi)],
      ['Kompartemen', esc(d.namaKompartemen)],
      ['Tema ke-', esc(d.temaKe)],
      ['Periode Inovasi', esc(d.periode)],
    ],
  ))

  // B. Anggota
  parts.push(sectionTitle('B. Susunan Anggota Gugus'))
  parts.push(table(
    [{ label: 'No', width: '5%' }, { label: 'Peran', width: '15%' }, { label: 'Nama Lengkap' }, { label: 'NIK', width: '12%' }, { label: 'Jabatan' }, { label: 'Dep / Bagian' }],
    arr(d.anggota).map((a, i) => [i + 1, esc(a.peran), esc(a.nama), esc(a.nik), esc(a.jabatan), esc(a.depBagian)]),
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

  // GIO: stratifikasi & Pareto mendahului jadwal (form F-GIO-01).
  if (B.pareto && has(d.pareto)) {
    const total = arr(d.pareto).reduce((s, x) => s + (Number(x.frekuensi) || 0), 0) || 1
    let cum = 0
    parts.push(sectionTitle(`${B.pareto} Stratifikasi & Diagram Pareto (Penentuan Masalah Dominan)`))
    parts.push(table(
      [{ label: 'No', width: '5%' }, { label: 'Kategori / Jenis Masalah' }, { label: 'Frekuensi', width: '12%' }, { label: '% Kontribusi', width: '13%' }, { label: '% Kumulatif', width: '13%' }],
      arr(d.pareto).map((x, i) => {
        const pct = ((Number(x.frekuensi) || 0) / total) * 100
        cum += pct
        return [i + 1, esc(x.kategori), esc(x.frekuensi), `${pct.toFixed(1)}%`, `${cum.toFixed(1)}%`]
      }),
    ))
  }

  if (has(d.jadwal)) {
    parts.push(sectionTitle(`${B.jadwal} ${B.jadwalTitle}`))
    parts.push(jadwalGrid(d))
  }

  if (has(d.sasaran)) {
    parts.push(sectionTitle(`${B.sasaran} Penentuan Sasaran (SMART)`))
    parts.push(table(
      [{ label: 'No', width: '5%' }, { label: 'Sasaran' }, { label: 'Kondisi Sebelum' }, { label: 'Target' }, { label: 'Indikator Keberhasilan' }],
      arr(d.sasaran).map((x, i) => [i + 1, esc(x.sasaran), esc(x.kondisiSebelum), esc(x.target), esc(x.indikator)]),
    ))
  }

  if (has(d.qcdse)) {
    parts.push(sectionTitle(`${B.qcdse} Dampak Masalah terhadap QCDSE + M`))
    parts.push(table(
      [{ label: 'Aspek', width: '18%' }, { label: 'Dampak Kualitatif' }, { label: 'Dampak Kuantitatif (didukung data)' }],
      arr(d.qcdse).map((x) => [esc(x.aspek), esc(x.dampakKualitatif), esc(x.dampakKuantitatif)]),
    ))
  }

  if (has(d.fishbone)) {
    parts.push(sectionTitle(`${B.fishbone} Analisa Akar Penyebab Masalah (Diagram Tulang Ikan / Fishbone)`))
    parts.push(table(
      [{ label: 'Faktor', width: '18%' }, { label: 'Penyebab yang Teridentifikasi' }, { label: 'Akar Penyebab Dominan' }, { label: 'Prioritas', width: '10%' }],
      arr(d.fishbone).map((x) => [esc(faktorLabel(x.faktor)), esc(x.penyebab), esc(x.akarDominan), esc(x.prioritas)]),
    ))
    parts.push(FISH_MARKER) // titik sisip diagram fishbone (React) tepat di bawah tabel
  }

  // GIO: verifikasi akar penyebab dominan dengan data kuantitatif.
  if (B.verifikasiAkar && txt(d.verifikasiAkar)) {
    parts.push(sectionTitle(`${B.verifikasiAkar} Verifikasi Akar Penyebab Dominan (Data / Scatter Diagram / Histogram)`))
    parts.push(paragraph(d.verifikasiAkar))
  }

  if (has(d.rencanaPerbaikan)) {
    parts.push(sectionTitle(`${B.rencana} Rencana Perbaikan (5W + 2H)`))
    parts.push(table(
      [{ label: 'Akar Penyebab' }, { label: 'What' }, { label: 'Why' }, { label: 'Where' }, { label: 'When' }, { label: 'Who' }, { label: 'How' }, { label: 'How Much' }],
      arr(d.rencanaPerbaikan).map((x) => [esc(x.akarPenyebab), esc(x.what), esc(x.why), esc(x.where), esc(x.when), esc(x.who), esc(x.how), esc(x.howMuch)]),
    ))
  }

  if (txt(d.judul)) {
    parts.push(sectionTitle(`${B.judul} ${judulBagianJudul(d.jenis)}`))
    parts.push(`<p style="text-align:center;font-weight:bold;font-size:12pt">"${esc(d.judul)}"</p>`)
  }

  parts.push(sectionTitle('Lembar Pengesahan Tahap PLAN'))
  parts.push(signBlock(d.pengesahan, 'PLAN'))

  // ---- DO / CHECK / ACTION (hanya bila terisi) ----
  const adaDo = has(d.doPelaksanaan) || has(d.doKendala)
  const adaCheck = has(d.checkPerbandingan) || has(d.checkSasaran) || has(d.checkBiaya) || has(d.checkRisiko)
    || txt(d.verifikasiStatistik)
  const adaAction = has(d.actionStandarisasi) || has(d.actionTindakLanjut) || txt(d.actionTemaBerikutnya)

  if (mode === 'full' && adaDo) {
    parts.push(stageBanner('DO — Melaksanakan Perbaikan'))
    if (has(d.doPelaksanaan)) {
      // Form F-GIO-01 tidak memuat kolom Tanggal pada D.1.
      const adaTanggal = d.jenis !== 'GIO'
      parts.push(sectionTitle('D.1 Pelaksanaan Perbaikan & Monitoring'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Tahapan Kegiatan' },
          ...(adaTanggal ? [{ label: 'Tanggal', width: '14%' }] : []),
          { label: 'Monitoring Hasil Perbaikan' }, { label: 'Foto / Evidence' }],
        arr(d.doPelaksanaan).map((x, i) => [i + 1, esc(x.tahapanKegiatan),
          ...(adaTanggal ? [esc(x.tanggal)] : []),
          esc(x.monitoringHasil), esc(x.evidenceNama)]),
      ))
    }
    if (has(d.doKendala)) {
      parts.push(sectionTitle('D.2 Kendala Selama Pelaksanaan & Solusinya'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Kendala' }, { label: 'Solusi / Tindakan yang Diambil' }, { label: 'Waktu', width: '14%' }, { label: 'PIC', width: '14%' }],
        arr(d.doKendala).map((x, i) => [i + 1, esc(x.kendala), esc(x.solusi), esc(x.waktu), esc(x.pic)]),
      ))
    }
  }

  if (mode === 'full' && adaCheck) {
    parts.push(stageBanner('CHECK — Evaluasi Hasil Perbaikan'))
    if (has(d.checkPerbandingan)) {
      const pSebelum = periodeSebelum(d.periode)
      parts.push(sectionTitle(`${B.cPerbandingan} Perbandingan Kondisi Sebelum & Sesudah Perbaikan`))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: `SEBELUM${pSebelum ? ` (periode ${pSebelum})` : ''}` }, { label: `SESUDAH${d.periode ? ` (periode ${d.periode})` : ''}` }],
        arr(d.checkPerbandingan).map((x, i) => [i + 1, esc(x.sebelum), esc(x.sesudah)]),
      ))
    }
    if (has(d.checkSasaran)) {
      parts.push(sectionTitle(`${B.cSasaran} Pencapaian Sasaran Perbaikan`))
      parts.push(table(
        [{ label: 'Sasaran' }, { label: 'Sebelum' }, { label: 'Target' }, { label: 'Sesudah' }, { label: '% Capaian', width: '12%' }],
        arr(d.checkSasaran).map((x) => [esc(x.sasaran), esc(x.sebelum), esc(x.target), esc(x.sesudah), esc(x.persenCapaian)]),
      ))
    }
    // GIO: pembuktian statistik hasil perbaikan.
    if (B.cStatistik && txt(d.verifikasiStatistik)) {
      parts.push(sectionTitle(`${B.cStatistik} Verifikasi Statistik Hasil Perbaikan (Control Chart / Histogram)`))
      parts.push(paragraph(d.verifikasiStatistik))
    }
    if (has(d.checkBiaya)) {
      parts.push(sectionTitle(`${B.cBiaya} Analisa Manfaat & Biaya (Cost-Benefit)`))
      parts.push(table(
        [{ label: 'Komponen' }, { label: 'Perhitungan / Dasar' }, { label: 'Nilai' }],
        arr(d.checkBiaya).map((x) => [esc(x.komponen), esc(x.perhitungan), esc(x.nilai)]),
      ))
    }
    if (has(d.checkRisiko)) {
      parts.push(sectionTitle(`${B.cRisiko} Analisa Risiko / Dampak Negatif & Penanganannya`))
      parts.push(table(
        [{ label: 'Potensi Dampak Negatif' }, { label: 'Rencana Penanganan / Mitigasi' }],
        arr(d.checkRisiko).map((x) => [esc(x.dampakNegatif), esc(x.mitigasi)]),
      ))
    }
  }

  if (mode === 'full' && adaAction) {
    parts.push(stageBanner('ACTION — Standarisasi & Rencana Tindak Lanjut'))
    if (has(d.actionStandarisasi)) {
      parts.push(sectionTitle('A.1 Standardisasi Hasil Perbaikan (menjadi SOP Perusahaan)'))
      parts.push(table(
        [{ label: 'No', width: '5%' }, { label: 'Standar Baru (SOP / Instruksi Kerja / Format)' }, { label: 'No. Dokumen' }, { label: 'Tgl. Berlaku', width: '14%' }, { label: 'PIC', width: '14%' }],
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
