import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import { Target, Plus, Trash2, Info } from 'lucide-react'

/* --------- provider helpers (dividends + currency + price) --------- */
function deepPick(obj, keys) {
  for (const k of keys) {
    const parts = k.split('.'); let cur = obj
    for (const p of parts) { if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]; else { cur = undefined; break } }
    if (typeof cur === 'number' && isFinite(cur)) return Number(cur)
    if (typeof cur === 'string' && cur) return cur
  }
  return undefined
}
async function fetchOverview_AV(symbol, apiKey) {
  const u = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const r = await fetch(u); const j = await r.json()
  return {
    dpsAnnual: isFinite(Number(j?.DividendPerShare)) ? Number(j.DividendPerShare) : undefined,
    currency: (j?.Currency || '').toUpperCase() || undefined,
  }
}
async function fetchPrice_AV(symbol, apiKey) {
  const u = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const r = await fetch(u); const j = await r.json()
  const raw = j?.['Global Quote']?.['05. price']; const px = raw != null ? Number(raw) : NaN
  return isFinite(px) ? px : undefined
}
async function fetchMetric_FH(symbol, apiKey) {
  const u = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`
  const r = await fetch(u); const j = await r.json()
  return { dpsAnnual: deepPick(j, ['metric.dividendPerShareAnnual', 'metric.dividendPerShareTTM']) }
}
async function fetchPrice_FH(symbol, apiKey) {
  const u = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
  const r = await fetch(u); const j = await r.json()
  const px = Number(j?.c); return isFinite(px) ? px : undefined
}
async function fetchProfile_FH(symbol, apiKey) {
  const u = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
  const r = await fetch(u); const j = await r.json()
  return { currency: (j?.currency || '').toUpperCase() || undefined }
}
async function fetchSummary_YR(symbol, apiKey, host) {
  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }
  try {
    const u = `https://${host}/stock/v2/get-summary?symbol=${encodeURIComponent(symbol)}&region=US`
    const r = await fetch(u, { headers }); if (r.ok) {
      const j = await r.json()
      return {
        dpsAnnual: deepPick(j, ['summaryDetail.dividendRate.raw', 'defaultKeyStatistics.lastDividendValue.raw']),
        price: deepPick(j, ['price.regularMarketPrice.raw', 'financialData.currentPrice.raw', 'price.preMarketPrice.raw']),
        currency: (deepPick(j, ['price.currency', 'financialData.financialCurrency']) || '').toUpperCase() || undefined,
      }
    }
  } catch {}
  try {
    const u2 = `https://${host}/api/yahoo/qu/quote/${encodeURIComponent(symbol)}`
    const r2 = await fetch(u2, { headers }); if (r2.ok) {
      const j2 = await r2.json()
      return {
        dpsAnnual: deepPick(j2, ['summaryDetail.dividendRate.raw', 'dividendRate']),
        price: deepPick(j2, ['price.regularMarketPrice.raw', 'regularMarketPrice']),
        currency: (deepPick(j2, ['price.currency']) || '').toUpperCase() || undefined,
      }
    }
  } catch {}
  return {}
}

/* --------- math (whole shares) --------- */
const PERIODS = [
  { key: 'month', label: 'Per Month', gy: 12 },
  { key: 'quarter', label: 'Per Quarter', gy: 4 },
  { key: 'year', label: 'Per Year', gy: 1 },
]
const gy = (period) => (PERIODS.find(p => p.key === period)?.gy ?? 12)
const monthlyIncome = (shares, dpsAnnual) => (Number(shares) * Number(dpsAnnual || 0)) / 12

function requiredSharesWhole({ goalType, targetValue, goalPeriod, price, dpsAnnual }) {
  const P = Math.max(0, Number(price || 0))
  const dps = Math.max(0, Number(dpsAnnual || 0))
  const Gy = gy(goalPeriod)
  if (!Number.isFinite(targetValue) || targetValue <= 0) return 0
  if (goalType === 'shares') {
    if (P <= 0 || dps <= 0 || Gy <= 0) return 0
    const raw = (targetValue * P * Gy) / dps
    return Math.ceil(raw || 0)
  } else {
    if (dps <= 0 || Gy <= 0) return 0
    const raw = (targetValue * Gy) / dps
    return Math.ceil(raw || 0)
  }
}

