import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileUp,
  Link2,
  Lock,
  Plus,
  Save,
  Send,
  UserPlus,
  X,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useDialog } from '../../components/DialogProvider'
import RepeatTable from './RepeatTable'
import PegawaiPicker from './PegawaiPicker'
import FishboneDiagram from './FishboneDiagram'
import JadwalPdca from './JadwalPdca'
import { jenisLabel, statusClass } from './statusClass'
import { anggotaKeSlot, bagian, faktorLabel, judulBagianJudul, periodeSebelum, tahapanJadwal, LIMA_R_STEP } from './inovasiTemplate'
import { renderRisalahHtml } from '../../lib/risalahDoc'
import { unduhRisalahPdf } from '../../lib/risalahPdf'
import './inovasi.css'

const ASPEK = [
  ['Q', 'Quality'],
  ['C', 'Cost'],
  ['D', 'Delivery'],
  ['S', 'Safety'],
  ['E', 'Environment'],
  ['M', 'Morale'],
]
const FAKTOR = ['Man', 'Method', 'Material', 'Machine', 'Environment']
const STEPS = ['PLAN', 'DO', 'CHECK', 'ACTION']

// P.3 rentang tanggal per sel bulan disimpan JSON, dikunci year*100+bulan
// (mis. {"202607":["2026-07-01","2026-07-15"]}) agar Periode 2 tahun (2026/2027)
// tidak bentrok antara Jul 2026 & Jul 2027. Kunci diturunkan dari tanggal ISO-nya,
// jadi data lama (dikunci bulan 1-12) tetap terbaca benar.
function parseRentang(s) {
  if (!s) return {}
  try {
    const obj = JSON.parse(s)
    const out = {}
    for (const v of Object.values(obj)) {
      if (Array.isArray(v) && v[0]) {
        const ym = Number(v[0].slice(0, 4)) * 100 + Number(v[0].slice(5, 7))
        out[ym] = { start: v[0], end: v[1] || v[0] }
      }
    }
    return out
  } catch { return {} }
}
function serializeRentang(ranges) {
  const obj = {}
  for (const [ym, r] of Object.entries(ranges || {})) {
    if (r?.start) obj[ym] = [r.start, r.end || r.start]
  }
  return Object.keys(obj).length ? JSON.stringify(obj) : null
}

// --- Risalah 5R: struktur & (de)serialisasi sub-bagian JSON ---
function emptyFiveR() {
  return {
    areaLokasi: '', profilDenahPath: '', profilDenahNama: '',
    dampakPositif: '', dampakPositifLainnya: '',
    // Jadwal (C) memakai tabel jadwal seperti SS/GIO; hanya D & F yang JSON di sini.
    catatan: {},       // { R1:{tanggal,jam,kehadiran}, ... }
    dokumentasi: {},   // { R1:{ rows:[{kegiatan,permasalahan,aktivitas,hasil}], sebelum:[{path,nama}], prosesSesudah:[{path,nama}] } }
  }
}
const parseJsonObj = (s) => { try { return s ? JSON.parse(s) : {} } catch { return {} } }

// --- validasi kelengkapan sebelum pengajuan pengesahan ---
const kosong = (v) => v == null || String(v).trim() === ''

// Tabel wajib: minimal satu baris, dan setiap kolom wajib terisi di tiap baris.
// `cols` = [[key, labelKolom], ...]; kolom opsional cukup tidak didaftarkan.
function cekTabel(label, rows, cols) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return [`${label} — belum ada baris (minimal 1 baris)`]
  const out = []
  list.forEach((r, i) => {
    const hilang = cols.filter(([k]) => kosong(r[k])).map(([, l]) => l)
    if (hilang.length) out.push(`${label} — baris ${i + 1}: ${hilang.join(', ')}`)
  })
  return out
}

// Ringkas daftar field yang belum terisi jadi pesan alert (dipangkas agar dialog
// tidak melebihi layar; daftar lengkap tetap tampil pada kotak peringatan halaman).
function pesanKurang(list) {
  const tampil = list.slice(0, 12)
  const sisa = list.length - tampil.length
  return `Masih ada ${list.length} isian wajib yang belum lengkap:\n\n`
    + tampil.map((s) => `• ${s}`).join('\n')
    + (sisa > 0 ? `\n• ...dan ${sisa} lainnya (lihat daftar lengkap pada kotak peringatan di halaman).` : '')
}

