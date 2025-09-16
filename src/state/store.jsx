import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

/* ========================================================================== */
/* Utilities                                                                  */
/* ========================================================================== */

const LS_KEY = 'wealth-tracker:v3'

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const clampNum = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0)
const toISO = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10)

/** Add one period to a date according to freq. */
function addPeriod(dateStr, freq) {
  const d = new Date(dateStr)
  if (freq === 'weekly') d.setDate(d.getDate() + 7)
  else if (freq === 'biweekly') d.setDate(d.getDate() + 14)
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setMonth(d.getMonth() + 1) // default monthly
  return toISO(d)
}

/* ========================================================================== */
/* Initial Data                                                               */
/* ========================================================================== */

const initialData = {
  // Debts: { id, name, amount, apr?, targetDate?, paid, payments[], recurring? }
  debts: [],

  // Savings: { id, name, target?, balance, history[], recurring? }
  savings: [],

  // Investments: { id, symbol, units, price, dpsAnnual?, dividendYield?, payoutFreq?, ccy? }
  investments: [],

  // DRIP goals
  dividendGoals: [],

  // Other assets: { id, name, type?, value }
  assets: [],

  // UX / settings
  settings: {
    theme: 'system',
    notifications: false,
    marketData: { provider: 'AlphaVantage', apiKey: '', host: '' },
    lastPriceSyncAt: null,
  },

  // Fun things
  achievements: [],

  // NW history for charting: [{date:'YYYY-MM-DD', value:number}]
  netWorthHistory: [],
}

/* ========================================================================== */
/* Totals (Savings added into Assets)                                         */
/* ========================================================================== */

function computeTotals(data) {
  const debts = Array.isArray(data.debts) ? data.debts : []
  const assetsArr = Array.isArray(data.assets) ? data.assets : []
  const savingsArr = Array.isArray(data.savings) ? data.savings : []
  const holdings = Array.isArray(data.investments) ? data.investments : []

  // Liabilities = remaining principal on debts
  const liabilities = debts.reduce(
    (a, d) => a + Math.max(0, clampNum(d.amount) - clampNum(d.paid)),
    0
  )

  // Assets from Assets tab
  const assetsFromAssetsTab = assetsArr.reduce((a, it) => a + clampNum(it.value), 0)

  // ✅ Savings balances are counted as Assets
  const assetsFromSavings = savingsArr.reduce(
    (a, s) => a + clampNum(s.balance ?? s.amount ?? 0),
    0
  )

  // Market value of investments
  const investmentValue = holdings.reduce(
    (a, h) => a + clampNum(h.units) * clampNum(h.price),
    0
  )

  // Final Assets (excl. investments by design)
  const assets = assetsFromAssetsTab + assetsFromSavings

  const netWorth = assets + investmentValue - liabilities

  // Monthly passive income (sum across currencies; used as a headline)
  const monthlyDiv = holdings.reduce(
    (a, h) => a + (clampNum(h.units) * clampNum(h.dpsAnnual || 0)) / 12,
    0
  )

  return {
    assets,
    liabilities,
    investmentValue,
    netWorth,
    savings: assetsFromSavings,
    monthlyDiv,
  }
}

/* ========================================================================== */
/* Persistence                                                                */
/* ========================================================================== */

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return initialData
    const parsed = JSON.parse(raw)
    // backward-compatible defaults
    return { ...initialData, ...parsed }
  } catch {
    return initialData
  }
}

function saveToLS(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota errors */
  }
}

/* ========================================================================== */
/* Context + Provider                                                         */
/* ========================================================================== */

const StoreCtx = createContext(null)

