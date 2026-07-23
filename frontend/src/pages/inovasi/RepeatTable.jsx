import { Plus, Trash2 } from 'lucide-react'

// Tabel baris berulang yang bisa diedit (dipakai untuk P.2, P.4, P.7, D.1, D.2,
// C.1-C.4, A.1-A.2). `columns` = daftar { key, label, type, options, width,
// render }. type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'custom'.
// Untuk 'custom', pakai `render(row, idx, patch)`.
export default function RepeatTable({
  columns,
  rows,
  setRows,
  readOnly = false,
  numbered = true,
  addLabel = 'Tambah Baris',
  makeEmpty,
  minRows = 0,
  maxRows = null,
}) {
  const atMax = maxRows != null && rows.length >= maxRows
  function patch(idx, key, value) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
  }
  function addRow() {
    setRows([...rows, makeEmpty ? makeEmpty() : {}])
  }
  function delRow(idx) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="inv__subtable">
          <thead>
            <tr>
              {numbered && <th className="inv__rownum">No</th>}
              {columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
              ))}
              {!readOnly && <th className="inv__rowdel"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (numbered ? 1 : 0) + (readOnly ? 0 : 1)} className="inv__no-data" style={{ padding: 14 }}>
                  Belum ada baris.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx}>
                {numbered && <td className="inv__rownum">{idx + 1}</td>}
                {columns.map((c) => (
                  <td key={c.key} style={c.width ? { width: c.width } : undefined}>
                    <Cell col={c} row={row} idx={idx} patch={patch} readOnly={readOnly} />
                  </td>
                ))}
                {!readOnly && (
                  <td className="inv__rowdel">
                    <button
                      type="button"
                      className="inv__icon-btn inv__icon-btn--danger"
                      title="Hapus baris"
                      onClick={() => delRow(idx)}
                      disabled={rows.length <= minRows}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        atMax
          ? <p className="inv__hint" style={{ marginTop: 8 }}>Batas maksimum {maxRows} baris tercapai.</p>
          : (
            <button type="button" className="inv__btn inv__btn--soft inv__addrow" onClick={addRow}>
              <Plus size={15} /> {addLabel}
            </button>
          )
      )}
    </div>
  )
}

function Cell({ col, row, idx, patch, readOnly }) {
  const value = row[col.key] ?? ''
  if (col.type === 'custom') return col.render(row, idx, (k, v) => patch(idx, k, v), readOnly)

  if (readOnly) {
    if (col.type === 'select') return <span>{value || '-'}</span>
    return <span style={{ whiteSpace: 'pre-wrap' }}>{value === '' ? '-' : String(value)}</span>
  }

  if (col.type === 'textarea') {
    return <textarea rows={col.rows ?? 2} value={value} onChange={(e) => patch(idx, col.key, e.target.value)} placeholder={col.placeholder} />
  }
  if (col.type === 'select') {
    return (
      <select value={value} onChange={(e) => patch(idx, col.key, e.target.value)}>
        <option value="">-</option>
        {(col.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    )
  }
  return (
    <input
      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
      value={value}
      min={col.min}
      max={col.max}
      onChange={(e) => patch(idx, col.key, e.target.value)}
      placeholder={col.placeholder}
    />
  )
}
