import React, { useMemo, useState } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../state/store'
import { currency, parseNum } from '../lib/utils'
import { PieChart, Pie, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function AssetItem({ a, idx, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className={`card ${isDragging?'opacity-80':''}`}>
      <div className="flex items-start gap-3">
        <button className="shrink-0 mt-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} title="Drag to reorder">
          <GripVertical className="w-5 h-5 text-neutral-400"/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold truncate">{a.name}</h3>

            <div className="text-sm text-neutral-500">Value: <span className="font-medium text-neutral-700 dark:text-neutral-200">{currency(a.value||0)}</span></div>
          </div>
          <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">Category: {a.category||'Other'}</div>
        </div>
        <button onClick={() => onDelete(a.id)} className="opacity-60 hover:opacity-100 hover:text-red-600" title="Delete"><X className="w-5 h-5"/></button>
      </div>
    </div>
  )
}

export default function Assets() {
  const store = useStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const [name, setName] = useState('')
  const [category, setCategory] = useState('Property')
  const [value, setValue] = useState('')

  const add = (e) => {
    e?.preventDefault?.()
    if (!name.trim() || parseNum(value) <= 0) return
    store.addAsset({ name, value, category })
    setName(''); setCategory('Property'); setValue('')
  }

  const assets = store.data.assets || []
  const totals = useMemo(() => assets.reduce((a,x)=>a+(x.value||0),0), [assets])

  const onDragEnd = (e) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    const oldIndex = assets.findIndex(x => x.id === active.id)
    const newIndex = assets.findIndex(x => x.id === over.id)
    store.reorderAssets?.(oldIndex, newIndex)
  }

  const pieData = Object.values(assets.reduce((acc, a) => {
    const key = a.category || 'Other'
    acc[key] = acc[key] || { name: key, value: 0 }
    acc[key].value += a.value || 0
    return acc
  }, {}))

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Assets</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Track properties, vehicles, and other assets.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Total</div>
            <div className="mt-1 text-xl font-semibold">{currency(totals)}</div>
          </div>
        </div>
      </div>

      <form onSubmit={add} className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div className="lg:col-span-2">
          <label className="label">Name</label>
          <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Primary Residence / Car / etc."/>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input w-full" value={category} onChange={e=>setCategory(e.target.value)}>
            <option>Property</option>
            <option>Vehicle</option>
            <option>Cash</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="label">Value</label>
          <input className="input w-full" type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)} placeholder="0.00"/>
        </div>
        <button className="btn btn-primary"><Plus className="w-4 h-4"/> Add Asset</button>
      </form>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {assets.length === 0 ? (
            <div className="card text-center text-neutral-600 dark:text-neutral-300 p-10">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black grid place-items-center mb-3"><Plus className="w-6 h-6"/></div>
              <p className="font-medium mb-1">No assets yet</p>
              <p className="text-sm">Add properties, vehicles, and other assets to fully reflect your net worth.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={assets.map(a=>a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {assets.map((a, idx) => (<AssetItem key={a.id} a={a} idx={idx} onDelete={store.deleteAsset} />))}
                </div>
              </SortableContext>
            </DndContext>
          )}
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
          </div>
        </div>
      </section>
    </div>
  )
}
