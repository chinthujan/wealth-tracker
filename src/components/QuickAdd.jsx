import React, { useState } from 'react'
import Modal from './Modal'
import { useStore } from '../state/store'

export default function QuickAdd({ open, onClose }) {
  const store = useStore()
  const [tab, setTab] = useState('Debt')

  return (
    <Modal open={open} onClose={onClose} title={`Quick Add — ${tab}`}>
      <div className="flex gap-2 mb-3">
        {['Debt','Savings','Investment'].map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 rounded-xl border ${tab===t?'bg-neutral-900 text-white dark:bg-white dark:text-black':''}`}>{t}</button>
        ))}
      </div>
      {tab==='Debt' && <DebtForm onDone={onClose} />}
      {tab==='Savings' && <SavingsForm onDone={onClose} />}
      {tab==='Investment' && <InvestForm onDone={onClose} />}
      <div className="mt-3 text-xs text-neutral-500">Tip: Press <kbd className="kbd">N</kbd> to open Quick Add anywhere.</div>
    </Modal>
  )
}

function DebtForm({ onDone }) {
  const store = useStore()
  const [name,setName] = useState(''); const [amount,setAmount]=useState('')
  return (
    <form onSubmit={(e)=>{e.preventDefault(); if(!name||!amount) return; store.addDebt({name,amount}); onDone()}} className="grid grid-cols-3 gap-2 items-end">
      <div className="col-span-2"><label className="label">Name</label><input className="input w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Debt name"/></div>
      <div><label className="label">Amount</label><input className="input w-full" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></div>
      <button className="btn btn-primary col-span-3">Add Debt</button>
    </form>
  )
}
function SavingsForm({ onDone }) {
  const store = useStore()
  const [name,setName] = useState(''); const [target,setTarget]=useState('')
  return (
    <form onSubmit={(e)=>{e.preventDefault(); if(!name||!target) return; store.addGoal({name,target}); onDone()}} className="grid grid-cols-3 gap-2 items-end">
      <div className="col-span-2"><label className="label">Goal</label><input className="input w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Goal name"/></div>
      <div><label className="label">Target</label><input className="input w-full" type="number" min="0" step="0.01" value={target} onChange={e=>setTarget(e.target.value)} placeholder="0.00"/></div>
      <button className="btn btn-primary col-span-3">Add Goal</button>
    </form>
  )
}
function InvestForm({ onDone }) {
  const store = useStore()
  const [symbol,setSymbol] = useState(''); const [units,setUnits]=useState(''); const [price,setPrice]=useState('')
  return (
    <form onSubmit={(e)=>{e.preventDefault(); if(!symbol||!units) return; store.addHolding({symbol,units,price}); onDone()}} className="grid grid-cols-3 gap-2 items-end">
      <div><label className="label">Symbol</label><input className="input w-full" value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="AAPL"/></div>
      <div><label className="label">Units</label><input className="input w-full" type="number" step="0.0001" value={units} onChange={e=>setUnits(e.target.value)} placeholder="0.0"/></div>
      <div><label className="label">Price (opt)</label><input className="input w-full" type="number" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00"/></div>
      <button className="btn btn-primary col-span-3">Add Holding</button>
    </form>
  )
}
