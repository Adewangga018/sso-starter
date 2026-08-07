import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, UserCog, ShieldAlert, Search, X, Wand2, ChevronDown, ChevronRight } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { rupiah, kelompokkan, Field, SubGrup } from './PayrollShared'
import './PayrollShared.css'

// Komponen standalone (tanpa grup_kode) yg punya panel kalkulator sendiri (di atas grid) -
// jangan dobel tampil di grid biasa.
const KODE_KALKULATOR_SENDIRI = ['POT_PRESENSI', 'MAKAN_DINAS', 'TJ_SPPD']

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Autocomplete pegawai seluruh perusahaan (bukan per-departemen — admin payroll
// mengelola seluruh karyawan). Debounce 250ms, min 2 karakter.
function PegawaiSearch({ selected, onSelect }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return }
    setLoading(true)
    const t = setTimeout(() => {
      api.cariPegawaiGaji(q).then((res) => setItems(res)).catch(() => setItems([])).finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    function onDown(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  if (selected) {
    return (
      <div className="agt__pegawai-sel">
        <div>
          <div className="agt__pegawai-nama">{selected.nama}</div>
          <div className="agt__pegawai-sub">{selected.nik}{selected.jabatan ? ` · ${selected.jabatan}` : ''}</div>
        </div>
        <button type="button" className="agt__ibtn" onClick={() => onSelect(null)}><X size={16} /></button>
      </div>
    )
  }

  return (
    <div className="agt__pegawai-search" ref={boxRef}>
      <div className="agt__input-wrap">
        <Search size={15} />
        <input
          type="text" placeholder="Cari nama atau NIK…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {loading && <Loader2 size={15} className="agt__spin" />}
      </div>
      {open && items.length > 0 && (
        <div className="agt__pegawai-list">
          {items.map((p) => (
            <button
              type="button" key={p.nik} className="agt__pegawai-item"
              onClick={() => { onSelect(p); setOpen(false); setQ('') }}
            >
              <span className="agt__pegawai-nama">{p.nama}</span>
              <span className="agt__pegawai-sub">{p.nik}{p.jabatan ? ` · ${p.jabatan}` : ''}{p.unit ? ` · ${p.unit}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Menghitung Potongan Presensi otomatis dari Absensi + Surat Ijin yang sudah disetujui
// (acuan Nota Dinas 0188/08/ND Potongan Absen 2018). HANYA preview - hasilnya cuma
// mengisi field nominal POT_PRESENSI di form; admin tetap harus koreksi bila perlu &
// menekan tombol Simpan utama sebelum tersimpan.
function PresensiCalculator({ pegawai, tahun, bulan, komponen, nominal, setNominal, onHasil }) {
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  async function hitung() {
    setLoading(true); setError(null)
    try {
      const r = await api.hitungPotonganPresensi(pegawai.nik, tahun, bulan)
      setHasil(r)
      setOpen(true)
      onHasil(komponen.idKomponen, r.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghitung potongan presensi.')
    } finally { setLoading(false) }
  }

  return (
    <div className="agt__presensi">
      <div className="agt__presensi-head">
        <div>
          <span className="agt__presensi-nama">{komponen.nama}</span>
          <span className="agt__presensi-note">Dihitung dari Absensi + Surat Ijin disetujui bulan ini (acuan Nota Dinas Potongan Absen). Boleh dikoreksi manual di kolom nominal.</span>
        </div>
        <button type="button" className="agt__save agt__save--sm" onClick={hitung} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <Wand2 size={14} />}
          Hitung dari Absensi
        </button>
      </div>

      <Field it={komponen} nominal={nominal} setNominal={setNominal} />

      {error && <div className="agt__msg agt__msg--err">{error}</div>}

      {hasil && (
        <div className="agt__presensi-hasil">
          <button type="button" className="agt__subgrup-head" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="agt__subgrup-label">{hasil.kejadian.length} kejadian terdeteksi</span>
            <span className="agt__subgrup-count">TP {hasil.persenTpTotal}% · TA {hasil.persenTaTotal}%</span>
            <span className="agt__subgrup-total">{rupiah(hasil.total)}</span>
          </button>
          {open && (
            <div className="agt__subgrup-body">
              {hasil.kejadian.length === 0 ? (
                <p className="agt__pd-note">Tidak ada pelanggaran presensi terdeteksi periode ini.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="agt__presensi-table">
                    <thead>
                      <tr><th>Tanggal</th><th>Jenis</th><th>Ijin</th><th>Jam Hilang</th><th>TP</th><th>TA</th></tr>
                    </thead>
                    <tbody>
                      {hasil.kejadian.map((k, i) => (
                        <tr key={i}>
                          <td>{k.tanggal}</td>
                          <td>{k.jenis}</td>
                          <td>{k.adaIjin ? 'Ya' : 'Tidak'}</td>
                          <td>{k.jamHilang != null ? `${Number(k.jamHilang).toFixed(1)} jam` : '—'}</td>
                          <td>{k.persenTp}%</td>
                          <td>{k.persenTa}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="agt__pd-note">
                Nominal dihitung dari Tunjangan Pangan/Angkutan Band pegawai — hasil sudah mengisi field nominal di atas, boleh dikoreksi manual sebelum Simpan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Menghitung Lembur Biasa/Pengganti otomatis dari SPL yang sudah disetujui (rumus
// bertingkat Jam I-IV, sama untuk keduanya - lihat GajiService.HitungLemburBertingkatAsync).
// HANYA preview - mengisi field nominal komponen (tetap tampil di dalam dropdown "Lembur"
// seperti biasa, di grid bawah) - admin tetap boleh koreksi & wajib menekan tombol Simpan utama.
function LemburBertingkatCalculator({ pegawai, tahun, bulan, komponen, hitungFn, jenisSpl, onHasil }) {
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  async function hitung() {
    setLoading(true); setError(null)
    try {
      const r = await hitungFn(pegawai.nik, tahun, bulan)
      setHasil(r)
      setOpen(true)
      if (!r.peringatan) onHasil(komponen.idKomponen, r.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Gagal menghitung ${komponen.nama}.`)
    } finally { setLoading(false) }
  }

  return (
    <div className="agt__presensi">
      <div className="agt__presensi-head">
        <div>
          <span className="agt__presensi-nama">{komponen.nama}</span>
          <span className="agt__presensi-note">Dihitung dari SPL "{jenisSpl}" yang sudah disetujui periode berjalan (siklus 16 s/d 15). Hasil mengisi field "{komponen.nama}" di daftar Lembur bawah - boleh dikoreksi manual.</span>
        </div>
        <button type="button" className="agt__save agt__save--sm" onClick={hitung} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <Wand2 size={14} />}
          Hitung dari SPL
        </button>
      </div>

      {error && <div className="agt__msg agt__msg--err">{error}</div>}

      {hasil && hasil.peringatan && <div className="agt__msg agt__msg--err">{hasil.peringatan}</div>}

      {hasil && !hasil.peringatan && (
        <div className="agt__presensi-hasil">
          <button type="button" className="agt__subgrup-head" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="agt__subgrup-label">{hasil.kejadian.length} SPL disetujui</span>
            <span className="agt__subgrup-count">
              Tarif {rupiah(hasil.tarif)}/jam · {hasil.totalJamDibayar} jam{hasil.dibatasi45Jam ? ' (dibatasi 45 jam)' : ''}
            </span>
            <span className="agt__subgrup-total">{rupiah(hasil.total)}</span>
          </button>
          {open && (
            <div className="agt__subgrup-body">
              {hasil.kejadian.length === 0 ? (
                <p className="agt__pd-note">Tidak ada SPL "{jenisSpl}" disetujui pada periode ini.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="agt__presensi-table">
                    <thead>
                      <tr><th>Tanggal</th><th>Tipe Hari</th><th>Jam</th><th>I</th><th>II</th><th>III</th><th>IV</th><th>Nominal</th></tr>
                    </thead>
                    <tbody>
                      {hasil.kejadian.map((k, i) => (
                        <tr key={i}>
                          <td>{k.tanggal}{k.terpotong45Jam ? ' *' : ''}</td>
                          <td>{k.tipeHari}</td>
                          <td>{k.jamMulai}–{k.jamSelesai}</td>
                          <td>{k.jamI || ''}</td>
                          <td>{k.jamII || ''}</td>
                          <td>{k.jamIII || ''}</td>
                          <td>{k.jamIV || ''}</td>
                          <td>{rupiah(k.nominal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {hasil.dibatasi45Jam && (
                <p className="agt__pd-note">* Jam ditandai dipotong karena total lembur periode ini sudah mencapai batas 45 jam.</p>
              )}
              <p className="agt__pd-note">
                Tarif = Gaji Pokok Band {hasil.band} ÷ 173. Hasil sudah mengisi field "{komponen.nama}" di daftar Lembur bawah, boleh dikoreksi manual sebelum Simpan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Menghitung Lembur Crash Program otomatis dari SPL "Crash Program" disetujui (khusus
// Band I-IV). "Jam mati" - TANPA pengali tarif, TANPA batas 45 jam (beda dari Lembur
// Biasa). Preview saja - mengisi field LEMBUR_CRASH di dalam dropdown "Lembur" bawah.
function LemburCrashCalculator({ pegawai, tahun, bulan, komponen, onHasil }) {
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  async function hitung() {
    setLoading(true); setError(null)
    try {
      const r = await api.hitungLemburCrash(pegawai.nik, tahun, bulan)
      setHasil(r)
      setOpen(true)
      if (!r.peringatan) onHasil(komponen.idKomponen, r.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghitung Lembur Crash Program.')
    } finally { setLoading(false) }
  }

  return (
    <div className="agt__presensi">
      <div className="agt__presensi-head">
        <div>
          <span className="agt__presensi-nama">{komponen.nama}</span>
          <span className="agt__presensi-note">Dihitung dari SPL "Crash Program" yang sudah disetujui periode berjalan (siklus 16 s/d 15). Hasil mengisi field "{komponen.nama}" di daftar Lembur bawah - boleh dikoreksi manual.</span>
        </div>
        <button type="button" className="agt__save agt__save--sm" onClick={hitung} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <Wand2 size={14} />}
          Hitung dari SPL
        </button>
      </div>

      {error && <div className="agt__msg agt__msg--err">{error}</div>}

      {hasil && hasil.peringatan && <div className="agt__msg agt__msg--err">{hasil.peringatan}</div>}

      {hasil && !hasil.peringatan && (
        <div className="agt__presensi-hasil">
          <button type="button" className="agt__subgrup-head" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="agt__subgrup-label">{hasil.kejadian.length} SPL disetujui</span>
            <span className="agt__subgrup-count">Tarif {rupiah(hasil.tarif)}/jam · {hasil.totalJam} jam</span>
            <span className="agt__subgrup-total">{rupiah(hasil.total)}</span>
          </button>
          {open && (
            <div className="agt__subgrup-body">
              {hasil.kejadian.length === 0 ? (
                <p className="agt__pd-note">Tidak ada SPL "Crash Program" disetujui pada periode ini.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="agt__presensi-table">
                    <thead>
                      <tr><th>Tanggal</th><th>Jam</th><th>Durasi</th><th>Nominal</th></tr>
                    </thead>
                    <tbody>
                      {hasil.kejadian.map((k, i) => (
                        <tr key={i}>
                          <td>{k.tanggal}</td>
                          <td>{k.jamMulai}–{k.jamSelesai}</td>
                          <td>{k.jam} jam</td>
                          <td>{rupiah(k.nominal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="agt__pd-note">
                Tarif = Gaji Pokok Band {hasil.band} ÷ 173, tanpa pengali jam (jam mati). Hasil sudah mengisi field "{komponen.nama}" di daftar Lembur bawah, boleh dikoreksi manual sebelum Simpan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Menghitung Uang Makan Dinas (UMDL) otomatis dari pengajuan UMDL yang sudah disetujui:
// <75km = Rp40rb flat, 75-150km = 20% dari tarif SPPD Band pegawai. Preview saja - mengisi
// field MAKAN_DINAS (standalone, dikeluarkan dari grid biasa spt POT_PRESENSI).
function UmdlFormulaCalculator({ pegawai, tahun, bulan, komponen, nominal, setNominal, onHasil }) {
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  async function hitung() {
    setLoading(true); setError(null)
    try {
      const r = await api.hitungUmdlFormula(pegawai.nik, tahun, bulan)
      setHasil(r)
      setOpen(true)
      if (!r.peringatan) onHasil(komponen.idKomponen, r.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghitung Uang Makan Dinas.')
    } finally { setLoading(false) }
  }

  return (
    <div className="agt__presensi">
      <div className="agt__presensi-head">
        <div>
          <span className="agt__presensi-nama">{komponen.nama}</span>
          <span className="agt__presensi-note">Dihitung dari pengajuan UMDL yang sudah disetujui periode berjalan (siklus 16 s/d 15): {'<'}75km = Rp40rb, 75-150km = 20% tarif SPPD Band. Boleh dikoreksi manual di kolom nominal.</span>
        </div>
        <button type="button" className="agt__save agt__save--sm" onClick={hitung} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <Wand2 size={14} />}
          Hitung dari UMDL
        </button>
      </div>

      <Field it={komponen} nominal={nominal} setNominal={setNominal} />

      {error && <div className="agt__msg agt__msg--err">{error}</div>}
      {hasil && hasil.peringatan && <div className="agt__msg agt__msg--err">{hasil.peringatan}</div>}

      {hasil && !hasil.peringatan && (
        <div className="agt__presensi-hasil">
          <button type="button" className="agt__subgrup-head" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="agt__subgrup-label">{hasil.kejadian.length} UMDL disetujui</span>
            <span className="agt__subgrup-count">Tarif SPPD Band {hasil.band}: {rupiah(hasil.tarifSppdBand)}</span>
            <span className="agt__subgrup-total">{rupiah(hasil.total)}</span>
          </button>
          {open && (
            <div className="agt__subgrup-body">
              {hasil.kejadian.length === 0 ? (
                <p className="agt__pd-note">Tidak ada UMDL disetujui pada periode ini.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="agt__presensi-table">
                    <thead>
                      <tr><th>Tanggal</th><th>Rentang Km</th><th>Nominal</th><th>Catatan</th></tr>
                    </thead>
                    <tbody>
                      {hasil.kejadian.map((k, i) => (
                        <tr key={i}>
                          <td>{k.tanggal}</td>
                          <td>{k.rentangKm ? `${k.rentangKm} km` : '-'}</td>
                          <td>{rupiah(k.nominal)}</td>
                          <td>{k.peringatan ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="agt__pd-note">
                Hasil sudah mengisi field "{komponen.nama}" di atas, boleh dikoreksi manual sebelum Simpan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Menghitung SPPD otomatis dari pengajuan SPPD yang sudah disetujui: tarif per Band x
// jumlah SPPD dalam periode. Preview saja - mengisi field TJ_SPPD (standalone).
function SppdFormulaCalculator({ pegawai, tahun, bulan, komponen, nominal, setNominal, onHasil }) {
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  async function hitung() {
    setLoading(true); setError(null)
    try {
      const r = await api.hitungSppdFormula(pegawai.nik, tahun, bulan)
      setHasil(r)
      setOpen(true)
      if (!r.peringatan) onHasil(komponen.idKomponen, r.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghitung SPPD.')
    } finally { setLoading(false) }
  }

  return (
    <div className="agt__presensi">
      <div className="agt__presensi-head">
        <div>
          <span className="agt__presensi-nama">{komponen.nama}</span>
          <span className="agt__presensi-note">Dihitung dari pengajuan SPPD yang sudah disetujui periode berjalan (siklus 16 s/d 15): tarif per Band × jumlah SPPD. Boleh dikoreksi manual di kolom nominal.</span>
        </div>
        <button type="button" className="agt__save agt__save--sm" onClick={hitung} disabled={loading}>
          {loading ? <Loader2 size={14} className="agt__spin" /> : <Wand2 size={14} />}
          Hitung dari SPPD
        </button>
      </div>

      <Field it={komponen} nominal={nominal} setNominal={setNominal} />

      {error && <div className="agt__msg agt__msg--err">{error}</div>}
      {hasil && hasil.peringatan && <div className="agt__msg agt__msg--err">{hasil.peringatan}</div>}

      {hasil && !hasil.peringatan && (
        <div className="agt__presensi-hasil">
          <button type="button" className="agt__subgrup-head" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="agt__subgrup-label">{hasil.kejadian.length} SPPD disetujui</span>
            <span className="agt__subgrup-count">Tarif Band {hasil.band}: {rupiah(hasil.tarif)}</span>
            <span className="agt__subgrup-total">{rupiah(hasil.total)}</span>
          </button>
          {open && (
            <div className="agt__subgrup-body">
              {hasil.kejadian.length === 0 ? (
                <p className="agt__pd-note">Tidak ada SPPD disetujui pada periode ini.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="agt__presensi-table">
                    <thead>
                      <tr><th>Tanggal Berangkat</th><th>Tujuan</th><th>Nominal</th></tr>
                    </thead>
                    <tbody>
                      {hasil.kejadian.map((k, i) => (
                        <tr key={i}>
                          <td>{k.tanggal}</td>
                          <td>{k.tujuan ?? '-'}</td>
                          <td>{rupiah(k.nominal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="agt__pd-note">
                Hasil sudah mengisi field "{komponen.nama}" di atas, boleh dikoreksi manual sebelum Simpan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PayrollManualPage() {
  const { isAdminModulSdm, summary } = useAuth()
  const now = new Date()
  const [pegawai, setPegawai] = useState(null)
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const [data, setData] = useState(null)
  const [nominal, setNominal] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    if (!pegawai) { setData(null); return }
    setLoading(true); setMsg(null)
    try {
      const d = await api.getGajiManual(pegawai.nik, tahun, bulan)
      setData(d)
      const map = {}
      d.komponen.forEach((k) => { map[k.idKomponen] = k.nominal ? String(k.nominal) : '' })
      setNominal(map)
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal memuat data.' })
    } finally { setLoading(false) }
  }, [pegawai, tahun, bulan])

  useEffect(() => { load() }, [load])

  const presensiKomponen = useMemo(
    () => data?.komponen.find((k) => k.kode === 'POT_PRESENSI') ?? null,
    [data],
  )
  const lemburBiasaKomponen = useMemo(
    () => data?.komponen.find((k) => k.kode === 'LEMBUR_BIASA') ?? null,
    [data],
  )
  const lemburCrashKomponen = useMemo(
    () => data?.komponen.find((k) => k.kode === 'LEMBUR_CRASH') ?? null,
    [data],
  )
  const lemburPenggantiKomponen = useMemo(
    () => data?.komponen.find((k) => k.kode === 'LEMBUR_PENGGANTI') ?? null,
    [data],
  )
  const umdlKomponen = useMemo(
    () => data?.komponen.find((k) => k.kode === 'MAKAN_DINAS') ?? null,
    [data],
  )
  const sppdKomponen = useMemo(
    () => data?.komponen.find((k) => k.kode === 'TJ_SPPD') ?? null,
    [data],
  )

  const grup = useMemo(() => {
    if (!data) return []
    const byKat = {}
    for (const it of data.komponen) {
      if (KODE_KALKULATOR_SENDIRI.includes(it.kode)) continue
      ;(byKat[it.kategori] ??= []).push(it)
    }
    return Object.entries(byKat)
  }, [data])

  async function save() {
    if (!data || !pegawai) return
    setSaving(true); setMsg(null)
    try {
      await api.simpanGajiManual({
        nik: pegawai.nik, tahun, bulan,
        items: data.komponen.map((k) => ({ idKomponen: k.idKomponen, nominal: Number(nominal[k.idKomponen] || 0) })),
      })
      setMsg({ type: 'ok', text: `Nominal ${pegawai.nama} (${BULAN[bulan - 1]} ${tahun}) tersimpan.` })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Gagal menyimpan.' })
    } finally { setSaving(false) }
  }

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
        <h2 className="agt__title"><UserCog size={20} /> Manual per Karyawan</h2>
        <p className="agt__sub">Komponen yang nominalnya berbeda-beda tiap orang (mis. K3PG, PIKGCS, KSPPS, BMT, RIT, Angsuran) — diinput manual per pegawai, per periode.</p>
      </div>

      <div className="agt__manual-bar">
        <PegawaiSearch selected={pegawai} onSelect={setPegawai} />
        <label>Bulan
          <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))}>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
          </select>
        </label>
        <label>Tahun
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
            {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {msg && <div className={`agt__msg agt__msg--${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      {pegawai && lemburBiasaKomponen && (
        <LemburBertingkatCalculator
          pegawai={pegawai} tahun={tahun} bulan={bulan} komponen={lemburBiasaKomponen}
          hitungFn={api.hitungLemburBiasa} jenisSpl="Biasa"
          onHasil={(idKomponen, total) => setNominal((m) => ({ ...m, [idKomponen]: String(total) }))}
        />
      )}

      {pegawai && lemburPenggantiKomponen && (
        <LemburBertingkatCalculator
          pegawai={pegawai} tahun={tahun} bulan={bulan} komponen={lemburPenggantiKomponen}
          hitungFn={api.hitungLemburPengganti} jenisSpl="Mengganti"
          onHasil={(idKomponen, total) => setNominal((m) => ({ ...m, [idKomponen]: String(total) }))}
        />
      )}

      {pegawai && lemburCrashKomponen && (
        <LemburCrashCalculator
          pegawai={pegawai} tahun={tahun} bulan={bulan} komponen={lemburCrashKomponen}
          onHasil={(idKomponen, total) => setNominal((m) => ({ ...m, [idKomponen]: String(total) }))}
        />
      )}

      {pegawai && presensiKomponen && (
        <PresensiCalculator
          pegawai={pegawai} tahun={tahun} bulan={bulan} komponen={presensiKomponen}
          nominal={nominal} setNominal={setNominal}
          onHasil={(idKomponen, total) => setNominal((m) => ({ ...m, [idKomponen]: String(total) }))}
        />
      )}

      {pegawai && umdlKomponen && (
        <UmdlFormulaCalculator
          pegawai={pegawai} tahun={tahun} bulan={bulan} komponen={umdlKomponen}
          nominal={nominal} setNominal={setNominal}
          onHasil={(idKomponen, total) => setNominal((m) => ({ ...m, [idKomponen]: String(total) }))}
        />
      )}

      {pegawai && sppdKomponen && (
        <SppdFormulaCalculator
          pegawai={pegawai} tahun={tahun} bulan={bulan} komponen={sppdKomponen}
          nominal={nominal} setNominal={setNominal}
          onHasil={(idKomponen, total) => setNominal((m) => ({ ...m, [idKomponen]: String(total) }))}
        />
      )}

      {!pegawai ? (
        <div className="agt__empty">Pilih pegawai terlebih dahulu.</div>
      ) : loading ? (
        <div className="agt__loading"><Loader2 className="agt__spin" size={20} /> Memuat…</div>
      ) : !data || data.komponen.length === 0 ? (
        <div className="agt__empty">Tidak ada komponen manual per karyawan.</div>
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
            <button type="button" className="agt__save" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="agt__spin" /> : <Save size={16} />}
              Simpan Nominal {pegawai.nama} ({BULAN[bulan - 1]} {tahun})
            </button>
          </div>
        </>
      )}
    </div>
  )
}
