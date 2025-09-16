import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import { Target, Percent, DollarSign, Calendar, Plus, Trash2, Info, Zap } from 'lucide-react'

/* ---------- provider helpers (dividends only) ---------- */
function deepPick(obj, keys) {
  for (const k of keys) {
    const parts = k.split('.'); let cur = obj
    for (const p of parts) { if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]; else { cur = undefined; break } }
    if (typeof cur === 'number' && isFinite(cur)) return Number(cur)
  }
  return undefined
}

async function fetchDividend_AV(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const r = await fetch(url); const j = await r.json()
  const dps = Number(j?.DividendPerShare)
  const yld = Number(j?.DividendYield)
  if (!isFinite(dps) && !isFinite(yld)) throw new Error('AlphaVantage: dividends not found')
  return { dpsAnnual: isFinite(dps) ? dps : undefined, dividendYield: isFinite(yld) ? yld : undefined, payoutFreq: 4 }
}
async function fetchDividend_FH(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`
  const r = await fetch(url); const j = await r.json()
  const dps = deepPick(j, ['metric.dividendPerShareAnnual', 'metric.dividendPerShareTTM'])
  const yld = deepPick(j, ['metric.dividendYieldIndicatedAnnual', 'metric.dividendYieldTTM'])
  if (dps == null && yld == null) throw new Error('Finnhub: dividends not found')
  return { dpsAnnual: dps, dividendYield: yld != null ? yld / 100 : undefined, payoutFreq: 4 }
}
async function fetchDividend_YR(symbol, apiKey, host) {
  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }
  try {
    const u = `https://${host}/stock/v2/get-summary?symbol=${encodeURIComponent(symbol)}&region=US`
    const r = await fetch(u, { headers }); if (r.ok) {
      const j = await r.json()
      const dps = deepPick(j, ['summaryDetail.dividendRate.raw', 'defaultKeyStatistics.lastDividendValue.raw'])
      const yld = deepPick(j, ['summaryDetail.dividendYield.raw'])
      if (dps != null || yld != null) return { dpsAnnual: dps, dividendYield: yld, payoutFreq: 4 }
    }
  } catch {}
  try {
    const u = `https://${host}/api/yahoo/qu/quote/${encodeURIComponent(symbol)}`
    const r = await fetch(u, { headers }); if (r.ok) {
      const j = await r.json()
      const dps = deepPick(j, ['summaryDetail.dividendRate.raw', 'dividendRate'])
      const yld = deepPick(j, ['summaryDetail.dividendYield.raw', 'dividendYield'])
      if (dps != null || yld != null) return { dpsAnnual: dps, dividendYield: yld, payoutFreq: 4 }
    }
  } catch {}
  throw new Error('Yahoo: dividends not found')
}
async function fetchDividend(symbol, provider, apiKey, host) {
  if (provider === 'Finnhub') return fetchDividend_FH(symbol, apiKey)
  if (provider === 'YahooRapidAPI') return fetchDividend_YR(symbol, apiKey, host)
  return fetchDividend_AV(symbol, apiKey)
}

/* ---------- math helpers ---------- */
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

/* ---------- subcomponents ---------- */
function HoldingSymbolPicker({ value, onChange, holdings, onAutofill, autofillDisabled }) {
  const list = Array.from(new Set((holdings || []).map(h => (h.symbol || '').trim()).filter(Boolean)))
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <input
          list="symbols"
          className="input w-full"
          placeholder="Symbol (e.g., KO or ENB)"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
        />
        <datalist id="symbols">{list.map(s => <option key={s} value={s} />)}</datalist>
        <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">Pick an existing holding or type any ticker.</p>
      </div>
      <button type="button" className="btn" disabled={autofillDisabled} onClick={onAutofill} title="Autofill dividend from provider">
        <Zap className="w-4 h-4" /> Autofill
      </button>
    </div>
  )
}