/* --------- presentation row --------- */
function GoalRow({ g, onDelete, holdings }) {
  const currentShares = (holdings || [])
    .filter(h => (h.symbol || '').toUpperCase() === (g.symbol || '').toUpperCase())
    .reduce((a, h) => a + Number(h.units || 0), 0)

  const live = (holdings || []).find(h => (h.symbol || '').toUpperCase() === (g.symbol || '').toUpperCase())
  const price = Number(live?.price || 0)
  const ccy = live?.ccy || 'USD'

  const reqWhole = requiredSharesWhole({
    goalType: g.goalType,
    targetValue: g.targetValue,
    goalPeriod: g.goalPeriod,
    price,
    dpsAnnual: g.dpsAnnual,
  })
  const sharesToAdd = Math.max(0, reqWhole - currentShares)
  const dollarsNeeded = sharesToAdd * price

  const monthlyTarget = g.goalType === 'shares'
    ? (g.targetValue * price * (gy(g.goalPeriod) / 12))
    : (g.targetValue * (gy(g.goalPeriod) / 12))

  const currentMonthlyDiv = monthlyIncome(currentShares, g.dpsAnnual)
  const progress = monthlyTarget > 0 ? Math.min(1, currentMonthlyDiv / monthlyTarget) : 0

  return (
    <div className="rounded-xl border dark:border-white/10 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" />
          <div className="font-semibold">{g.symbol}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Goal: <span className="font-medium">{g.goalType === 'shares' ? `${g.targetValue} / ${g.goalPeriod}` : `$${g.targetValue} / ${g.goalPeriod}`}</span>
          </div>
        </div>
        <button className="btn hover:text-red-600" onClick={() => onDelete(g.id)} title="Remove">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Current shares</div>
          <div className="font-medium">{currentShares.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Price</div>
          <div className="font-medium">{price > 0 ? `${currency(price)} ${ccy}` : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Dividend / share (annual)</div>
          <div className="font-medium">{currency(g.dpsAnnual)}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Shares required</div>
          <div className="font-medium">{reqWhole.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Shares to add</div>
          <div className="font-medium">{sharesToAdd.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Capital needed</div>
          <div className="font-medium">{price > 0 ? `${currency(dollarsNeeded)} ${ccy}` : '—'}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Progress</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="mt-1 h-3 w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
        <div className="h-full bg-brand-600" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className="mt-2 text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">Current monthly dividend: </span>
        <span className="font-medium">{currency(currentMonthlyDiv)} {ccy}</span>
      </div>

      <div className="text-xs text-neutral-600 dark:text-neutral-300 flex items-center gap-2">
        <Info className="w-3 h-3" /> Monthly target converts your goal period → monthly equivalent.
      </div>
    </div>
  )
}

/* --------- main planner (equal spacing + fixed $ + aligned label) --------- */
export default function DividendPlanner() {
  const { data, setData } = useStore()
  const holdings = data?.investments || []
  const goals = data?.dividendGoals || []

  const provider = data?.settings?.marketData?.provider || 'AlphaVantage'
  const apiKey   = data?.settings?.marketData?.apiKey || ''
  const host     = data?.settings?.marketData?.host || ''

  const [symbol, setSymbol] = useState('')
  const [goalType, setGoalType] = useState('shares')
  const [targetValue, setTargetValue] = useState('1')
  const [goalPeriod, setGoalPeriod] = useState('month')
  const [dpsAnnual, setDpsAnnual] = useState('')

  // local ref data
  const [refPrice, setRefPrice] = useState(undefined)
  const [refCcy, setRefCcy] = useState('USD')

  const v_symbol = symbol.trim().toUpperCase()
  const v_target = parseNum(targetValue)
  const v_dps = parseNum(dpsAnnual)

  // Autofill when symbol changes
  useEffect(() => {
    if (!v_symbol) return
    const h = holdings.find(h => (h.symbol || '').toUpperCase() === v_symbol)
    if (h) {
      if (h.dpsAnnual) setDpsAnnual(String(h.dpsAnnual))
      if (h.price) setRefPrice(h.price)
      setRefCcy(h.ccy || 'USD')
      return
    }
    ;(async () => {
      try {
        if (provider === 'AlphaVantage') {
          if (!apiKey) return
          const [ov, px] = await Promise.allSettled([fetchOverview_AV(v_symbol, apiKey), fetchPrice_AV(v_symbol, apiKey)])
          if (ov.status === 'fulfilled') {
            if (ov.value?.dpsAnnual) setDpsAnnual(String(ov.value.dpsAnnual))
            if (ov.value?.currency) setRefCcy(ov.value.currency)
          }
          if (px.status === 'fulfilled' && px.value) setRefPrice(px.value)
        } else if (provider === 'Finnhub') {
          if (!apiKey) return
          const [mt, pr, pf] = await Promise.allSettled([fetchMetric_FH(v_symbol, apiKey), fetchPrice_FH(v_symbol, apiKey), fetchProfile_FH(v_symbol, apiKey)])
          if (mt.status === 'fulfilled' && mt.value?.dpsAnnual) setDpsAnnual(String(mt.value.dpsAnnual))
          if (pr.status === 'fulfilled' && pr.value) setRefPrice(pr.value)
          if (pf.status === 'fulfilled' && pf.value?.currency) setRefCcy(pf.value.currency)
        } else {
          if (!apiKey || !host) return
          const sm = await fetchSummary_YR(v_symbol, apiKey, host)
          if (sm?.dpsAnnual) setDpsAnnual(String(sm.dpsAnnual))
          if (sm?.price) setRefPrice(sm.price)
          if (sm?.currency) setRefCcy(sm.currency)
        }
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v_symbol, holdings, provider, apiKey, host])

  const canSubmit = Boolean(v_symbol && v_target > 0 && v_dps > 0)

  const addGoal = (e) => {
    e?.preventDefault?.()
    if (!canSubmit) return
    const newGoal = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      symbol: v_symbol,
      goalType,
      targetValue: v_target,
      goalPeriod,
      dpsAnnual: v_dps,
      createdAt: new Date().toISOString()
    }
    setData(prev => ({ ...prev, dividendGoals: [...(prev.dividendGoals || []), newGoal] }))
    setTargetValue(goalType === 'shares' ? '1' : '')
  }

  const removeGoal = (id) =>
    setData(prev => ({ ...prev, dividendGoals: (prev.dividendGoals || []).filter(g => g.id !== id) }))

  const sortedGoals = useMemo(() => {
    return (goals || []).slice().sort((a, b) => {
      const currA = holdings.filter(h => (h.symbol || '').toUpperCase() === (a.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
      const currB = holdings.filter(h => (h.symbol || '').toUpperCase() === (b.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
      return currA - currB
    })
  }, [goals, holdings])

  return (
    <section className="space-y-4">
      <div className="card">
        <h3 className="font-semibold">Dividend DRIP Planner</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Aim: “Buy <b>1 share</b> <i>per month</i> using dividends alone.” We auto-fill DPS & price when possible.
        </p>
      </div>

      {/* FORM — equal spacing; smaller Symbol; fixed $ overlay; aligned label */}
      <form onSubmit={addGoal} className="card grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        {/* Symbol (smaller) */}
        <div className="lg:col-span-2">
          <label className="label">Symbol</label>
          <input
            className="input w-full"
            value={symbol}
            onChange={(e)=>setSymbol(e.target.value.toUpperCase())}
            placeholder="KO"
            list="dripSymbols"
          />
          <datalist id="dripSymbols">
            {Array.from(new Set((holdings||[]).map(h => (h.symbol||'').toUpperCase()).filter(Boolean))).map(s => <option key={s} value={s} />)}
          </datalist>
          {refPrice ? (
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
              Ref price: <span className="font-medium">{currency(refPrice)} {refCcy}</span>
            </div>
          ) : null}
        </div>

        {/* Goal (wider) */}
        <div className="lg:col-span-6">
          <label className="label">Goal</label>
          <div className="grid grid-cols-3 gap-2">
            <select className="input w-full" value={goalType} onChange={e => setGoalType(e.target.value)}>
              <option value="shares">Shares</option>
              <option value="income">Income ($)</option>
            </select>
            <input className="input w-full" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder={goalType === 'shares' ? '1' : '100'} />
            <select className="input w-full min-w-[130px]" value={goalPeriod} onChange={e => setGoalPeriod(e.target.value)}>
              {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Dividend / share (annual) */}
        <div className="lg:col-span-4">
          <label className="label">Dividend / share (annual)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
            <input className="input w-full pl-6" value={dpsAnnual} onChange={e => setDpsAnnual(e.target.value)} />
          </div>
        </div>

        {/* Button row — right aligned / same size as Add Holding */}
        <div className="lg:col-span-12 flex justify-end">
          <button type="submit" className="btn btn-primary h-10 px-4" disabled={!canSubmit}>
            <Plus className="w-4 h-4 mr-1" /> Add Goal
          </button>
        </div>
      </form>

      {/* Goals */}
      {sortedGoals.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {sortedGoals.map(g => (<GoalRow key={g.id} g={g} holdings={holdings} onDelete={removeGoal} />))}
        </div>
      ) : (
        <div className="card text-sm text-neutral-600 dark:text-neutral-300">
          No DRIP goals yet. Example: <b>KO</b> → Goal “Shares 1” → “Per Month”.
        </div>
      )}
    </section>
  )
}
