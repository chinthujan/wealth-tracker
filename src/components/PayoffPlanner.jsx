import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency, todayISO } from '../lib/utils'
import { compareStrategies } from '../lib/payoff'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export default function PayoffPlanner() {
  const { data } = useStore()
  const [budget, setBudget] = useState('500')
  const [extra, setExtra] = useState(0)
  const [strategy, setStrategy] = useState('snowball')

  const canSim = data.debts.some(d => (d.amount - (d.paid||0)) > 0)

  const sim = useMemo(() => {
    const monthlyBudget = Number(budget||0)
    if (!canSim || monthlyBudget<=0) return null
    return compareStrategies(data.debts, monthlyBudget + Number(extra||0))
  }, [data.debts, budget])

  if (!canSim) return null

  const active = sim?.[strategy.slice(0,4)==='snow'?'snow':'aval']

  const chartData = (active?.snapshots || []).map(s => ({ name: `M${s.month}`, Balance: Number(s.totalBalance.toFixed(2)) }))

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold">Payoff Planner</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Simulate **Snowball** vs **Avalanche** using your current balances and APRs.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">Monthly Budget</label>
            <input type="number" min="0" step="1" className="input w-40" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="500"/>
          </div>
          <div>
            <label className="label">Strategy</label>
            <select className="input w-40" value={strategy} onChange={e=>setStrategy(e.target.value)}>
              <option value="snowball">Snowball (smallest balance first)</option>
              <option value="avalanche">Avalanche (highest APR first)</option>
            </select>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">What-if Extra / mo</label>
            <input type="number" min="0" step="1" className="input w-40" value={extra} onChange={e=>setExtra(e.target.value)} placeholder="0"/>
          </div>
          {sim?.snow?.ok && sim?.aval?.ok && (
            <div className="text-sm text-neutral-600 dark:text-neutral-300 mt-6">
              With extra, Snowball saves ~{Math.max(0, (sim.snow.totalInterest)).toLocaleString(undefined,{maximumFractionDigits:0})} interest; Avalanche saves ~{Math.max(0,(sim.aval.totalInterest)).toLocaleString(undefined,{maximumFractionDigits:0})}.
            </div>
          )}
        </div>
      </div>

      {active && active.ok ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="card">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Debt-free in</div>
              <div className="mt-1 text-xl font-semibold">{active.months} months</div>
            </div>
            <div className="card">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Projected interest</div>
              <div className="mt-1 text-xl font-semibold">{currency(active.totalInterest)}</div>
            </div>
            <div className="card">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Payoff date</div>
              <div className="mt-1 text-xl font-semibold">{new Date(active.payoffDate).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Balance" strokeWidth={2} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {sim?.snow?.ok && sim?.aval?.ok && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="card">
                <h4 className="font-semibold mb-1">Snowball</h4>
                <p className="text-sm">Months: {sim.snow.months} • Interest: {currency(sim.snow.totalInterest)} • Payoff: {new Date(sim.snow.payoffDate).toLocaleDateString()}</p>
              </div>
              <div className="card">
                <h4 className="font-semibold mb-1">Avalanche</h4>
                <p className="text-sm">Months: {sim.aval.months} • Interest: {currency(sim.aval.totalInterest)} • Payoff: {new Date(sim.aval.payoffDate).toLocaleDateString()}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">Estimates assume monthly compounding and apply your budget each month after covering any minimum payments.</p>
        </>
      ) : active && !active.ok ? (
        <div className="text-sm text-red-600">Simulation error: {active.error}</div>
      ) : null}
    </div>
  )
}
