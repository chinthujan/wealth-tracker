export async function ensurePermission() {
  if (!('Notification' in window)) throw new Error('Notifications not supported in this browser.')
  if (Notification.permission === 'granted') return true
  if (Notification.permission !== 'denied') {
    const p = await Notification.requestPermission()
    return p === 'granted'
  }
  return false
}
export function notify({ title, body }) {
  try {
    new Notification(title, { body })
  } catch {}
}
