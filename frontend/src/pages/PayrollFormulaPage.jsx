import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, Sliders, ShieldAlert } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { kelompokkan, Field, SubGrup } from './PayrollShared'
import './PayrollShared.css'

// Tarif satu dimensi (Band/JG/PG): satu nominal per nilai — bukan matriks JG × PG.
// Dipakai Pendapatan Dasar & Potongan per Band/JG/PG (dua endpoint terpisah walau
// mekanismenya sama, supaya potongan tak tercampur ke basis rumus BPJS Kesehatan).
function TarifTunggalSection({ tahun, judul, deskripsi, emptyMsg, getFn, saveFn, savedMsg }) {
  const [data, setData] = useState(null)
  const [nominal, setNominal] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setMsg(null)
    try {
      const d = await getFn(tahun)
      setData(d)
      const map = {}
      d.komponen.forEach((k) => k.nilai.forEach((n) => { map[`${k.idKomponen}:${n.nilai}`] = n.nominal ? String(n.nominal) : '' }))
      setNominal(map)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : `Gagal memuat ${judul}.` })
    } finally { setLoading(false) }
  }, [tahun, getFn, judul])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!data) return
    setSaving(true); setMsg(null)
    try {
      const items = []
      data.komponen.forEach((k) => k.nilai.forEach((n) => {
        items.push({ idKomponen: k.idKomponen, nilai: n.nilai, nominal: Number(nominal[`${k.idKomponen}:${n.nilai}`] || 0) })
      }))
      await saveFn({ tahun, items })
      setMsg({ type: 'ok', text: savedMsg(tahun) })
      load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

  if (!loading && data && data.komponen.length === 0) return null

  return (
    <section className="agt__pd">
      <div className="agt__pd-head">
        <h3>{judul}</h3>
        <p>{deskripsi}</p>
      </div>

      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {loading && !data ? (
        <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
      ) : !data || data.komponen.length === 0 ? (
        <div className="agt__empty">{emptyMsg}</div>
      ) : (
        <>
          <div className="agt__pd-grid">
            {data.komponen.map((k) => (
              <div className="agt__pd-kom" key={k.idKomponen}>
                <div className="agt__pd-kom-head">
                  <span className="agt__k-nama agt__k-nama--in">{k.nama}</span>
                  <span className="agt__pd-basis">per {k.basis}</span>
                </div>
                <div className="agt__pd-rows">
                  {k.nilai.map((n) => (
                    <label className="agt__pd-row" key={n.nilai}>
                      <span className="agt__pd-label">{n.label}</span>
                      <div className="agt__input-wrap">
                        <span className="agt__rp">Rp</span>
                        <input
                          type="number" min="0" step="1000" inputMode="numeric"
                          value={nominal[`${k.idKomponen}:${n.nilai}`] ?? ''}
                          placeholder="0"
                          onChange={(e) => setNominal((m) => ({ ...m, [`${k.idKomponen}:${n.nilai}`]: e.target.value }))}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="agt__foot">
            <button type="button" className="agt__save agt__save--sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={15} className="agt__spin" /> : <Save size={15} />}
              Simpan {judul}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

// Komponen berbasis rumus: nominal = Persen% x MIN(Pendapatan Dasar, Batas Atas).
// Saat ini: Tunjangan BPJS Kesehatan. Tidak per-tahun - berlaku sampai diubah lagi.
function FormulaSection() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setMsg(null)
    try {
      const d = await api.getGajiFormula()
      setData(d)
      const map = {}
      d.komponen.forEach((k) => { map[k.idKomponen] = { persen: k.persen ?? '', batas: k.batas ?? '' } })
      setForm(map)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat rumus.' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!data) return
    setSaving(true); setMsg(null)
    try {
      const items = data.komponen.map((k) => ({
        idKomponen: k.idKomponen,
        persen: Number(form[k.idKomponen]?.persen || 0),
        batas: form[k.idKomponen]?.batas === '' ? null : Number(form[k.idKomponen].batas),
      }))
      await api.simpanGajiFormula({ items })
      setMsg({ type: 'ok', text: 'Rumus tersimpan.' })
      load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
  if (!data || data.komponen.length === 0) return null

  return (
    <section className="agt__pd">
      <div className="agt__pd-head">
        <h3>Komponen Berbasis Rumus</h3>
        <p>Dihitung otomatis: <b>Persen% × MIN(Pendapatan Dasar, Batas Atas)</b>. Kosongkan Batas Atas bila tanpa batas.</p>
      </div>
      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="agt__pd-grid">
        {data.komponen.map((k) => (
          <div className="agt__pd-kom" key={k.idKomponen}>
            <div className="agt__pd-kom-head">
              <span className="agt__k-nama agt__k-nama--in">{k.nama}</span>
            </div>
            <div className="agt__pd-rows">
              <label className="agt__pd-row">
                <span className="agt__pd-label">Persentase (%)</span>
                <div className="agt__input-wrap">
                  <input
                    type="number" min="0" max="100" step="0.1" inputMode="decimal"
                    value={form[k.idKomponen]?.persen ?? ''}
                    placeholder="0"
                    onChange={(e) => setForm((m) => ({ ...m, [k.idKomponen]: { ...m[k.idKomponen], persen: e.target.value } }))}
                  />
                </div>
              </label>
              <label className="agt__pd-row">
                <span className="agt__pd-label">Batas Atas (Rp)</span>
                <div className="agt__input-wrap">
                  <span className="agt__rp">Rp</span>
                  <input
                    type="number" min="0" step="1000" inputMode="numeric"
                    value={form[k.idKomponen]?.batas ?? ''}
                    placeholder="tanpa batas"
                    onChange={(e) => setForm((m) => ({ ...m, [k.idKomponen]: { ...m[k.idKomponen], batas: e.target.value } }))}
                  />
                </div>
              </label>
            </div>
            {k.keterangan && <p className="agt__pd-note">{k.keterangan}</p>}
          </div>
        ))}
      </div>
      <div className="agt__foot">
        <button type="button" className="agt__save agt__save--sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="agt__spin" /> : <Save size={15} />}
          Simpan Rumus
        </button>
      </div>
    </section>
  )
}

// Tarif SPPD per Band - dipakai (1) nominal komponen SPPD sendiri (tarif x jumlah SPPD
// disetujui/periode) dan (2) basis formula Uang Makan Dinas rentang 75-150km (20% dari
// tarif SPPD Band pegawai). Endpoint SENDIRI (bukan panel Pendapatan Dasar generik) krn
// basis komponen SPPD = Karyawan_Periode, nominalnya dihitung dari kejadian, bukan flat.
function TarifSppdSection({ tahun }) {
  const [data, setData] = useState(null)
  const [nominal, setNominal] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setMsg(null)
    try {
      const d = await api.getTarifSppd(tahun)
      setData(d)
      const map = {}
      d.nilai.forEach((n) => { map[n.nilai] = n.nominal ? String(n.nominal) : '' })
      setNominal(map)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat tarif SPPD.' })
    } finally { setLoading(false) }
  }, [tahun])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!data) return
    setSaving(true); setMsg(null)
    try {
      const items = data.nilai.map((n) => ({ idKomponen: 0, nilai: n.nilai, nominal: Number(nominal[n.nilai] || 0) }))
      await api.simpanTarifSppd({ tahun, items })
      setMsg({ type: 'ok', text: `Tarif SPPD tahun ${tahun} tersimpan.` })
      load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

  if (loading && !data) return <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
  if (!data || data.nilai.length === 0) return null

  return (
    <section className="agt__pd">
      <div className="agt__pd-head">
        <h3>Tarif SPPD per Band</h3>
        <p>
          Nominal SPPD = tarif Band ini × jumlah SPPD disetujui per periode. Juga jadi dasar
          Uang Makan Dinas rentang <b>75-150km</b> (20% dari tarif Band ini).
        </p>
      </div>
      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="agt__pd-grid">
        <div className="agt__pd-kom">
          <div className="agt__pd-kom-head">
            <span className="agt__k-nama agt__k-nama--in">SPPD</span>
            <span className="agt__pd-basis">per Band</span>
          </div>
          <div className="agt__pd-rows">
            {data.nilai.map((n) => (
              <label className="agt__pd-row" key={n.nilai}>
                <span className="agt__pd-label">{n.label}</span>
                <div className="agt__input-wrap">
                  <span className="agt__rp">Rp</span>
                  <input
                    type="number" min="0" step="1000" inputMode="numeric"
                    value={nominal[n.nilai] ?? ''}
                    placeholder="0"
                    onChange={(e) => setNominal((m) => ({ ...m, [n.nilai]: e.target.value }))}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="agt__foot">
        <button type="button" className="agt__save agt__save--sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="agt__spin" /> : <Save size={15} />}
          Simpan Tarif SPPD
        </button>
      </div>
    </section>
  )
}

// Tarif Tunjangan Luar Daerah per Wilayah x Band - dua dimensi (beda dari tarif satu
// dimensi Band/JG/PG di atas). Cakupan saat ini: Medan/Lampung/Makassar x Band III-VI
// (dikonfirmasi user; wilayah/band lain bisa ditambah lewat backend tanpa ubah UI ini).
function TarifWilayahSection({ tahun }) {
  const [data, setData] = useState(null)
  const [nominal, setNominal] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setMsg(null)
    try {
      const d = await api.getTarifWilayah(tahun)
      setData(d)
      const map = {}
      d.nilai.forEach((n) => { map[`${n.wilayah}:${n.band}`] = n.nominal ? String(n.nominal) : '' })
      setNominal(map)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat tarif luar daerah.' })
    } finally { setLoading(false) }
  }, [tahun])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!data) return
    setSaving(true); setMsg(null)
    try {
      const items = data.nilai.map((n) => ({
        wilayah: n.wilayah, band: n.band, nominal: Number(nominal[`${n.wilayah}:${n.band}`] || 0),
      }))
      await api.simpanTarifWilayah({ tahun, items })
      setMsg({ type: 'ok', text: `Tarif Luar Daerah tahun ${tahun} tersimpan.` })
      load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

  if (loading && !data) return <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
  if (!data || data.wilayahList.length === 0) return null

  const bandLabelOf = (band) => data.nilai.find((n) => n.band === band)?.bandLabel ?? `Band ${band}`

  return (
    <section className="agt__pd">
      <div className="agt__pd-head">
        <h3>Tarif Tunjangan Luar Daerah per Wilayah × Band</h3>
        <p>
          Nominal tunjangan pegawai yang bertugas di wilayah ini, sesuai Band-nya. Cakupan saat
          ini: {data.wilayahList.join(', ')} × {data.bandList.map(bandLabelOf).join(', ')}.
        </p>
      </div>
      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table className="agt__presensi-table">
          <thead>
            <tr>
              <th>Wilayah</th>
              {data.bandList.map((b) => <th key={b}>{bandLabelOf(b)}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.wilayahList.map((w) => (
              <tr key={w}>
                <td>{w}</td>
                {data.bandList.map((b) => (
                  <td key={b}>
                    <div className="agt__input-wrap" style={{ width: 140 }}>
                      <span className="agt__rp">Rp</span>
                      <input
                        type="number" min="0" step="1000" inputMode="numeric"
                        value={nominal[`${w}:${b}`] ?? ''}
                        placeholder="0"
                        onChange={(e) => setNominal((m) => ({ ...m, [`${w}:${b}`]: e.target.value }))}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="agt__foot">
        <button type="button" className="agt__save agt__save--sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="agt__spin" /> : <Save size={15} />}
          Simpan Tarif Luar Daerah
        </button>
      </div>
    </section>
  )
}

// Komponen basis 'Flat': satu nominal, SAMA untuk semua karyawan (mis. Iuran IKGCS,
// Simpanan Wajib KKCS/K3PG) - bukan per Band/JG/PG, bukan per karyawan/periode.
function FlatSection() {
  const [data, setData] = useState(null)
  const [nominal, setNominal] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setMsg(null)
    try {
      const d = await api.getGajiFlat()
      setData(d)
      const map = {}
      d.komponen.forEach((k) => { map[k.idKomponen] = k.nilai ? String(k.nilai) : '' })
      setNominal(map)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat nilai flat.' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!data) return
    setSaving(true); setMsg(null)
    try {
      const items = data.komponen.map((k) => ({ idKomponen: k.idKomponen, nilai: Number(nominal[k.idKomponen] || 0) }))
      await api.simpanGajiFlat({ items })
      setMsg({ type: 'ok', text: 'Nilai tersimpan.' })
      load()
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
  if (!data || data.komponen.length === 0) return null

  return (
    <section className="agt__pd">
      <div className="agt__pd-head">
        <h3>Nilai Sama untuk Semua Karyawan</h3>
        <p>Satu nominal yang berlaku untuk <b>seluruh karyawan</b> — bukan per Band/JG/PG, bukan per orang.</p>
      </div>
      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="agt__pd-grid">
        {data.komponen.map((k) => (
          <div className="agt__pd-kom" key={k.idKomponen}>
            <div className="agt__pd-kom-head">
              <span className="agt__k-nama agt__k-nama--out">{k.nama}</span>
            </div>
            <label className="agt__pd-row">
              <span className="agt__pd-label">Nominal</span>
              <div className="agt__input-wrap">
                <span className="agt__rp">Rp</span>
                <input
                  type="number" min="0" step="1000" inputMode="numeric"
                  value={nominal[k.idKomponen] ?? ''}
                  placeholder="0"
                  onChange={(e) => setNominal((m) => ({ ...m, [k.idKomponen]: e.target.value }))}
                />
              </div>
            </label>
          </div>
        ))}
      </div>
      <div className="agt__foot">
        <button type="button" className="agt__save agt__save--sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="agt__spin" /> : <Save size={15} />}
          Simpan Nilai
        </button>
      </div>
    </section>
  )
}

// Komponen JG_PG lain (belum digeneralisasi ke Band/JG/PG tunggal): matriks per sel.
// Punya selektor JG/PG SENDIRI, di-scope ke sub-bagian ini saja.
function MatriksJgPgSection({ tahun }) {
  const [opsi, setOpsi] = useState(null)
  const [jg, setJg] = useState(null)
  const [pg, setPg] = useState(null)
  const [items, setItems] = useState([])
  const [nominal, setNominal] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    api.getGajiGradeOpsi()
      .then((o) => { setOpsi(o); if (o.jg?.length) setJg(o.jg[0]); if (o.pg?.length) setPg(o.pg[0]) })
      .catch(() => setMsg({ type: 'err', text: 'Gagal memuat pilihan JG/PG.' }))
  }, [])

  const loadSel = useCallback(async () => {
    if (!jg || !pg) return
    setLoading(true); setMsg(null)
    try {
      const sel = await api.getGajiTarif(tahun, jg, pg)
      setItems(sel.items)
      const map = {}
      sel.items.forEach((it) => { map[it.idKomponen] = it.nominal ? String(it.nominal) : '' })
      setNominal(map)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat tarif.' })
    } finally { setLoading(false) }
  }, [tahun, jg, pg])

  useEffect(() => { loadSel() }, [loadSel])

  const grup = useMemo(() => {
    const byKat = {}
    for (const it of items) (byKat[it.kategori] ??= []).push(it)
    return Object.entries(byKat)
  }, [items])

  async function save() {
    setSaving(true); setMsg(null)
    try {
      await api.simpanGajiTarif({
        tahun, jg, pg,
        items: items.map((it) => ({ idKomponen: it.idKomponen, nominal: Number(nominal[it.idKomponen] || 0) })),
      })
      setMsg({ type: 'ok', text: `Tarif JG ${jg} / PG ${pg} tahun ${tahun} tersimpan.` })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

  return (
    <section className="agt__pd">
      <div className="agt__pd-head">
        <h3>Komponen Lain (per sel Job Grade × Person Grade)</h3>
        <p>Komponen yang belum digeneralisasi ke Band/JG/PG tunggal — nominal tetap diisi per sel JG × PG.</p>
      </div>

      <div className="agt__sel agt__sel--inline">
        <label>Job Grade (JG)
          <select value={jg ?? ''} onChange={(e) => setJg(Number(e.target.value))}>
            {opsi?.jg?.map((v) => <option key={v} value={v}>JG {v}</option>)}
          </select>
        </label>
        <label>Person Grade (PG)
          <select value={pg ?? ''} onChange={(e) => setPg(Number(e.target.value))}>
            {opsi?.pg?.map((v) => <option key={v} value={v}>PG {v}</option>)}
          </select>
        </label>
      </div>

      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {loading ? (
        <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
      ) : items.length === 0 ? (
        <div className="agt__empty">Tidak ada komponen berbasis JG/PG.</div>
      ) : (
        <>
          <div className="agt__grid">
            {grup.map(([kat, list]) => (
              <div className="agt__kat" key={kat}>
                <div className="agt__kat-head">{kat}</div>
                {kelompokkan(list).map((en) => en.type === 'sub'
                  ? <SubGrup key={en.grupKode} sub={en} nominal={nominal} setNominal={setNominal} />
                  : <Field key={en.item.idKomponen} it={en.item} nominal={nominal} setNominal={setNominal} />)}
              </div>
            ))}
          </div>
          <div className="agt__foot">
            <button type="button" className="agt__save agt__save--sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={15} className="agt__spin" /> : <Save size={15} />}
              Simpan JG {jg} / PG {pg}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export default function PayrollFormulaPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const nowYear = new Date().getFullYear()
  const [tahun, setTahun] = useState(nowYear)

  if (!isAdminModulSdm) {
    return (
      <div className="agt">
        <div className="agt__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Konfigurasi gaji hanya untuk Admin Modul SDM (Kepala Bagian SDM ke atas hingga GM SKP).</p>
          <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="agt">
      <div className="agt__top">
        <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="agt__role">Admin Modul SDM{summary?.nama ? <> · <span className="u-nama">{summary.nama}</span></> : ''}</span>
      </div>

      <div className="agt__head">
        <h2 className="agt__title"><Sliders size={20} /> Formula &amp; Generalisasi</h2>
        <p className="agt__sub">Komponen yang nominalnya ditentukan berdasarkan grade (Band/JG/PG), rumus, atau sama untuk semua karyawan — bukan diinput satu-satu per orang.</p>
      </div>

      <div className="agt__sel">
        <label>Tahun berlaku
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
            {[nowYear + 1, nowYear, nowYear - 1, nowYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <TarifTunggalSection
        tahun={tahun}
        judul="Pendapatan Dasar"
        deskripsi={<>Gaji Pokok, Tunjangan Jabatan, Perumahan, Pangan &amp; Angkutan — satu nominal per <b>Band</b>, <b>JG</b>, atau <b>PG</b> saja. Berlaku sama untuk semua pegawai di tingkat itu.</>}
        emptyMsg="Tidak ada komponen Pendapatan Dasar."
        getFn={api.getPendapatanDasar}
        saveFn={api.simpanPendapatanDasar}
        savedMsg={(t) => `Pendapatan Dasar tahun ${t} tersimpan.`}
      />
      <TarifTunggalSection
        tahun={tahun}
        judul="Potongan per Band/JG/PG"
        deskripsi={<>Mis. <b>Potongan DPLK</b> — satu nominal per Band/JG/PG.</>}
        emptyMsg="Tidak ada potongan berbasis Band/JG/PG."
        getFn={api.getPotonganTunggal}
        saveFn={api.simpanPotonganTunggal}
        savedMsg={(t) => `Potongan per Band/JG/PG tahun ${t} tersimpan.`}
      />
      <TarifSppdSection tahun={tahun} />
      <TarifWilayahSection tahun={tahun} />
      <FormulaSection />
      <FlatSection />
      <MatriksJgPgSection tahun={tahun} />
    </div>
  )
}
