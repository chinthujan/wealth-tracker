import React, { useMemo, useState } from 'react'
import { Plus, X, GripVertical, CalendarDays } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../state/store'
import { clamp, currency, parseNum } from '../lib/utils'

function GoalItem({ goal, idx, onDelete, onContrib }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: goal.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const remaining = Math.max(0, goal.target - (goal.current ?? 0))
  const pct = goal.target === 0 ? 0 : Math.round(((goal.current ?? 0) / goal.target) * 100)
  const isCompleted = remaining <= 0 && goal.target > 0

  return (
    <div ref={setNodeRef} style={style} className={`card ${isDragging?'opacity-80':''}`}>
      <div className="flex items-start gap-3">
        <button className="shrink-0 mt-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} title="Drag to reorder">
          <GripVertical className="w-5 h-5 text-neutral-400"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold truncate">{goal.name}</h3>
            <div className="text-sm text-neutral-500">Target: <span className="font-medium text-neutral-700 dark:text-neutral-200">{currency(goal.target)}</span></div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{currency(goal.current ?? 0)} saved</span>
              <span>{isCompleted ? '100%' : `${pct}%`}</span>
            </div>
            <div className="mt-1 h-3 w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
              <div className={`h-full ${isCompleted?'bg-brand-700':'bg-brand-600'}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-neutral-500">{remaining > 0 ? <span>{currency(remaining)} remaining</span> : <span className="text-brand-600 dark:text-brand-400 font-medium">🎉 Goal reached!</span>}</div>
          </div>
          {!isCompleted && <AddContributionRow max={remaining} onSubmit={(amt) => onContrib(goal.id, amt)} />}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-neutral-500">
            <div className="rounded-xl border p-2 dark:border-white/10">
              <div className="flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Target Date</div>
              <div className="mt-1 font-medium text-neutral-700 dark:text-neutral-200">{goal.targetDate || '—'}</div>
            </div>
            <div className="rounded-xl border p-2 dark:border-white/10">
              <div className="text-xs">APY</div>
              <div className="mt-1 font-medium text-neutral-700 dark:text-neutral-200">{goal.apy ? `${goal.apy}%` : '—'}</div>
            </div>
          </div>
        </div>
        <button onClick={() => onDelete(goal.id)} className="opacity-60 hover:opacity-100 hover:text-red-600" title="Delete"><X className="w-5 h-5"/></button>
      </div>
    </div>
  )
}

function AddContributionRow({ onSubmit, max }) {
  const [val, setVal] = useState('')
  const handle = () => {
    const n = parseNum(val); if (n <= 0) return
    onSubmit(Math.min(n, max)); setVal('')
  }
  return (
    <div className="mt-3 flex items-center gap-2">
      <input type="number" step="0.01" min="0" placeholder="Add contribution" value={val} onChange={e=>setVal(e.target.value)} className="input w-48"/>
      <button onClick={handle} className="btn btn-green"><Plus className="w-4 h-4"/> Add</button>
      <span className="text-xs text-neutral-400">Max {currency(max)}</span>
    </div>
  )
}

export default function SavingsTracker() {
  const store = useStore()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('')
  const [apy, setApy] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [recurringAmount, setRecurringAmount] = useState('')
  const [recurringFreq, setRecurringFreq] = useState('monthly')
  const [recurringStart, setRecurringStart] = useState('')
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const add = (e) => {
    e?.preventDefault?.()
    if (!name.trim() || parseNum(target) <= 0) return
    store.addGoal({ name, target, current, apy, targetDate, recurring: recurringEnabled ? { amount: recurringAmount, freq: recurringFreq, startDate: recurringStart || new Date().toISOString().slice(0,10), enabled: true } : null })
    setName(''); setTarget(''); setCurrent(''); setApy(''); setTargetDate(''); setRecurringAmount(''); setRecurringStart(''); setRecurringEnabled(false)
  }

  const goals = store.data.savings

  const totals = useMemo(() => {
    const targetSum = goals.reduce((a,g)=>a+g.target,0)
    const saved = goals.reduce((a,g)=>a+(g.current??0),0)
    const pct = targetSum === 0 ? 0 : Math.round((saved/targetSum)*100)
    return { targetSum, saved, pct }
  }, [goals])

  const onDragEnd = (e) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    const oldIndex = goals.findIndex(g => g.id === active.id)
    const newIndex = goals.findIndex(g => g.id === over.id)
    store.reorderGoals(oldIndex, newIndex)
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Savings</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Create goals, contribute, and track progress.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Overall</div>
            <div className="mt-1 h-3 w-64 max-w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
              <div className="h-full bg-brand-600" style={{ width: `${totals.pct}%` }} />
            </div>
            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{currency(totals.saved)} saved of {currency(totals.targetSum)} ({totals.pct}%)</div>
          </div>
        </div>
      </div>

      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52">
          <label className="label">Goal name</label>
          <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Emergency Fund"/>
        </div>
        <div>
          <label className="label">Target Amount</label>
          <input type="number" step="0.01" min="0" className="input w-40" value={target} onChange={e=>setTarget(e.target.value)} placeholder="5000"/>
        </div>
        <div>
          <label className="label">Current (optional)</label>
          <input type="number" step="0.01" min="0" className="input w-40" value={current} onChange={e=>setCurrent(e.target.value)} placeholder="1000"/>
        </div>
        <div>
          <label className="label">APY % (optional)</label>
          <input type="number" step="0.01" min="0" className="input w-32" value={apy} onChange={e=>setApy(e.target.value)} placeholder="4.5"/>
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
          <button type="submit" className="btn btn-primary"><Plus className="w-4 h-4"/> Add Goal</button>
        </div>
      </form>

      <section className="space-y-3">
        {goals.length === 0 ? (
          <div className="card text-center text-neutral-600 dark:text-neutral-300 p-10">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black grid place-items-center mb-3"><Plus className="w-6 h-6"/></div>
            <p className="font-medium mb-1">No goals yet</p>
            <p className="text-sm">Add your first savings goal above to start tracking.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={goals.map(g=>g.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {goals.map((goal, idx) => (
                  <GoalItem key={goal.id} goal={goal} idx={idx} onDelete={store.deleteGoal} onContrib={(id, amt) => store.contribute(id, amt)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  )
}
