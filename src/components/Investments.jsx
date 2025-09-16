import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import DividendPlanner from './DividendPlanner'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend
} from 'recharts'
import { Plus, Trash2, RefreshCcw, DollarSign } from 'lucide-react'

/* -----------------------------
   Provider helpers (price + dividends)
----------------------------- */
function deepPick(obj, keys) {
  for (const k of keys) {
    const parts = k.split('.')
    let cur = obj
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]
      else { cur = undefined; break }
    }
    if (typeof cur === 'number' && isFinite(cur)) return Number(cur)
  }
  return undefined
}

/* AlphaVantage */
async function fetchPrice_AV(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const res = await fetch(url); const j = await res.json()
  const raw = j?.['Global Quote']?.['05. price']
  const px = raw != null ? Number(raw) : NaN
  if (!isFinite(px)) throw new Error('AlphaVantage: price not found')
  return px
}
async function fetchDividend_AV(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  const res = await fetch(url); const j = await res.json()
  // Overview returns DividendPerShare (TTM) & DividendYield
  const dps = Number(j?.DividendPerShare)
  const yld = Number(j?.DividendYield) // decimal (e.g., 0.034)
  if (!isFinite(dps) && !isFinite(yld)) throw new Error('AlphaVantage: dividends not found')
  return { dpsAnnual: isFinite(dps) ? dps : undefined, dividendYield: isFinite(yld) ? yld : undefined, payoutFreq: 4 }
}

/* Finnhub */
async function fetchPrice_FH(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
  const res = await fetch(url); const j = await res.json()
  const px = Number(j?.c)
  if (!isFinite(px) || px <= 0) throw new Error('Finnhub: price not found')
  return px
}
async function fetchDividend_FH(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`
  const res = await fetch(url); const j = await res.json()
  const dps = deepPick(j, ['metric.dividendPerShareAnnual', 'metric.dividendPerShareTTM'])
  const yld = deepPick(j, ['metric.dividendYieldIndicatedAnnual', 'metric.dividendYieldTTM'])
  if (dps == null && yld == null) throw new Error('Finnhub: dividends not found')
  return { dpsAnnual: dps, dividendYield: yld != null ? yld / 100 : undefined, payoutFreq: 4 }
}

/* Yahoo via RapidAPI (supports multiple hosts) */
async function fetchPrice_YR(symbol, apiKey, host) {
  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }

  // Try finance15 style
  try {
    const u1 = `https://${host}/api/yahoo/qu/quote/${encodeURIComponent(symbol)}`
    const r1 = await fetch(u1, { headers }); if (r1.ok) {
      const j1 = await r1.json()
      const px1 = deepPick(j1, [
        'price.regularMarketPrice.raw',
        'regularMarketPrice',
        'quoteResponse.result.0.regularMarketPrice',
        'regularMarketPrice.raw',
      ])
      if (isFinite(px1)) return px1
    }
  } catch {}

  // Fallback yh-finance summary
  const u2 = `https://${host}/stock/v2/get-summary?symbol=${encodeURIComponent(symbol)}&region=US`
  const r2 = await fetch(u2, { headers }); const j2 = await r2.json()
  const px2 = deepPick(j2, [
    'price.regularMarketPrice.raw',
    'financialData.currentPrice.raw',
    'price.preMarketPrice.raw',
  ])
  if (!isFinite(px2)) throw new Error('Yahoo: price not found')
  return px2
}
async function fetchDividend_YR(symbol, apiKey, host) {
  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }

  // Try yh-finance summary
  try {
    const u = `https://${host}/stock/v2/get-summary?symbol=${encodeURIComponent(symbol)}&region=US`
    const r = await fetch(u, { headers }); if (r.ok) {
      const j = await r.json()
      const dps = deepPick(j, ['summaryDetail.dividendRate.raw', 'defaultKeyStatistics.lastDividendValue.raw'])
      const yld = deepPick(j, ['summaryDetail.dividendYield.raw'])
      if (dps != null || yld != null) return { dpsAnnual: dps, dividendYield: yld, payoutFreq: 4 }
    }
  } catch {}

  // Try finance15 style
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

