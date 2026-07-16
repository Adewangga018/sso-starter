// One-time/rebuildable conversion: emsifa/api-wilayah-indonesia CSVs -> sharded JSON under
// public/wilayah/, one file per parent so the cascading Provinsi/Kabupaten/Kecamatan/Desa
// selects in ProfilPage only fetch the slice they need instead of shipping all of Indonesia
// up front. Source: https://github.com/emsifa/api-wilayah-indonesia (data/*.csv).
// Re-run with `node scripts/build-wilayah.mjs` if the source CSVs are refreshed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'wilayah-src')
const outDir = path.join(__dirname, '..', 'public', 'wilayah')

// Matches the casing seen in the reference form's embedded data (e.g. "Kabupaten S I A K"):
// per-word first-letter-uppercase, rest lowercase.
function titleCase(name) {
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function parseCsv(file) {
  return readFileSync(path.join(srcDir, file), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(','))
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function groupBy(rows, keyIdx) {
  const map = new Map()
  for (const row of rows) {
    const key = row[keyIdx]
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

const provinces = parseCsv('provinces.csv') // id, name
const regencies = parseCsv('regencies.csv') // id, province_id, name
const districts = parseCsv('districts.csv') // id, regency_id, name
const villages = parseCsv('villages.csv') // id, district_id, name

ensureDir(outDir)
ensureDir(path.join(outDir, 'regencies'))
ensureDir(path.join(outDir, 'districts'))
ensureDir(path.join(outDir, 'villages'))

writeFileSync(
  path.join(outDir, 'provinces.json'),
  JSON.stringify(provinces.map(([id, name]) => ({ id, name: titleCase(name) }))),
)

for (const [provinceId, rows] of groupBy(regencies, 1)) {
  writeFileSync(
    path.join(outDir, 'regencies', `${provinceId}.json`),
    JSON.stringify(rows.map(([id, , name]) => ({ id, name: titleCase(name) }))),
  )
}

for (const [regencyId, rows] of groupBy(districts, 1)) {
  writeFileSync(
    path.join(outDir, 'districts', `${regencyId}.json`),
    JSON.stringify(rows.map(([id, , name]) => ({ id, name: titleCase(name) }))),
  )
}

for (const [districtId, rows] of groupBy(villages, 1)) {
  writeFileSync(
    path.join(outDir, 'villages', `${districtId}.json`),
    JSON.stringify(rows.map(([id, , name]) => ({ id, name: titleCase(name) }))),
  )
}

console.log(`provinces: ${provinces.length}`)
console.log(`regencies: ${regencies.length} (${groupBy(regencies, 1).size} files)`)
console.log(`districts: ${districts.length} (${groupBy(districts, 1).size} files)`)
console.log(`villages: ${villages.length} (${groupBy(villages, 1).size} files)`)
