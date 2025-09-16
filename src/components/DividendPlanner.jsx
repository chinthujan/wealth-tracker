import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import { Target, DollarSign, Plus, Trash2, Info } from 'lucide-react'

/* ---------- math helpers ---------- */
const PERIODS = [
  { key: 'month', label: 'Per Month', gy: 12 },
  { key: 'quarter', label: 'Per Quarter', gy: 4 },
  { key: 'year', label: 'Per Year', gy: 1 },
]
const gy = (period) => (PERIODS.find(p => p.key === period)?.gy ?? 12)

const effectivePrice = (price) => Math.max(0, Number(price || 0)) // no DRIP discount here
const netDps = (dpsAnnual) => Math.max(0, Number(dpsAnnual || 0)) // no tax in this version

function requiredSharesWhole({ goalType, targetValue, goalPeriod, price, dpsAnnual }) {
  const P_eff = effectivePrice(price)
  const dpsNet = netDps(dpsAnnual)
  const Gy = gy(goalPeriod)
  if (!Number.isFinite(targetValue) || targetValue <= 0) return 0
  if (goalType === 'shares') {
    if (P_eff <= 0 || dpsNet <= 0 || Gy <= 0) return 0
    const raw = (targetValue * P_eff * Gy) / dpsNet
    return Math.ceil(raw || 0) // whole shares only
  } else {
    if (dpsNet <= 0 || Gy <= 0) return 0
    const raw = (targetValue * Gy) / dpsNet
    return Math.ceil(raw || 0)
  }
}
function monthlyTargetCost({ goalType, targetValue, goalPeriod, price }) {
  const P_eff = effectivePrice(price)
  const Gy = gy(goalPeriod)
  if (!Number.isFinite(targetValue) || targetValue <= 0 || Gy <= 0) return 0
  return goalType === 'shares'
    ? targetValue * P_eff * (Gy / 12)
    : targetValue * (Gy / 12)
}

/* ---------- goal row ---------- */
function GoalRow({ g, onDelete, holdings }) {
  const currentShares = (holdings || [])
    .filter(h => (h.symbol || '').toUpperCase() === (g.symbol || '').toUpperCase())
    .reduce((a, h) => a + Number(h.units || 0), 0)

  const live = (holdings || []).find(h => (h.symbol || '').toUpperCase() === (g.symbol || '').toUpperCase())
  const price = Number(g.priceOverride || live?.price || 0)
  const ccy = live?.ccy || 'USD'

  const reqWhole = requiredSharesWhole({
    goalType: g.goalType,
    targetValue: g.targetValue,
    goalPeriod: g.goalPeriod,
    price,
    dpsAnnual: g.dpsAnnual,
  })

  const sharesToAdd = Math.max(0, reqWhole - currentShares)
  const monthlyCost = monthlyTargetCost({
    goalType: g.goalType,
    targetValue: g.targetValue,
    goalPeriod: g.goalPeriod,
    price,
  })

  const monthlyDiv = (currentShares * netDps(g.dpsAnnual)) / 12
  const progress = monthlyCost > 0 ? Math.min(1, Math.max(0, (monthlyDiv || 0) / monthlyCost)) : 0

  // NEW: dollars needed to reach goal (whole shares)
  const dollarsNeeded = sharesToAdd * price

  return (
    <div className="rounded-xl border dark:border-white/10 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" />
          <div className="font-semibold">{g.symbol}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Goal: <span className="font-medium">{g.goalType === 'shares' ? `${g.targetValue} / ${g.goalPeriod}` : `${currency(g.targetValue)} / ${g.goalPeriod}`}</span>
          </div>
        </div>
        <button className="btn hover:text-red-600" onClick={() => onDelete(g.id)} title="Remove goal">
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
          <div className="font-medium">{currency(netDps(g.dpsAnnual))}</div>
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

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Progress</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1 h-3 w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
          <div className="h-full bg-brand-600" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <div className="text-xs text-neutral-600 dark:text-neutral-300 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          Monthly target cost uses your goal period → monthly equivalent.
        </div>
      </div>
    </div>
  )
}