async function fetchPrice(symbol, provider, apiKey, host) {
  if (provider === 'Finnhub') return fetchPrice_FH(symbol, apiKey)
  if (provider === 'YahooRapidAPI') return fetchPrice_YR(symbol, apiKey, host)
  return fetchPrice_AV(symbol, apiKey)
}
async function fetchDividend(symbol, provider, apiKey, host) {
  if (provider === 'Finnhub') return fetchDividend_FH(symbol, apiKey)
  if (provider === 'YahooRapidAPI') return fetchDividend_YR(symbol, apiKey, host)
  return fetchDividend_AV(symbol, apiKey)
}

/* -----------------------------
   Color helpers for allocation
----------------------------- */
function colorForIndex(i) {
  const hue = (i * 63) % 360
  return `hsl(${hue} 70% 45%)`
}

/* -----------------------------
   Investments main component
----------------------------- */
export default function Investments() {
  const { data, setData } = useStore()
  const holdings = data.investments || []
  const provider = data?.settings?.marketData?.provider || 'AlphaVantage'
  const apiKey   = data?.settings?.marketData?.apiKey || ''
  const host     = data?.settings?.marketData?.host || ''

  // Add form state
  const [symbol, setSymbol] = useState('')
  const [units, setUnits] = useState('')
  const [price, setPrice] = useState('')

  const [loading, setLoading] = useState(false)
  const [fetchNote, setFetchNote] = useState('')

  const add = (e) => {
    if (e?.preventDefault) e.preventDefault()
    const s = symbol.trim().toUpperCase()
    const u = parseNum(units)
    const p = price === '' ? undefined : parseNum(price)
    if (!s || !isFinite(u) || u <= 0) { alert('Enter a symbol and a positive number of units.'); return }
    setData(prev => ({
      ...prev,
      investments: [
        ...(prev.investments || []),
        { id: Math.random().toString(36).slice(2) + Date.now().toString(36), symbol: s, units: u, price: p }
      ]
    }))
    setSymbol(''); setUnits(''); setPrice('')
  }

  const remove = (id) => {
    setData(prev => ({ ...prev, investments: (prev.investments || []).filter(h => h.id !== id) }))
  }
  const updateHolding = (id, fields) => {
    setData(prev => ({
      ...prev,
      investments: (prev.investments || []).map(h => h.id === id ? { ...h, ...fields } : h)
    }))
  }

  const allocation = useMemo(() => {
    const rows = holdings.map((h) => {
      const value = Number(h.units || 0) * Number(h.price || 0)
      return { name: h.symbol || '—', value }
    })
    const total = rows.reduce((a, r) => a + r.value, 0)
    return { rows, total }
  }, [holdings])

  const totalValue = allocation.total
  const totalUnits = useMemo(() => holdings.reduce((a, h) => a + Number(h.units || 0), 0), [holdings])

  const guardProviderKeys = () => {
    if (provider === 'AlphaVantage' && !apiKey) { alert('AlphaVantage API key is missing (Settings → Market Data).'); return false }
    if (provider === 'Finnhub' && !apiKey) { alert('Finnhub API key is missing (Settings → Market Data).'); return false }
    if (provider === 'YahooRapidAPI' && (!apiKey || !host)) { alert('RapidAPI key or host missing (Settings → Market Data).'); return false }
    return true
  }

  const fetchAllPrices = async () => {
    if (!holdings.length) return
    if (!guardProviderKeys()) return

    setLoading(true); setFetchNote('Fetching latest prices & dividends…')
    try {
      const results = await Promise.allSettled(
        holdings.map(async (h) => {
          const out = { id: h.id }
          try { out.price = await fetchPrice(h.symbol, provider, apiKey, host) } catch {}
          try {
            const d = await fetchDividend(h.symbol, provider, apiKey, host)
            if (d?.dpsAnnual != null && isFinite(d.dpsAnnual)) out.dpsAnnual = d.dpsAnnual
            if (d?.dividendYield != null && isFinite(d.dividendYield)) out.dividendYield = d.dividendYield
            if (d?.payoutFreq) out.payoutFreq = d.payoutFreq
          } catch {}
          return out
        })
      )

      const updates = {}
      for (const r of results) if (r.status === 'fulfilled') updates[r.value.id] = r.value

      setData(prev => ({
        ...prev,
        investments: (prev.investments || []).map(h => {
          const u = updates[h.id]
          return u ? { ...h, price: u.price ?? h.price, dpsAnnual: u.dpsAnnual ?? h.dpsAnnual, dividendYield: u.dividendYield ?? h.dividendYield, payoutFreq: u.payoutFreq ?? h.payoutFreq } : h
        }),
        settings: { ...prev.settings, lastPriceSyncAt: new Date().toISOString() }
      }))

      const ok = holdings.length
      setFetchNote(`Updated ${ok} holding${ok === 1 ? '' : 's'} (price + dividends when available).`)
    } finally {
      setLoading(false)
      setTimeout(() => setFetchNote(''), 3500)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Investments</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Track positions, auto-fill dividends, and plan DRIP goals.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Total Value</div>
            <div className="mt-1 text-xl font-semibold">{currency(totalValue)}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{totalUnits.toLocaleString()} total units</div>
          </div>
        </div>
      </div>

      {/* Two-column layout: wide left, sidebar right */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT / WIDE column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add holding */}
          <form onSubmit={add} className="card grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="label">Symbol</label>
              <input className="input w-full" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} placeholder="KO" />
              <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">e.g., KO (Coca-Cola), ENB (Enbridge)</p>
            </div>
            <div>
              <label className="label">Units</label>
              <input className="input w-full" type="number" step="0.0001" min="0" value={units} onChange={e=>setUnits(e.target.value)} placeholder="10" />
            </div>
            <div>
              <label className="label">Price (optional)</label>
              <input className="input w-full" type="number" step="0.01" min="0" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn btn-primary"><Plus className="w-4 h-4" /> Add Holding</button>
            </div>
          </form>

          {/* Holdings table */}
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Holdings</div>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={fetchAllPrices} disabled={loading}>
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Fetch Prices + Dividends
                </button>
                {fetchNote && <span className="text-xs text-neutral-500 dark:text-neutral-400">{fetchNote}</span>}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Units</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Value</th>
                  <th className="py-2 pr-3">DPS (annual)</th>
                  <th className="py-2 pr-3">Yield</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {holdings.length === 0 ? (
                  <tr><td className="py-6 text-center text-neutral-500 dark:text-neutral-400" colSpan={7}>No holdings yet</td></tr>
                ) : holdings.map(h => {
                  const value = Number(h.units || 0) * Number(h.price || 0)
                  return (
                    <tr key={h.id} className="border-t border-neutral-200/80 dark:border-white/10">
                      <td className="py-2 pr-3 font-medium">{h.symbol}</td>
                      <td className="py-2 pr-3">
                        <input
                          className="input w-28"
                          type="number" step="0.0001" min="0"
                          value={h.units}
                          onChange={e => updateHolding(h.id, { units: parseNum(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 opacity-60" />
                          <input
                            className="input w-28"
                            type="number" step="0.01" min="0"
                            value={h.price ?? ''}
                            onChange={e => updateHolding(h.id, { price: e.target.value === '' ? undefined : parseNum(e.target.value) })}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-3">{isFinite(value) ? currency(value) : '—'}</td>
                      <td className="py-2 pr-3">
                        <input
                          className="input w-28"
                          type="number" step="0.0001" min="0"
                          value={h.dpsAnnual ?? ''}
                          onChange={e => updateHolding(h.id, { dpsAnnual: e.target.value === '' ? undefined : parseNum(e.target.value) })}
                          placeholder="auto"
                          title="Annual dividend per share"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {h.dividendYield != null ? `${(Number(h.dividendYield) * 100).toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <button className="btn hover:text-red-600" onClick={() => remove(h.id)} title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Dividend DRIP Planner in the wide column */}
          <DividendPlanner />
        </div>

        {/* RIGHT / SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card h-[340px]">
            <div className="font-semibold mb-2">Allocation</div>
            {allocation.rows.length === 0 ? (
              <div className="text-sm text-neutral-500 dark:text-neutral-400">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation.rows} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                    {allocation.rows.map((_, i) => (
                      <Cell key={i} fill={colorForIndex(i)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [currency(v), n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card text-xs text-neutral-600 dark:text-neutral-300">
            <div className="font-medium mb-1">Market Data</div>
            <div>Provider: <span className="font-semibold">{provider}</span></div>
            {data?.settings?.lastPriceSyncAt && (
              <div>Last sync: {new Date(data.settings.lastPriceSyncAt).toLocaleString()}</div>
            )}
            <div className="mt-2">
              Tip: Set keys in <span className="font-semibold">Settings → Market Data</span>. “Fetch Prices + Dividends” fills DPS automatically.
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