export default function InovasiForm() {
  const { id } = useParams()
  const ctx = useOutletContext() || {}
  const base = ctx.base ?? '/my-innovation'
  const navigate = useNavigate()
  const dialog = useDialog()

  const [data, setData] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [step, setStep] = useState('PLAN')
  const [banner, setBanner] = useState(null) // {type, text}
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSlot, setPickerSlot] = useState(null)   // indeks slot anggota yang sedang diisi
  const [detailOpen, setDetailOpen] = useState(false)

  // --- editable state ---
  const [ident, setIdent] = useState({ namaGugus: '', temaKe: '', periode: '', bagianSeksi: '', judul: '', latarBelakang: '', masalahUtama: '', verifikasiAkar: '' })
  const [anggota, setAnggota] = useState([])
  const [dataPendukung, setDataPendukung] = useState([])
  const [jadwal, setJadwal] = useState([])
  const [sasaran, setSasaran] = useState([])
  const [pareto, setPareto] = useState([])
  const [qcdse, setQcdse] = useState([])
  const [fishbone, setFishbone] = useState([])
  const [rencana, setRencana] = useState([])
  const [doPel, setDoPel] = useState([])
  const [doKen, setDoKen] = useState([])
  const [chkStat, setChkStat] = useState('')   // GIO C.3 Verifikasi Statistik
  const [chkPerb, setChkPerb] = useState([])
  const [chkSas, setChkSas] = useState([])
  const [chkBia, setChkBia] = useState([])
  const [chkRis, setChkRis] = useState([])
  const [actTema, setActTema] = useState('')
  const [actStd, setActStd] = useState([])
  const [actTl, setActTl] = useState([])
  // Risalah 5R (Form F-5R-02) - struktur berbeda; sub-bagian C/D/F disimpan JSON.
  const [fiveR, setFiveR] = useState(emptyFiveR())

  const hydrate = useCallback((d) => {
    setData(d)
    setIdent({
      namaGugus: d.namaGugus ?? '',
      temaKe: d.temaKe ?? '',
      periode: d.periode || periodeSekarang(),
      bagianSeksi: d.bagianSeksi ?? '',
      judul: d.judul ?? '',
      latarBelakang: d.latarBelakang ?? '',
      masalahUtama: d.masalahUtama ?? '',
      verifikasiAkar: d.verifikasiAkar ?? '',
    })
    setAnggota(anggotaKeSlot(d.jenis, d.anggota))
    setDataPendukung(d.dataPendukung ?? [])
    setPareto(d.pareto ?? [])
    // jadwal: satu baris per (tahapan x Rencana/Realisasi). Tahapan mengikuti
    // metodologi - PDCA untuk SS/5R, 8 Langkah DELTA untuk GIO. Sel dikunci
    // year*100+bulan; nilai `bulan` lama (1-12 tanpa tahun) dipetakan ke tahun
    // awal Periode.
    const y1 = Number(String(d.periode || '').split('/')[0]) || new Date().getFullYear()
    const jad = []
    for (const t of tahapanJadwal(d.jenis)) {
      for (const j of ['Rencana', 'Realisasi']) {
        const found = (d.jadwal ?? []).find((x) => x.tahapan === t.kode && x.jenis === j)
        const ranges = parseRentang(found?.rentang)
        const legacy = found?.bulan
          ? found.bulan.split(',').map((n) => Number(n)).filter(Boolean).map((n) => (n < 100 ? y1 * 100 + n : n))
          : []
        const bulanArr = Array.from(new Set([...legacy, ...Object.keys(ranges).map(Number)]))
        jad.push({ tahapan: t.kode, label: t.label, jenis: j, ranges, bulanArr, jumlah: found?.jumlah ?? '' })
      }
    }
    setJadwal(jad)
    setSasaran(d.sasaran ?? [])
    // qcdse fixed 6 rows
    setQcdse(ASPEK.map(([a]) => {
      const f = (d.qcdse ?? []).find((x) => x.aspek === a)
      return { aspek: a, dampakKualitatif: f?.dampakKualitatif ?? '', dampakKuantitatif: f?.dampakKuantitatif ?? '' }
    }))
    // fishbone fixed 5 rows; penyebab disimpan sebagai daftar (satu per baris).
    setFishbone(FAKTOR.map((fk) => {
      const f = (d.fishbone ?? []).find((x) => x.faktor === fk)
      const items = (f?.penyebab ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      return { faktor: fk, penyebabItems: items, penyebab: items.join('\n'), akarDominan: f?.akarDominan ?? '', prioritas: f?.prioritas ?? '' }
    }))
    setRencana(d.rencanaPerbaikan ?? [])
    setDoPel(d.doPelaksanaan ?? [])
    setDoKen(d.doKendala ?? [])
    setChkStat(d.verifikasiStatistik ?? '')
    setChkPerb(d.checkPerbandingan ?? [])
    setChkSas(d.checkSasaran ?? [])
    setChkBia(d.checkBiaya ?? [])
    setChkRis(d.checkRisiko ?? [])
    setActTema(d.actionTemaBerikutnya ?? '')
    setActStd(d.actionStandarisasi ?? [])
    setActTl(d.actionTindakLanjut ?? [])
    // 5R: bagian D/F dari kolom JSON; jadwal (C) memakai tabel jadwal (state di atas).
    setFiveR({
      areaLokasi: d.areaLokasi ?? '',
      profilDenahPath: d.profilDenahPath ?? '', profilDenahNama: d.profilDenahNama ?? '',
      dampakPositif: d.dampakPositif ?? '', dampakPositifLainnya: d.dampakPositifLainnya ?? '',
      catatan: parseJsonObj(d.limaRCatatan),
      dokumentasi: parseJsonObj(d.limaRDokumentasi),
    })
  }, [])

  const load = useCallback(async () => {
    try {
      const d = await api.getInovasi(id)
      hydrate(d)
      setLoadErr('')
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : 'Gagal memuat risalah.')
    }
  }, [id, hydrate])

  useEffect(() => { load() }, [load])

  const editPlan = data?.bisaEdit === true
  // DO/CHECK/ACTION dapat diedit setelah PLAN disahkan, dan terkunci lagi saat
  // pengesahan akhir sudah diajukan atau risalah Selesai.
  const editLanjut = data?.isOwner === true && data?.planDisahkan === true
    && data?.status !== 'Pengesahan Akhir' && data?.status !== 'Selesai'
  const isGio = data?.jenis === 'GIO'
  const is5R = data?.jenis === '5R'
  // Penomoran & judul bagian mengikuti metodologi (GIO memakai form F-GIO-01/DELTA).
  const B = bagian(data?.jenis)
  const tahapanList = tahapanJadwal(data?.jenis)

  // Susunan anggota = slot tetap per metodologi (jumlah pasti, tanpa tambah manual):
  //  - SS  : 3 orang (1 Ketua, 1 Sekretaris, 1 Fasilitator), satu departemen
  //  - GIO : 7 orang (1 Ketua, 1 Sekretaris, 4 Anggota, 1 Fasilitator), lintas unit
  //  - 5R  : 10 orang (1 Ketua, 1 Sekretaris, 7 Anggota, 1 Fasilitator), satu kompartemen
  const scopeHint = isGio
    ? 'GIO: 7 orang - 1 Ketua, 1 Sekretaris, 4 Anggota, 1 Fasilitator (boleh lintas kompartemen maupun luar organisasi).'
    : is5R
      ? 'Program 5R: 10 orang - 1 Ketua, 1 Sekretaris, 7 Anggota, 1 Fasilitator (harus dalam satu kompartemen).'
      : 'Sistem Saran: 3 orang - 1 Ketua, 1 Sekretaris, 1 Fasilitator (harus dalam satu departemen).'

  const paretoKumulatif = useMemo(() => {
    const total = pareto.reduce((s, r) => s + (Number(r.frekuensi) || 0), 0) || 1
    let cum = 0
    return pareto.map((r) => {
      const pct = ((Number(r.frekuensi) || 0) / total) * 100
      cum += pct
      return { kontribusi: pct.toFixed(1), kumulatif: cum.toFixed(1) }
    })
  }, [pareto])

  const notify = (type, text) => {
    setBanner({ type, text })
    setTimeout(() => setBanner(null), 4000)
  }

  // --- Penyebab fishbone sebagai daftar; penyebab (string) selalu disinkronkan
  // dari penyebabItems agar diagram & payload ikut terbarui.
  const applyItems = (idx, items) => setFishbone((p) => p.map((r, i) => (i === idx ? { ...r, penyebabItems: items, penyebab: items.join('\n') } : r)))
  const addPenyebab = (idx) => setFishbone((p) => p.map((r, i) => (i === idx ? { ...r, penyebabItems: [...(r.penyebabItems || []), ''] } : r)))
  const setPenyebabItem = (idx, ci, val) => applyItems(idx, (fishbone[idx]?.penyebabItems || []).map((s, j) => (j === ci ? val : s)))
  const removePenyebabItem = (idx, ci) => applyItems(idx, (fishbone[idx]?.penyebabItems || []).filter((_, j) => j !== ci))

  // ---- save handlers ----
  // Hanya slot anggota terisi yang dikirim; urutan mengikuti posisi slot.
  const anggotaPayload = () => anggota
    .map((a, i) => ({ ...a, urutan: i + 1 }))
    .filter((a) => (a.nama || a.nik))
    .map((a) => ({ id: a.id ?? 0, peran: a.peran, nik: a.nik || null, nama: a.nama, jabatan: a.jabatan || null, depBagian: a.depBagian || null, urutan: a.urutan }))

  // Payload simpan Risalah 5R: identitas + anggota + bagian C/D/F (JSON). Koleksi
  // P.1-P.8 sengaja tidak dikirim (dikosongkan di backend, memang tak dipakai 5R).
  function buildFiveRPayload() {
    return {
      namaGugus: ident.namaGugus,
      temaKe: ident.temaKe === '' ? null : Number(ident.temaKe),
      periode: ident.periode,
      bagianSeksi: ident.bagianSeksi || null,
      judul: ident.judul || null,
      anggota: anggotaPayload(),
      // C. Jadwal 5R disimpan di tabel jadwal (sama seperti SS/GIO), memakai
      // kolom bulan kalender + rentang tanggal per sel.
      jadwal: jadwal.map((j) => ({ id: 0, tahapan: j.tahapan, jenis: j.jenis, bulan: (j.bulanArr || []).join(','), jumlah: j.jumlah === '' || j.jumlah == null ? null : Number(j.jumlah), rentang: serializeRentang(j.ranges) })),
      areaLokasi: fiveR.areaLokasi || null,
      profilDenahPath: fiveR.profilDenahPath || null,
      profilDenahNama: fiveR.profilDenahNama || null,
      dampakPositif: fiveR.dampakPositif || null,
      dampakPositifLainnya: fiveR.dampakPositifLainnya || null,
      limaRCatatan: JSON.stringify(fiveR.catatan ?? {}),
      limaRDokumentasi: JSON.stringify(fiveR.dokumentasi ?? {}),
    }
  }

  function buildPlanPayload() {
    return {
      namaGugus: ident.namaGugus,
      temaKe: ident.temaKe === '' ? null : Number(ident.temaKe),
      periode: ident.periode,
      bagianSeksi: ident.bagianSeksi || null,
      judul: ident.judul,
      latarBelakang: ident.latarBelakang,
      masalahUtama: ident.masalahUtama,
      verifikasiAkar: ident.verifikasiAkar || null,
      anggota: anggotaPayload(),
      dataPendukung: dataPendukung.map((x) => ({ id: 0, indikator: x.indikator || null, kondisiAwal: x.kondisiAwal || null, sumberKeterangan: x.sumberKeterangan || null, lampiranPath: x.lampiranPath || null, lampiranNama: x.lampiranNama || null, lampiranLink: x.lampiranLink || null, urutan: 0 })),
      jadwal: jadwal.map((j) => ({ id: 0, tahapan: j.tahapan, jenis: j.jenis, bulan: (j.bulanArr || []).join(','), jumlah: j.jumlah === '' || j.jumlah == null ? null : Number(j.jumlah), rentang: serializeRentang(j.ranges) })),
      sasaran: sasaran.map((x) => ({ id: 0, sasaran: x.sasaran || null, kondisiSebelum: x.kondisiSebelum || null, target: x.target || null, indikator: x.indikator || null, urutan: 0 })),
      pareto: pareto.map((x) => ({ id: 0, kategori: x.kategori || null, frekuensi: x.frekuensi === '' || x.frekuensi == null ? null : Number(x.frekuensi), urutan: 0 })),
      qcdse: qcdse.filter((x) => (x.dampakKualitatif || x.dampakKuantitatif)).map((x) => ({ id: 0, aspek: x.aspek, dampakKualitatif: x.dampakKualitatif || null, dampakKuantitatif: x.dampakKuantitatif || null })),
      fishbone: fishbone.map((x) => ({
        ...x,
        penyebab: (x.penyebabItems || []).map((s) => s.trim()).filter(Boolean).join('\n'),
      })).filter((x) => (x.penyebab || x.akarDominan || x.prioritas !== '')).map((x) => ({ id: 0, faktor: x.faktor, penyebab: x.penyebab || null, akarDominan: x.akarDominan || null, prioritas: x.prioritas === '' ? null : Number(x.prioritas) })),
      rencanaPerbaikan: rencana.map((x) => ({ id: 0, akarPenyebab: x.akarPenyebab || null, what: x.what || null, why: x.why || null, where: x.where || null, when: x.when || null, who: x.who || null, how: x.how || null, howMuch: x.howMuch || null, urutan: 0 })),
    }
  }

  async function savePlan() {
    setSaving(true)
    try {
      await api.saveInovasiPlan(id, buildPlanPayload())
      await load()
      notify('ok', 'Tahap PLAN tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan PLAN.')
    } finally {
      setSaving(false)
    }
  }

  async function saveFiveR() {
    setSaving(true)
    try {
      await api.saveInovasiPlan(id, buildFiveRPayload())
      await load()
      notify('ok', 'Risalah 5R tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan risalah 5R.')
    } finally {
      setSaving(false)
    }
  }

  function buildDoPayload() {
    return {
      doPelaksanaan: doPel.map((x) => ({ id: 0, tahapanKegiatan: x.tahapanKegiatan || null, monitoringHasil: x.monitoringHasil || null, tanggal: x.tanggal || null, evidencePath: x.evidencePath || null, evidenceNama: x.evidenceNama || null, urutan: 0 })),
      doKendala: doKen.map((x) => ({ id: 0, kendala: x.kendala || null, solusi: x.solusi || null, waktu: x.waktu || null, pic: x.pic || null, urutan: 0 })),
    }
  }

  async function saveDo() {
    setSaving(true)
    try {
      await api.saveInovasiDo(id, buildDoPayload())
      await load()
      notify('ok', 'Tahap DO tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan DO.')
    } finally { setSaving(false) }
  }

  function buildCheckPayload() {
    return {
      verifikasiStatistik: chkStat || null,
      checkPerbandingan: chkPerb.map((x) => ({ id: 0, sebelum: x.sebelum || null, sesudah: x.sesudah || null, urutan: 0 })),
      checkSasaran: chkSas.map((x) => ({ id: 0, sasaran: x.sasaran || null, sebelum: x.sebelum || null, target: x.target || null, sesudah: x.sesudah || null, persenCapaian: x.persenCapaian || null, urutan: 0 })),
      checkBiaya: chkBia.map((x) => ({ id: 0, komponen: x.komponen || null, perhitungan: x.perhitungan || null, nilai: x.nilai || null, urutan: 0 })),
      checkRisiko: chkRis.map((x) => ({ id: 0, dampakNegatif: x.dampakNegatif || null, mitigasi: x.mitigasi || null, urutan: 0 })),
    }
  }

  async function saveCheck() {
    setSaving(true)
    try {
      await api.saveInovasiCheck(id, buildCheckPayload())
      await load()
      notify('ok', 'Tahap CHECK tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan CHECK.')
    } finally { setSaving(false) }
  }

  function buildActionPayload() {
    return {
      actionTemaBerikutnya: actTema || null,
      actionStandarisasi: actStd.map((x) => ({ id: 0, standarBaru: x.standarBaru || null, noDokumen: x.noDokumen || null, tglBerlaku: x.tglBerlaku || null, pic: x.pic || null, urutan: 0 })),
      actionTindakLanjut: actTl.map((x) => ({ id: 0, rencana: x.rencana || null, targetWaktu: x.targetWaktu || null, pic: x.pic || null, status: x.status || null, urutan: 0 })),
    }
  }

  async function saveAction() {
    setSaving(true)
    try {
      await api.saveInovasiAction(id, buildActionPayload())
      await load()
      notify('ok', 'Tahap ACTION tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan ACTION.')
    } finally { setSaving(false) }
  }

  async function submit() {
    const is5RForm = data?.jenis === '5R'
    const kurang = is5RForm ? validasiFiveR() : validasiPlan()
    if (kurang.length) {
      await dialog.alert({ title: is5RForm ? 'Risalah 5R belum lengkap' : 'Tahap PLAN belum lengkap', message: pesanKurang(kurang) })
      return
    }
    if (!(await dialog.confirm({
      title: 'Ajukan Risalah',
      message: is5RForm
        ? 'Ajukan risalah 5R untuk pengesahan? Risalah tidak bisa diubah lagi kecuali diminta revisi.'
        : 'Ajukan risalah ini untuk pengesahan? PLAN tidak bisa diubah lagi kecuali diminta revisi.',
      confirmText: 'Ajukan',
    }))) return
    setSaving(true)
    try {
      await api.saveInovasiPlan(id, is5RForm ? buildFiveRPayload() : buildPlanPayload())
      const res = await api.submitInovasi(id)
      await load()
      notify('ok', `Risalah diajukan. Nomor registrasi: ${res.noRegistrasi ?? '-'}`)
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal mengajukan risalah.')
    } finally { setSaving(false) }
  }

  async function submitFinal() {
    const kurang = validasiFinal()
    if (kurang.length) {
      await dialog.alert({ title: 'DO / CHECK / ACTION belum lengkap', message: pesanKurang(kurang) })
      return
    }
    if (!(await dialog.confirm({
      title: 'Ajukan Pengesahan Akhir',
      message: 'Ajukan hasil DO/CHECK/ACTION untuk pengesahan akhir? Tahapan tidak bisa diubah lagi kecuali diminta revisi.',
      confirmText: 'Ajukan',
    }))) return
    setSaving(true)
    try {
      // Simpan dulu isian terbaru agar yang diajukan sama dengan yang divalidasi.
      await api.saveInovasiDo(id, buildDoPayload())
      await api.saveInovasiCheck(id, buildCheckPayload())
      await api.saveInovasiAction(id, buildActionPayload())
      await api.submitFinalInovasi(id)
      await load()
      notify('ok', 'Risalah diajukan ke Lembar Pengesahan Akhir.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal mengajukan pengesahan akhir.')
    } finally { setSaving(false) }
  }

  async function actPengesahan(pid, aksi) {
    let komentar = null
    if (aksi === 'Ditolak' || aksi === 'Revisi') {
      komentar = await dialog.prompt({
        title: aksi === 'Revisi' ? 'Minta Revisi' : 'Tolak Risalah',
        label: `Komentar ${aksi.toLowerCase()} (opsional):`,
        multiline: true,
        confirmText: aksi === 'Revisi' ? 'Kirim Revisi' : 'Tolak',
      })
      if (komentar === null) return
    }
    try {
      await api.actPengesahan(id, pid, { aksi, komentar })
      await load()
      notify('ok', `Pengesahan: ${aksi}.`)
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal memproses pengesahan.')
    }
  }

  async function uploadLampiran(idx, file) {
    try {
      const res = await api.uploadInovasiFile(id, file)
      setDataPendukung((prev) => prev.map((r, i) => (i === idx ? { ...r, lampiranPath: res.path, lampiranNama: res.nama } : r)))
      notify('ok', 'Berkas terunggah. Jangan lupa Simpan PLAN.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal mengunggah berkas.')
    }
  }

  async function uploadEvidence(idx, file) {
    try {
      const res = await api.uploadInovasiFile(id, file)
      setDoPel((prev) => prev.map((r, i) => (i === idx ? { ...r, evidencePath: res.path, evidenceNama: res.nama } : r)))
      notify('ok', 'Foto terunggah. Jangan lupa Simpan DO.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal mengunggah foto.')
    }
  }

  async function viewFile(path) {
    try {
      const { url } = await api.getInovasiFile(id, path)
      window.open(url, '_blank', 'noopener')
    } catch {
      notify('err', 'Gagal membuka berkas.')
    }
  }

  // ---- helper khusus 5R ----
  async function uploadDenah(file) {
    try {
      const res = await api.uploadInovasiFile(id, file)
      setFiveR((p) => ({ ...p, profilDenahPath: res.path, profilDenahNama: res.nama }))
      notify('ok', 'Denah terunggah. Jangan lupa Simpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal mengunggah denah.')
    }
  }
  const dokBlok = (d, r) => ({ rows: [], sebelum: [], prosesSesudah: [], keterangan: {}, ...(d?.[r] || {}) })
  async function uploadDok(rKode, kategori, file) {
    try {
      const res = await api.uploadInovasiFile(id, file)
      setFiveR((p) => {
        const dok = { ...(p.dokumentasi || {}) }
        const cur = dokBlok(dok, rKode)
        cur[kategori] = [...cur[kategori], { path: res.path, nama: res.nama }]
        dok[rKode] = cur
        return { ...p, dokumentasi: dok }
      })
      notify('ok', 'Foto/berkas terunggah. Jangan lupa Simpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal mengunggah berkas.')
    }
  }
  const removeDok = (rKode, kategori, idx) => setFiveR((p) => {
    const dok = { ...(p.dokumentasi || {}) }
    const cur = dokBlok(dok, rKode)
    cur[kategori] = cur[kategori].filter((_, i) => i !== idx)
    dok[rKode] = cur
    return { ...p, dokumentasi: dok }
  })
  const setDokRows = (rKode, rows) => setFiveR((p) => {
    const dok = { ...(p.dokumentasi || {}) }
    dok[rKode] = { ...dokBlok(dok, rKode), rows }
    return { ...p, dokumentasi: dok }
  })
  const setDokKeterangan = (rKode, kategori, val) => setFiveR((p) => {
    const dok = { ...(p.dokumentasi || {}) }
    const cur = dokBlok(dok, rKode)
    cur.keterangan = { ...(cur.keterangan || {}), [kategori]: val }
    dok[rKode] = cur
    return { ...p, dokumentasi: dok }
  })
  const setCatatan5R = (rKode, field, val) => setFiveR((p) => {
    const c = { ...(p.catatan || {}) }
    c[rKode] = { ...(c[rKode] || {}), [field]: val }
    return { ...p, catatan: c }
  })

  function validasiFiveR() {
    const m = []
    if (kosong(ident.namaGugus)) m.push('A. Identitas — Nama Gugus')
    if (kosong(ident.bagianSeksi)) m.push('A. Identitas — Bagian')
    if (kosong(fiveR.areaLokasi)) m.push('A. Identitas — Area / Lokasi 5R')
    if (kosong(ident.periode)) m.push('A. Identitas — Periode Program')
    if (kosong(ident.judul)) m.push('A. Identitas — Judul Program 5R')
    anggota.forEach((s) => { if (kosong(s.nama) && kosong(s.nik)) m.push(`B. Susunan Anggota — ${s.label} belum diisi`) })
    // Jadwal: minimal satu tahap punya baris Rencana dengan bulan terjadwal.
    if (!jadwal.some((j) => j.jenis === 'Rencana' && (j.bulanArr || []).length)) m.push('C. Jadwal Kegiatan — belum ada bulan terjadwal')
    LIMA_R_STEP.forEach((r) => {
      const rows = fiveR.dokumentasi?.[r.kode]?.rows || []
      if (!rows.some((x) => !kosong(x.kegiatan))) m.push(`F. Dokumentasi ${r.label} — minimal satu Kegiatan`)
    })
    if (kosong(fiveR.dampakPositif)) m.push('G. Dampak Positif Pelaksanaan 5R')
    return m
  }

  const planLocked = !editPlan
  const lanjutTersedia = data?.planDisahkan === true

  // Tombol Detail muncul begitu risalah punya isi (judul/latar belakang/anggota).
  const adaBaris = (a) => Array.isArray(a) && a.length > 0
  const bisaExportPlan = Boolean(data?.judul || data?.latarBelakang || data?.masalahUtama || adaBaris(data?.anggota) || data?.planDisahkan)

  // Pengesahan akhir: tombol muncul untuk pemilik setelah PLAN disahkan; kelengkapan
  // isian DO/CHECK/ACTION dicek oleh validasiFinal() saat tombol ditekan.
  const finalRows = (data?.pengesahan ?? []).filter((p) => p.tahap === 'FINAL')
  const finalDiajukan = finalRows.length > 0 && data?.status !== 'Revisi Akhir'
  const bisaAjukanAkhir = data?.isOwner === true && data?.planDisahkan === true
    && !finalDiajukan && data?.status !== 'Selesai'

  // Daftar field wajib yang belum terisi (dipakai untuk kotak peringatan & alert).
  const kurangPlan = is5R ? [] : validasiPlan()
  const kurangFinal = validasiFinal()
  const kurang5R = is5R ? validasiFiveR() : []

  if (loadErr) return <div className="inv"><button className="inv__back" onClick={() => navigate(`${base}/daftar`)}><ArrowLeft size={15} /> Kembali</button><div className="inv__banner inv__banner--err">{loadErr}</div></div>
  if (!data) return <div className="inv"><p className="inv__subtitle">Memuat risalah...</p></div>

  return (
    <div className="inv">
      <button className="inv__back" onClick={() => navigate(`${base}/daftar`)}><ArrowLeft size={15} /> Kembali ke Daftar</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="inv__title">{data.namaGugus || `Risalah ${jenisLabel(data.jenis)}`}</h2>
          <div className="inv__meta">
            <span>No. Reg: <b>{data.noRegistrasi ?? '-'}</b></span>
            <span>Tema ke-<b>{data.temaKe ?? '-'}</b></span>
            <span>Periode <b>{data.periode}</b></span>
            <span>Status: <span className={`inv__status ${statusClass(data.status)}`}>{data.status}</span></span>
          </div>
        </div>
        {bisaExportPlan && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="inv__btn inv__btn--primary" onClick={() => setDetailOpen(true)} title="Lihat keseluruhan isi risalah (termasuk diagram fishbone)">
              <Eye size={15} /> Detail
            </button>
          </div>
        )}
      </div>

      {banner && <div className={`inv__banner inv__banner--${banner.type}`}>{banner.text}</div>}
      {data.status === 'Revisi' && <div className="inv__banner inv__banner--warn">Pembina/Fasilitator meminta revisi. Perbaiki risalah lalu ajukan kembali.</div>}
      {planLocked && data.status !== 'Draft' && data.status !== 'Revisi' && !lanjutTersedia && (
        <div className="inv__banner inv__banner--info">
          {is5R
            ? 'Risalah sudah diajukan. Menunggu pengesahan (Fasilitator & Pembina).'
            : 'Risalah sudah diajukan. Menunggu pengesahan (verifikasi Fasilitator & validasi Pembina) sebelum tahap DO/CHECK/ACTION terbuka.'}
        </div>
      )}

      {/* 5R (F-5R-02): satu form utuh + satu Lembar Pengesahan, tanpa PLAN/DO/CHECK/ACTION. */}
      {is5R ? renderFiveR() : (
        <>
          <div className="inv__steps">
            {STEPS.map((s) => {
              const locked = s !== 'PLAN' && !lanjutTersedia
              return (
                <button key={s} type="button"
                  className={`inv__step${step === s ? ' inv__step--active' : ''}${locked ? ' inv__step--locked' : ''}`}
                  onClick={() => !locked && setStep(s)}
                  disabled={locked}>
                  {locked && <Lock size={13} />} {s}
                </button>
              )
            })}
          </div>

          {step === 'PLAN' && renderPlan()}
          {step === 'DO' && renderDo()}
          {step === 'CHECK' && renderCheck()}
          {step === 'ACTION' && renderAction()}
        </>
      )}

      <PegawaiPicker
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerSlot(null) }}
        gugusId={id}
        // Cegah duplikat: NIK yang sudah dipakai slot LAIN tak bisa dipilih.
        existingNiks={anggota.filter((_, i) => i !== pickerSlot).map((a) => a.nik).filter(Boolean)}
        onPick={(p) => {
          setAnggota((prev) => prev.map((s, i) => (i === pickerSlot
            ? { ...s, id: 0, nik: p.nik, nama: p.nama, jabatan: p.jabatan ?? '', depBagian: p.unit ?? '' }
            : s)))
          setPickerOpen(false)
          setPickerSlot(null)
        }}
      />

      {detailOpen && <RisalahDetailModal data={data} onClose={() => setDetailOpen(false)} />}
    </div>
  )

  // ================= Validasi kelengkapan =================
  // Semua isian wajib harus terisi sebelum pengajuan. Yang memang opsional tidak
  // dicek: Dampak QCDSE + M (P.5 SS / P.6 GIO), NIK anggota manual,
  // lampiran/tautan P.2, foto evidence D.1.
  function validasiPlan() {
    const m = []

    if (kosong(ident.namaGugus)) m.push('A. Identitas Gugus — Nama Gugus')
    if (kosong(ident.temaKe)) m.push('A. Identitas Gugus — Tema ke-')
    if (kosong(ident.periode)) m.push('A. Identitas Gugus — Periode Inovasi')
    if (kosong(ident.bagianSeksi)) m.push('A. Identitas Gugus — Bagian / Seksi')

    // Semua slot anggota (jumlah pasti per metodologi) wajib diisi.
    anggota.forEach((s) => {
      if (kosong(s.nama) && kosong(s.nik)) m.push(`B. Susunan Anggota — ${s.label} belum diisi`)
    })

    if (kosong(ident.latarBelakang)) m.push('P.1 Latar Belakang Masalah')

    m.push(...cekTabel('P.2 Data Pendukung', dataPendukung, [
      ['indikator', 'Indikator / Data Pendukung'], ['kondisiAwal', 'Kondisi Awal'], ['sumberKeterangan', 'Sumber / Keterangan'],
    ]))

    if (isGio) {
      m.push(...cekTabel(`${B.pareto} Stratifikasi & Diagram Pareto`, pareto, [
        ['kategori', 'Kategori / Jenis Masalah'], ['frekuensi', 'Frekuensi'],
      ]))
    }

    // Jadwal: tiap tahapan wajib punya baris Rencana + jumlah pertemuan.
    // (Baris Realisasi diisi saat pelaksanaan, bukan syarat pengajuan PLAN.)
    for (const t of tahapanList) {
      const r = jadwal.find((x) => x.tahapan === t.kode && x.jenis === 'Rencana')
      if (!(r?.bulanArr || []).length) m.push(`${B.jadwal} Jadwal Kegiatan — ${t.label}: baris Rencana belum ada bulan terjadwal`)
      if (kosong(r?.jumlah)) m.push(`${B.jadwal} Jadwal Kegiatan — ${t.label}: kolom Jml. belum diisi`)
    }

    m.push(...cekTabel(`${B.sasaran} Penentuan Sasaran (SMART)`, sasaran, [
      ['sasaran', 'Sasaran'], ['kondisiSebelum', 'Kondisi Sebelum'], ['target', 'Target'], ['indikator', 'Indikator Keberhasilan'],
    ]))

    // Dampak QCDSE + M (P.5 SS / P.6 GIO) opsional untuk seluruh metodologi -
    // sengaja tidak divalidasi.

    if (kosong(ident.masalahUtama)) m.push(`${B.fishbone} Fishbone — Masalah Utama`)
    if (!fishbone.some((f) => (f.penyebabItems || []).some((s) => !kosong(s)))) {
      m.push(`${B.fishbone} Fishbone — minimal satu faktor harus punya Penyebab Teridentifikasi`)
    }
    fishbone.forEach((f) => {
      const items = f.penyebabItems || []
      const terpakai = items.some((s) => !kosong(s)) || !kosong(f.akarDominan) || !kosong(f.prioritas)
      if (!terpakai) return
      if (items.some((s) => kosong(s))) m.push(`${B.fishbone} Fishbone — faktor ${f.faktor}: ada baris Penyebab yang kosong`)
      if (kosong(f.akarDominan)) m.push(`${B.fishbone} Fishbone — faktor ${f.faktor}: Akar Penyebab Dominan`)
      if (kosong(f.prioritas)) m.push(`${B.fishbone} Fishbone — faktor ${f.faktor}: Prioritas (1-5)`)
    })

    if (isGio && kosong(ident.verifikasiAkar)) m.push(`${B.verifikasiAkar} Verifikasi Akar Penyebab Dominan`)

    m.push(...cekTabel(`${B.rencana} Rencana Perbaikan (5W + 2H)`, rencana, [
      ['akarPenyebab', 'Akar Penyebab'], ['what', 'What'], ['why', 'Why'], ['where', 'Where'],
      ['when', 'When'], ['who', 'Who'], ['how', 'How'], ['howMuch', 'How Much'],
    ]))

    if (kosong(ident.judul)) m.push(`${B.judul} ${judulBagianJudul(data?.jenis)}`)

    return m
  }

  function validasiFinal() {
    const m = []
    m.push(...cekTabel('D.1 Pelaksanaan Perbaikan & Monitoring', doPel, [
      ['tahapanKegiatan', 'Tahapan Kegiatan'], ['monitoringHasil', 'Monitoring Hasil Perbaikan'],
      // Kolom Tanggal hanya ada pada form SS/5R.
      ...(isGio ? [] : [['tanggal', 'Tanggal']]),
    ]))
    m.push(...cekTabel('D.2 Kendala & Solusi', doKen, [
      ['kendala', 'Kendala'], ['solusi', 'Solusi / Tindakan yang Diambil'], ['waktu', 'Waktu'], ['pic', 'PIC'],
    ]))
    m.push(...cekTabel(`${B.cPerbandingan} Perbandingan Sebelum & Sesudah`, chkPerb, [
      ['sebelum', 'SEBELUM'], ['sesudah', 'SESUDAH'],
    ]))
    m.push(...cekTabel(`${B.cSasaran} Pencapaian Sasaran Perbaikan`, chkSas, [
      ['sasaran', 'Sasaran'], ['sebelum', 'Sebelum'], ['target', 'Target'], ['sesudah', 'Sesudah'], ['persenCapaian', '% Capaian'],
    ]))
    if (isGio && kosong(chkStat)) m.push(`${B.cStatistik} Verifikasi Statistik Hasil Perbaikan (Control Chart / Histogram)`)
    m.push(...cekTabel(`${B.cBiaya} Analisa Manfaat & Biaya`, chkBia, [
      ['komponen', 'Komponen'], ['perhitungan', 'Perhitungan / Dasar'], ['nilai', 'Nilai'],
    ]))
    m.push(...cekTabel(`${B.cRisiko} Analisa Risiko / Dampak Negatif`, chkRis, [
      ['dampakNegatif', 'Potensi Dampak Negatif'], ['mitigasi', 'Rencana Penanganan / Mitigasi'],
    ]))
    m.push(...cekTabel('A.1 Standardisasi Hasil Perbaikan', actStd, [
      ['standarBaru', 'Standar Baru (SOP / Instruksi Kerja / Format)'], ['noDokumen', 'No. Dokumen'], ['tglBerlaku', 'Tgl. Berlaku'], ['pic', 'PIC'],
    ]))
    m.push(...cekTabel('A.2 Rencana Tindak Lanjut', actTl, [
      ['rencana', 'Rencana Tindak Lanjut'], ['targetWaktu', 'Target Waktu'], ['pic', 'PIC'], ['status', 'Status'],
    ]))
    if (kosong(actTema)) m.push('A.3 Rencana Tema / Inovasi Berikutnya')
    return m
  }

  // B. Susunan Anggota - slot tetap per metodologi (dipakai form SS/GIO & 5R).
  function renderAnggotaSection() {
    return (
      <Section tag="B" title="Susunan Anggota Gugus">
        <p className="inv__hint" style={{ marginTop: 0, marginBottom: 10 }}>{scopeHint}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="inv__subtable">
            <thead><tr>
              <th style={{ width: 40, textAlign: 'center' }}>No</th>
              <th style={{ width: 120 }}>Peran</th>
              <th>Nama Lengkap</th>
              <th style={{ width: 110 }}>NIK</th>
              <th>Jabatan</th>
              <th>Dep / Bagian</th>
              {!planLocked && <th style={{ width: 150 }}>Aksi</th>}
            </tr></thead>
            <tbody>
              {anggota.map((s, idx) => {
                const terisi = Boolean(s.nama || s.nik)
                return (
                  <tr key={s.label}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{s.label}</td>
                    <td>{s.nama || <span style={{ color: '#c0392b' }}>(belum diisi)</span>}</td>
                    <td>{s.nik || '-'}</td>
                    <td>{s.jabatan || '-'}</td>
                    <td>{s.depBagian || '-'}</td>
                    {!planLocked && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '4px 10px' }}
                            onClick={() => { setPickerSlot(idx); setPickerOpen(true) }}>
                            <UserPlus size={13} /> {terisi ? 'Ganti' : 'Pilih'}
                          </button>
                          {terisi && (
                            <button type="button" className="inv__icon-btn inv__icon-btn--danger" title="Kosongkan slot"
                              onClick={() => setAnggota((prev) => prev.map((x, i) => (i === idx ? { ...x, id: 0, nik: '', nama: '', jabatan: '', depBagian: '' } : x)))}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="inv__hint">Semua slot wajib diisi dari Data Pegawai. Anggota (dengan NIK) juga melihat inovasi ini di My Innovation mereka.</p>
      </Section>
    )
  }

  // ================= PLAN =================
  function renderPlan() {
    return (
      <>
        {/* A. Identitas */}
        <Section tag="A" title="Identitas Gugus">
          <div className="inv__form-row">
            <label className="inv__field"><span>Nama Gugus</span>
              <input value={ident.namaGugus} disabled={planLocked} onChange={(e) => setIdent({ ...ident, namaGugus: e.target.value })} /></label>
            <label className="inv__field"><span>Tema ke-</span>
              <input type="number" min={1} value={ident.temaKe} disabled={planLocked} onChange={(e) => setIdent({ ...ident, temaKe: e.target.value })} /></label>
            {/* Periode ditentukan otomatis dari tahun risalah dibuat (mis. dibuat
                2026 -> 2026/2027), tidak dipilih manual. */}
            <label className="inv__field"><span>Periode Inovasi</span>
              <input value={ident.periode || periodeSekarang()} disabled title="Ditentukan otomatis dari tahun risalah dibuat" /></label>
          </div>
          <div className="inv__form-row">
            <label className="inv__field"><span>No. Registrasi</span><input value={data.noRegistrasi ?? '(terbit saat diajukan)'} disabled /></label>
            <label className="inv__field"><span>Unit / Departemen</span><input value={data.namaDepartemen ?? '-'} disabled /></label>
            <label className="inv__field"><span>Bagian / Seksi</span>
              <input value={ident.bagianSeksi} disabled={planLocked} placeholder="mis. Pengadaan" onChange={(e) => setIdent({ ...ident, bagianSeksi: e.target.value })} /></label>
          </div>
          <div className="inv__form-row">
            <label className="inv__field"><span>Kompartemen</span><input value={data.namaKompartemen ?? '-'} disabled /></label>
            {/* Departemen sasaran perbaikan, dibawa dari gagasan asal. Untuk GIO,
                departemen inilah yang menentukan Direktur pengesah (Komersil /
                Keuangan) pada Lembar Pengesahan PLAN & Akhir. */}
            <label className="inv__field"><span>Departemen Tujuan</span>
              <input
                value={data.namaDepartemenTujuan ?? data.namaDepartemen ?? '-'}
                disabled
                title={data.jenis === 'GIO'
                  ? 'Ditetapkan saat Sumbang Gagasan; menentukan Direktur pengesah GIO.'
                  : 'Ditetapkan saat Sumbang Gagasan.'}
              /></label>
          </div>
        </Section>

        {renderAnggotaSection()}

        {/* P.1 */}
        <Section tag="P.1" title="Latar Belakang Masalah">
          <textarea className="inv__field" style={{ width: '100%', minHeight: 120, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
            value={ident.latarBelakang} disabled={planLocked}
            placeholder="Uraikan kondisi awal, masalah utama, alasan pemilihan tema, disertai data pembanding."
            onChange={(e) => setIdent({ ...ident, latarBelakang: e.target.value })} />
        </Section>

        {/* P.2 */}
        <Section tag="P.2" title="Data Pendukung (Kondisi Awal)">
          <RepeatTable
            readOnly={planLocked}
            rows={dataPendukung}
            setRows={setDataPendukung}
            makeEmpty={() => ({ indikator: '', kondisiAwal: '', sumberKeterangan: '', lampiranPath: '', lampiranNama: '', lampiranLink: '' })}
            columns={[
              { key: 'indikator', label: 'Indikator / Data Pendukung', type: 'textarea' },
              { key: 'kondisiAwal', label: 'Kondisi Awal', type: 'textarea' },
              { key: 'sumberKeterangan', label: 'Sumber / Keterangan', type: 'textarea' },
              {
                key: 'lampiran', label: 'Lampiran / Tautan (opsional)', width: 200, type: 'custom',
                render: (row, idx, patchCell, ro) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {row.lampiranNama
                      ? <span className="inv__lampiran"><FileUp size={12} /> <a onClick={() => viewFile(row.lampiranPath)} style={{ cursor: 'pointer' }}>{row.lampiranNama}</a></span>
                      : !ro && <label className="inv__btn inv__btn--soft" style={{ padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
                        <FileUp size={13} /> Unggah
                        <input type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onChange={(e) => e.target.files?.[0] && uploadLampiran(idx, e.target.files[0])} />
                      </label>}
                    <span className="inv__lampiran"><Link2 size={12} />
                      {ro ? (row.lampiranLink || '-') : <input style={{ border: '1px solid var(--inv-line)', borderRadius: 5, padding: '3px 5px', fontSize: 11.5, width: '100%' }} placeholder="URL" value={row.lampiranLink ?? ''} onChange={(e) => patchCell('lampiranLink', e.target.value)} />}
                    </span>
                  </div>
                ),
              },
            ]}
          />
        </Section>

        {/* GIO P.3: Stratifikasi & Pareto - mendahului jadwal sesuai form F-GIO-01 */}
        {isGio && (
          <Section tag={B.pareto} title="Stratifikasi & Diagram Pareto (Penentuan Masalah Dominan)">
            <div style={{ overflowX: 'auto' }}>
              <table className="inv__subtable">
                <thead><tr><th className="inv__rownum">No</th><th>Kategori / Jenis Masalah</th><th style={{ width: 110 }}>Frekuensi</th><th style={{ width: 100 }}>% Kontribusi</th><th style={{ width: 100 }}>% Kumulatif</th>{!planLocked && <th className="inv__rowdel"></th>}</tr></thead>
                <tbody>
                  {pareto.length === 0 && <tr><td className="inv__no-data" colSpan={6} style={{ padding: 14 }}>Belum ada kategori.</td></tr>}
                  {pareto.map((row, idx) => (
                    <tr key={idx}>
                      <td className="inv__rownum">{idx + 1}</td>
                      <td>{planLocked ? (row.kategori || '-') : <input value={row.kategori ?? ''} onChange={(e) => setPareto((p) => p.map((r, i) => i === idx ? { ...r, kategori: e.target.value } : r))} />}</td>
                      <td>{planLocked ? (row.frekuensi ?? '-') : <input type="number" min={0} value={row.frekuensi ?? ''} onChange={(e) => setPareto((p) => p.map((r, i) => i === idx ? { ...r, frekuensi: e.target.value } : r))} />}</td>
                      <td>{paretoKumulatif[idx]?.kontribusi ?? '0.0'}%</td>
                      <td>{paretoKumulatif[idx]?.kumulatif ?? '0.0'}%</td>
                      {!planLocked && <td className="inv__rowdel"><button type="button" className="inv__icon-btn inv__icon-btn--danger" onClick={() => setPareto((p) => p.filter((_, i) => i !== idx))}><X size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!planLocked && <button type="button" className="inv__btn inv__btn--soft inv__addrow" onClick={() => setPareto([...pareto, { kategori: '', frekuensi: '' }])}>Tambah Kategori</button>}
            <p className="inv__hint">Urutkan dari frekuensi terbesar ke terkecil. % kontribusi &amp; kumulatif dihitung otomatis (prinsip 80/20).</p>
          </Section>
        )}

        {/* Jadwal Kegiatan - PDCA (SS/5R) atau 8 Langkah DELTA (GIO) */}
        <Section tag={B.jadwal} title={B.jadwalTitle}>
          <JadwalPdca jadwal={jadwal} setJadwal={setJadwal} readOnly={planLocked} periode={ident.periode || data.periode} />
        </Section>

        {/* Penentuan Sasaran */}
        <Section tag={B.sasaran} title="Penentuan Sasaran (SMART)">
          <RepeatTable
            readOnly={planLocked} rows={sasaran} setRows={setSasaran}
            makeEmpty={() => ({ sasaran: '', kondisiSebelum: '', target: '', indikator: '' })}
            columns={[
              { key: 'sasaran', label: 'Sasaran', type: 'textarea' },
              { key: 'kondisiSebelum', label: 'Kondisi Sebelum', type: 'textarea' },
              { key: 'target', label: 'Target', type: 'textarea' },
              { key: 'indikator', label: 'Indikator Keberhasilan', type: 'textarea' },
            ]}
          />
        </Section>

        {/* Dampak QCDSE + M - opsional untuk seluruh metodologi (SS/GIO/5R). */}
        <Section tag={B.qcdse} title="Dampak Masalah terhadap QCDSE + M (opsional)">
          <p className="inv__hint">Bagian ini opsional - boleh dikosongkan seluruhnya atau diisi pada aspek yang relevan saja.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="inv__subtable">
              <thead><tr><th style={{ width: 130 }}>Aspek</th><th>Dampak Kualitatif</th><th>Dampak Kuantitatif (didukung data)</th></tr></thead>
              <tbody>
                {qcdse.map((row, idx) => (
                  <tr key={row.aspek}>
                    <td style={{ fontWeight: 700 }}>{row.aspek} - {ASPEK.find(([a]) => a === row.aspek)?.[1]}</td>
                    <td>{planLocked ? (row.dampakKualitatif || '-') : <textarea rows={2} value={row.dampakKualitatif} onChange={(e) => setQcdse((p) => p.map((r, i) => i === idx ? { ...r, dampakKualitatif: e.target.value } : r))} />}</td>
                    <td>{planLocked ? (row.dampakKuantitatif || '-') : <textarea rows={2} value={row.dampakKuantitatif} onChange={(e) => setQcdse((p) => p.map((r, i) => i === idx ? { ...r, dampakKuantitatif: e.target.value } : r))} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Fishbone */}
        <Section tag={B.fishbone} title="Analisa Akar Penyebab Masalah (Diagram Tulang Ikan / Fishbone)">
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Masalah Utama (kepala tulang ikan)</span>
            <input value={ident.masalahUtama} disabled={planLocked} onChange={(e) => setIdent({ ...ident, masalahUtama: e.target.value })} placeholder="mis. Tata kelola dokumen belum efektif" />
          </label>
          <p className="inv__hint" style={{ marginTop: 0 }}>Tiap faktor bisa memiliki <b>beberapa Penyebab Teridentifikasi</b> (tambah dengan tombol). Setiap penyebab menjadi cabang pada diagram fishbone, dibaca dari garis tengah ke arah luar. <b>Akar Penyebab Dominan</b> adalah akar terakhir yang akan diselesaikan - dicatat pada tabel ini dan menjadi dasar {B.rencana} Rencana Perbaikan (tidak digambar pada diagram).</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="inv__subtable">
              <thead><tr><th style={{ width: 170 }}>Faktor</th><th>Penyebab yang Teridentifikasi</th><th>Akar Penyebab Dominan</th><th style={{ width: 120 }}>Prioritas (1-5)</th></tr></thead>
              <tbody>
                {fishbone.map((row, idx) => (
                  <tr key={row.faktor}>
                    <td style={{ fontWeight: 700 }}>{faktorLabel(row.faktor)}</td>
                    <td>
                      {planLocked ? (
                        (row.penyebabItems || []).length
                          ? <ul style={{ margin: 0, paddingLeft: 18 }}>{row.penyebabItems.map((c, ci) => <li key={ci}>{c}</li>)}</ul>
                          : '-'
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {(row.penyebabItems || []).map((c, ci) => (
                            <div key={ci} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: '#8a978c', minWidth: 14 }}>{ci + 1}.</span>
                              <input style={{ flex: 1 }} value={c} placeholder={`Penyebab ${ci + 1}`} onChange={(e) => setPenyebabItem(idx, ci, e.target.value)} />
                              <button type="button" className="inv__icon-btn inv__icon-btn--danger" title="Hapus penyebab" onClick={() => removePenyebabItem(idx, ci)}><X size={13} /></button>
                            </div>
                          ))}
                          <button type="button" className="inv__btn inv__btn--soft" style={{ alignSelf: 'flex-start', padding: '4px 10px' }} onClick={() => addPenyebab(idx)}><Plus size={13} /> Tambah penyebab</button>
                        </div>
                      )}
                    </td>
                    <td>{planLocked ? (row.akarDominan || '-') : <textarea rows={2} value={row.akarDominan} onChange={(e) => setFishbone((p) => p.map((r, i) => i === idx ? { ...r, akarDominan: e.target.value } : r))} />}</td>
                    <td>{planLocked ? (row.prioritas || '-') : <input type="number" min={1} max={5} value={row.prioritas} onChange={(e) => setFishbone((p) => p.map((r, i) => i === idx ? { ...r, prioritas: e.target.value } : r))} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Visualisasi diagram tulang ikan (Ishikawa) - di bawah tabel P.6 */}
          <div style={{ marginTop: 12 }}>
            <FishboneDiagram fishbone={fishbone} masalah={ident.masalahUtama || data.judul} />
          </div>
        </Section>

        {/* GIO: Verifikasi Akar Penyebab Dominan */}
        {isGio && (
          <Section tag={B.verifikasiAkar} title="Verifikasi Akar Penyebab Dominan (Data / Scatter Diagram / Histogram)">
            <p className="inv__hint" style={{ marginTop: 0 }}>Langkah ini membedakan kedalaman analisis GIO dari SS: buktikan akar penyebab dominan dengan data kuantitatif sebelum menyusun rencana perbaikan.</p>
            <textarea style={{ width: '100%', minHeight: 90, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
              value={ident.verifikasiAkar} disabled={planLocked}
              placeholder="Buktikan akar penyebab dominan dengan data kuantitatif (uji korelasi / scatter diagram / histogram)."
              onChange={(e) => setIdent({ ...ident, verifikasiAkar: e.target.value })} />
          </Section>
        )}

        {/* Rencana Perbaikan 5W2H - satu baris untuk tiap akar penyebab dominan */}
        <Section tag={B.rencana} title="Rencana Perbaikan (5W + 2H)">
          <RepeatTable
            readOnly={planLocked} rows={rencana} setRows={setRencana}
            makeEmpty={() => ({ akarPenyebab: '', what: '', why: '', where: '', when: '', who: '', how: '', howMuch: '' })}
            columns={[
              { key: 'akarPenyebab', label: 'Akar Penyebab', type: 'textarea' },
              { key: 'what', label: 'What', type: 'textarea' },
              { key: 'why', label: 'Why', type: 'textarea' },
              { key: 'where', label: 'Where', type: 'textarea' },
              { key: 'when', label: 'When', type: 'textarea' },
              { key: 'who', label: 'Who', type: 'textarea' },
              { key: 'how', label: 'How', type: 'textarea' },
              { key: 'howMuch', label: 'How Much', type: 'textarea' },
            ]}
          />
        </Section>

        {/* Judul inovasi */}
        <Section tag={B.judul} title={judulBagianJudul(data.jenis)}>
          <p className="inv__hint" style={{ marginTop: 0 }}>Wajib memuat 5 komponen berurutan: (1) kata kerja aktif, (2) obyek, (3) besaran (%), (4) cara, (5) jangka waktu. Contoh: &ldquo;Menurunkan Downtime Mesin Produksi Sebesar 32% Dengan Penerapan Preventive Maintenance Terjadwal Selama 6 Bulan&rdquo;.</p>
          <textarea style={{ width: '100%', minHeight: 60, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
            value={ident.judul} disabled={planLocked}
            placeholder="Kata kerja aktif + Obyek + Besaran (%) + Cara + Jangka waktu"
            onChange={(e) => setIdent({ ...ident, judul: e.target.value })} />
        </Section>

        {/* Pengesahan */}
        {renderSignBlock('PLAN')}

        {/* Aksi PLAN */}
        {(editPlan) && (
          <>
            {kurangPlan.length > 0 && (
              <div className="inv__banner inv__banner--warn">
                <b>Lengkapi {kurangPlan.length} isian berikut sebelum mengajukan pengesahan:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {kurangPlan.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            <div className="inv__actions-bar">
              <button type="button" className="inv__btn inv__btn--ghost" onClick={savePlan} disabled={saving}><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan PLAN'}</button>
              <button type="button" className="inv__btn inv__btn--primary" onClick={submit} disabled={saving}><Send size={16} /> Ajukan Pengesahan</button>
            </div>
          </>
        )}
      </>
    )
  }

  function renderSignBlock(tahap) {
    const rows = (data.pengesahan ?? []).filter((p) => p.tahap === tahap)
    const isPlan = tahap === 'PLAN'
    // Pada 5R, Lembar Pengesahan PLAN adalah satu-satunya (tanpa tahap akhir).
    const title = isPlan
      ? (is5R ? 'Lembar Pengesahan' : 'Lembar Pengesahan Tahap PLAN')
      : 'Lembar Pengesahan Akhir (Tahap DO–CHECK–ACTION)'
    if (rows.length === 0) {
      return (
        <Section tag="✓" title={title}>
          <p className="inv__hint">{isPlan
            ? 'Belum ada lembar pengesahan. Ajukan risalah untuk memulai proses tanda tangan.'
            : 'Belum ada lembar pengesahan akhir. Lengkapi DO/CHECK/ACTION lalu ajukan pengesahan akhir.'}</p>
        </Section>
      )
    }
    return (
      <Section tag="✓" title={title}>
        <p className="inv__hint">Urutan: Ketua Gugus &rarr; Fasilitator (verifikasi) &rarr; Pembina Tk. Departemen &rarr; Pembina Tk. Kompartemen (validasi).{isPlan ? (is5R ? ' Risalah berstatus Selesai setelah semua disetujui.' : ' DO/CHECK/ACTION terbuka setelah semua disetujui.') : ' Risalah berstatus Selesai setelah semua disetujui.'}</p>
        <div className="inv__sign-grid">
          {rows.map((p) => (
            <div className="inv__sign" key={p.id}>
              <div className="inv__sign-role">{p.peran}</div>
              <div className="inv__sign-name">{p.nama ?? '(belum ditetapkan)'}</div>
              <span className={`inv__status ${statusClass(p.status === 'Disetujui' ? 'Divalidasi' : p.status === 'Menunggu' ? 'Diajukan' : p.status)}`}>{p.status}</span>
              {p.komentar && <div className="inv__hint" style={{ marginTop: 6 }}>&ldquo;{p.komentar}&rdquo;</div>}
              {p.bisaSaya && (
                <div className="inv__sign-actions">
                  <button type="button" className="inv__btn inv__btn--primary" style={{ padding: '6px 12px' }} onClick={() => actPengesahan(p.id, 'Disetujui')}><CheckCircle2 size={14} /> Setujui</button>
                  <button type="button" className="inv__btn inv__btn--soft" style={{ padding: '6px 12px' }} onClick={() => actPengesahan(p.id, 'Revisi')}>Revisi</button>
                  <button type="button" className="inv__btn inv__btn--danger" style={{ padding: '6px 12px' }} onClick={() => actPengesahan(p.id, 'Ditolak')}>Tolak</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    )
  }

  // ================= DO =================
  function renderDo() {
    const ro = !editLanjut
    return (
      <>
        <Section tag="D.1" title="Pelaksanaan Perbaikan & Monitoring">
          <RepeatTable
            readOnly={ro} rows={doPel} setRows={setDoPel}
            makeEmpty={() => ({ tahapanKegiatan: '', monitoringHasil: '', tanggal: '', evidencePath: '', evidenceNama: '' })}
            columns={[
              { key: 'tahapanKegiatan', label: 'Tahapan Kegiatan', type: 'textarea' },
              { key: 'monitoringHasil', label: 'Monitoring Hasil Perbaikan', type: 'textarea' },
              // Form F-GIO-01 tidak memuat kolom Tanggal pada D.1 (SS tetap memakainya).
              ...(isGio ? [] : [{ key: 'tanggal', label: 'Tanggal', type: 'date', width: 130 }]),
              {
                key: 'evidence', label: 'Foto / Evidence (opsional)', width: 170, type: 'custom',
                render: (row, idx, _p, roc) => (
                  row.evidenceNama
                    ? <span className="inv__lampiran"><FileUp size={12} /> <a style={{ cursor: 'pointer' }} onClick={() => viewFile(row.evidencePath)}>{row.evidenceNama}</a></span>
                    : !roc && <label className="inv__btn inv__btn--soft" style={{ padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
                      <FileUp size={13} /> Unggah Foto
                      <input type="file" hidden accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => e.target.files?.[0] && uploadEvidence(idx, e.target.files[0])} />
                    </label>
                ),
              },
            ]}
          />
        </Section>
        <Section tag="D.2" title="Kendala Selama Pelaksanaan & Solusinya">
          <RepeatTable
            readOnly={ro} rows={doKen} setRows={setDoKen}
            makeEmpty={() => ({ kendala: '', solusi: '', waktu: '', pic: '' })}
            columns={[
              { key: 'kendala', label: 'Kendala', type: 'textarea' },
              { key: 'solusi', label: 'Solusi / Tindakan yang Diambil', type: 'textarea' },
              { key: 'waktu', label: 'Waktu', type: 'text', width: 110 },
              { key: 'pic', label: 'PIC', type: 'text', width: 120 },
            ]}
          />
        </Section>
        {editLanjut && <div className="inv__actions-bar"><button type="button" className="inv__btn inv__btn--primary" onClick={saveDo} disabled={saving}><Save size={16} /> Simpan DO</button></div>}
      </>
    )
  }

  // ================= CHECK =================
  function renderCheck() {
    const ro = !editLanjut
    return (
      <>
        <Section tag={B.cPerbandingan} title="Perbandingan Kondisi Sebelum & Sesudah Perbaikan">
          <RepeatTable readOnly={ro} rows={chkPerb} setRows={setChkPerb} makeEmpty={() => ({ sebelum: '', sesudah: '' })}
            columns={[
              { key: 'sebelum', label: `SEBELUM${periodeSebelum(data.periode) ? ` (periode ${periodeSebelum(data.periode)})` : ''}`, type: 'textarea' },
              { key: 'sesudah', label: `SESUDAH${data.periode ? ` (periode ${data.periode})` : ''}`, type: 'textarea' },
            ]} />
        </Section>
        <Section tag={B.cSasaran} title="Pencapaian Sasaran Perbaikan">
          <RepeatTable readOnly={ro} rows={chkSas} setRows={setChkSas} makeEmpty={() => ({ sasaran: '', sebelum: '', target: '', sesudah: '', persenCapaian: '' })}
            columns={[
              { key: 'sasaran', label: 'Sasaran', type: 'textarea' },
              { key: 'sebelum', label: 'Sebelum', type: 'textarea' },
              { key: 'target', label: 'Target', type: 'textarea' },
              { key: 'sesudah', label: 'Sesudah', type: 'textarea' },
              { key: 'persenCapaian', label: '% Capaian', type: 'text', width: 90 },
            ]} />
        </Section>
        {/* GIO C.3: pembuktian statistik hasil perbaikan (tidak ada pada SS/5R) */}
        {isGio && (
          <Section tag={B.cStatistik} title="Verifikasi Statistik Hasil Perbaikan (Control Chart / Histogram)">
            <p className="inv__hint" style={{ marginTop: 0 }}>Buktikan proses sudah stabil/terkendali dan perbaikan signifikan secara statistik - bukan kebetulan. Sertakan data peta kendali (control chart) atau histogram beserta pembacaannya.</p>
            <textarea style={{ width: '100%', minHeight: 90, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
              value={chkStat} disabled={ro}
              placeholder="Uraikan data hasil perbaikan dalam bentuk peta kendali / histogram beserta kesimpulan statistiknya."
              onChange={(e) => setChkStat(e.target.value)} />
          </Section>
        )}
        <Section tag={B.cBiaya} title="Analisa Manfaat & Biaya (Cost-Benefit)">
          <RepeatTable readOnly={ro} rows={chkBia} setRows={setChkBia} makeEmpty={() => ({ komponen: '', perhitungan: '', nilai: '' })}
            columns={[{ key: 'komponen', label: 'Komponen', type: 'textarea' }, { key: 'perhitungan', label: 'Perhitungan / Dasar', type: 'textarea' }, { key: 'nilai', label: 'Nilai', type: 'textarea' }]} />
        </Section>
        <Section tag={B.cRisiko} title="Analisa Risiko / Dampak Negatif & Penanganannya">
          <RepeatTable readOnly={ro} rows={chkRis} setRows={setChkRis} makeEmpty={() => ({ dampakNegatif: '', mitigasi: '' })}
            columns={[{ key: 'dampakNegatif', label: 'Potensi Dampak Negatif', type: 'textarea' }, { key: 'mitigasi', label: 'Rencana Penanganan / Mitigasi', type: 'textarea' }]} />
        </Section>
        {editLanjut && <div className="inv__actions-bar"><button type="button" className="inv__btn inv__btn--primary" onClick={saveCheck} disabled={saving}><Save size={16} /> Simpan CHECK</button></div>}
      </>
    )
  }

  // ================= ACTION =================
  function renderAction() {
    const ro = !editLanjut
    return (
      <>
        <Section tag="A.1" title="Standardisasi Hasil Perbaikan (menjadi SOP Perusahaan)">
          <RepeatTable readOnly={ro} rows={actStd} setRows={setActStd} makeEmpty={() => ({ standarBaru: '', noDokumen: '', tglBerlaku: '', pic: '' })}
            columns={[
              { key: 'standarBaru', label: 'Standar Baru (SOP / Instruksi Kerja / Format)', type: 'textarea' },
              { key: 'noDokumen', label: 'No. Dokumen', type: 'text', width: 130 },
              { key: 'tglBerlaku', label: 'Tgl. Berlaku', type: 'date', width: 130 },
              { key: 'pic', label: 'PIC', type: 'text', width: 120 },
            ]} />
        </Section>
        <Section tag="A.2" title="Rencana Tindak Lanjut & Perbaikan Berkelanjutan">
          <RepeatTable readOnly={ro} rows={actTl} setRows={setActTl} makeEmpty={() => ({ rencana: '', targetWaktu: '', pic: '', status: '' })}
            columns={[
              { key: 'rencana', label: 'Rencana Tindak Lanjut', type: 'textarea' },
              { key: 'targetWaktu', label: 'Target Waktu', type: 'text', width: 120 },
              { key: 'pic', label: 'PIC', type: 'text', width: 110 },
              { key: 'status', label: 'Status', type: 'text', width: 110 },
            ]} />
        </Section>
        <Section tag="A.3" title="Rencana Tema / Inovasi Berikutnya">
          <textarea style={{ width: '100%', minHeight: 70, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
            value={actTema} disabled={ro} onChange={(e) => setActTema(e.target.value)} />
        </Section>

        {/* marginBottom memberi jarak sebelum blok Lembar Pengesahan Akhir di bawahnya. */}
        {editLanjut && <div className="inv__actions-bar" style={{ marginBottom: 18 }}><button type="button" className="inv__btn inv__btn--primary" onClick={saveAction} disabled={saving}><Save size={16} /> Simpan ACTION</button></div>}

        {/* Pengesahan Akhir */}
        {renderSignBlock('FINAL')}
        {bisaAjukanAkhir && (
          <>
            {kurangFinal.length > 0 && (
              <div className="inv__banner inv__banner--warn">
                <b>Lengkapi {kurangFinal.length} isian berikut sebelum mengajukan pengesahan akhir:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {kurangFinal.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            <div className="inv__actions-bar">
              <button type="button" className="inv__btn inv__btn--primary" onClick={submitFinal} disabled={saving}><Send size={16} /> Ajukan Pengesahan Akhir</button>
            </div>
          </>
        )}
      </>
    )
  }

  // ================= 5R (Form F-5R-02) =================
  function renderFiveR() {
    const ro = planLocked
    // Isi satu sel dokumentasi (Sebelum / Proses & Sesudah): daftar berkas foto/pdf,
    // tombol unggah, dan textbox keterangan sesuai template form cetak.
    const galeriCell = (rKode, kategori) => {
      const blok = fiveR.dokumentasi?.[rKode] || {}
      const list = blok[kategori] || []
      const ket = blok.keterangan?.[kategori] || ''
      return (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: ro ? 0 : 8 }}>
            {list.length === 0 && <span className="inv__hint" style={{ margin: 0 }}>{ro ? '-' : 'Belum ada berkas.'}</span>}
            {list.map((f, i) => (
              <span key={i} className="inv__lampiran">
                <FileUp size={12} /> <a style={{ cursor: 'pointer' }} onClick={() => viewFile(f.path)}>{f.nama}</a>
                {!ro && <button type="button" className="inv__icon-btn inv__icon-btn--danger" title="Hapus berkas" style={{ marginLeft: 4 }} onClick={() => removeDok(rKode, kategori, i)}><X size={12} /></button>}
              </span>
            ))}
          </div>
          {!ro && (
            <label className="inv__btn inv__btn--soft" style={{ padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
              <FileUp size={13} /> Tambah Foto / PDF
              <input type="file" hidden accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => e.target.files?.[0] && uploadDok(rKode, kategori, e.target.files[0])} />
            </label>
          )}
          {ro
            ? (ket && <p className="inv__hint" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: 'inherit' }}>{ket}</p>)
            : <textarea
                placeholder="Keterangan…"
                value={ket}
                onChange={(e) => setDokKeterangan(rKode, kategori, e.target.value)}
                style={{ width: '100%', minHeight: 54, marginTop: 8, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 8, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }}
              />}
        </div>
      )
    }

    return (
      <>
        {/* A. Identitas */}
        <Section tag="A" title="Identitas Gugus">
          <div className="inv__form-row">
            <label className="inv__field"><span>Nama Gugus</span>
              <input value={ident.namaGugus} disabled={ro} onChange={(e) => setIdent({ ...ident, namaGugus: e.target.value })} /></label>
            <label className="inv__field"><span>Bagian</span>
              <input value={ident.bagianSeksi} disabled={ro} placeholder="mis. Bagian Umum" onChange={(e) => setIdent({ ...ident, bagianSeksi: e.target.value })} /></label>
            <label className="inv__field"><span>Area / Lokasi 5R</span>
              <input value={fiveR.areaLokasi} disabled={ro} placeholder="mis. Gudang Lantai 2" onChange={(e) => setFiveR((p) => ({ ...p, areaLokasi: e.target.value }))} /></label>
          </div>
          <div className="inv__form-row">
            <label className="inv__field"><span>No. Registrasi</span><input value={data.noRegistrasi ?? '(terbit saat diajukan)'} disabled /></label>
            <label className="inv__field"><span>Kompartemen</span><input value={data.namaKompartemen ?? '-'} disabled /></label>
            <label className="inv__field"><span>Periode Program</span><input value={ident.periode || periodeSekarang()} disabled title="Ditentukan otomatis dari tahun risalah dibuat" /></label>
          </div>
          <label className="inv__field" style={{ marginTop: 4 }}>
            <span>Judul Program 5R</span>
            <textarea style={{ width: '100%', minHeight: 54, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
              value={ident.judul} disabled={ro}
              placeholder="mis. Penerapan 5R di Gudang Umum untuk Menekan Waktu Pencarian Barang Sebesar 40% Selama 6 Bulan"
              onChange={(e) => setIdent({ ...ident, judul: e.target.value })} />
          </label>
        </Section>

        {/* B. Anggota (10 slot: 1 Ketua, 1 Sekretaris, 7 Anggota, 1 Fasilitator) */}
        {renderAnggotaSection()}

        {/* C. Jadwal Kegiatan - kolom bulan kalender mengikuti Periode (2 tahun),
            rentang tanggal per sel. 5R: satu baris per tahap (tanpa Rencana/
            Realisasi) dan tanpa kolom Jml. */}
        <Section tag="C" title="Jadwal Kegiatan">
          <JadwalPdca jadwal={jadwal} setJadwal={setJadwal} readOnly={ro} periode={ident.periode || data.periode} fiveR />
        </Section>

        {/* D. Catatan Pertemuan */}
        <Section tag="D" title="Catatan Pertemuan">
          <div style={{ overflowX: 'auto' }}>
            <table className="inv__subtable">
              <thead>
                <tr><th style={{ width: 140 }}>Tahapan 5R</th>{LIMA_R_STEP.map((r) => <th key={r.kode} style={{ textAlign: 'center' }}>{r.kode}</th>)}</tr>
              </thead>
              <tbody>
                {[['tanggal', 'Tanggal', 'date'], ['jam', 'Jam', 'time'], ['kehadiran', '% Kehadiran', 'text']].map(([field, label, tipe]) => (
                  <tr key={field}>
                    <td style={{ fontWeight: 700 }}>{label}</td>
                    {LIMA_R_STEP.map((r) => (
                      <td key={r.kode}>
                        {ro
                          ? (fiveR.catatan?.[r.kode]?.[field] || '-')
                          : <input type={tipe} value={fiveR.catatan?.[r.kode]?.[field] ?? ''} style={{ width: '100%' }} onChange={(e) => setCatatan5R(r.kode, field, e.target.value)} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* E. Profil 5R (denah) */}
        <Section tag="E" title="Profil 5R">
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Gambar Denah Ruang / Area</span>
            <input value={fiveR.areaLokasi} disabled={ro} placeholder="mis. Gudang Lantai 2"
              onChange={(e) => setFiveR((p) => ({ ...p, areaLokasi: e.target.value }))} />
          </label>
          <p className="inv__hint" style={{ marginTop: 0 }}>Gambar denah ruang / area kerja.</p>
          {fiveR.profilDenahNama
            ? <span className="inv__lampiran"><FileUp size={12} /> <a style={{ cursor: 'pointer' }} onClick={() => viewFile(fiveR.profilDenahPath)}>{fiveR.profilDenahNama}</a>
                {!ro && <button type="button" className="inv__icon-btn inv__icon-btn--danger" title="Hapus denah" style={{ marginLeft: 6 }} onClick={() => setFiveR((p) => ({ ...p, profilDenahPath: '', profilDenahNama: '' }))}><X size={12} /></button>}</span>
            : !ro && (
              <label className="inv__btn inv__btn--soft" style={{ padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
                <FileUp size={13} /> Unggah Denah (gambar/PDF)
                <input type="file" hidden accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => e.target.files?.[0] && uploadDenah(e.target.files[0])} />
              </label>
            )}
          {!fiveR.profilDenahNama && ro && <span className="inv__hint" style={{ margin: 0 }}>-</span>}
        </Section>

        {/* F. Dokumentasi Pelaksanaan 5R (R1-R5) */}
        {LIMA_R_STEP.map((r) => (
          <Section key={r.kode} tag="F" title={`Dokumentasi ${r.label}`}>
            <p className="inv__hint" style={{ marginTop: 0 }}>{r.desc}</p>
            <RepeatTable
              readOnly={ro}
              rows={fiveR.dokumentasi?.[r.kode]?.rows || []}
              setRows={(rows) => setDokRows(r.kode, rows)}
              makeEmpty={() => ({ kegiatan: '', permasalahan: '', aktivitas: '', hasil: '' })}
              addLabel="Tambah Kegiatan"
              columns={[
                { key: 'kegiatan', label: 'Kegiatan', type: 'textarea' },
                { key: 'permasalahan', label: 'Permasalahan', type: 'textarea' },
                { key: 'aktivitas', label: 'Aktivitas Perbaikan', type: 'textarea' },
                { key: 'hasil', label: 'Hasil yang Dicapai', type: 'textarea' },
              ]}
            />
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="inv__subtable">
                <thead>
                  <tr><th colSpan={2} style={{ textAlign: 'center' }}>DOKUMENTASI {r.kode}</th></tr>
                  <tr>
                    <th style={{ textAlign: 'center', width: '50%' }}>SEBELUM</th>
                    <th style={{ textAlign: 'center' }}>PROSES DAN SESUDAH</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: 'top' }}>{galeriCell(r.kode, 'sebelum')}</td>
                    <td style={{ verticalAlign: 'top' }}>{galeriCell(r.kode, 'prosesSesudah')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        ))}

        {/* G. Dampak Positif */}
        <Section tag="G" title="Dampak Positif Pelaksanaan 5R">
          <textarea style={{ width: '100%', minHeight: 90, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
            value={fiveR.dampakPositif} disabled={ro} placeholder="Uraikan dampak positif pelaksanaan 5R."
            onChange={(e) => setFiveR((p) => ({ ...p, dampakPositif: e.target.value }))} />
          <label className="inv__field" style={{ marginTop: 12 }}>
            <span>Dampak Positif Lainnya</span>
            <textarea style={{ width: '100%', minHeight: 70, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
              value={fiveR.dampakPositifLainnya} disabled={ro}
              onChange={(e) => setFiveR((p) => ({ ...p, dampakPositifLainnya: e.target.value }))} />
          </label>
        </Section>

        {/* Lembar Pengesahan (sekali saja) */}
        {renderSignBlock('PLAN')}

        {editPlan && (
          <>
            {kurang5R.length > 0 && (
              <div className="inv__banner inv__banner--warn">
                <b>Lengkapi {kurang5R.length} isian berikut sebelum mengajukan pengesahan:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {kurang5R.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            <div className="inv__actions-bar">
              <button type="button" className="inv__btn inv__btn--ghost" onClick={saveFiveR} disabled={saving}><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
              <button type="button" className="inv__btn inv__btn--primary" onClick={submit} disabled={saving}><Send size={16} /> Ajukan Pengesahan</button>
            </div>
          </>
        )}
      </>
    )
  }
}

function Section({ tag, title, children }) {
  return (
    <div className="inv__card">
      <div className="inv__section-head">
        <span className="inv__section-tag">{tag}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  )
}

// Periode Inovasi ditentukan dari tahun berjalan: tahun ini 2026 -> "2026/2027",
// tahun ini 2027 -> "2027/2028".
const PERIODE_MIN = 2026
const tahunPeriode = () => Math.max(new Date().getFullYear(), PERIODE_MIN)
function periodeSekarang() {
  const y = tahunPeriode()
  return `${y}/${y + 1}`
}

// Modal Detail: menampilkan keseluruhan isi risalah (read-only). Diagram fishbone
// disisipkan tepat di bawah tabel P.6 (bukan di paling atas). Pengganti unduhan Word.
function RisalahDetailModal({ data, onClose }) {
  const adaFishbone = (data.fishbone ?? []).some((f) => f.penyebab || f.akarDominan)
  const { before, after } = renderRisalahHtml(data, { mode: 'full' })
  // Diagram fishbone digambar React; SVG-nya disalin dari DOM ini agar ikut
  // tercetak di PDF pada posisi yang sama.
  const fishRef = useRef(null)

  function unduhPdf() {
    const ok = unduhRisalahPdf(data, fishRef.current?.innerHTML ?? '')
    if (!ok) alert('Jendela cetak diblokir peramban. Izinkan pop-up untuk situs ini lalu coba lagi.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,22,0.5)', display: 'grid', placeItems: 'center', zIndex: 70, padding: 16 }}>
      {/* Tinggi maksimum lewat kelas (inv__sheet--tall), bukan inline: butuh
          dvh + cadangan vh, lihat inovasi.css. */}
      <div className="inv__sheet--tall" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(920px, 96vw)', display: 'flex', flexDirection: 'column', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Detail Risalah</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="inv__btn inv__btn--soft" onClick={unduhPdf} title="Simpan seluruh isi risalah sebagai PDF">
              <Download size={15} /> Unduh PDF
            </button>
            <button type="button" className="inv__icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div style={{ overflowY: 'auto' }}>
          <div dangerouslySetInnerHTML={{ __html: before }} />
          {adaFishbone && after && (
            <div ref={fishRef} style={{ margin: '2px 0 12px' }}><FishboneDiagram fishbone={data.fishbone} masalah={data.masalahUtama || data.judul} /></div>
          )}
          {after && <div dangerouslySetInnerHTML={{ __html: after }} />}
        </div>
      </div>
    </div>
  )
}
