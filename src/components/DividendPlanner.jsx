import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import {
  Target, Percent, DollarSign, Calendar, Plus, Trash2, Info
} from 'lucide-react'

/* ---------- constants / helpers ---------- */
const PERIODS = [
  { key: 'month', label: 'Per Month', gy: 12 },
  { key: 'quarter', label: 'Per Quarter', gy: 4 },
  { key: 'year', label: 'Per Year', gy: 1 },
]
const gy = (period) => (PERIODS.find(p => p.key === period)?.gy ?? 12)

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
const asPctUnit = (s) => clamp01(parseNum(s) / 100)

const effectivePrice = (price, dripDiscount) => {
  const P = Math.max(0, Number(price || 0))
  const disc = clamp01(dripDiscount)
  return P * (1 - disc)
}
const netDps = (dpsAnnual, taxRate) => {
  const d = Math.max(0, Number(dpsAnnual || 0))
  const t = clamp01(taxRate)
  return d * (1 - t)
}

/* ---------- core math ---------- */
function requiredShares({ goalType, targetValue, goalPeriod, price, dripDiscount, dpsAnnual, taxRate, allowFractional }) {
  const P_eff = effectivePrice(price, dripDiscount)
  const dpsNet = netDps(dpsAnnual, taxRate)
  const Gy = gy(goalPeriod)
  if (!Number.isFinite(targetValue) || targetValue <= 0) return 0
  if (goalType === 'shares') {
    if (P_eff <= 0 || dpsNet <= 0 || Gy <= 0) return 0
    const raw = (targetValue * P_eff * Gy) / dpsNet
    return allowFractional ? raw : Math.ceil(raw || 0)
  } else {
    if (dpsNet <= 0 || Gy <= 0) return 0
    const raw = (targetValue * Gy) / dpsNet
    return allowFractional ? raw : Math.ceil(raw || 0)
  }
}
function monthlyTargetCost({ goalType, targetValue, goalPeriod, price, dripDiscount }) {
  const P_eff = effectivePrice(price, dripDiscount)
  const Gy = gy(goalPeriod)
  if (!Number.isFinite(targetValue) || targetValue <= 0 || Gy <= 0) return 0
  return goalType === 'shares'
    ? targetValue * P_eff * (Gy / 12)
    : targetValue * (Gy / 12)
}
function estimateMonthsToGoal({ currentShares, goalShares, dpsAnnual, taxRate, dripDiscount, price, allowFractional, extraMonthly = 0, growthRate = 0 }) {
  let months = 0
  let S = Math.max(0, Number(currentShares || 0))
  const P_eff = effectivePrice(price, dripDiscount)
  let dpsNet = netDps(dpsAnnual, taxRate)
  const monthlyGrowth = Math.max(0, Number(growthRate || 0)) / 12
  if (!Number.isFinite(goalShares) || goalShares <= 0) return null
  if (P_eff <= 0 || dpsNet <= 0) return null
  if (S >= goalShares) return 0
  while (months < 600 && S < goalShares) {
    const monthlyDivDollars = (S * dpsNet) / 12
    const investable = (Number.isFinite(monthlyDivDollars) ? monthlyDivDollars : 0) + (Number(extraMonthly) || 0)
    let delta = investable / P_eff
    if (!Number.isFinite(delta)) delta = 0
    if (!allowFractional) delta = Math.floor(delta)
    if (delta <= 0 && (Number(extraMonthly) || 0) <= 0) return null
    S += delta
    dpsNet = dpsNet * (1 + monthlyGrowth)
    months++
  }
  return S >= goalShares ? months : null
}

/* ---------- subcomponents ---------- */
function HoldingSymbolPicker({ value, onChange, holdings }) {
  const list = Array.from(new Set((holdings || []).map(h => (h.symbol || '').trim()).filter(Boolean)))
  return (
    <div>
      <input
        list="symbols"
        className="input w-full"
        placeholder="Symbol (e.g., ENB)"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
      />
      <datalist id="symbols">{list.map(s => <option key={s} value={s} />)}</datalist>
      <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">Pick an existing holding or type any symbol.</p>
    </div>
  )
}