function GoalRow({ g, onDelete, holdings }) {
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
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Dividend / share (annual, <i>net</i>)</div>
          <div className="font-medium">{currency(netDps(g.dpsAnnual, g.taxRate))}</div>
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

  const provider = data?.settings?.marketData?.provider || 'AlphaVantage'
  const apiKey   = data?.settings?.marketData?.apiKey || ''
  const host     = data?.settings?.marketData?.host || ''

  // form
  const [symbol, setSymbol] = useState('')
  const [goalType, setGoalType] = useState('shares')
  const [targetValue, setTargetValue] = useState('1')
  const [goalPeriod, setGoalPeriod] = useState('month')

  const [dpsAnnual, setDpsAnnual] = useState('') // gross
  const [taxRate, setTaxRate] = useState('0')
  const [dripDiscount, setDripDiscount] = useState('0')
  const [allowFractional, setAllowFractional] = useState(true)
  const [priceOverride, setPriceOverride] = useState('')

  const v_symbol = symbol.trim().toUpperCase()
  const v_target = parseNum(targetValue)
  const v_dps = parseNum(dpsAnnual)
  const v_tax = asPctUnit(taxRate)
  const v_drip = asPctUnit(dripDiscount)
  const v_price = priceOverride === '' ? undefined : parseNum(priceOverride)

  const errors = {
    symbol: v_symbol ? '' : 'Enter a ticker (e.g., KO).',
    target: v_target > 0 ? '' : goalType === 'shares' ? 'Enter shares per period (e.g., 1).' : 'Enter $ per period (e.g., 100).',
    dps: v_dps > 0 ? '' : 'Enter annual dividend per share (gross) or click Autofill.',
  }
  const canSubmit = !(errors.symbol || errors.target || errors.dps)

  // Prefill DPS if the holding already has it
  const tryPrefillFromHolding = () => {
    const h = holdings.find(h => (h.symbol || '').toUpperCase() === v_symbol)
    if (h?.dpsAnnual) setDpsAnnual(String(h.dpsAnnual))
  }

  const autofillFromProvider = async () => {
    if (!v_symbol) return
    try {
      // guard for keys
      if (provider === 'AlphaVantage' && !apiKey) throw new Error('AlphaVantage API key missing')
      if (provider === 'Finnhub' && !apiKey) throw new Error('Finnhub API key missing')
      if (provider === 'YahooRapidAPI' && (!apiKey || !host)) throw new Error('RapidAPI key/host missing')

      const d = await fetchDividend(v_symbol, provider, apiKey, host)
      if (d?.dpsAnnual != null && isFinite(d.dpsAnnual)) setDpsAnnual(String(d.dpsAnnual))
      // we don’t show payout in the form; keep default assumptions simple
      // Optional: could set goalPeriod based on frequency if desired
    } catch (err) {
      alert(err?.message || 'Could not fetch dividends for this symbol.')
    }
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
      allowFractional: !!allowFractional,
      dpsAnnual: v_dps,
      payoutFreq: 4,
      dripDiscount: v_drip,
      taxRate: v_tax,
      growthRate: 0,
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
      {/* header (cleaned) */}
      <div className="card">
        <h3 className="font-semibold">Dividend DRIP Planner</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Aim: “Buy <b>1 share</b> <i>per month</i> using dividends alone.” Autofill uses your provider to fetch the annual dividend.
        </p>
      </div>

      {/* form */}
      <form onSubmit={addGoal} className="card grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-4">
          <label className="label">Symbol</label>
          <HoldingSymbolPicker
            value={symbol}
            onChange={(s)=>{ setSymbol(s); setTimeout(tryPrefillFromHolding, 0) }}
            holdings={holdings}
            onAutofill={autofillFromProvider}
            autofillDisabled={!v_symbol}
          />
          {errors.symbol && <p className="text-xs mt-1 text-red-600">{errors.symbol}</p>}
        </div>

        <div className="lg:col-span-4">
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
          <label className="label">Dividend / share (annual, gross)</label>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={dpsAnnual} onChange={e => setDpsAnnual(e.target.value)} placeholder="Click Autofill or type…" />
          </div>
          {errors.dps && <p className="text-xs mt-1 text-red-600">{errors.dps}</p>}
          <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">We’ll net out taxes in the calculation below.</p>
        </div>

        <div className="lg:col-span-1">
         <label className="label">Tax %</label>
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 opacity-70" />
            <input className="input w-full" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="lg:col-span-12 flex items-center justify-between mt-1">
          <div className="flex items-center gap-3">
            <label className="label m-0">DRIP discount %</label>
            <input className="input w-28" value={dripDiscount} onChange={e => setDripDiscount(e.target.value)} placeholder="0" />
            <label className="label m-0">Fractional DRIP</label>
            <select className="input w-28" value={allowFractional ? 'yes' : 'no'} onChange={e => setAllowFractional(e.target.value === 'yes')}>
              <option value="yes">Allowed</option>
              <option value="no">Whole shares</option>
            </select>
            <label className="label m-0">Price override</label>
            <input className="input w-28" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} placeholder="0.00" />
          </div>
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
          No DRIP goals yet. Example: <b>KO</b> → Goal “Shares 1” → “Per Month” → click <b>Autofill</b>.
        </div>
      )}
    </section>
  )
}
