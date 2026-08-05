import { ChevronLeft, ChevronRight } from 'lucide-react'
import { halamanAman, UKURAN_HALAMAN } from './tablePaging'

// Penomoran halaman tabel bergaya DOF ("Baris per Halaman: 10 · 1-10 dari 120").
// Dipakai tabel Inbox / Inbox CC Otomatis dan tab Riwayat pada detail surat.
// Pemotongan datanya dikerjakan pemanggil lewat potongHalaman() di tablePaging.js;
// komponen ini hanya menggambar kendalinya.
export default function TablePager({ total, halaman, perHalaman, onHalaman, onPerHalaman }) {
  if (total === 0) return null

  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman))
  const kini = halamanAman(total, halaman, perHalaman)
  const mulai = (kini - 1) * perHalaman

  return (
    <div className="mo-pager">
      <label className="mo-pager__size">
        Baris per Halaman:
        <select className="mo-select" value={perHalaman} onChange={(e) => onPerHalaman(Number(e.target.value))}>
          {UKURAN_HALAMAN.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className="mo-pager__range">
        {mulai + 1}-{Math.min(mulai + perHalaman, total)} dari {total}
      </span>
      <div className="mo-pager__nav">
        <button
          type="button"
          className="mo-icon-btn"
          onClick={() => onHalaman(Math.max(1, kini - 1))}
          disabled={kini <= 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          className="mo-icon-btn"
          onClick={() => onHalaman(Math.min(totalHalaman, kini + 1))}
          disabled={kini >= totalHalaman}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
