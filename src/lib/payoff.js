import { clamp } from './utils'

function cloneDebts(debts) {
  return debts.map(d => ({
    id: d.id, name: d.name,
    principal: Math.max(0, (d.amount ?? 0) - (d.paid ?? 0)),
    apr: Number(d.apr || 0),
    min: Number(d.minPayment || 0)
  })).filter(d => d.principal > 0)
}

function sortByStrategy(debts, strategy) {
  const arr = [...debts]
  if (strategy === 'snowball') arr.sort((a,b) => a.principal - b.principal)
  else if (strategy === 'avalanche') arr.sort((a,b) => b.apr - a.apr)
  return arr
}

/** Simulate monthly payoff
 * @param {Array} debts - with {principal, apr, min}
 * @param {number} monthlyBudget
 * @param {'snowball'|'avalanche'} strategy
 */
export function simulate(debts, monthlyBudget, strategy='snowball') {
  let items = cloneDebts(debts)
  const totalMin = items.reduce((a,d)=>a+(d.min||0),0)
  if (monthlyBudget < totalMin) {
    return { ok:false, error:`Monthly budget (${monthlyBudget}) is below total minimums (${totalMin}). Increase budget or adjust mins.` }
  }
  let month = 0
  let totalInterest = 0
  const snapshots = []

  // safety
  if (items.length === 0) return { ok:true, months:0, totalInterest:0, snapshots:[], order:[], payoffDate: new Date() }

  const order = sortByStrategy(items, strategy).map(d=>d.id)

  const maxMonths = 1200 // 100 years
  while (items.some(d => d.principal > 0.01) && month < maxMonths) {
    month++
    // Interest
    items.forEach(d => {
      const mRate = (d.apr/100)/12
      const interest = d.principal * mRate
      d.principal += interest
      totalInterest += interest
    })

    // Payments
    let budget = monthlyBudget
    // First cover mins
    for (const d of items) {
      const pay = Math.min(d.min, d.principal, budget)
      d.principal -= pay
      budget -= pay
    }
    // Then extra using strategy
    const sorted = sortByStrategy(items.filter(d=>d.principal>0.01), strategy)
    for (const d of sorted) {
      if (budget <= 0) break
      const pay = Math.min(d.principal, budget)
      d.principal -= pay
      budget -= pay
    }

    const totalBalance = items.reduce((a,d)=>a+d.principal,0)
    snapshots.push({ month, totalBalance })
    // Remove paid-off debts from consideration (but keep for snapshots)
    items = items.map(d => ({ ...d, principal: Math.max(0, d.principal) }))
  }

  const payoffMonths = month
  const payoffDate = new Date(); payoffDate.setMonth(payoffDate.getMonth() + payoffMonths)
  return { ok:true, months:payoffMonths, totalInterest:Number(totalInterest.toFixed(2)), snapshots, order, payoffDate }
}

export function compareStrategies(debts, monthlyBudget) {
  const snow = simulate(debts, monthlyBudget, 'snowball')
  const aval = simulate(debts, monthlyBudget, 'avalanche')
  return { snow, aval }
}
