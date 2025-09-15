export const getCurrencyCode = () => {
  try {
    const raw = localStorage.getItem('wealth-tracker:data:v1')
    if (!raw) return 'USD'
    const obj = JSON.parse(raw)
    return obj?.settings?.currency || 'USD'
  } catch { return 'USD' }
}
export const currency = (n, code) => new Intl.NumberFormat(undefined, { style: 'currency', currency: code || getCurrencyCode() }).format(n ?? 0)
export const pct = (v) => `${Math.round(v * 100)}%`
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
export const todayISO = () => new Date().toISOString().slice(0,10)
export const parseNum = (s) => {
  const n = Number(s)
  return isNaN(n) ? 0 : Number(n.toFixed(2))
}
