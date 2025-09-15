import React, { useMemo, useRef, useState } from 'react'
import { Plus, X, GripVertical, CalendarDays, BadgeDollarSign } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../state/store'
import { clamp, currency, parseNum } from '../lib/utils'
import confetti from 'canvas-confetti'

function DebtItem({ debt, index, onDelete, onPayment }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: debt.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const remaining = Math.max(0, debt.amount - (debt.paid ?? 0))
  const pct = debt.amount === 0 ? 0 : Math.round(((debt.paid ?? 0) / debt.amount) * 100)
  const isPaid = remaining <= 0 && debt.amount > 0

  return (
    <div ref={setNodeRef} style={style} className={`card ${isDragging?'opacity-80':''}`}>
      <div className="flex items-start gap-3">
        <button className="shrink-0 mt-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} title="Drag to reorder">
          <GripVertical className="w-5 h-5 text-neutral-400"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold truncate">{debt.name}</h3>
            <div className="text-sm text-neutral-500">Target: <span className="font-medium text-neutral-700 dark:text-neutral-200">{currency(debt.amount)}</span></div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{currency(debt.paid ?? 0)} paid</span>
              <span>{isPaid ? '100%' : `${pct}%`}</span>
            </div>
            <div className="mt-1 h-3 w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
              <div className={`h-full ${isPaid?'bg-brand-700':'bg-brand-600'}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-neutral-500">{remaining > 0 ? <span>{currency(remaining)} remaining</span> : <span className="text-brand-600 dark:text-brand-400 font-medium">🎉 Paid in full – amazing!</span>}</div>
          </div>
          {!isPaid && <AddPaymentRow max={remaining} onSubmit={(amt, note) => onPayment(debt.id, amt, note)} />}
          {/* Details */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-500">
            <div className="rounded-xl border p-2 dark:border-white/10">
              <div className="flex items-center gap-1"><BadgeDollarSign className="w-3 h-3"/> APR</div>
              <div className="mt-1 font-medium text-neutral-700 dark:text-neutral-200">{debt.apr ? `${debt.apr}%` : '—'}</div>
            </div>
            <div className="rounded-xl border p-2 dark:border-white/10">
              <div className="flex items-center gap-1"><BadgeDollarSign className="w-3 h-3"/> Min Payment</div>
              <div className="mt-1 font-medium text-neutral-700 dark:text-neutral-200">{debt.minPayment ? currency(debt.minPayment) : '—'}</div>
            </div>
            <div className="rounded-xl border p-2 dark:border-white/10">
              <div className="flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Target Date</div>
              <div className="mt-1 font-medium text-neutral-700 dark:text-neutral-200">{debt.targetDate || '—'}</div>
            </div>
          </div>
        </div>
        <button onClick={() => onDelete(debt.id)} className="opacity-60 hover:opacity-100 hover:text-red-600" title="Delete"><X className="w-5 h-5"/></button>
      </div>
    </div>
  )
}

function AddPaymentRow({ onSubmit, max }) {
  const [val, setVal] = useState('')
  const [note, setNote] = useState('')
  const inputRef = useRef(null)

  const handleAdd = () => {
    const n = parseNum(val)
    if (n <= 0) return
    const capped = Math.min(n, max)
    onSubmit(capped, note.trim())
    setVal(''); setNote(''); inputRef.current?.focus()
    try { confetti({ particleCount: 60, spread: 70, startVelocity: 35, origin:{y:.7} }) } catch {}
  }

  const onKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() }}

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="number" step="0.01" min="0" placeholder="Add a payment (e.g., 50)" value={val} onChange={e=>setVal(e.target.value)} onKeyDown={onKeyDown} className="input w-40"/>
      <input type="text" placeholder="Note (optional)" value={note} onChange={e=>setNote(e.target.value)} className="input flex-1 min-w-40"/>
      <button onClick={handleAdd} className="btn btn-green"><Plus className="w-4 h-4"/> Add Payment</button>
      <span className="text-xs text-neutral-400">Max {currency(max)}</span>
    </div>
  )
}

import PayoffPlanner from './PayoffPlanner'

export default function DebtTracker() {
  const store = useStore()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [apr, setApr] = useState('')
  const [minPayment, setMinPayment] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [recurringAmount, setRecurringAmount] = useState('')
  const [recurringFreq, setRecurringFreq] = useState('monthly')
  const [recurringStart, setRecurringStart] = useState('')
  const [recurringEnabled, setRecurringEnabled] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const add = (e) => {
    e?.preventDefault?.()
    if (!name.trim() || parseNum(amount) <= 0) return
    store.addDebt({ name, amount, apr, minPayment, targetDate, recurring: recurringEnabled ? { amount: recurringAmount, freq: recurringFreq, startDate: recurringStart || new Date().toISOString().slice(0,10), enabled: true } : null })
    setName(''); setAmount(''); setApr(''); setMinPayment(''); setTargetDate(''); setRecurringAmount(''); setRecurringStart(''); setRecurringEnabled(false)
  }

  const debts = store.data.debts

  const totals = useMemo(() => {
    const principal = debts.reduce((a,d)=>a+d.amount,0)
    const paid = debts.reduce((a,d)=>a+(d.paid??0),0)
    const remaining = Math.max(0, principal - paid)
    const pct = principal === 0 ? 0 : Math.round((paid/principal)*100)
    return { principal, paid, remaining, pct }
  }, [debts])

  const onDragEnd = (e) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    const oldIndex = debts.findIndex(d => d.id === active.id)
    const newIndex = debts.findIndex(d => d.id === over.id)
    store.reorderDebts(oldIndex, newIndex)
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Debt Tracker</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Track balances, log payments, and simulate payoff strategies.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Total Progress</div>
            <div className="mt-1 h-3 w-64 max-w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
              <div className="h-full bg-brand-600" style={{ width: `${totals.pct}%` }} />
            </div>
            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{currency(totals.paid)} / {currency(totals.principal)} ({totals.pct}%)</div>
          </div>
        </div>
      </div>

      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52">
          <label className="label">Debt name</label>
          <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., Student Loan A"/>
        </div>
        <div>
          <label className="label">Amount</label>
          <input type="number" step="0.01" min="0" className="input w-40" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="12000"/>
        </div>
        <div>
          <label className="label">APR % (optional)</label>
          <input type="number" step="0.01" min="0" className="input w-32" value={apr} onChange={e=>setApr(e.target.value)} placeholder="5.5"/>
        </div>
        <div>
          <label className="label">Min payment (optional)</label>
          <input type="number" step="0.01" min="0" className="input w-40" value={minPayment} onChange={e=>setMinPayment(e.target.value)} placeholder="150"/>
        </div>
        <div>
          <label className="label">Target date (optional)</label>
          <input type="date" className="input w-44" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/>
        </div>
        <div className="w-full h-px bg-neutral-200/80 dark:bg-white/10 my-1 md:hidden"></div>
        <div className="md:ml-auto flex items-end gap-3">
          <div className="hidden md:block mr-2 text-xs text-neutral-500 dark:text-neutral-400">Recurring (optional)</div>
          <label className="label md:hidden">Recurring (optional)</label>
          <input type="number" step="0.01" min="0" className="input w-36" value={recurringAmount} onChange={e=>setRecurringAmount(e.target.value)} placeholder="Amt"/>
          <select className="input w-36" value={recurringFreq} onChange={e=>setRecurringFreq(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input type="date" className="input w-44" value={recurringStart} onChange={e=>setRecurringStart(e.target.value)} placeholder="Start"/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recurringEnabled} onChange={e=>setRecurringEnabled(e.target.checked)} /> Enable</label>
          <button type="submit" className="btn btn-primary"><Plus className="w-4 h-4"/> Add Debt</button>
        </div>
      </form>

      <section className="space-y-3">
        {debts.length === 0 ? (
          <div className="card text-center text-neutral-600 dark:text-neutral-300 p-10">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black grid place-items-center mb-3"><Plus className="w-6 h-6"/></div>
            <p className="font-medium mb-1">No debts yet</p>
            <p className="text-sm">Add your first debt above to start tracking. Reorder items by dragging the handle.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={debts.map(d=>d.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {debts.map((debt, idx) => (
                  <DebtItem key={debt.id} debt={debt} index={idx} onDelete={store.deleteDebt} onPayment={(id, amt, note) => store.addDebtPayment(id, amt, note)}/>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <PayoffPlanner />
    </div>
  )
}
