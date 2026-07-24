import {
  CheckCircle2,
  ClipboardCheck,
  CheckSquare,
  FileText,
  FilePlus2,
  Files,
  Building2,
  UsersRound,
  Search,
  UploadCloud,
  PencilLine,
} from 'lucide-react'
import './office.css'

// Kartu statistik persuratan (mengikuti dashboard DOF). Data akan terisi setelah
// modul persuratan aktif — untuk saat ini menampilkan 0 sebagai placeholder.
const STATS = [
  { key: 'total', label: 'Total Surat', value: 0, icon: FileText, tone: 'green' },
  { key: 'draft', label: 'Draft', value: 0, icon: PencilLine, tone: 'muted' },
  { key: 'review', label: 'Menunggu Review', value: 0, icon: ClipboardCheck, tone: 'gold' },
  { key: 'approval', label: 'Menunggu Approval', value: 0, icon: CheckSquare, tone: 'gold' },
  { key: 'disetujui', label: 'Disetujui', value: 0, icon: CheckCircle2, tone: 'ok' },
  { key: 'upload', label: 'Belum Upload', value: 0, icon: UploadCloud, tone: 'muted' },
]

// Peta jalan fitur — mengikuti fungsi DOF (persuratan Petrokimia Gresik).
const ROADMAP = [
  { icon: FilePlus2, title: 'Buat Surat', desc: 'Penciptaan surat (draft → reviewer → approver), termasuk SP/ASP.' },
  { icon: Files, title: 'Daftar Surat', desc: 'Pantau status: draft, menunggu, disetujui, revisi, upload, batal.' },
  { icon: ClipboardCheck, title: 'Review & Approval', desc: 'Alur persetujuan berjenjang oleh reviewer dan approver.' },
  { icon: Building2, title: 'Master Perusahaan', desc: 'Data perusahaan tujuan distribusi surat.' },
  { icon: UsersRound, title: 'Master Group', desc: 'Pengelompokan pegawai untuk distribusi surat.' },
  { icon: Search, title: 'Rekap & Pencarian', desc: 'Rekapitulasi dan pencarian arsip surat.' },
]

export default function MyOfficeBeranda() {
  return (
    <div className="mo">
      <div className="mo__intro">
        <h2 className="mo__intro-title">Beranda My Office</h2>
        <p className="mo__intro-sub">Persuratan digital PT Gresik Cipta Sejahtera — penciptaan, distribusi, dan pengarsipan naskah dinas.</p>
      </div>

      <div className="mo__banner">
        Modul dalam tahap penyiapan. Statistik akan aktif setelah fitur persuratan dijalankan.
      </div>

      <div className="mo__stats">
        {STATS.map((s) => (
          <div className={`mo-stat mo-stat--${s.tone}`} key={s.key}>
            <div className="mo-stat__icon"><s.icon size={20} /></div>
            <div>
              <div className="mo-stat__value">{s.value}</div>
              <div className="mo-stat__label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mo-card">
        <div className="mo-card__head"><Files size={16} /> Peta Jalan Fitur</div>
        <div className="mo-roadmap">
          {ROADMAP.map((r) => (
            <div className="mo-roadmap__item" key={r.title}>
              <div className="mo-roadmap__icon"><r.icon size={18} /></div>
              <div>
                <div className="mo-roadmap__title">{r.title} <span className="mo-badge">Segera hadir</span></div>
                <div className="mo-roadmap__desc">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
