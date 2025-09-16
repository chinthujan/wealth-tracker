import React, { useEffect, useMemo } from 'react'
import { useStore } from '../state/store'
import { currency } from '../lib/utils'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'

function Stat({ label, value, tone = 'neutral' }) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
  : tone === 'negative' ? 'text-red-600 dark:text-red-400'
  : 'text-neutral-900 dark:text-neutral-100'
  return (
    <div className="card">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}

export default function NetWorth() {
  const { data, setData } = useStore()

  const debts      = data?.debts || []
  const savingsArr = data?.savings || data?.savingsAccounts || []
  const holdings   = data?.investments || []
  const assetsArr  = data?.assets || []
  const history    = data?.netWorthHistory || []

  const totals = useMemo(() => {
    const liabilities = debts.reduce((a, d) => a + Math.max(0, Number(d.amount || 0) - Number(d.paid || 0)), 0)
    const savings     = (Array.isArray(savingsArr) ? savingsArr : []).reduce((a, s) => a + Number(s.balance || s.amount || 0), 0)
    const investments = holdings.reduce((a, h) => a + (Number(h.units || 0) * Number(h.price || 0)), 0)
    const assets      = assetsArr.reduce((a, it) => a + Number(it.value || 0), 0)
    const monthlyDiv  = holdings.reduce((a, h) => a + ((Number(h.units || 0) * Number(h.dpsAnnual || 0)) / 12), 0)
    const netWorth    = assets + savings + investments - liabilities
    return { liabilities, savings, investments, assets, monthlyDiv, netWorth }
  }, [debts, savingsArr, holdings, assetsArr])

  // Snapshot net worth daily (for trend)
  useEffect(() => {
    const today = new Date().toISOString().slice(0,10)
    const last  = history[history.length - 1]
    const value = totals.netWorth
    if (!last || last.date !== today || last.value !== value) {
      const next = [...history, { date: today, value }]
      // keep last 365 entries
      while (next.length > 365) next.shift()
      setData(prev => ({ ...prev, netWorthHistory: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.netWorth])

  const netTone = totals.netWorth > 0 ? 'positive' : totals.netWorth < 0 ? 'negative' : 'neutral'

  const trendData = (history.length ? history : [{ date: new Date().toISOString().slice(0,10), value: totals.netWorth }])
    .map(x => ({ ...x, label: x.date.slice(5) })) // MM-DD labels

  const comp = [
    { name: 'Assets',       value: totals.assets },
    { name: 'Investments',  value: totals.investments },
    { name: 'Liabilities',  value: totals.liabilities },
  ].filter(x => x.value > 0)

  const colors = {
    Assets: 'hsl(160 84% 39%)',
    Investments: 'hsl(217 91% 60%)',
    Liabilities: 'hsl(0 84% 60%)',
  }

  return (
    <div className="space-y-4">
      {/* Keep your top row (Focus/Next Due/Achievements) as-is above this component in the page layout.
          Below is the ONLY summary row we render. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Assets"                 value={currency(totals.assets)} />
        <Stat label="Liabilities"            value={currency(totals.liabilities)} />
        <Stat label="Investments"            value={currency(totals.investments)} />
        <Stat label="Monthly Passive Income" value={currency(totals.monthlyDiv)} />
        <Stat label="Net Worth"              value={currency(totals.netWorth)} tone={netTone} />
      </div>

      {/* Insight panels */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Net worth trend */}
        <div className="card lg:col-span-2 h-[280px]">
          <div className="font-semibold mb-2">Net Worth Trend</div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ left: 6, right: 6, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(152 60% 45%)" stopOpacity={0.35}/>
                  <stop offset="100%" stopColor="hsl(152 60% 45%)" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${Math.round(v).toLocaleString()}`} width={60}/>
              <Tooltip formatter={(v) => currency(v)} labelFormatter={(l)=>`Date: ${l}`} />
              <Area type="monotone" dataKey="value" stroke="hsl(152 60% 45%)" fill="url(#nwFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Composition */}
        <div className="card">
          <div className="font-semibold mb-2">Composition</div>
          {comp.length === 0 ? (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Add data to see a breakdown.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={comp} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                  {comp.map((s, i) => (<Cell key={i} fill={colors[s.name] || 'hsl(220 10% 60%)'} />))}
                </Pie>
                <Tooltip formatter={(v, n) => [currency(v), n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Optional quick insights */}
      <div className="card text-sm text-neutral-600 dark:text-neutral-300">
        <div className="font-medium mb-1">Insights</div>
        <ul className="list-disc pl-5 space-y-1">
          {totals.liabilities === 0 && <li>You are currently <b>debt-free</b>. 🎉</li>}
          {totals.investments > totals.assets && <li>Investments make up the majority of your net worth.</li>}
          {totals.monthlyDiv > 0 && <li>Estimated monthly passive income: <b>{currency(totals.monthlyDiv)}</b>.</li>}
          {totals.liabilities > 0 && totals.assets + totals.investments > 0 && (
            <li>Debt-to-assets ratio: <b>{((totals.liabilities / (totals.assets + totals.investments)) * 100).toFixed(1)}%</b>.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
