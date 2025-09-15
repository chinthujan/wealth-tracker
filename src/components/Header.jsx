import React from 'react'
import ThemeToggle from './ThemeToggle'
import ExportImport from './ExportImport'
import NotificationsToggle from './NotificationsToggle'
import QuickAdd from './QuickAdd'
import { Plus } from 'lucide-react'
import { Wallet } from 'lucide-react'

export default function Header({ tab, setTab }) {
  const [qaOpen, setQaOpen] = React.useState(false)
  React.useEffect(() => { const fn = () => setQaOpen(true); window.addEventListener('open-quick-add', fn); return () => window.removeEventListener('open-quick-add', fn) }, [])
  return (
    <>
    <header className="sticky top-0 z-10 backdrop-blur bg-white/70 dark:bg-black/40 border-b border-neutral-200/80 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-600 text-white grid place-items-center"><Wallet className="w-4 h-4"/></div>
          <h1 className="font-semibold">Wealth Tracker</h1>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          {['Debt','Savings','Investments','Assets','Net Worth','Settings'].map((t) => (
            <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 rounded-xl border ${tab===t?'bg-neutral-900 text-white dark:bg-white dark:text-black':'text-neutral-600 dark:text-neutral-300 dark:border-white/10'}`}>{t}</button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ExportImport />
          <NotificationsToggle />
          <button className="btn" onClick={()=>setQaOpen(true)} title="Quick Add"><Plus className="w-4 h-4"/> New</button>
          <ThemeToggle />
        </div>
      </div>
    </header>
      <QuickAdd open={qaOpen} onClose={()=>setQaOpen(false)}/>
        </>
  )
}
