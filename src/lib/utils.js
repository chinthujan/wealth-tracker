// utils.js — shared helpers

// (Kept for compatibility; not used by currency() anymore)
export const getCurrencyCode = () => {
  try {
    const raw = localStorage.getItem('wealth-tracker:data:v1')
    if (!raw) return 'USD'
    const obj = JSON.parse(raw)
    return obj?.settings?.currency || 'USD'
  } catch {
    return 'USD'
  }
}

// Always display with a plain $ (no CA$, no code). Handles negatives cleanly as -$1,234.56
export const currency = (n, _codeIgnored) => {
  const v = Number(n ?? 0)
  const abs = Math.abs(v)
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return (v < 0 ? '-$' : '$') + formatted
}

export const pct = (v) => {
  const n = Number(v || 0)
  return `${Math.round(n * 100)}%`
}

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36)

export const todayISO = () => new Date().toISOString().slice(0, 10)

// Robust number parsing: accepts strings like "1,234.56", rounds to 2 decimals
export const parseNum = (s) => {
  if (typeof s === 'number') return Number(s.toFixed(2))
  if (typeof s !== 'string') return 0
  const cleaned = s.replace(/[, ]+/g, '')
  const n = Number(cleaned)
  return isNaN(n) ? 0 : Number(n.toFixed(2))
}
