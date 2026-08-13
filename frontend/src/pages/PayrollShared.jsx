import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0)

// Komponen yang punya sub-komponen (mis. BPJS Ketenagakerjaan) berbagi `grupKode`
// yang sama & berurutan — kelompokkan jadi satu blok dropdown; tiap sub-komponen
// tetap punya kolom input nominal sendiri-sendiri.
export function kelompokkan(list) {
  const entries = []
  let i = 0
  while (i < list.length) {
    const it = list[i]
    if (it.grupKode) {
      const cluster = [it]
      let j = i + 1
      while (j < list.length && list[j].grupKode === it.grupKode) { cluster.push(list[j]); j++ }
      entries.push({ type: 'sub', grupKode: it.grupKode, grupLabel: it.grupLabel, items: cluster })
      i = j
    } else {
      entries.push({ type: 'row', item: it })
      i++
    }
  }
  return entries
}

// mirrorId (opsional): kalau diisi, mengetik di field ini juga menulis nilai yang
// SAMA ke komponen lain (mis. TJ_PAJAK <-> POT_PAJAK, TJ_PREMI <-> POT_PREMI -
// nilainya sudah pasti sama, jadi tak perlu diketik dua kali/bisa beda sendiri).
export function Field({ it, nominal, setNominal, mirrorId, mirrorNama }) {
  return (
    <label className="agt__field">
      <span className={`agt__k-nama agt__k-nama--${it.tipe === 'Potongan' ? 'out' : 'in'}`}>
        {it.nama}
        {mirrorId && <span className="agt__k-mirror" title={`Otomatis sama dengan ${mirrorNama ?? 'komponen pasangannya'}`}>= {mirrorNama}</span>}
      </span>
      <div className="agt__input-wrap">
        <span className="agt__rp">Rp</span>
        <input
          type="number" min="0" step="1000" inputMode="numeric"
          value={nominal[it.idKomponen] ?? ''}
          placeholder="0"
          onChange={(e) => {
            const val = e.target.value
            setNominal((m) => (mirrorId ? { ...m, [it.idKomponen]: val, [mirrorId]: val } : { ...m, [it.idKomponen]: val }))
          }}
        />
      </div>
      <span className="agt__preview">{rupiah(Number(nominal[it.idKomponen] || 0))}</span>
    </label>
  )
}

export function SubGrup({ sub, nominal, setNominal }) {
  const [open, setOpen] = useState(false)
  const subtotal = sub.items.reduce((s, it) => s + Number(nominal[it.idKomponen] || 0), 0)
  return (
    <div className={`agt__subgrup${open ? ' is-open' : ''}`}>
      <button type="button" className="agt__subgrup-head" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="agt__subgrup-label">{sub.grupLabel}</span>
        <span className="agt__subgrup-count">{sub.items.length} sub-komponen</span>
        <span className="agt__subgrup-total">{rupiah(subtotal)}</span>
      </button>
      {open && (
        <div className="agt__subgrup-body">
          {sub.items.map((it) => <Field key={it.idKomponen} it={it} nominal={nominal} setNominal={setNominal} />)}
        </div>
      )}
    </div>
  )
}