export function Provider({ children }) {
  const [data, setDataState] = useState(() => loadFromLS())

  // Keep a stable setter that accepts object OR (prev)=>object
  const setData = (updater) =>
    setDataState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return next
    })

  // Persist
  useEffect(() => {
    saveToLS(data)
  }, [data])

  // Totals memo
  const totals = useMemo(() => computeTotals(data), [data])

  // Snapshot net worth daily (used by Net Worth chart)
  useEffect(() => {
    const today = toISO(new Date())
    const last = data.netWorthHistory?.[data.netWorthHistory.length - 1]
    if (!last || last.date !== today || last.value !== totals.netWorth) {
      setData((prev) => ({
        ...prev,
        netWorthHistory: [...(prev.netWorthHistory || []), { date: today, value: totals.netWorth }].slice(-365),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.netWorth])

  /* ---------------------------------------------------------------------- */
  /* Debts                                                                  */
  /* ---------------------------------------------------------------------- */

  const addDebt = ({ name, amount, apr, targetDate, recurring = null }) => {
    if (!name || clampNum(amount) <= 0) return
    const debt = {
      id: uid(),
      name: name.trim(),
      amount: clampNum(amount),
      apr: clampNum(apr) || undefined,
      targetDate: targetDate || undefined,
      paid: 0,
      payments: [],
      recurring:
        recurring && recurring.enabled
          ? {
              amount: clampNum(recurring.amount || 0),
              freq: recurring.freq || 'monthly',
              startDate: recurring.startDate || toISO(new Date()),
              enabled: true,
              lastApplied: null,
            }
          : null,
    }
    setData((prev) => ({ ...prev, debts: [...prev.debts, debt] }))
  }

  const deleteDebt = (id) =>
    setData((prev) => ({ ...prev, debts: prev.debts.filter((d) => d.id !== id) }))

  const reorderDebts = (fromIndex, toIndex) =>
    setData((prev) => {
      const list = prev.debts.slice()
      const [m] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, m)
      return { ...prev, debts: list }
    })

  const addDebtPayment = (id, amount, note = '') =>
    setData((prev) => {
      const list = prev.debts.slice()
      const i = list.findIndex((d) => d.id === id)
      if (i === -1) return prev
      const d = { ...list[i] }
      const amt = clampNum(amount)
      d.paid = clampNum(d.paid) + Math.min(amt, Math.max(0, clampNum(d.amount) - clampNum(d.paid)))
      d.payments = Array.isArray(d.payments) ? d.payments.slice() : []
      d.payments.push({ id: uid(), amount: amt, note: note || '', date: new Date().toISOString() })
      list[i] = d
      return { ...prev, debts: list }
    })

  /* ---------------------------------------------------------------------- */
  /* Savings                                                                 */
  /* ---------------------------------------------------------------------- */

  const addSavings = ({ name, target, balance = 0, recurring = null }) => {
    if (!name) return
    const item = {
      id: uid(),
      name: name.trim(),
      target: clampNum(target) || undefined,
      balance: clampNum(balance),
      history: [],
      recurring:
        recurring && recurring.enabled
          ? {
              amount: clampNum(recurring.amount || 0),
              freq: recurring.freq || 'monthly',
              startDate: recurring.startDate || toISO(new Date()),
              enabled: true,
              lastApplied: null,
            }
          : null,
    }
    setData((prev) => ({ ...prev, savings: [...prev.savings, item] }))
  }

  const deleteSavings = (id) =>
    setData((prev) => ({ ...prev, savings: prev.savings.filter((s) => s.id !== id) }))

  const reorderSavings = (fromIndex, toIndex) =>
    setData((prev) => {
      const list = prev.savings.slice()
      const [m] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, m)
      return { ...prev, savings: list }
    })

  /** Used by Savings page and by recurrence application. */
  const addSavingsContribution = (id, amount, note = '') =>
    setData((prev) => {
      const list = prev.savings.slice()
      const i = list.findIndex((s) => s.id === id)
      if (i === -1) return prev
      const g = { ...list[i] }
      const amt = clampNum(amount)
      g.balance = clampNum(g.balance) + amt
      g.history = Array.isArray(g.history) ? g.history.slice() : []
      g.history.push({ id: uid(), amount: amt, note: note || '', date: new Date().toISOString() })
      list[i] = g
      return { ...prev, savings: list }
    })

  /* ---------------------------------------------------------------------- */
  /* Assets                                                                  */
  /* ---------------------------------------------------------------------- */

  const addAsset = ({ name, value, type }) => {
    if (!name || clampNum(value) <= 0) return
    const item = { id: uid(), name: name.trim(), value: clampNum(value), type: type || undefined }
    setData((prev) => ({ ...prev, assets: [...prev.assets, item] }))
  }

  const deleteAsset = (id) =>
    setData((prev) => ({ ...prev, assets: prev.assets.filter((a) => a.id !== id) }))

  const reorderAssets = (fromIndex, toIndex) =>
    setData((prev) => {
      const list = prev.assets.slice()
      const [m] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, m)
      return { ...prev, assets: list }
    })

  /* ---------------------------------------------------------------------- */
  /* Recurrences                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Apply missed recurring savings contributions and debt payments up to "today".
   * We store "lastApplied" on each recurring object to avoid double-posting.
   */
  const applyRecurrences = () =>
    setData((prev) => {
      const today = toISO(new Date())
      const nextState = { ...prev }

      // Savings
      nextState.savings = (prev.savings || []).map((s) => {
        if (!s.recurring || !s.recurring.enabled) return s
        const r = { ...s.recurring }
        if (!r.amount || r.amount <= 0) return s
        let nextDate = r.lastApplied ? addPeriod(r.lastApplied, r.freq) : r.startDate
        let changed = false
        let copy = { ...s, history: Array.isArray(s.history) ? s.history.slice() : [], balance: clampNum(s.balance) }
        while (toISO(nextDate) <= today) {
          // apply one contribution
          const amt = clampNum(r.amount)
          copy.balance += amt
          copy.history.push({ id: uid(), amount: amt, note: 'Recurring', date: new Date(nextDate).toISOString() })
          r.lastApplied = toISO(nextDate)
          nextDate = addPeriod(nextDate, r.freq)
          changed = true
        }
        return changed ? { ...copy, recurring: r } : s
      })

      // Debts
      nextState.debts = (prev.debts || []).map((d) => {
        if (!d.recurring || !d.recurring.enabled) return d
        const r = { ...d.recurring }
        if (!r.amount || r.amount <= 0) return d
        let nextDate = r.lastApplied ? addPeriod(r.lastApplied, r.freq) : r.startDate
        let changed = false
        let copy = { ...d, payments: Array.isArray(d.payments) ? d.payments.slice() : [], paid: clampNum(d.paid) }
        while (toISO(nextDate) <= today) {
          // apply one payment, capped by remaining balance
          const remaining = Math.max(0, clampNum(copy.amount) - clampNum(copy.paid))
          if (remaining <= 0) break
          const amt = Math.min(remaining, clampNum(r.amount))
          copy.paid += amt
          copy.payments.push({ id: uid(), amount: amt, note: 'Recurring', date: new Date(nextDate).toISOString() })
          r.lastApplied = toISO(nextDate)
          nextDate = addPeriod(nextDate, r.freq)
          changed = true
        }
        return changed ? { ...copy, recurring: r } : d
      })

      return nextState
    })

  /* ---------------------------------------------------------------------- */
  /* Import / Export / Reset                                                 */
  /* ---------------------------------------------------------------------- */

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wealth-tracker-backup-${toISO(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (json) => {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json
      setData({ ...initialData, ...parsed })
    } catch (e) {
      alert('Import failed: invalid file.')
    }
  }

  const resetLocal = () => {
    localStorage.removeItem(LS_KEY)
    setData({ ...initialData })
  }

  /* ---------------------------------------------------------------------- */
  /* Public API                                                              */
  /* ---------------------------------------------------------------------- */

  const api = {
    data,
    totals,

    // global setter (object or updater)
    setData,

    // Debts
    addDebt,
    deleteDebt,
    reorderDebts,
    addDebtPayment,

    // Savings
    addSavings,
    deleteSavings,
    reorderSavings,
    addSavingsContribution,

    // Assets
    addAsset,
    deleteAsset,
    reorderAssets,

    // Recurrence
    applyRecurrences,

    // Backup
    exportData,
    importData,
    resetLocal,
  }

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within <Provider>')
  return ctx
}
