import React, { useEffect, useMemo } from 'react'
import { useStore } from '../state/store'
import { currency } from '../lib/utils'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts'

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

  // snapshot net worth daily for trend
  useEffect(() => {
    const today = new Date().toISOString().slice(0,10)
    const last  = history[history.length - 1]
    const value = totals.netWorth
    if (!last || last.date !== today || last.value !== value) {
      const next = [...history, { date: today, value }]
      while (next.length > 365) next.shift()
      setData(prev => ({ ...prev, netWorthHistory: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.netWorth])

  const trendData = (history.length ? history : [{ date: new Date().toISOString().slice(0,10), value: totals.netWorth }])
    .map(x => ({ ...x, label: x.date.slice(5) })) // MM-DD

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
      {/* NOTE: We intentionally do NOT render any stat row here.
          Your top row of cards (Assets/Liabilities/Net Worth/Investment Value)
          comes from the surrounding page layout and should remain.
          The old second/duplicate row has been removed. */}

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
              <YAxis tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`} width={60}/>
              <Tooltip formatter={(v) => currency(v)} labelFormatter={(l)=>`Date: ${l}`} />
              <Area type="monotone" dataKey="value" stroke="hsl(152 60% 45%)" fill="url(#nwFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Composition + quick facts */}
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
          <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 space-y-1">
            <div><span className="text-neutral-500">Monthly passive income:</span> <b>{currency(totals.monthlyDiv)}</b></div>
            <div><span className="text-neutral-500">Debt-to-assets:</span> <b>{(totals.assets + totals.investments > 0 ? (totals.liabilities / (totals.assets + totals.investments)) * 100 : 0).toFixed(1)}%</b></div>
          </div>
        </div>
      </section>
    </div>
  )
}
