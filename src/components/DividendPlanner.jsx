import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import {
  Target, Percent, DollarSign, Calendar, Plus, Trash2, Info
} from 'lucide-react'

const PERIODS = [
  { key: 'month', label: 'Per Month', gy: 12 },
  { key: 'quarter', label: 'Per Quarter', gy: 4 },
  { key: 'year', label: 'Per Year', gy: 1 },
]

function gy(period) {
  const p = PERIODS.find(p => p.key === period)
  return p ? p.gy : 12
}
function effectivePrice(price, dripDiscount) {
  const P = Math.max(0, Number(price || 0))
  const disc = Math.max(0, Math.min(1, Number(dripDiscount || 0)))
  return P * (1 - disc)
}
function netDps(dpsAnnual, taxRate) {
  const d = Math.max(0, Number(dpsAnnual || 0))
  const t = Math.max(0, Math.min(1, Number(taxRate || 0)))
  return d * (1 - t)
}
function requiredShares({ goalType, targetValue, goalPeriod, price, dripDiscount, dpsAnnual, taxRate }) {
  const P_eff = effectivePrice(price, dripDiscount)
  const dpsNet = netDps(dpsAnnual, taxRate)
  const Gy = gy(goalPeriod)
  if (P_eff <= 0 || dpsNet <= 0 || Gy <= 0 || Number(targetValue) <= 0) return 0
  return goalType === 'shares'
    ? (Number(targetValue) * P_eff * Gy) / dpsNet        // N shares / period
    : (Number(targetValue) * Gy) / dpsNet                // $X / period
}
function monthlyTargetCost({ goalType, targetValue, goalPeriod, price, dripDiscount }) {
  const P_eff = effectivePrice(price, dripDiscount)
  const Gy = gy(goalPeriod)
  return goalType === 'shares'
    ? Number(targetValue || 0) * P_eff * (Gy / 12)
    : Number(targetValue || 0) * (Gy / 12)
}
function estimateMonthsToGoal({ currentShares, goalShares, dpsAnnual, taxRate, dripDiscount, price, allowFractional, extraMonthly = 0, growthRate = 0 }) {
  let months = 0
  let S = Math.max(0, Number(currentShares || 0))
  const P_eff = effectivePrice(price, dripDiscount)
  let dpsNet = netDps(dpsAnnual, taxRate)
  const monthlyGrowth = Math.max(0, Number(growthRate || 0)) / 12
  if (P_eff <= 0 || dpsNet <= 0) return null
  if (S >= goalShares) return 0
  while (months < 600 && S < goalShares) {
    const monthlyDivDollars = (S * dpsNet) / 12
    const investable = monthlyDivDollars + Number(extraMonthly || 0)
    let deltaShares = investable / P_eff
    if (!allowFractional) deltaShares = Math.floor(deltaShares)
    if (deltaShares <= 0 && Number(extraMonthly || 0) <= 0) return null
    S += deltaShares
    dpsNet = dpsNet * (1 + monthlyGrowth)
    months++
  }
  return S >= goalShares ? months : null
}

function HoldingSymbolPicker({ value, onChange, holdings }) {
  const uniqueSymbols = Array.from(new Set((holdings || []).map(h => (h.symbol || '').trim()).filter(Boolean)))
  return (
    <div>
      <input
        list="symbols"
        className="input w-full"
        placeholder="Symbol (e.g., ENB)"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
      />
      <datalist id="symbols">
        {uniqueSymbols.map(s => <option key={s} value={s} />)}
      </datalist>
    </div>
  )
}

