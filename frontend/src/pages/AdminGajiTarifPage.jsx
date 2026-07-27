import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, SlidersHorizontal, ShieldAlert } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import './AdminGajiTarifPage.css'

const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0)

export default function AdminGajiTarifPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const nowYear = new Date().getFullYear()

  const [opsi, setOpsi] = useState(null)
  const [tahun, setTahun] = useState(nowYear)
  const [jg, setJg] = useState(null)
  const [pg, setPg] = useState(null)
  const [items, setItems] = useState([])
  const [nominal, setNominal] = useState({}) // idKomponen -> string
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  // Muat pilihan JG/PG sekali.
  useEffect(() => {
    if (!isAdminModulSdm) return
    api.getGajiGradeOpsi()
      .then((o) => {
        setOpsi(o)
        if (o.jg?.length) setJg(o.jg[0])
        if (o.pg?.length) setPg(o.pg[0])
      })
      .catch(() => setMsg({ type: 'err', text: 'Gagal memuat pilihan JG/PG.' }))
  }, [isAdminModulSdm])

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
    } finally {
      setLoading(false)
    }
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
    } finally {
      setSaving(false)
    }
  }

  if (!isAdminModulSdm) {
    return (
      <div className="agt">
        <div className="agt__denied">
          <ShieldAlert size={28} />
          <h2>Akses terbatas</h2>
          <p>Konfigurasi tarif gaji hanya untuk Admin Modul SDM (Kepala Bagian SDM ke atas hingga GM SKP).</p>
          <Link to="/dashboard" className="agt__back"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="agt">
      <div className="agt__top">
        <Link to="/my-personal/gaji" className="agt__back"><ArrowLeft size={16} /> Slip Gaji</Link>
        <span className="agt__role">Admin Modul SDM{summary?.nama ? ` · ${summary.nama}` : ''}</span>
      </div>

      <div className="agt__head">
        <h2 className="agt__title"><SlidersHorizontal size={20} /> Konfigurasi Tarif Gaji</h2>
        <p className="agt__sub">Nominal komponen per sel <b>Job Grade × Person Grade</b> per tahun. PG naik tahunan & JG naik mengikuti jabatan — keduanya menaikkan gaji.</p>
      </div>

      <div className="agt__sel">
        <label>Tahun
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
            {[nowYear + 1, nowYear, nowYear - 1, nowYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
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
                {list.map((it) => (
                  <label className="agt__field" key={it.idKomponen}>
                    <span className={`agt__k-nama agt__k-nama--${it.tipe === 'Potongan' ? 'out' : 'in'}`}>{it.nama}</span>
                    <div className="agt__input-wrap">
                      <span className="agt__rp">Rp</span>
                      <input
                        type="number" min="0" step="1000" inputMode="numeric"
                        value={nominal[it.idKomponen] ?? ''}
                        placeholder="0"
                        onChange={(e) => setNominal((m) => ({ ...m, [it.idKomponen]: e.target.value }))}
                      />
                    </div>
                    <span className="agt__preview">{rupiah(Number(nominal[it.idKomponen] || 0))}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div className="agt__foot">
            <button type="button" className="agt__save" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="agt__spin" /> : <Save size={16} />}
              Simpan tarif JG {jg} / PG {pg} ({tahun})
            </button>
          </div>
        </>
      )}
    </div>
  )
}