function GoalRow({ g, onDelete, holdings, extraMonthlyDefault }) {
  const currentShares = (holdings || [])
    .filter(h => (h.symbol || '').toUpperCase() === (g.symbol || '').toUpperCase())
    .reduce((a, h) => a + Number(h.units || 0), 0)

  const live = (holdings || []).find(h => (h.symbol || '').toUpperCase() === (g.symbol || '').toUpperCase())
  const price = Number(g.priceOverride || live?.price || 0)

  const req = requiredShares({
    goalType: g.goalType,
    targetValue: g.targetValue,
    goalPeriod: g.goalPeriod,
    price,
    dripDiscount: g.dripDiscount,
    dpsAnnual: g.dpsAnnual,
    taxRate: g.taxRate,
    allowFractional: g.allowFractional
  })
  const sharesToAdd = Math.max(0, (Number.isFinite(req) ? req : 0) - currentShares)

  const monthlyCost = monthlyTargetCost({
    goalType: g.goalType,
    targetValue: g.targetValue,
    goalPeriod: g.goalPeriod,
    price,
    dripDiscount: g.dripDiscount,
  })
  const monthlyDiv = (currentShares * netDps(g.dpsAnnual, g.taxRate)) / 12
  const progress = monthlyCost > 0 ? Math.min(1, Math.max(0, (monthlyDiv || 0) / monthlyCost)) : 0

  const eta = estimateMonthsToGoal({
    currentShares,
    goalShares: req,
    dpsAnnual: g.dpsAnnual,
    taxRate: g.taxRate,
    dripDiscount: g.dripDiscount,
    price,
    allowFractional: g.allowFractional,
    extraMonthly: extraMonthlyDefault,
    growthRate: g.growthRate || 0,
  })

  return (
    <div className="rounded-xl border dark:border-white/10 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" />
          <div className="font-semibold">{g.symbol}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {g.goalType === 'shares'
              ? <>Goal: <span className="font-medium">{g.targetValue}</span> / {g.goalPeriod}</>
              : <>Goal: <span className="font-medium">{currency(g.targetValue)}</span> / {g.goalPeriod}</>}
          </div>
        </div>
        <button className="btn hover:text-red-600" onClick={() => onDelete(g.id)} title="Remove goal">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Current shares</div>
          <div className="font-medium">{currentShares.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Price{g.priceOverride ? ' (override)' : ''}</div>
          <div className="font-medium">{price > 0 ? currency(price) : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Dividend / share (annual, <span className="italic">net</span>)</div>
          <div className="font-medium">
            {currency(netDps(g.dpsAnnual, g.taxRate))}
            <span className="text-xs text-neutral-400"> ({currency(g.dpsAnnual)} gross)</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Shares required</div>
          <div className="font-medium">{Number.isFinite(req) ? Math.max(0, req).toLocaleString() : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Shares to add</div>
          <div className="font-medium">{Number.isFinite(sharesToAdd) ? sharesToAdd.toLocaleString() : '—'}</div>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-1">
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
          <Calendar className="w-3 h-3" />
          ETA: {eta === null ? '—' : `${eta} mo`}
        </div>
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          Monthly target cost: {monthlyCost > 0 ? currency(monthlyCost) : '—'}
        </div>
      </div>
    </div>
  )
}

/* ---------- main planner ---------- */
export default function DividendPlanner() {
  const { data, setData } = useStore()
  const holdings = data?.investments || []
  const goals = data?.dividendGoals || []

  // form
  const [symbol, setSymbol] = useState('')
  const [goalType, setGoalType] = useState('shares') // 'shares' | 'income'
  const [targetValue, setTargetValue] = useState('1') // N shares OR $X
  const [goalPeriod, setGoalPeriod] = useState('month')

  const [dpsAnnual, setDpsAnnual] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [dripDiscount, setDripDiscount] = useState('0')
  const [allowFractional, setAllowFractional] = useState(true)
  const [priceOverride, setPriceOverride] = useState('')

  const [extraMonthly, setExtraMonthly] = useState('0')

  // validation
  const v_symbol = symbol.trim().toUpperCase()
  const v_target = parseNum(targetValue)
  const v_dps = parseNum(dpsAnnual)
  const v_tax = asPctUnit(taxRate)
  const v_drip = asPctUnit(dripDiscount)
  const v_price = priceOverride === '' ? undefined : parseNum(priceOverride)

  const errors = {
    symbol: v_symbol ? '' : 'Enter a ticker (e.g., ENB).',
    target: v_target > 0 ? '' : goalType === 'shares' ? 'Enter shares per period (e.g., 1).' : 'Enter $ per period (e.g., 100).',
    dps: v_dps > 0 ? '' : 'Enter annual dividend per share (gross).',
  }
  const hasErrors = Boolean(errors.symbol || errors.target || errors.dps)
  const canSubmit = !hasErrors

  const addGoal = (e) => {
    e?.preventDefault?.()
    if (!canSubmit) return
    const newGoal = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      symbol: v_symbol,
      goalType,
      targetValue: v_target,
      goalPeriod,
      allowFractional: !!allowFractional,
      dpsAnnual: v_dps,
      payoutFreq: 4, // meta; not needed for math
      dripDiscount: v_drip,
      taxRate: v_tax,
      growthRate: 0,
      priceOverride: v_price,
      createdAt: new Date().toISOString()
    }
    try {
      setData(prev => ({ ...prev, dividendGoals: [...(prev.dividendGoals || []), newGoal] }))
      // reset only some fields
      setTargetValue(goalType === 'shares' ? '1' : '')
      setDpsAnnual('')
      setDripDiscount('0')
      setPriceOverride('')
    } catch (err) {
      console.error('Failed to save goal', err)
      alert('Could not save this goal. Try again or clear local data in Settings → Backup.')
    }
  }

  const removeGoal = (id) =>
    setData(prev => ({ ...prev, dividendGoals: (prev.dividendGoals || []).filter(g => g.id !== id) }))

  const extraMonthlyDefault = parseNum(extraMonthly)

  const sortedGoals = useMemo(() => {
    // sort by "fewest shares to add"
    return (goals || []).slice().sort((a, b) => {
      const liveA = holdings.find(h => (h.symbol || '').toUpperCase() === (a.symbol || '').toUpperCase())
      const liveB = holdings.find(h => (h.symbol || '').toUpperCase() === (b.symbol || '').toUpperCase())
      const priceA = a.priceOverride || liveA?.price || 0
      const priceB = b.priceOverride || liveB?.price || 0
      const reqA = requiredShares({ ...a, price: priceA })
      const reqB = requiredShares({ ...b, price: priceB })
      const currA = holdings.filter(h => (h.symbol || '').toUpperCase() === (a.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
      const currB = holdings.filter(h => (h.symbol || '').toUpperCase() === (b.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
      const needA = Math.max(0, (Number.isFinite(reqA) ? reqA : 0) - currA)
      const needB = Math.max(0, (Number.isFinite(reqB) ? reqB : 0) - currB)
      return needA - needB
    })
  }, [goals, holdings])

  return (
    <section className="space-y-4">
      {/* header */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Dividend DRIP Planner</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Goal idea: “Buy <b>1 share</b> <i>per month</i> using dividends alone.”
            </p>
          </div>
          <div>
            <label className="label">Extra monthly add (optional)</label>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 opacity-70" />
              <input className="input w-28" value={extraMonthly} onChange={e=>setExtraMonthly(e.target.value)} placeholder="0" />
            </div>
            <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">Used for ETA only.</p>
          </div>
        </div>
      </div>

      {/* form */}
      <form onSubmit={addGoal} className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="label">Symbol</label>
          <HoldingSymbolPicker value={symbol} onChange={setSymbol} holdings={holdings} />
          {errors.symbol && <p className="text-xs mt-1 text-red-600">{errors.symbol}</p>}
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
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

        <div>
          <label className="label">Dividend / share (annual, gross)</label>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={dpsAnnual} onChange={e => setDpsAnnual(e.target.value)} placeholder="e.g., 3.60" />
          </div>
          {errors.dps && <p className="text-xs mt-1 text-red-600">{errors.dps}</p>}
          <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">Enter the yearly dividend paid per share (before tax).</p>
        </div>

        <div>
          <label className="label">Tax %</label>
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="0" />
          </div>
          <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">Set to 0 for tax-sheltered accounts.</p>
        </div>

        <div>
          <label className="label">DRIP discount %</label>
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={dripDiscount} onChange={e => setDripDiscount(e.target.value)} placeholder="0" />
          </div>
          <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">If your broker offers a discount on DRIP purchases.</p>
        </div>

        <div>
          <label className="label">Price override (optional)</label>
          <input className="input w-full" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} placeholder="e.g., 47.50" />
          <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">Leave blank to use the holding’s price when available.</p>
        </div>

        <div>
          <label className="label">Fractional DRIP</label>
          <select className="input w-full" value={allowFractional ? 'yes' : 'no'} onChange={e => setAllowFractional(e.target.value === 'yes')}>
            <option value="yes">Allowed</option>
            <option value="no">Whole shares only</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            <Plus className="w-4 h-4" /> Add Goal
          </button>
        </div>
      </form>

      {/* goals */}
      {sortedGoals.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {sortedGoals.map(g => (
            <GoalRow
              key={g.id}
              g={g}
              holdings={holdings}
              onDelete={removeGoal}
              extraMonthlyDefault={extraMonthlyDefault}
            />
          ))}
        </div>
      ) : (
        <div className="card text-sm text-neutral-600 dark:text-neutral-300">
          No DRIP goals yet. Example: ENB → Goal “Shares 1” → “Per Month” → enter **annual DPS** (e.g., 3.60). Tax 0% if TFSA/RRSP.
        </div>
      )}
    </section>
  )
}