/* ---------- main ---------- */
export default function DividendPlanner() {
  const { data, setData } = useStore()
  const holdings = data?.investments || []
  const goals = data?.dividendGoals || []

  // form
  const [symbol, setSymbol] = useState('')
  const [goalType, setGoalType] = useState('shares')
  const [targetValue, setTargetValue] = useState('1')
  const [goalPeriod, setGoalPeriod] = useState('month')
  const [dpsAnnual, setDpsAnnual] = useState('') // gross annual
  const [priceOverride, setPriceOverride] = useState('')

  // normalize symbol
  const v_symbol = symbol.trim().toUpperCase()
  const v_target = parseNum(targetValue)
  const v_dps = parseNum(dpsAnnual)
  const v_price = priceOverride === '' ? undefined : parseNum(priceOverride)

  const errors = {
    symbol: v_symbol ? '' : 'Enter a ticker (e.g., KO).',
    target: v_target > 0 ? '' : goalType === 'shares' ? 'Enter shares per period (e.g., 1).' : 'Enter $ per period (e.g., 100).',
    dps: v_dps > 0 ? '' : 'Enter annual dividend per share (or fetch in Holdings).',
  }
  const canSubmit = !(errors.symbol || errors.target || errors.dps)

  // Prefill DPS from holding if available
  const tryPrefillFromHolding = () => {
    const h = holdings.find(h => (h.symbol || '').toUpperCase() === v_symbol)
    if (h?.dpsAnnual) setDpsAnnual(String(h.dpsAnnual))
    if (h?.price && !priceOverride) setPriceOverride(String(h.price))
  }

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
      priceOverride: v_price,
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
          Aim: “Buy <b>1 share</b> <i>per month</i> using dividends alone.” We’ll show shares to add and the additional capital required.
        </p>
      </div>

      {/* form */}
      <form onSubmit={addGoal} className="card grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-3">
          <label className="label">Symbol</label>
          <input
            className="input w-full"
            placeholder="KO"
            value={symbol}
            onChange={(e)=>{ setSymbol(e.target.value.toUpperCase()); setTimeout(tryPrefillFromHolding, 0) }}
          />
          {errors.symbol && <p className="text-xs mt-1 text-red-600">{errors.symbol}</p>}
        </div>

        <div className="lg:col-span-5">
          <label className="label">Goal</label>
          <div className="grid grid-cols-3 gap-2">
            <select className="input w-full" value={goalType} onChange={e => setGoalType(e.target.value)}>
              <option value="shares">Shares</option>
              <option value="income">Income ($)</option>
            </select>
            <input className="input w-full" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder={goalType === 'shares' ? '1' : '100'} />
            <select className="input w-full" value={goalPeriod} onChange={e => setGoalPeriod(e.target.value)}>
              {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          {errors.target && <p className="text-xs mt-1 text-red-600">{errors.target}</p>}
        </div>

        <div className="lg:col-span-3">
          <label className="label">Dividend / share (annual)</label>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={dpsAnnual} onChange={e => setDpsAnnual(e.target.value)} placeholder="auto or type…" />
          </div>
          {errors.dps && <p className="text-xs mt-1 text-red-600">{errors.dps}</p>}
        </div>

        <div className="lg:col-span-1">
          <label className="label">Price override</label>
          <input className="input w-full" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} placeholder="0.00" />
        </div>

        <div className="lg:col-span-12 flex items-center justify-end">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            <Plus className="w-4 h-4" /> Add Goal
          </button>
        </div>
      </form>

      {/* goals */}
      { (goals || []).length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          { (goals || []).map(g => (
            <GoalRow key={g.id} g={g} holdings={holdings} onDelete={removeGoal} />
          )) }
        </div>
      ) : (
        <div className="card text-sm text-neutral-600 dark:text-neutral-300">
          No DRIP goals yet. Example: <b>KO</b> → Goal “Shares 1” → “Per Month”. Fetch prices/dividends in Holdings first for auto-prefill.
        </div>
      )}
    </section>
  )
}
