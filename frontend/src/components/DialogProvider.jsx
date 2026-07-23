import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Dialog UI global (konfirmasi / input / info) pengganti window.confirm,
// window.prompt, dan window.alert bawaan browser. Dipakai lewat hook useDialog():
//   const dialog = useDialog()
//   if (await dialog.confirm({ message, danger })) { ... }
//   const teks = await dialog.prompt({ label, defaultValue })  // null bila dibatalkan
//   await dialog.alert({ message })
//
// Semua mengembalikan Promise sehingga alur pemanggil tetap linear.

const DialogContext = createContext(null)

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog harus dipakai di dalam <DialogProvider>')
  return ctx
}

export function DialogProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const open = useCallback((cfg) => new Promise((resolve) => {
    resolver.current = resolve
    setState(cfg)
  }), [])

  const settle = useCallback((value) => {
    if (resolver.current) { resolver.current(value); resolver.current = null }
    setState(null)
  }, [])

  const confirm = useCallback((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {})
    return open({
      type: 'confirm', title: o.title ?? 'Konfirmasi', message: o.message ?? '',
      confirmText: o.confirmText ?? 'Ya', cancelText: o.cancelText ?? 'Batal', danger: o.danger === true,
    })
  }, [open])

  const prompt = useCallback((opts) => {
    const o = typeof opts === 'string' ? { label: opts } : (opts || {})
    return open({
      type: 'prompt', title: o.title ?? 'Masukan', label: o.label ?? '', defaultValue: o.defaultValue ?? '',
      placeholder: o.placeholder ?? '', multiline: o.multiline === true, required: o.required === true,
      confirmText: o.confirmText ?? 'OK', cancelText: o.cancelText ?? 'Batal',
    })
  }, [open])

  const alert = useCallback((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {})
    return open({ type: 'alert', title: o.title ?? 'Informasi', message: o.message ?? '', confirmText: o.confirmText ?? 'OK' })
  }, [open])

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      {state && <DialogModal key={state.title + state.type} cfg={state} onSettle={settle} />}
    </DialogContext.Provider>
  )
}

function DialogModal({ cfg, onSettle }) {
  const [value, setValue] = useState(cfg.type === 'prompt' ? cfg.defaultValue : '')
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (inputRef.current) { inputRef.current.focus(); inputRef.current.select?.() }
    }, 30)
    const onKey = (e) => {
      if (e.key === 'Escape') cancel()
      else if (e.key === 'Enter' && cfg.type !== 'prompt') submit()
      else if (e.key === 'Enter' && cfg.type === 'prompt' && !cfg.multiline) submit()
    }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cancel() {
    onSettle(cfg.type === 'prompt' ? null : cfg.type === 'confirm' ? false : true)
  }
  function submit() {
    if (cfg.type === 'prompt') {
      if (cfg.required && !value.trim()) { inputRef.current?.focus(); return }
      onSettle(value)
    } else {
      onSettle(true)
    }
  }

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(20,30,22,0.5)', display: 'grid',
    placeItems: 'center', zIndex: 1000, padding: 16,
  }
  const card = {
    background: '#fff', color: '#1a1f1b', borderRadius: 14, width: 'min(440px, 94vw)',
    padding: '20px 22px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', fontFamily: 'inherit',
  }
  const primaryBg = cfg.danger ? '#c0392b' : '#1f6b39'
  const btn = (bg, color, border) => ({
    padding: '9px 16px', borderRadius: 9, border: border ?? 'none', background: bg, color,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  })

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) cancel() }}>
      <div style={card} role="dialog" aria-modal="true">
        <h3 style={{ margin: '0 0 10px', fontSize: 17 }}>{cfg.title}</h3>

        {cfg.type === 'prompt' ? (
          <label style={{ display: 'block' }}>
            {cfg.label && <div style={{ fontSize: 13.5, marginBottom: 6, color: '#3a463c' }}>{cfg.label}</div>}
            {cfg.multiline ? (
              <textarea
                ref={inputRef} rows={4} value={value} placeholder={cfg.placeholder}
                onChange={(e) => setValue(e.target.value)}
                style={{ width: '100%', border: '1px solid #c8d2c9', borderRadius: 8, padding: 9, fontFamily: 'inherit', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            ) : (
              <input
                ref={inputRef} value={value} placeholder={cfg.placeholder}
                onChange={(e) => setValue(e.target.value)}
                style={{ width: '100%', border: '1px solid #c8d2c9', borderRadius: 8, padding: '9px 10px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
              />
            )}
          </label>
        ) : (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#3a463c', whiteSpace: 'pre-wrap' }}>{cfg.message}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          {cfg.type !== 'alert' && (
            <button type="button" style={btn('#eef1ee', '#3a463c', '1px solid #d5ddd6')} onClick={cancel}>{cfg.cancelText}</button>
          )}
          <button ref={cfg.type === 'confirm' || cfg.type === 'alert' ? inputRef : null} type="button" style={btn(primaryBg, '#fff')} onClick={submit}>{cfg.confirmText}</button>
        </div>
      </div>
    </div>
  )
}