function GoalRow({ g, onDelete, holdings, extraMonthlyDefault }) {
  const hForSymbol = (holdings || []).filter(h => (h.symbol || '').toUpperCase() === (g.symbol || '').toUpperCase())
  const currentShares = hForSymbol.reduce((a, h) => a + Number(h.units || 0), 0)
  const livePrice = hForSymbol[0]?.price
  const price = Number(g.priceOverride || livePrice || 0)

  const req = requiredShares({
    goalType: g.goalType,
    targetValue: g.targetValue,
    goalPeriod: g.goalPeriod,
    price,
    dripDiscount: g.dripDiscount,
    dpsAnnual: g.dpsAnnual,
    taxRate: g.taxRate,
  })
  const allowFractional = !!g.allowFractional
  const reqDisplay = allowFractional ? req : Math.ceil(req || 0)
  const sharesToAdd = Math.max(0, (reqDisplay || 0) - currentShares)

  const monthlyCost = monthlyTargetCost({
    goalType: g.goalType,
    targetValue: g.targetValue,
    goalPeriod: g.goalPeriod,
    price,
    dripDiscount: g.dripDiscount,
  })
  const monthlyDiv = (currentShares * netDps(g.dpsAnnual, g.taxRate)) / 12
  const progress = monthlyCost > 0 ? Math.min(1, monthlyDiv / monthlyCost) : 0

  const eta = estimateMonthsToGoal({
    currentShares,
    goalShares: reqDisplay,
    dpsAnnual: g.dpsAnnual,
    taxRate: g.taxRate,
    dripDiscount: g.dripDiscount,
    price,
    allowFractional,
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
          <div className="text-xs text-neutral-500 dark:text-neutral-400">DPS (annual, net)</div>
          <div className="font-medium">
            {currency(netDps(g.dpsAnnual, g.taxRate))}
            <span className="text-xs text-neutral-400"> ({currency(g.dpsAnnual)} gross)</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Shares required</div>
          <div className="font-medium">{Number.isFinite(reqDisplay) ? reqDisplay.toLocaleString() : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Shares to add</div>
          <div className="font-medium">{Number.isFinite(sharesToAdd) ? sharesToAdd.toLocaleString() : '—'}</div>
        </div>
      </div>

      <div className="mt-1">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Progress</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1 h-3 w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
          <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, Math.round(progress * 100)))}%` }} />
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

export default function DividendPlanner() {
  const { data, setData } = useStore()
  const holdings = data.investments || []
  const goals = data.dividendGoals || []

  const [symbol, setSymbol] = useState('')
  const [goalType, setGoalType] = useState('shares')
  const [targetValue, setTargetValue] = useState('1')
  const [goalPeriod, setGoalPeriod] = useState('month')

  const [dpsAnnual, setDpsAnnual] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [payoutFreq, setPayoutFreq] = useState('quarterly') // meta only
  const [dripDiscount, setDripDiscount] = useState('0')
  const [allowFractional, setAllowFractional] = useState(true)
  const [priceOverride, setPriceOverride] = useState('')

  const [extraMonthly, setExtraMonthly] = useState('0')

  const addGoal = (e) => {
    e?.preventDefault?.()
    const sym = symbol.trim().toUpperCase()
    if (!sym) return alert('Enter a symbol (e.g., ENB)')
    const dps = parseNum(dpsAnnual)
    if (dps <= 0) return alert('Enter annual dividend per share (gross).')
    const toPct = (s) => Math.max(0, Math.min(1, parseNum(s) / 100))
    const newGoal = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      symbol: sym,
      goalType,
      targetValue: parseNum(targetValue),
      goalPeriod,
      allowFractional: !!allowFractional,
      dpsAnnual: dps,
      payoutFreq: payoutFreq === 'monthly' ? 12 : payoutFreq === 'semi' ? 2 : 4,
      dripDiscount: toPct(dripDiscount),
      taxRate: toPct(taxRate),
      growthRate: 0,
      priceOverride: priceOverride ? parseNum(priceOverride) : undefined,
      createdAt: new Date().toISOString()
    }
    setData(prev => ({ ...prev, dividendGoals: [...(prev.dividendGoals || []), newGoal] }))
    setTargetValue(goalType === 'shares' ? '1' : '')
    setDpsAnnual(''); setPriceOverride(''); setDripDiscount('0')
  }
  const removeGoal = (id) => setData(prev => ({ ...prev, dividendGoals: (prev.dividendGoals || []).filter(g => g.id !== id) }))

  const extraMonthlyDefault = parseNum(extraMonthly)

  const sortedGoals = useMemo(() => {
    return (goals || []).slice().sort((a, b) => {
      const liveA = holdings.find(h => (h.symbol || '').toUpperCase() === (a.symbol || '').toUpperCase())
      const liveB = holdings.find(h => (h.symbol || '').toUpperCase() === (b.symbol || '').toUpperCase())
      const priceA = a.priceOverride || liveA?.price || 0
      const priceB = b.priceOverride || liveB?.price || 0
      const reqA = requiredShares({ goalType: a.goalType, targetValue: a.targetValue, goalPeriod: a.goalPeriod, price: priceA, dripDiscount: a.dripDiscount, dpsAnnual: a.dpsAnnual, taxRate: a.taxRate })
      const reqB = requiredShares({ goalType: b.goalType, targetValue: b.targetValue, goalPeriod: b.goalPeriod, price: priceB, dripDiscount: b.dripDiscount, dpsAnnual: b.dpsAnnual, taxRate: b.taxRate })
      const currA = holdings.filter(h => (h.symbol || '').toUpperCase() === (a.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
      const currB = holdings.filter(h => (h.symbol || '').toUpperCase() === (b.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
      const needA = Math.max(0, (a.allowFractional ? reqA : Math.ceil(reqA || 0)) - currA)
      const needB = Math.max(0, (b.allowFractional ? reqB : Math.ceil(reqB || 0)) - currB)
      return needA - needB
    })
  }, [goals, holdings])

  return (
    <section className="space-y-4">
      {/* Header card */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Dividend DRIP Planner</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Size positions so dividends can buy your next shares automatically.
            </p>
          </div>
          <div>
            <label className="label">Extra monthly add (optional)</label>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 opacity-70" />
              <input className="input w-28" value={extraMonthly} onChange={e=>setExtraMonthly(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>
      </div>

      {/* Add goal — responsive grid, no fixed widths */}
      <form onSubmit={addGoal} className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="label">Symbol</label>
          <HoldingSymbolPicker value={symbol} onChange={setSymbol} holdings={holdings} />
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
        </div>

        <div>
          <label className="label">Price override (opt)</label>
          <input className="input w-full" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} placeholder="0.00" />
        </div>

        <div>
          <label className="label">Dividend / share (annual, gross)</label>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={dpsAnnual} onChange={e => setDpsAnnual(e.target.value)} placeholder="e.g., 3.60" />
          </div>
        </div>

        <div>
          <label className="label">Tax %</label>
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div>
          <label className="label">DRIP %</label>
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={dripDiscount} onChange={e => setDripDiscount(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div>
          <label className="label">Payout</label>
          <select className="input w-full" value={payoutFreq} onChange={e => setPayoutFreq(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semi">Semi-annual</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        <div>
          <label className="label">Fractional</label>
          <select className="input w-full" value={allowFractional ? 'yes' : 'no'} onChange={e => setAllowFractional(e.target.value === 'yes')}>
            <option value="yes">Allowed</option>
            <option value="no">Whole shares</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn btn-primary">
            <Plus className="w-4 h-4" /> Add Goal
          </button>
        </div>
      </form>

      {/* Goals list */}
      { (goals || []).length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {useMemo(() => {
            const sorted = (goals || []).slice().sort((a, b) => {
              const liveA = holdings.find(h => (h.symbol || '').toUpperCase() === (a.symbol || '').toUpperCase())
              const liveB = holdings.find(h => (h.symbol || '').toUpperCase() === (b.symbol || '').toUpperCase())
              const priceA = a.priceOverride || liveA?.price || 0
              const priceB = b.priceOverride || liveB?.price || 0
              const reqA = requiredShares({ goalType: a.goalType, targetValue: a.targetValue, goalPeriod: a.goalPeriod, price: priceA, dripDiscount: a.dripDiscount, dpsAnnual: a.dpsAnnual, taxRate: a.taxRate })
              const reqB = requiredShares({ goalType: b.goalType, targetValue: b.targetValue, goalPeriod: b.goalPeriod, price: priceB, dripDiscount: b.dripDiscount, dpsAnnual: b.dpsAnnual, taxRate: b.taxRate })
              const currA = holdings.filter(h => (h.symbol || '').toUpperCase() === (a.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
              const currB = holdings.filter(h => (h.symbol || '').toUpperCase() === (b.symbol || '').toUpperCase()).reduce((s, h) => s + Number(h.units || 0), 0)
              const needA = Math.max(0, (a.allowFractional ? reqA : Math.ceil(reqA || 0)) - currA)
              const needB = Math.max(0, (b.allowFractional ? reqB : Math.ceil(reqB || 0)) - currB)
              return needA - needB
            })
            return sorted.map(g => (
              <GoalRow
                key={g.id}
                g={g}
                holdings={holdings}
                onDelete={removeGoal}
                extraMonthlyDefault={parseNum(extraMonthly)}
              />
            ))
          }, [goals, holdings, extraMonthly])}
        </div>
      ) : (
        <div className="card text-sm text-neutral-600 dark:text-neutral-300">
          No DRIP goals yet. Add one above (e.g., ENB, goal = 1 share / month, enter annual DPS).
        </div>
      )}
    </section>
  )
}
