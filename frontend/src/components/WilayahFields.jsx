import { useEffect, useState } from 'react'

async function fetchJson(path) {
  try {
    const res = await fetch(path)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

const norm = (s) => (s ?? '').trim().toLowerCase()

// Cascading Provinsi -> Kota/Kabupaten -> Kecamatan -> Desa/Kelurahan, backed by the static
// wilayah dataset in public/wilayah/ (source: emsifa/api-wilayah-indonesia, see
// scripts/build-wilayah.mjs). The form only ever stores the region NAME (matching AlamatDto's
// plain strings) - ids are local UI state used just to drive the cascade and fetch the next
// level's options.
export default function WilayahFields({ profile, form, setForm, editing, required }) {
  const mark = required ? <span className="profil__required">*</span> : null
  const [provinces, setProvinces] = useState([])
  const [regencies, setRegencies] = useState([])
  const [districts, setDistricts] = useState([])
  const [villages, setVillages] = useState([])

  const [provinceId, setProvinceId] = useState('')
  const [regencyId, setRegencyId] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [villageId, setVillageId] = useState('')

  useEffect(() => {
    if (editing) fetchJson('/wilayah/provinces.json').then(setProvinces)
  }, [editing])

  // Resolve saved names back to ids as each level loads, so editing an existing profile
  // pre-selects the right chain instead of starting empty every time.
  useEffect(() => {
    if (!provinces.length || !form?.provinsi || provinceId) return
    const match = provinces.find((p) => norm(p.name) === norm(form.provinsi))
    if (match) setProvinceId(match.id)
  }, [provinces, form?.provinsi, provinceId])

  useEffect(() => {
    if (!provinceId) {
      setRegencies([])
      return
    }
    fetchJson(`/wilayah/regencies/${provinceId}.json`).then(setRegencies)
  }, [provinceId])

  useEffect(() => {
    if (!regencies.length || !form?.kabupaten || regencyId) return
    const match = regencies.find((r) => norm(r.name) === norm(form.kabupaten))
    if (match) setRegencyId(match.id)
  }, [regencies, form?.kabupaten, regencyId])

  useEffect(() => {
    if (!regencyId) {
      setDistricts([])
      return
    }
    fetchJson(`/wilayah/districts/${regencyId}.json`).then(setDistricts)
  }, [regencyId])

  useEffect(() => {
    if (!districts.length || !form?.kecamatan || districtId) return
    const match = districts.find((d) => norm(d.name) === norm(form.kecamatan))
    if (match) setDistrictId(match.id)
  }, [districts, form?.kecamatan, districtId])

  useEffect(() => {
    if (!districtId) {
      setVillages([])
      return
    }
    fetchJson(`/wilayah/villages/${districtId}.json`).then(setVillages)
  }, [districtId])

  useEffect(() => {
    if (!villages.length || !form?.desa || villageId) return
    const match = villages.find((v) => norm(v.name) === norm(form.desa))
    if (match) setVillageId(match.id)
  }, [villages, form?.desa, villageId])

  function onProvinceChange(id) {
    setProvinceId(id)
    setRegencyId('')
    setDistrictId('')
    setVillageId('')
    const name = provinces.find((p) => p.id === id)?.name ?? ''
    setForm((f) => ({ ...f, provinsi: name, kabupaten: '', kecamatan: '', desa: '' }))
  }

  function onRegencyChange(id) {
    setRegencyId(id)
    setDistrictId('')
    setVillageId('')
    const name = regencies.find((r) => r.id === id)?.name ?? ''
    setForm((f) => ({ ...f, kabupaten: name, kecamatan: '', desa: '' }))
  }

  function onDistrictChange(id) {
    setDistrictId(id)
    setVillageId('')
    const name = districts.find((d) => d.id === id)?.name ?? ''
    setForm((f) => ({ ...f, kecamatan: name, desa: '' }))
  }

  function onVillageChange(id) {
    setVillageId(id)
    const name = villages.find((v) => v.id === id)?.name ?? ''
    setForm((f) => ({ ...f, desa: name }))
  }

  if (!editing) {
    return (
      <>
        <div className="info-row">
          <div className="info-row__label">Kecamatan</div>
          <div className="info-row__value">{profile.alamat?.kecamatan ?? '-'}</div>
        </div>
        <div className="info-row">
          <div className="info-row__label">Desa/Kelurahan</div>
          <div className="info-row__value">{profile.alamat?.desa ?? '-'}</div>
        </div>
        <div className="info-row span-2">
          <div className="info-row__label">Kota/Kabupaten</div>
          <div className="info-row__value">{profile.alamat?.kabupaten ?? '-'}</div>
        </div>
        <div className="info-row span-2">
          <div className="info-row__label">Provinsi</div>
          <div className="info-row__value">{profile.alamat?.provinsi ?? '-'}</div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="info-row">
        <div className="info-row__label">Kecamatan{mark}</div>
        <select
          className="profil__input"
          value={districtId}
          onChange={(e) => onDistrictChange(e.target.value)}
          disabled={!regencyId}
        >
          <option value="">{regencyId ? '— Pilih Kecamatan —' : '— Pilih Kota/Kabupaten dahulu —'}</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="info-row">
        <div className="info-row__label">Desa/Kelurahan{mark}</div>
        <select
          className="profil__input"
          value={villageId}
          onChange={(e) => onVillageChange(e.target.value)}
          disabled={!districtId}
        >
          <option value="">{districtId ? '— Pilih Desa/Kelurahan —' : '— Pilih Kecamatan dahulu —'}</option>
          {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="info-row span-2">
        <div className="info-row__label">Kota/Kabupaten{mark}</div>
        <select
          className="profil__input"
          value={regencyId}
          onChange={(e) => onRegencyChange(e.target.value)}
          disabled={!provinceId}
        >
          <option value="">{provinceId ? '— Pilih Kota/Kabupaten —' : '— Pilih Provinsi dahulu —'}</option>
          {regencies.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div className="info-row span-2">
        <div className="info-row__label">Provinsi{mark}</div>
        <select className="profil__input" value={provinceId} onChange={(e) => onProvinceChange(e.target.value)}>
          <option value="">— Pilih Provinsi —</option>
          {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </>
  )
}
