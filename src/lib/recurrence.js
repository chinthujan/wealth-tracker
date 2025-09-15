// Simple recurrence helpers
export function addDays(date, days) {
  const d = new Date(date); d.setDate(d.getDate()+days); return d
}
export function addMonths(date, months) {
  const d = new Date(date); const day = d.getDate(); d.setMonth(d.getMonth()+months)
  // keep same day-of-month if possible
  if (d.getDate() < day) d.setDate(0)
  return d
}
export function toISODate(d) { return new Date(d).toISOString().slice(0,10) }
export function nextDueFrom(startDate, freq, fromDate=new Date()) {
  if (!startDate || !freq) return null
  let next = new Date(startDate); const from = new Date(fromDate)
  while (next < from) {
    if (freq==='weekly') next = addDays(next, 7)
    else if (freq==='biweekly') next = addDays(next, 14)
    else if (freq==='monthly') next = addMonths(next, 1)
    else break
  }
  return next
}
export function allDueBetween(startDate, freq, fromDate, toDate) {
  const res = []
  if (!startDate || !freq) return res
  let next = nextDueFrom(startDate, freq, fromDate)
  const end = new Date(toDate)
  while (next && next <= end) {
    res.push(new Date(next))
    if (freq==='weekly') next = addDays(next, 7)
    else if (freq==='biweekly') next = addDays(next, 14)
    else if (freq==='monthly') next = addMonths(next, 1)
    else break
  }
  return res
}
