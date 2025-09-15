import React from 'react'
import { currency } from '../lib/utils'

export default function MiniStat({ label, value, positive=false }) {
  return (
    <div className="px-4 py-3 rounded-2xl border bg-white/70 dark:bg-white/5 dark:border-white/10">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1 font-semibold ${positive?'text-brand-600 dark:text-brand-400':''}`}>{currency(value)}</div>
    </div>
  )
}
