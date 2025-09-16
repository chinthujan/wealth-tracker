import React, { useMemo, useRef, useState } from 'react'
import {
  Plus, X, GripVertical, ChevronDown, CalendarDays, BadgeDollarSign,
  CheckCircle2, PencilLine, Save, XCircle, Search, Filter, ArrowUpDown
} from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../state/store'
import { clamp, currency, parseNum } from '../lib/utils'
import confetti from 'canvas-confetti'
import PayoffPlanner from './PayoffPlanner'

/* =========================
   Sortable list item
========================= */
function DebtItem({
  debt,
  canDrag,
  onDelete,
  onPayment,
  onMarkPaid,
  onEditSave
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: debt.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const remaining = Math.max(0, (debt.amount || 0) - (debt.paid ?? 0))
  const pct = (debt.amount || 0) === 0 ? 0 : Math.round(((debt.paid ?? 0) / debt.amount) * 100)
  const isPaid = remaining <= 0 && (debt.amount || 0) > 0

  const [showHistory, setShowHistory] = useState(false)
  const [edit, setEdit] = useState(false)
  const [editName, setEditName] = useState(debt.name || '')
  const [editAmount, setEditAmount] = useState(String(debt.amount ?? ''))
  const [editApr, setEditApr] = useState(String(debt.apr ?? ''))
  const [editTarget, setEditTarget] = useState(debt.targetDate || '')

  const saveEdit = () => {
    const updates = {
      name: editName.trim() || debt.name,
      amount: parseNum(editAmount),
      apr: parseNum(editApr),
      targetDate: editTarget || ''
    }
    onEditSave(debt.id, updates)
    setEdit(false)
  }

  return (
    <div ref={setNodeRef} style={style} className={`card ${isDragging ? 'opacity-80' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          className={`shrink-0 mt-1 ${canDrag ? 'cursor-grab active:cursor-grabbing opacity-100' : 'cursor-not-allowed opacity-40'}`}
          title={canDrag ? 'Drag to reorder' : 'Reordering disabled in this view'}
          {...(canDrag ? { ...attributes, ...listeners } : {})}
        >
          <GripVertical className="w-5 h-5 text-neutral-400" />
        </button>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            {!edit ? (
              <h3 className="font-semibold truncate">{debt.name}</h3>
            ) : (
              <input className="input w-full" value={editName} onChange={e=>setEditName(e.target.value)} />
            )}

            <div className="text-sm text-neutral-500">
              Target:{' '}
              {!edit ? (
                <span className="font-medium text-neutral-700 dark:text-neutral-200">{currency(debt.amount)}</span>
              ) : (
                <input type="number" step="0.01" min="0" className="input w-40" value={editAmount} onChange={e=>setEditAmount(e.target.value)} />
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{currency(debt.paid ?? 0)} paid</span>
              <span>{isPaid ? '100%' : `${pct}%`}</span>
            </div>
            <div className="mt-1 h-3 w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
              <div className={`h-full ${isPaid ? 'bg-brand-700' : 'bg-brand-600'}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {remaining > 0 ? (
                <span>{currency(remaining)} remaining</span>
              ) : (
                <span className="text-brand-600 dark:text-brand-400 font-medium">🎉 Paid in full — amazing!</span>
              )}
            </div>
          </div>

          {/* Add payment */}
          {!isPaid && (
            <AddPaymentRow
              max={remaining}
              onSubmit={(amt, note) => onPayment(debt.id, amt, note)}
            />
          )}

          {/* Details grid */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-neutral-500">
            <div className="rounded-xl border p-2 dark:border-white/10">
              <div className="flex items-center gap-1"><BadgeDollarSign className="w-3 h-3" /> APR</div>
              <div className="mt-1 font-medium text-neutral-700 dark:text-neutral-200">
                {!edit ? (debt.apr ? `${debt.apr}%` : '—') : (
                  <input type="number" step="0.01" min="0" className="input w-24" value={editApr} onChange={e=>setEditApr(e.target.value)} />
                )}
              </div>
            </div>
            <div className="rounded-xl border p-2 dark:border-white/10">
              <div className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Target Date</div>
              <div className="mt-1 font-medium text-neutral-700 dark:text-neutral-200">
                {!edit ? (debt.targetDate || '—') : (
                  <input type="date" className="input w-40" value={editTarget} onChange={e=>setEditTarget(e.target.value)} />
                )}
              </div>
            </div>
          </div>

          {/* History toggle */}
          {(debt.payments?.length ?? 0) > 0 && (
            <button
              className="mt-3 text-xs text-neutral-600 dark:text-neutral-300 underline"
              onClick={() => setShowHistory(v => !v)}
            >
              {showHistory ? 'Hide' : 'Show'} payment history ({debt.payments.length})
            </button>
          )}

          {showHistory && (
            <div className="mt-2 rounded-xl border p-2 dark:border-white/10 bg-neutral-50/60 dark:bg-white/5">
              <div className="text-xs font-medium mb-1">Payment history</div>
              <div className="space-y-1 max-h-40 overflow-auto pr-1">
                {debt.payments?.slice().reverse().map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">{new Date(p.date).toLocaleString()}</span>
                    <span className="font-medium">{currency(p.amount)}{p.note ? ` — ${p.note}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2">
          {!isPaid ? (
            <button onClick={() => onMarkPaid(debt.id)} className="btn" title="Mark as paid in full">
              <CheckCircle2 className="w-4 h-4" />
            </button>
          ) : null}

          {!edit ? (
            <button onClick={() => setEdit(true)} className="btn" title="Edit">
              <PencilLine className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={saveEdit} className="btn btn-primary" title="Save">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => { setEdit(false); setEditName(debt.name||''); setEditAmount(String(debt.amount||'')); setEditApr(String(debt.apr||'')); setEditTarget(debt.targetDate||'') }} className="btn" title="Cancel">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          <button onClick={() => onDelete(debt.id)} className="btn hover:text-red-600" title="Delete">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================
   Add-payment row
========================= */
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
    try { confetti({ particleCount: 60, spread: 70, startVelocity: 35, origin: { y: .7 } }) } catch {}
  }

  const onKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        placeholder="Add a payment (e.g., 50)"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={onKeyDown}
        className="input w-40"
      />
      <input
        type="text"
        placeholder="Note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="input flex-1 min-w-40"
      />
      <button onClick={handleAdd} className="btn btn-green"><Plus className="w-4 h-4" /> Add Payment</button>
      <span className="text-xs text-neutral-400">Max {currency(max)}</span>
    </div>
  )
}

/* =========================
   Main: DebtTracker
========================= */
export default function DebtTracker() {
  const store = useStore()
  const debts = store.data.debts

  // Form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [apr, setApr] = useState('')
  const [targetDate, setTargetDate] = useState('')

  // Recurring (collapsed by default)
  const [recurringAmount, setRecurringAmount] = useState('')
  const [recurringFreq, setRecurringFreq] = useState('monthly')
  const [recurringStart, setRecurringStart] = useState('')
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)

  // View controls
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active') // active | paid | all
  const [sortBy, setSortBy] = useState('manual') // manual | balance | apr | name

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const add = (e) => {
    e?.preventDefault?.()
    if (!name.trim() || parseNum(amount) <= 0) return
    store.addDebt({
      name,
      amount,
      apr,
      targetDate,
      recurring: recurringEnabled
        ? { amount: recurringAmount, freq: recurringFreq, startDate: recurringStart || new Date().toISOString().slice(0, 10), enabled: true }
        : null
    })
    setName(''); setAmount(''); setApr(''); setTargetDate('')
    setRecurringAmount(''); setRecurringStart(''); setRecurringEnabled(false); setRecurringOpen(false)
  }

  const markPaid = (id) => {
    const d = debts.find(x => x.id === id)
    if (!d) return
    const remaining = Math.max(0, (d.amount || 0) - (d.paid ?? 0))
    if (remaining <= 0) return
    store.addDebtPayment(id, remaining, 'Marked paid in full')
  }

  const saveEdits = (id, fields) => {
    // Use store.setData to update a single debt (edit flow)
    store.setData(prev => ({
      ...prev,
      debts: prev.debts.map(d => d.id === id ? { ...d, ...fields } : d)
    }))
  }

  // Derived totals
  const totals = useMemo(() => {
    const principal = debts.reduce((a, d) => a + (d.amount || 0), 0)
    const paid = debts.reduce((a, d) => a + (d.paid ?? 0), 0)
    const remaining = Math.max(0, principal - paid)
    const pct = principal === 0 ? 0 : Math.round((paid / principal) * 100)
    const highestApr = debts.reduce((max, d) => Math.max(max, d.apr || 0), 0)
    return { principal, paid, remaining, pct, highestApr }
  }, [debts])

  // Filter + search + sort (view-only sorting)
  const filtered = useMemo(() => {
    let list = debts.slice()

    // Status filter
    if (status !== 'all') {
      list = list.filter(d => {
        const remaining = Math.max(0, (d.amount || 0) - (d.paid ?? 0))
        return status === 'active' ? remaining > 0.01 : remaining <= 0.01
      })
    }

    // Search
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(d =>
        (d.name || '').toLowerCase().includes(q)
        || (d.targetDate || '').toLowerCase().includes(q)
      )
    }

    // Sort (view only; manual keeps store order for drag)
    if (sortBy === 'balance') {
      list.sort((a, b) => {
        const ra = Math.max(0, (a.amount || 0) - (a.paid ?? 0))
        const rb = Math.max(0, (b.amount || 0) - (b.paid ?? 0))
        return rb - ra
      })
    } else if (sortBy === 'apr') {
      list.sort((a, b) => (b.apr || 0) - (a.apr || 0))
    } else if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    return list
  }, [debts, status, query, sortBy])

  const canDrag = sortBy === 'manual'

  const onDragEnd = (e) => {
    if (!canDrag) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = debts.findIndex(d => d.id === active.id)
    const newIndex = debts.findIndex(d => d.id === over.id)
    store.reorderDebts(oldIndex, newIndex)
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Debt Tracker</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Track balances, log payments, and simulate payoff strategies.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Total Progress</div>
            <div className="mt-1 h-3 w-64 max-w-full rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden ring-1 ring-neutral-200/80 dark:ring-white/10">
              <div className="h-full bg-brand-600" style={{ width: `${totals.pct}%` }} />
            </div>
            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {currency(totals.paid)} / {currency(totals.principal)} ({totals.pct}%)
            </div>
            {totals.highestApr > 0 && (
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Highest APR: {totals.highestApr}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        {/* Search */}
        <div className="lg:col-span-4">
          <label className="label flex items-center gap-2">
            <Search className="w-4 h-4" /> Search
          </label>
          <input className="input w-full" placeholder="Name or date…" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>

        {/* Status filter */}
        <div className="lg:col-span-4">
          <label className="label flex items-center gap-2">
            <Filter className="w-4 h-4" /> Status
          </label>
          <select className="input w-full" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="active">Active (default)</option>
            <option value="paid">Paid off</option>
            <option value="all">All</option>
          </select>
        </div>

        {/* Sort */}
        <div className="lg:col-span-4">
          <label className="label flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" /> Sort by
          </label>
          <select className="input w-full" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="manual">Manual (drag to reorder)</option>
            <option value="balance">Remaining balance</option>
            <option value="apr">APR (high → low)</option>
            <option value="name">Name (A → Z)</option>
          </select>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        {/* Top row */}
        <div className="flex-1 min-w-52">
          <label className="label">Debt name</label>
          <input className="input w-full" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Student Loan A" />
        </div>
        <div>
          <label className="label">Amount</label>
          <input type="number" step="0.01" min="0" className="input w-40" value={amount} onChange={e => setAmount(e.target.value)} placeholder="12000" />
        </div>
        <div>
          <label className="label">APR % (optional)</label>
          <input type="number" step="0.01" min="0" className="input w-32" value={apr} onChange={e => setApr(e.target.value)} placeholder="5.5" />
        </div>
        <div>
          <label className="label">Target date (optional)</label>
          <input type="date" className="input w-44" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-neutral-200/80 dark:bg-white/10 my-1"></div>

        {/* Collapsible: Recurring */}
        <div className="w-full">
          <button
            type="button"
            onClick={() => setRecurringOpen(v => !v)}
            className="flex items-center gap-2 text-sm"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${recurringOpen ? 'rotate-180' : ''}`} />
            More options (Recurring)
          </button>

          {recurringOpen && (
            <div className="mt-3 md:ml-auto flex flex-wrap items-end gap-3">
              <div className="hidden md:block mr-2 text-xs text-neutral-500 dark:text-neutral-400">Recurring (optional)</div>
              <label className="label md:hidden">Recurring (optional)</label>

              <input
                type="number"
                step="0.01"
                min="0"
                className="input w-36"
                value={recurringAmount}
                onChange={e => setRecurringAmount(e.target.value)}
                placeholder="Amt"
              />

              <select
                className="input w-36"
                value={recurringFreq}
                onChange={e => setRecurringFreq(e.target.value)}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>

              <input
                type="date"
                className="input w-44"
                value={recurringStart}
                onChange={e => setRecurringStart(e.target.value)}
                placeholder="Start"
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurringEnabled}
                  onChange={e => setRecurringEnabled(e.target.checked)}
                />
                Enable
              </label>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="mt-3">
          <button type="submit" className="btn btn-primary"><Plus className="w-4 h-4" /> Add Debt</button>
        </div>
      </form>

      {/* List */}
      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center text-neutral-600 dark:text-neutral-300 p-10">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black grid place-items-center mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <p className="font-medium mb-1">No debts to show</p>
            <p className="text-sm">Adjust filters or add a new debt above.</p>
          </div>
        ) : canDrag ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map(d => d.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {filtered.map((debt) => (
                  <DebtItem
                    key={debt.id}
                    debt={debt}
                    canDrag={true}
                    onDelete={store.deleteDebt}
                    onPayment={(id, amt, note) => store.addDebtPayment(id, amt, note)}
                    onMarkPaid={markPaid}
                    onEditSave={saveEdits}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-3">
            {filtered.map((debt) => (
              <DebtItem
                key={debt.id}
                debt={debt}
                canDrag={false}
                onDelete={store.deleteDebt}
                onPayment={(id, amt, note) => store.addDebtPayment(id, amt, note)}
                onMarkPaid={markPaid}
                onEditSave={saveEdits}
              />
            ))}
          </div>
        )}
      </section>

      {/* Planner */}
      <PayoffPlanner />
    </div>
  )
}
