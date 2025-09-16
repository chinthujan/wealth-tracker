import React, { useMemo, useState, useEffect } from 'react'
import Header from './components/Header'
import DebtTracker from './components/DebtTracker'
import SavingsTracker from './components/SavingsTracker'
import Investments from './components/Investments'
import Assets from './components/Assets'
import NetWorth from './components/NetWorth'
import Settings from './components/Settings'
import { Provider, useStore } from './state/store'
import { currency } from './lib/utils'
import * as Recurrence from './lib/recurrence.js'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

function Shell() {
  // v2: default landing tab is Net Worth
  const [tab, setTab] = useState('Net Worth')
  const { totals, applyRecurrences } = useStore()

  // apply missed recurrences on load
  useEffect(() => { applyRecurrences?.() }, [])

  // v2: change quick-add hotkey to "\" and ignore when typing
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      const typing = ['input', 'textarea', 'select'].includes(tag) || document.activeElement?.isContentEditable
      if (typing) return
      if (e.key === '\\' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        window.dispatchEvent(new CustomEvent('open-quick-add'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen text-neutral-900 dark:text-neutral-100">
      <Header tab={tab} setTab={setTab}/>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* v2: Show cross-app overview ONLY on Net Worth */}
        {tab === 'Net Worth' && (
          <>
            <Insights />
            <Overview />
            <Reminders />
            <NetWorth />
          </>
        )}
        {tab === 'Debt' && <DebtTracker />}
        {tab === 'Savings' && <SavingsTracker />}
        {tab === 'Investments' && <Investments />}
        {tab === 'Assets' && <Assets />}
        {tab === 'Settings' && <Settings />}
        <div className="py-10" />
      </main>
    </div>
  )
}

/* --- v2: keep these but they now render only on Net Worth --- */
function Reminders() {
  const { data } = useStore()
  const items = []
  const today = new Date()
  const next30 = new Date(); next30.setDate(next30.getDate()+30)
  const { nextDueFrom, toISODate } = Recurrence
  for (const d of data.debts) {
    const r = d.recurring; if (!r || !r.enabled) continue
    const due = nextDueFrom(r.startDate, r.freq, today)
    if (due && due <= next30) items.push({ type:'Debt', name:d.name, amount:r.amount, date: toISODate(due) })
  }
  for (const g of data.savings) {
    const r = g.recurring; if (!r || !r.enabled) continue
    const due = nextDueFrom(r.startDate, r.freq, today)
    if (due && due <= next30) items.push({ type:'Savings', name:g.name, amount:r.amount, date: toISODate(due) })
  }
  items.sort((a,b)=>a.date.localeCompare(b.date))
  if (!items.length) return null
  return (
    <section className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Upcoming (30 days)</h3>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{items.length} due</span>
      </div>
      <div className="grid gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full border text-xs">{it.type}</span>
              <span className="font-medium">{it.name}</span>
            </div>
            <div className="text-right text-neutral-600 dark:text-neutral-300">
              <div>{new Date(it.date).toLocaleDateString()}</div>
              <div className="text-xs">{it.amount}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Insights() {
  const { data } = useStore()
  const highestAPR = [...data.debts].sort((a,b)=> (b.apr||0) - (a.apr||0))[0]
  const nextDue = (()=> {
    let soon = null
    for (const d of data.debts) {
      const r = d.recurring; if (!r || !r.enabled) continue
      const due = Recurrence.nextDueFrom(r.startDate, r.freq, new Date())
      if (!soon || (due && due < soon.date)) soon = { type:'Debt', name:d.name, date:due }
    }
    for (const g of data.savings) {
      const r = g.recurring; if (!r || !r.enabled) continue
      const due = Recurrence.nextDueFrom(r.startDate, r.freq, new Date())
      if (!soon || (due && due < soon.date)) soon = { type:'Savings', name:g.name, date:due }
    }
    return soon
  })()
  const achievements = (data.achievements||[]).slice(-4).reverse()
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="card">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">Focus Suggestion</div>
        <div className="mt-1 text-sm">{highestAPR ? <>Target <span className="font-semibold">{highestAPR.name}</span> next ({highestAPR.apr}% APR)</> : 'Add a debt to get suggestions'}</div>
      </div>
      <div className="card">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">Next Due</div>
        <div className="mt-1 text-sm">{nextDue ? <>{nextDue.type}: <span className="font-semibold">{nextDue.name}</span> on {nextDue.date.toLocaleDateString()}</> : 'No scheduled items'}</div>
      </div>
      <div className="card">
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Recent Achievements</div>
        {achievements.length ? achievements.map(a => <div key={a.id} className="text-sm">🏆 {a.text}</div>) : <div className="text-sm">No achievements yet</div>}
      </div>
    </section>
  )
}

function Overview() {
  const { totals } = useStore()
  const netClass =
    totals.netWorth < 0
      ? 'text-red-600'
      : totals.netWorth > 0
      ? 'text-green-600'
      : 'text-neutral-900 dark:text-neutral-100' // black in light, white in dark

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="card">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">Assets</div>
        <div className="mt-1 text-xl font-semibold">{currency(totals.assets)}</div>
      </div>
      <div className="card">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">Liabilities</div>
        <div className="mt-1 text-xl font-semibold">{currency(totals.liabilities)}</div>
      </div>
      <div className="card">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">Net Worth</div>
        <div className={`mt-1 text-xl font-semibold ${netClass}`}>{currency(totals.netWorth)}</div>
      </div>
      <div className="card">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">Investment Value</div>
        <div className="mt-1 text-xl font-semibold">{currency(totals.investmentValue)}</div>
      </div>
    </section>
  )
}


export default function App() {
  return (
    <Provider>
      <Shell />
    </Provider>
  )
}
