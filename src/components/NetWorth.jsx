import React, { useMemo } from 'react'
import { useStore } from '../state/store'
import { currency } from '../lib/utils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export default function NetWorth() {
  const { totals, data } = useStore()

  const chartData = useMemo(() => {
    return data.history.map(h => ({ date: h.date, Assets: h.assets, Liabilities: h.liabilities, 'Net Worth': h.netWorth }))
  }, [data.history])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Assets" value={totals.assets}/>
        <Stat label="Liabilities" value={totals.liabilities}/>
        <Stat label="Net Worth" value={totals.netWorth} highlight/>
        <Stat label="Investments" value={totals.investmentValue}/>
      </div>

      <div className="card h-[380px]">
        <h3 className="font-semibold mb-2">Net Worth Over Time</h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopOpacity={0.8}/>
                  <stop offset="95%" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="Assets" strokeWidth={2} fillOpacity={0.2} />
              <Area type="monotone" dataKey="Liabilities" strokeWidth={2} fillOpacity={0.2} />
              <Area type="monotone" dataKey="Net Worth" strokeWidth={2} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight=false }) {
  return (
    <div className={`card ${highlight?'ring-1 ring-brand-600/30':''}`}>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-xl font-semibold">{currency(value)}</div>
    </div>
  )
}
