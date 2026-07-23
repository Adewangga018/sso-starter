import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  FileUp,
  Link2,
  Lock,
  Save,
  Send,
  UserPlus,
  X,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useDialog } from '../../components/DialogProvider'
import RepeatTable from './RepeatTable'
import PegawaiPicker from './PegawaiPicker'
import { jenisLabel, statusClass } from './statusClass'
import { exportRisalahWord } from '../../lib/risalahDoc'
import './inovasi.css'

const ASPEK = [
  ['Q', 'Quality'],
  ['C', 'Cost'],
  ['D', 'Delivery'],
  ['S', 'Safety'],
  ['E', 'Environment'],
  ['M', 'Morale'],
]
const FAKTOR = ['Man', 'Method', 'Machine', 'Material', 'Environment']
const TAHAPAN = ['PLAN', 'DO', 'CHECK', 'ACTION']
const MONTHS = [
  [6, 'Jun'], [7, 'Jul'], [8, 'Agu'], [9, 'Sep'], [10, 'Okt'], [11, 'Nov'],
  [12, 'Des'], [1, 'Jan'], [2, 'Feb'], [3, 'Mar'], [4, 'Apr'], [5, 'Mei'],
]
const STEPS = ['PLAN', 'DO', 'CHECK', 'ACTION']

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

  // --- editable state ---
  const [ident, setIdent] = useState({ namaGugus: '', temaKe: '', periode: '', judul: '', latarBelakang: '', masalahUtama: '', verifikasiAkar: '' })
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
  const [chkPerb, setChkPerb] = useState([])
  const [chkSas, setChkSas] = useState([])
  const [chkBia, setChkBia] = useState([])
  const [chkRis, setChkRis] = useState([])
  const [actTema, setActTema] = useState('')
  const [actStd, setActStd] = useState([])
  const [actTl, setActTl] = useState([])

  const hydrate = useCallback((d) => {
    setData(d)
    setIdent({
      namaGugus: d.namaGugus ?? '',
      temaKe: d.temaKe ?? '',
      periode: d.periode ?? '',
      judul: d.judul ?? '',
      latarBelakang: d.latarBelakang ?? '',
      masalahUtama: d.masalahUtama ?? '',
      verifikasiAkar: d.verifikasiAkar ?? '',
    })
    setAnggota(d.anggota ?? [])
    setDataPendukung(d.dataPendukung ?? [])
    setPareto(d.pareto ?? [])
    // jadwal: 4 tahapan x 2 jenis; isi dari data bila ada.
    const jad = []
    for (const t of TAHAPAN) {
      for (const j of ['Rencana', 'Realisasi']) {
        const found = (d.jadwal ?? []).find((x) => x.tahapan === t && x.jenis === j)
        jad.push({
          tahapan: t,
          jenis: j,
          bulanArr: found?.bulan ? found.bulan.split(',').map((n) => Number(n)).filter(Boolean) : [],
          jumlah: found?.jumlah ?? '',
        })
      }
    }
    setJadwal(jad)
    setSasaran(d.sasaran ?? [])
    // qcdse fixed 6 rows
    setQcdse(ASPEK.map(([a]) => {
      const f = (d.qcdse ?? []).find((x) => x.aspek === a)
      return { aspek: a, dampakKualitatif: f?.dampakKualitatif ?? '', dampakKuantitatif: f?.dampakKuantitatif ?? '' }
    }))
    // fishbone fixed 5 rows
    setFishbone(FAKTOR.map((fk) => {
      const f = (d.fishbone ?? []).find((x) => x.faktor === fk)
      return { faktor: fk, penyebab: f?.penyebab ?? '', akarDominan: f?.akarDominan ?? '', prioritas: f?.prioritas ?? '' }
    }))
    setRencana(d.rencanaPerbaikan ?? [])
    setDoPel(d.doPelaksanaan ?? [])
    setDoKen(d.doKendala ?? [])
    setChkPerb(d.checkPerbandingan ?? [])
    setChkSas(d.checkSasaran ?? [])
    setChkBia(d.checkBiaya ?? [])
    setChkRis(d.checkRisiko ?? [])
    setActTema(d.actionTemaBerikutnya ?? '')
    setActStd(d.actionStandarisasi ?? [])
    setActTl(d.actionTindakLanjut ?? [])
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
  const editLanjut = data?.isOwner === true && data?.planDisahkan === true
  const isGio = data?.jenis === 'GIO'
  const is5R = data?.jenis === '5R'
  // Batas & cakupan anggota per metodologi:
  //  - SS  : anggota dalam satu departemen (tanpa batas jumlah eksplisit)
  //  - 5R  : anggota dalam satu kompartemen, maksimum 10 (Ketua, Sekretaris, Anggota 1-7, Fasilitator)
  //  - GIO : bebas - lintas kompartemen maupun dari luar
  const maxAnggota = is5R ? 10 : null
  const scopeHint = isGio
    ? 'GIO: anggota bebas - boleh lintas kompartemen maupun dari luar organisasi.'
    : is5R
      ? 'Program 5R: anggota harus dalam satu kompartemen. Maksimum 10 orang (Ketua, Sekretaris, Anggota 1-7, Fasilitator).'
      : 'Sistem Saran: anggota harus dalam satu departemen.'

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

  // ---- save handlers ----
  function buildPlanPayload() {
    return {
      namaGugus: ident.namaGugus,
      temaKe: ident.temaKe === '' ? null : Number(ident.temaKe),
      periode: ident.periode,
      judul: ident.judul,
      latarBelakang: ident.latarBelakang,
      masalahUtama: ident.masalahUtama,
      verifikasiAkar: ident.verifikasiAkar || null,
      anggota: anggota.map((a, i) => ({ id: a.id ?? 0, peran: a.peran, nik: a.nik || null, nama: a.nama, jabatan: a.jabatan || null, depBagian: a.depBagian || null, urutan: i + 1 })),
      dataPendukung: dataPendukung.map((x) => ({ id: 0, indikator: x.indikator || null, kondisiAwal: x.kondisiAwal || null, sumberKeterangan: x.sumberKeterangan || null, lampiranPath: x.lampiranPath || null, lampiranNama: x.lampiranNama || null, lampiranLink: x.lampiranLink || null, urutan: 0 })),
      jadwal: jadwal.map((j) => ({ id: 0, tahapan: j.tahapan, jenis: j.jenis, bulan: (j.bulanArr || []).join(','), jumlah: j.jumlah === '' ? null : Number(j.jumlah) })),
      sasaran: sasaran.map((x) => ({ id: 0, sasaran: x.sasaran || null, kondisiSebelum: x.kondisiSebelum || null, target: x.target || null, indikator: x.indikator || null, urutan: 0 })),
      pareto: pareto.map((x) => ({ id: 0, kategori: x.kategori || null, frekuensi: x.frekuensi === '' || x.frekuensi == null ? null : Number(x.frekuensi), urutan: 0 })),
      qcdse: qcdse.filter((x) => (x.dampakKualitatif || x.dampakKuantitatif)).map((x) => ({ id: 0, aspek: x.aspek, dampakKualitatif: x.dampakKualitatif || null, dampakKuantitatif: x.dampakKuantitatif || null })),
      fishbone: fishbone.filter((x) => (x.penyebab || x.akarDominan || x.prioritas !== '')).map((x) => ({ id: 0, faktor: x.faktor, penyebab: x.penyebab || null, akarDominan: x.akarDominan || null, prioritas: x.prioritas === '' ? null : Number(x.prioritas) })),
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

  async function saveDo() {
    setSaving(true)
    try {
      await api.saveInovasiDo(id, {
        doPelaksanaan: doPel.map((x) => ({ id: 0, tahapanKegiatan: x.tahapanKegiatan || null, monitoringHasil: x.monitoringHasil || null, tanggal: x.tanggal || null, evidencePath: x.evidencePath || null, evidenceNama: x.evidenceNama || null, urutan: 0 })),
        doKendala: doKen.map((x) => ({ id: 0, kendala: x.kendala || null, solusi: x.solusi || null, waktu: x.waktu || null, pic: x.pic || null, urutan: 0 })),
      })
      await load()
      notify('ok', 'Tahap DO tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan DO.')
    } finally { setSaving(false) }
  }

  async function saveCheck() {
    setSaving(true)
    try {
      await api.saveInovasiCheck(id, {
        checkPerbandingan: chkPerb.map((x) => ({ id: 0, sebelum: x.sebelum || null, sesudah: x.sesudah || null, urutan: 0 })),
        checkSasaran: chkSas.map((x) => ({ id: 0, sasaran: x.sasaran || null, sebelum: x.sebelum || null, target: x.target || null, sesudah: x.sesudah || null, persenCapaian: x.persenCapaian || null, urutan: 0 })),
        checkBiaya: chkBia.map((x) => ({ id: 0, komponen: x.komponen || null, perhitungan: x.perhitungan || null, nilai: x.nilai || null, urutan: 0 })),
        checkRisiko: chkRis.map((x) => ({ id: 0, dampakNegatif: x.dampakNegatif || null, mitigasi: x.mitigasi || null, urutan: 0 })),
      })
      await load()
      notify('ok', 'Tahap CHECK tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan CHECK.')
    } finally { setSaving(false) }
  }

  async function saveAction() {
    setSaving(true)
    try {
      await api.saveInovasiAction(id, {
        actionTemaBerikutnya: actTema || null,
        actionStandarisasi: actStd.map((x) => ({ id: 0, standarBaru: x.standarBaru || null, noDokumen: x.noDokumen || null, tglBerlaku: x.tglBerlaku || null, pic: x.pic || null, urutan: 0 })),
        actionTindakLanjut: actTl.map((x) => ({ id: 0, rencana: x.rencana || null, targetWaktu: x.targetWaktu || null, pic: x.pic || null, status: x.status || null, urutan: 0 })),
      })
      await load()
      notify('ok', 'Tahap ACTION tersimpan.')
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal menyimpan ACTION.')
    } finally { setSaving(false) }
  }

  async function submit() {
    if (!(await dialog.confirm({
      title: 'Ajukan Risalah',
      message: 'Ajukan risalah ini untuk pengesahan? PLAN tidak bisa diubah lagi kecuali diminta revisi.',
      confirmText: 'Ajukan',
    }))) return
    setSaving(true)
    try {
      await savePlanSilent()
      const res = await api.submitInovasi(id)
      await load()
      notify('ok', `Risalah diajukan. Nomor registrasi: ${res.noRegistrasi ?? '-'}`)
    } catch (e) {
      notify('err', e instanceof ApiError ? e.message : 'Gagal mengajukan risalah.')
    } finally { setSaving(false) }
  }

  // simpan PLAN tanpa notifikasi (dipakai sebelum submit)
  async function savePlanSilent() {
    await api.saveInovasiPlan(id, buildPlanPayload())
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

  const planLocked = !editPlan
  const lanjutTersedia = data?.planDisahkan === true

  // Ekspor Word: bagian PLAN tersedia begitu isian terisi (tak menunggu disahkan);
  // versi Lengkap tersedia bila PLAN sudah disahkan atau ada isian DO/CHECK/ACTION.
  const adaBaris = (a) => Array.isArray(a) && a.length > 0
  const bisaExportPlan = Boolean(data?.judul || data?.latarBelakang || data?.masalahUtama || adaBaris(data?.anggota) || data?.planDisahkan)
  const bisaExportLengkap = data?.planDisahkan === true
    || adaBaris(data?.doPelaksanaan) || adaBaris(data?.doKendala)
    || adaBaris(data?.checkPerbandingan) || adaBaris(data?.checkSasaran)
    || adaBaris(data?.actionStandarisasi) || adaBaris(data?.actionTindakLanjut)

  // Syarat sebelum risalah bisa diajukan ke Lembar Pengesahan.
  const perluNamaGugus = !ident.namaGugus?.trim()
  const perluJudul = !ident.judul?.trim()
  const perluFasilitator = !anggota.some((a) => a.peran === 'Fasilitator')
  const perluKetua = !anggota.some((a) => a.peran === 'Ketua')
  const submitBlokir = perluNamaGugus || perluJudul || perluFasilitator || perluKetua

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
            <button type="button" className="inv__btn inv__btn--soft" onClick={() => exportRisalahWord(data, { mode: 'plan' })} title="Unduh bagian PLAN (isi yang sudah diinput) sebagai Word">
              <FileDown size={15} /> Word (PLAN)
            </button>
            {bisaExportLengkap && (
              <button type="button" className="inv__btn inv__btn--primary" onClick={() => exportRisalahWord(data, { mode: 'full' })} title="Unduh risalah lengkap (semua tahapan yang telah diisi) sebagai Word">
                <FileDown size={15} /> Word (Lengkap)
              </button>
            )}
          </div>
        )}
      </div>

      {banner && <div className={`inv__banner inv__banner--${banner.type}`}>{banner.text}</div>}
      {data.status === 'Revisi' && <div className="inv__banner inv__banner--warn">Pembina/Fasilitator meminta revisi. Perbaiki PLAN lalu ajukan kembali.</div>}
      {planLocked && data.status !== 'Draft' && data.status !== 'Revisi' && !lanjutTersedia && (
        <div className="inv__banner inv__banner--info">Risalah sudah diajukan. Menunggu pengesahan (verifikasi Fasilitator & validasi Pembina) sebelum tahap DO/CHECK/ACTION terbuka.</div>
      )}

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

      <PegawaiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        gugusId={id}
        existingNiks={anggota.map((a) => a.nik).filter(Boolean)}
        onPick={(p) => setAnggota((prev) => {
          if (maxAnggota != null && prev.length >= maxAnggota) return prev
          if (p.nik && prev.some((a) => String(a.nik) === String(p.nik))) return prev // cegah duplikat
          return [...prev, { id: 0, peran: 'Anggota', nik: p.nik, nama: p.nama, jabatan: p.jabatan ?? '', depBagian: p.unit ?? '' }]
        })}
      />
    </div>
  )

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
            <label className="inv__field"><span>Periode Inovasi</span>
              <input value={ident.periode} disabled={planLocked} onChange={(e) => setIdent({ ...ident, periode: e.target.value })} /></label>
          </div>
          <div className="inv__form-row">
            <label className="inv__field"><span>No. Registrasi</span><input value={data.noRegistrasi ?? '(terbit saat diajukan)'} disabled /></label>
            <label className="inv__field"><span>Departemen</span><input value={data.namaDepartemen ?? '-'} disabled /></label>
            <label className="inv__field"><span>Kompartemen</span><input value={data.namaKompartemen ?? '-'} disabled /></label>
          </div>
        </Section>

        {/* B. Anggota */}
        <Section tag="B" title="Susunan Anggota Gugus">
          <p className="inv__hint" style={{ marginTop: 0, marginBottom: 10 }}>{scopeHint}</p>
          {!planLocked && !(maxAnggota != null && anggota.length >= maxAnggota) && (
            <button type="button" className="inv__btn inv__btn--soft" style={{ marginBottom: 10 }} onClick={() => setPickerOpen(true)}>
              <UserPlus size={15} /> Tambah Anggota dari Data Pegawai
            </button>
          )}
          <RepeatTable
            readOnly={planLocked}
            rows={anggota}
            setRows={setAnggota}
            maxRows={maxAnggota}
            makeEmpty={() => ({ id: 0, peran: 'Anggota', nik: '', nama: '', jabatan: '', depBagian: '' })}
            addLabel="Tambah Anggota Manual"
            columns={[
              { key: 'peran', label: 'Peran', type: 'select', options: ['Ketua', 'Sekretaris', 'Fasilitator', 'Anggota'], width: 120 },
              { key: 'nama', label: 'Nama Lengkap', type: 'text' },
              { key: 'nik', label: 'NIK', type: 'text', width: 110 },
              { key: 'jabatan', label: 'Jabatan', type: 'text' },
              { key: 'depBagian', label: 'Dep / Bagian', type: 'text' },
            ]}
          />
          <p className="inv__hint">Anggota yang dicantumkan (dengan NIK) juga akan melihat inovasi ini di My Innovation mereka.</p>
        </Section>

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
                key: 'lampiran', label: 'Lampiran / Tautan', width: 200, type: 'custom',
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

        {/* P.3 Jadwal */}
        <Section tag="P.3" title="Jadwal Kegiatan (PDCA)">
          <div style={{ overflowX: 'auto' }}>
            <table className="inv__subtable">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Tahapan</th>
                  <th style={{ width: 80 }}>Ket.</th>
                  {MONTHS.map(([n, l]) => <th key={n} style={{ textAlign: 'center', width: 34 }}>{l}</th>)}
                  <th style={{ width: 60 }}>Jml.</th>
                </tr>
              </thead>
              <tbody>
                {jadwal.map((row, idx) => (
                  <tr key={`${row.tahapan}-${row.jenis}`}>
                    {row.jenis === 'Rencana' && <td rowSpan={2} style={{ fontWeight: 700, verticalAlign: 'middle' }}>{row.tahapan}</td>}
                    <td>{row.jenis}</td>
                    {MONTHS.map(([n]) => {
                      const on = row.bulanArr.includes(n)
                      return (
                        <td key={n} style={{ textAlign: 'center', background: on ? (row.jenis === 'Rencana' ? '#1f4f2c' : '#a7d3b0') : undefined, cursor: planLocked ? 'default' : 'pointer' }}
                          onClick={() => {
                            if (planLocked) return
                            setJadwal((prev) => prev.map((r, i) => i === idx ? { ...r, bulanArr: on ? r.bulanArr.filter((m) => m !== n) : [...r.bulanArr, n] } : r))
                          }} />
                      )
                    })}
                    <td>{planLocked ? (row.jumlah || '-') : <input type="number" min={0} value={row.jumlah} onChange={(e) => setJadwal((prev) => prev.map((r, i) => i === idx ? { ...r, jumlah: e.target.value } : r))} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="inv__hint">Klik sel bulan untuk mengarsir (hijau tua = Rencana, hijau muda = Realisasi).</p>
        </Section>

        {/* P.4 Sasaran */}
        <Section tag="P.4" title="Penentuan Sasaran (SMART)">
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

        {/* GIO: Stratifikasi & Pareto */}
        {isGio && (
          <Section tag="P.3b" title="Stratifikasi & Diagram Pareto (Penentuan Masalah Dominan)">
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
            <p className="inv__hint">% kontribusi & kumulatif dihitung otomatis (prinsip 80/20).</p>
          </Section>
        )}

        {/* P.5 QCDSE (opsional) */}
        <Section tag="P.5" title="Dampak Masalah terhadap QCDSE + M (opsional)">
          <p className="inv__hint">Bagian ini opsional - boleh dikosongkan.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="inv__subtable">
              <thead><tr><th style={{ width: 130 }}>Aspek</th><th>Dampak Kualitatif</th><th>Dampak Kuantitatif</th></tr></thead>
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

        {/* P.6 Fishbone */}
        <Section tag="P.6" title="Analisa Akar Penyebab (Fishbone)">
          <label className="inv__field" style={{ marginBottom: 12 }}>
            <span>Masalah Utama (kepala tulang ikan)</span>
            <input value={ident.masalahUtama} disabled={planLocked} onChange={(e) => setIdent({ ...ident, masalahUtama: e.target.value })} placeholder="mis. Tata kelola dokumen belum efektif" />
          </label>
          <div style={{ overflowX: 'auto' }}>
            <table className="inv__subtable">
              <thead><tr><th style={{ width: 120 }}>Faktor</th><th>Penyebab Teridentifikasi</th><th>Akar Penyebab Dominan</th><th style={{ width: 90 }}>Prioritas (1-5)</th></tr></thead>
              <tbody>
                {fishbone.map((row, idx) => (
                  <tr key={row.faktor}>
                    <td style={{ fontWeight: 700 }}>{row.faktor}</td>
                    <td>{planLocked ? (row.penyebab || '-') : <textarea rows={2} value={row.penyebab} onChange={(e) => setFishbone((p) => p.map((r, i) => i === idx ? { ...r, penyebab: e.target.value } : r))} />}</td>
                    <td>{planLocked ? (row.akarDominan || '-') : <textarea rows={2} value={row.akarDominan} onChange={(e) => setFishbone((p) => p.map((r, i) => i === idx ? { ...r, akarDominan: e.target.value } : r))} />}</td>
                    <td>{planLocked ? (row.prioritas || '-') : <input type="number" min={1} max={5} value={row.prioritas} onChange={(e) => setFishbone((p) => p.map((r, i) => i === idx ? { ...r, prioritas: e.target.value } : r))} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Preview: akar dominan diberi box, diurut prioritas */}
          <div className="inv__fishbone">
            {fishbone.filter((f) => f.akarDominan).sort((a, b) => (a.prioritas || 9) - (b.prioritas || 9)).map((f) => (
              <div className="inv__fish-factor" key={f.faktor}>
                <h4>{f.faktor}{f.prioritas ? <span className="inv__prio">{f.prioritas}</span> : null}</h4>
                {f.penyebab && <div className="inv__fish-cause">{f.penyebab}</div>}
                <div className="inv__fish-root">{f.akarDominan}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* GIO: Verifikasi Akar Penyebab Dominan */}
        {isGio && (
          <Section tag="P.8" title="Verifikasi Akar Penyebab Dominan (Data / Scatter / Histogram)">
            <textarea style={{ width: '100%', minHeight: 90, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
              value={ident.verifikasiAkar} disabled={planLocked}
              placeholder="Buktikan akar penyebab dominan dengan data kuantitatif (uji korelasi / scatter diagram / histogram)."
              onChange={(e) => setIdent({ ...ident, verifikasiAkar: e.target.value })} />
          </Section>
        )}

        {/* P.7 Rencana Perbaikan 5W2H */}
        <Section tag={isGio ? 'P.9' : 'P.7'} title="Rencana Perbaikan (5W + 2H)">
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

        {/* P.8 Judul */}
        <Section tag={isGio ? 'P.10' : 'P.8'} title={isGio ? 'Judul Gugus Inovasi Operasi (GIO)' : 'Judul Sistem Saran (SS)'}>
          <textarea style={{ width: '100%', minHeight: 60, border: '1px solid var(--inv-line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13.5 }}
            value={ident.judul} disabled={planLocked}
            placeholder="Kata kerja aktif + Obyek + Besaran (%) + Cara + Jangka waktu"
            onChange={(e) => setIdent({ ...ident, judul: e.target.value })} />
        </Section>

        {/* Pengesahan */}
        {renderPengesahan()}

        {/* Aksi PLAN */}
        {(editPlan) && (
          <>
            {submitBlokir && (
              <div className="inv__banner inv__banner--warn">
                <b>Lengkapi sebelum mengajukan:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {perluNamaGugus && <li>Nama Gugus (bagian A) wajib diisi.</li>}
                  {perluKetua && <li>Harus ada anggota dengan peran <b>Ketua</b>.</li>}
                  {perluFasilitator && <li>Harus ada anggota dengan peran <b>Fasilitator</b> (pendamping gugus).</li>}
                  {perluJudul && <li>Judul (P.8) wajib diisi.</li>}
                </ul>
              </div>
            )}
            <div className="inv__actions-bar">
              <button type="button" className="inv__btn inv__btn--ghost" onClick={savePlan} disabled={saving}><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan PLAN'}</button>
              <button type="button" className="inv__btn inv__btn--primary" onClick={submit} disabled={saving || submitBlokir} title={submitBlokir ? 'Lengkapi syarat di atas dahulu' : undefined}><Send size={16} /> Ajukan Pengesahan</button>
            </div>
          </>
        )}
      </>
    )
  }

  function renderPengesahan() {
    const planRows = (data.pengesahan ?? []).filter((p) => p.tahap === 'PLAN')
    if (planRows.length === 0) {
      return (
        <Section tag="✓" title="Lembar Pengesahan Tahap PLAN">
          <p className="inv__hint">Belum ada lembar pengesahan. Ajukan risalah untuk memulai proses tanda tangan.</p>
        </Section>
      )
    }
    return (
      <Section tag="✓" title="Lembar Pengesahan Tahap PLAN">
        <p className="inv__hint">Urutan: Ketua Gugus &rarr; Fasilitator (verifikasi) &rarr; Pembina Tk. Departemen &rarr; Pembina Tk. Kompartemen (validasi). DO/CHECK/ACTION terbuka setelah semua disetujui.</p>
        <div className="inv__sign-grid">
          {planRows.map((p) => (
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
              { key: 'tanggal', label: 'Tanggal', type: 'date', width: 130 },
              {
                key: 'evidence', label: 'Foto / Evidence', width: 170, type: 'custom',
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
              { key: 'solusi', label: 'Solusi / Tindakan', type: 'textarea' },
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
        <Section tag="C.1" title="Perbandingan Kondisi Sebelum & Sesudah">
          <RepeatTable readOnly={ro} rows={chkPerb} setRows={setChkPerb} makeEmpty={() => ({ sebelum: '', sesudah: '' })}
            columns={[{ key: 'sebelum', label: 'SEBELUM', type: 'textarea' }, { key: 'sesudah', label: 'SESUDAH', type: 'textarea' }]} />
        </Section>
        <Section tag="C.2" title="Pencapaian Sasaran Perbaikan">
          <RepeatTable readOnly={ro} rows={chkSas} setRows={setChkSas} makeEmpty={() => ({ sasaran: '', sebelum: '', target: '', sesudah: '', persenCapaian: '' })}
            columns={[
              { key: 'sasaran', label: 'Sasaran', type: 'textarea' },
              { key: 'sebelum', label: 'Sebelum', type: 'textarea' },
              { key: 'target', label: 'Target', type: 'textarea' },
              { key: 'sesudah', label: 'Sesudah', type: 'textarea' },
              { key: 'persenCapaian', label: '% Capaian', type: 'text', width: 90 },
            ]} />
        </Section>
        <Section tag="C.3" title="Analisa Manfaat & Biaya (Cost-Benefit)">
          <RepeatTable readOnly={ro} rows={chkBia} setRows={setChkBia} makeEmpty={() => ({ komponen: '', perhitungan: '', nilai: '' })}
            columns={[{ key: 'komponen', label: 'Komponen', type: 'textarea' }, { key: 'perhitungan', label: 'Perhitungan / Dasar', type: 'textarea' }, { key: 'nilai', label: 'Nilai', type: 'textarea' }]} />
        </Section>
        <Section tag="C.4" title="Analisa Risiko / Dampak Negatif & Penanganannya">
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
        <Section tag="A.1" title="Standarisasi Hasil Perbaikan (SOP)">
          <RepeatTable readOnly={ro} rows={actStd} setRows={setActStd} makeEmpty={() => ({ standarBaru: '', noDokumen: '', tglBerlaku: '', pic: '' })}
            columns={[
              { key: 'standarBaru', label: 'Standar Baru (SOP / IK / Format)', type: 'textarea' },
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
        {editLanjut && <div className="inv__actions-bar"><button type="button" className="inv__btn inv__btn--primary" onClick={saveAction} disabled={saving}><Save size={16} /> Simpan ACTION</button></div>}
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
