const KEY = 'wealth-tracker:data:v1'

export function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}
export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {}
}
export function exportAsBlob() {
  const data = localStorage.getItem(KEY) || '{}'
  return new Blob([data], { type: 'application/json' })
}
export function importFromText(text) {
  try {
    const obj = JSON.parse(text)
    localStorage.setItem(KEY, JSON.stringify(obj))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'Invalid JSON' }
  }
}
