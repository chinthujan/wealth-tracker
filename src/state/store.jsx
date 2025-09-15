import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { uid, parseNum, todayISO } from '../lib/utils'
import { load, save } from '../lib/storage'

const Store = createContext(null)

const defaultData = {
  settings: { currency: 'USD', theme: 'system', marketData: { provider: 'AlphaVantage', apiKey: '', host: '' } },
  lastCheck: null,
  debts: [], // {id, name, amount, apr, minPayment, targetDate, createdAt, paid, payments:[{id,date,amount,note}]}
  savings: [], // {id,name,target,current,apy,targetDate,createdAt,contributions:[{id,date,amount,note}]}
  investments: [], // {id,name,symbol,account,units,price,cost,totalCost,createdAt}
  assets: [], // custom assets {id,name,value,category}
  history: [], // {date, netWorth, assets, liabilities}
  achievements: [] // {id, date, type, text}
}

export function Provider({ children }) {
  const [data, setData] = useState(() => load() || defaultData)

  useEffect(() => { save(data) }, [data])

  // derived
  const totals = useMemo(() => {
    const debtPrincipal = data.debts.reduce((a,d) => a + d.amount, 0)
    const debtPaid = data.debts.reduce((a,d) => a + (d.paid ?? 0), 0)
    const debtRemaining = Math.max(0, debtPrincipal - debtPaid)

    const savingsTotal = data.savings.reduce((a,s) => a + (s.current ?? 0), 0)
    const investmentValue = data.investments.reduce((a,i) => a + (i.units * (i.price ?? 0)), 0)
    const customAssets = data.assets.reduce((a,as) => a + (as.value ?? 0), 0)

    const assets = savingsTotal + investmentValue + customAssets
    const liabilities = debtRemaining
    const netWorth = assets - liabilities
    return { debtPrincipal, debtPaid, debtRemaining, savingsTotal, investmentValue, customAssets, assets, liabilities, netWorth }
  }, [data])

  // history snapshot once per day when totals change
  useEffect(() => {
    const today = todayISO()
    const existing = data.history.find(h => h.date === today)
    const snap = { date: today, netWorth: totals.netWorth, assets: totals.assets, liabilities: totals.liabilities }
    if (!existing) {
      setData(prev => ({ ...prev, history: [...prev.history, snap] }))
    } else if (existing.assets !== totals.assets || existing.liabilities !== totals.liabilities) {
      setData(prev => ({ ...prev, history: prev.history.map(h => h.date === today ? snap : h) }))
    }
  }, [totals.assets, totals.liabilities])

  const api = {
  // Recurrence processing
  useRecurrences: true,
  async applyRecurrences() {
    const today = todayISO()
    const last = data.lastCheck || today
    const from = new Date(last)
    const to = new Date(today)
    /* dynamic import below */
    // debts
    let changed = false
    data.debts.forEach(d => {
      const r = d.recurring
      if (!r || !r.enabled || !r.amount || !r.freq || !r.startDate) return
      const dues = allDueBetween(r.startDate, r.freq, from, to)
      if (dues.length) {
        changed = true
        // add payments
        dues.forEach(_ => {
          const amt = parseNum(r.amount)
          d.paid = Math.min(d.amount, parseNum((d.paid ?? 0) + amt))
          d.payments = [...(d.payments||[]), { id: uid(), date: new Date().toISOString(), amount: amt, note: '[Auto] Recurring' }]
        })
      }
    })
    // savings
    data.savings.forEach(g => {
      const r = g.recurring
      if (!r || !r.enabled || !r.amount || !r.freq || !r.startDate) return
      const dues = allDueBetween(r.startDate, r.freq, from, to)
      if (dues.length) {
        changed = true
        dues.forEach(_ => {
          const amt = parseNum(r.amount)
          g.current = parseNum((g.current ?? 0) + amt)
          g.contributions = [...(g.contributions||[]), { id: uid(), date: new Date().toISOString(), amount: amt, note: '[Auto] Recurring' }]
        })
      }
    })
    if (changed || data.lastCheck !== today) {
      setData(prev => ({ ...data, lastCheck: today }))
    }
  },

  // Price fetching
  async fetchPrices() {
    const provider = data.settings.marketData?.provider
    const apiKey = data.settings.marketData?.apiKey
    const host = data.settings.marketData?.host
    if (!provider || !apiKey) throw new Error('Set provider and API key in Settings first.')
    const { fetchPrice } = await import('../lib/quotes.js')
    const results = []
    for (const h of data.investments) {
      if (!h.symbol) continue
      try {
        const { price } = await fetchPrice(h.symbol, provider, apiKey, host)
        if (price && !isNaN(price)) {
          results.push({ symbol: h.symbol, price })
          setData(s => ({ ...s, investments: s.investments.map(x => x.id===h.id? { ...x, price } : x) }))
          await new Promise(r => setTimeout(r, 1200)) // avoid rate limits
        }
      } catch (e) {
        results.push({ symbol: h.symbol, error: e.message })
      }
    }
    return results
  },

    data, setData, totals,
    // Settings
    setCurrency(code) { setData(d => ({ ...d, settings: { ...d.settings, currency: code }})) },
    // Debts
    addDebt(input) {
      const d = { id: uid(), name: input.name.trim(), amount: parseNum(input.amount), apr: parseNum(input.apr||0), minPayment: parseNum(input.minPayment||0), targetDate: input.targetDate||'', createdAt: new Date().toISOString(), paid: 0, payments: [], recurring: input.recurring || null }
      setData(s => ({ ...s, debts: [d, ...s.debts] }))
    },
    deleteDebt(id) { setData(s => ({ ...s, debts: s.debts.filter(d => d.id !== id) })) },
    reorderDebts(from, to) {
      setData(s => {
        const arr = [...s.debts]
        const [it] = arr.splice(from,1)
        arr.splice(to,0,it)
        return { ...s, debts: arr }
      })
    },
    addDebtPayment(id, amount, note='') {
      setData(s => ({
        ...s,
        debts: s.debts.map(d => {
          if (d.id !== id) return d
          const amt = parseNum(amount)
          const paid = Math.min(d.amount, parseNum((d.paid ?? 0) + amt))
          const payments = [...(d.payments||[]), { id: uid(), date: new Date().toISOString(), amount: amt, note }]
          const finished = paid >= d.amount && d.amount > 0 && (d.paid ?? 0) < d.amount
          const out = { ...d, paid, payments }
          if (finished) {
            const ach = { id: uid(), date: new Date().toISOString(), type: 'debt', text: `Paid off “${d.name}”!` }
            setData(s2 => ({ ...s2, achievements: [...(s2.achievements||[]), ach] }))
          }
          return out
        })
      }))
    },
    editDebt(id, fields) {
      setData(s => ({ ...s, debts: s.debts.map(d => d.id === id ? { ...d, ...fields } : d) }))
    },
    // Savings
    addGoal(input) {
      const g = { id: uid(), name: input.name.trim(), target: parseNum(input.target), current: parseNum(input.current||0), apy: parseNum(input.apy||0), targetDate: input.targetDate||'', createdAt: new Date().toISOString(), contributions: [], recurring: input.recurring || null }
      setData(s => ({ ...s, savings: [g, ...s.savings] }))
    },
    contribute(goalId, amount, note='') {
      setData(s => ({
        ...s,
        savings: s.savings.map(g => {
          if (g.id !== goalId) return g
          const amt = parseNum(amount)
          const current = parseNum((g.current ?? 0) + amt)
          const contributions = [...(g.contributions||[]), { id: uid(), date: new Date().toISOString(), amount: amt, note }]
          const finished = current >= g.target && g.target > 0 && (g.current ?? 0) < g.target
          const out = { ...g, current, contributions }
          if (finished) {
            const ach = { id: uid(), date: new Date().toISOString(), type: 'savings', text: `Reached goal “${g.name}”!` }
            setData(s2 => ({ ...s2, achievements: [...(s2.achievements||[]), ach] }))
          }
          return out
        })
      }))
    },
    editGoal(id, fields) { setData(s => ({ ...s, savings: s.savings.map(g => g.id === id ? { ...g, ...fields } : g) })) },
    deleteGoal(id) { setData(s => ({ ...s, savings: s.savings.filter(g => g.id !== id) })) },
    reorderGoals(from, to) {
      setData(s => {
        const arr = [...s.savings]
        const [it] = arr.splice(from,1)
        arr.splice(to,0,it)
        return { ...s, savings: arr }
      })
    },
    // Investments
    addHolding(input) {
      const h = { id: uid(), name: input.name.trim() || input.symbol?.toUpperCase(), symbol: (input.symbol||'').toUpperCase(), account: input.account||'', units: parseNum(input.units||0), price: parseNum(input.price||0), totalCost: parseNum(input.totalCost||0), createdAt: new Date().toISOString() }
      setData(s => ({ ...s, investments: [h, ...s.investments] }))
    },
    editHolding(id, fields) { setData(s => ({ ...s, investments: s.investments.map(h => h.id === id ? { ...h, ...fields } : h) })) },
    deleteHolding(id) { setData(s => ({ ...s, investments: s.investments.filter(h => h.id !== id) })) },
    reorderHoldings(from, to) {
      setData(s => {
        const arr = [...s.investments]
        const [it] = arr.splice(from,1)
        arr.splice(to,0,it)
        return { ...s, investments: arr }
      })
    },
    // Assets
    addAsset(input) {
      const a = { id: uid(), name: input.name.trim(), value: parseNum(input.value||0), category: input.category||'Other', createdAt: new Date().toISOString() }
      setData(s => ({ ...s, assets: [a, ...s.assets] }))
    },
    editAsset(id, fields) { setData(s => ({ ...s, assets: s.assets.map(a => a.id === id ? { ...a, ...fields } : a) })) },
    deleteAsset(id) { setData(s => ({ ...s, assets: s.assets.filter(a => a.id !== id) })) },
    reorderAssets(from, to) {
      setData(s => { const arr = [...s.assets]; const [it] = arr.splice(from,1); arr.splice(to,0,it); return { ...s, assets: arr } })
    },
    // Import/Export
    replaceAll(obj) { setData(obj) },
    resetAll() { setData(defaultData) },
    addSampleData() {
      const demo = {
        settings: { currency: 'USD', theme: 'system', marketData: { provider: 'AlphaVantage', apiKey: '', host: '' } },
        lastCheck: null,
        debts: [
          { id: uid(), name: 'Visa Card', amount: 2500, apr: 19.99, minPayment: 75, targetDate:'', createdAt:new Date().toISOString(), paid: 400, payments:[] },
          { id: uid(), name: 'Car Loan', amount: 12000, apr: 5.2, minPayment: 260, targetDate:'', createdAt:new Date().toISOString(), paid: 1800, payments:[] },
          { id: uid(), name: 'Student Loan', amount: 18000, apr: 4.5, minPayment: 150, targetDate:'', createdAt:new Date().toISOString(), paid: 2000, payments:[] },
        ],
        savings: [
          { id: uid(), name: 'Emergency Fund', target: 10000, current: 3500, apy: 4.5, targetDate:'', createdAt:new Date().toISOString(), contributions:[] },
          { id: uid(), name: 'Vacation 2026', target: 5000, current: 800, apy: 0, targetDate:'', createdAt:new Date().toISOString(), contributions:[] },
        ],
        investments: [
          { id: uid(), name: 'S&P 500 ETF', symbol: 'VOO', account:'TFSA', units: 12, price: 450, totalCost: 5200, createdAt:new Date().toISOString() },
          { id: uid(), name: 'Apple', symbol: 'AAPL', account:'Brokerage', units: 20, price: 190, totalCost: 3200, createdAt:new Date().toISOString() },
        ],
        assets: [],
        history: [],
        achievements: []
      }
      setData(demo)
    }
  }

  return <Store.Provider value={api}>{children}</Store.Provider>
}

export const useStore = () => useContext(Store)
