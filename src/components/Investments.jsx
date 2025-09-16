import React, { useMemo, useState } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import DividendPlanner from './DividendPlanner'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function HoldingItem({ h }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: h.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const value = (h.units ?? 0) * (h.price ?? 0)
  const gain = value - (h.totalCost ?? 0)
  const roi = (h.totalCost ?? 0) > 0 ? Math.round((gain / h.totalCost) * 100) : 0
  return (
    <div ref={setNodeRef} style={style} className={`card ${isDragging?'opacity-80':''}`}>
      <div className="flex items-start gap-3">
        <button className="shrink-0 mt-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} title="Drag to reorder">
          <GripVertical className="w-5 h-5 text-neutral-400"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold truncate">{h.name} {h.symbol? <span className="text-xs text-neutral-500">({h.symbol})</span> : null}</h3>
            <div className="text-sm text-neutral-500">Value: <span className="font-medium text-neutral-700 dark:text-neutral-200">{currency(value)}</span></div>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <div className="rounded-xl border p-2 dark:border-white/10"><div className="text-[11px]">Units</div><div className="font-medium">{h.units ?? 0}</div></div>
            <div className="rounded-xl border p-2 dark:border-white/10"><div className="text-[11px]">Price</div><div className="font-medium">{currency(h.price ?? 0)}</div></div>
            <div className="rounded-xl border p-2 dark:border-white/10"><div className="text-[11px]">Cost</div><div className="font-medium">{currency(h.totalCost ?? 0)}</div></div>
            <div className="rounded-xl border p-2 dark:border-white/10"><div className="text-[11px]">Gain</div><div className={`font-medium ${gain>=0?'text-brand-600 dark:text-brand-400':'text-red-600'}`}>{currency(gain)} ({roi}%)</div></div>
          </div>
        </div>
        <button onClick={() => window.dispatchEvent(new CustomEvent('delete-holding',{ detail:h.id }))} className="opacity-60 hover:opacity-100 hover:text-red-600" title="Delete"><X className="w-5 h-5"/></button>
      </div>
    </div>
  )
}

export default function Investments() {
  const store = useStore()
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [units, setUnits] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const holdings = store.data.investments
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [fetchMsg, setFetchMsg] = useState('')

  const totals = useMemo(() => {
    const value = holdings.reduce((a,h)=>a+(h.units*(h.price??0)),0)
    const cost = holdings.reduce((a,h)=>a+(h.totalCost??0),0)
    const gain = value - cost
    const roi = cost>0 ? Math.round((gain/cost)*100) : 0
    return { value, cost, gain, roi }
  }, [holdings])

  const add = (e) => {
    e?.preventDefault?.()
    if (!name.trim() && !symbol.trim()) return
    store.addHolding({ name, symbol, account, units, price, totalCost: cost })
    setSymbol(''); setName(''); setAccount(''); setUnits(''); setPrice(''); setCost('')
  }

  const onDragEnd = (e) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    const oldIndex = holdings.findIndex(g => g.id === active.id)
    const newIndex = holdings.findIndex(g => g.id === over.id)
    store.reorderHoldings(oldIndex, newIndex)
  }

  // pie data
  const pieData = holdings.map(h => ({ name: h.symbol || h.name, value: (h.units||0) * (h.price||0) }))

  // listen delete event
  React.useEffect(() => {
    const onDel = (e) => store.deleteHolding(e.detail)
    window.addEventListener('delete-holding', onDel)
    return () => window.removeEventListener('delete-holding', onDel)
  }, [])

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Investments</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Track holdings and performance (manual prices).</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Portfolio Value</div>
            <div className="mt-1 text-xl font-semibold">{currency(totals.value)}</div>
            <div className={`text-sm ${totals.gain>=0?'text-brand-600 dark:text-brand-400':'text-red-600'}`}>{currency(totals.gain)} ({totals.roi}%)</div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={loadingFetch} onClick={async()=>{ setFetchMsg(''); setLoadingFetch(true); try{ const res = await store.fetchPrices(); setFetchMsg(`Updated: ${res.filter(r=>r.price).length} • Errors: ${res.filter(r=>r.error).length}`) }catch(e){ setFetchMsg(e.message) } finally { setLoadingFetch(false) } }} className="btn">{loadingFetch?'Fetching...':'Fetch Prices'}</button>
            {fetchMsg && <span className="text-xs text-neutral-500 dark:text-neutral-400">{fetchMsg}</span>}
          </div>
        </div>
      </div>

      <form onSubmit={add} className="card grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        <div className="col-span-2">
          <label className="label">Name</label>
          <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="S&P 500 ETF"/>
        </div>
        <div>
          <label className="label">Symbol</label>
          <input className="input w-full" value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="VOO"/>
        </div>
        <div>
          <label className="label">Account</label>
          <input className="input w-full" value={account} onChange={e=>setAccount(e.target.value)} placeholder="TFSA / 401k"/>
        </div>
        <div>
          <label className="label">Units</label>
          <input type="number" step="0.0001" min="0" className="input w-full" value={units} onChange={e=>setUnits(e.target.value)} placeholder="10"/>
        </div>
        <div>
          <label className="label">Price</label>
          <input type="number" step="0.01" min="0" className="input w-full" value={price} onChange={e=>setPrice(e.target.value)} placeholder="450"/>
        </div>
        <div>
          <label className="label">Total Cost</label>
          <input type="number" step="0.01" min="0" className="input w-full" value={cost} onChange={e=>setCost(e.target.value)} placeholder="4000"/>
        </div>
        <button type="submit" className="btn btn-primary col-span-2"><Plus className="w-4 h-4"/> Add Holding</button>
      </form>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={holdings.map(h=>h.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {holdings.map((h) => (<HoldingItem key={h.id} h={h}/>))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="card h-[360px]">
          <h3 className="font-semibold mb-2">Allocation</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label />
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <DividendPlanner />
          </div>
        </div>
      </section>
    </div>
  )
}
