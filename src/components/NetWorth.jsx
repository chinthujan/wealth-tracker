import React, { useMemo } from 'react'
import { useStore } from '../state/store'
import { currency } from '../lib/utils'

function SummaryCard({ label, value, tone='neutral' }) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
  : tone === 'negative' ? 'text-red-600 dark:text-red-400'
  : 'text-neutral-900 dark:text-neutral-100'

  return (
    <div className="card">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}

export default function NetWorth() {
  const { data } = useStore()
  const debts       = data?.debts || []
  const savingsArr  = data?.savings || data?.savingsAccounts || []
  const holdings    = data?.investments || []
  const assetsArr   = data?.assets || []

  const totals = useMemo(() => {
    const liabilities = debts.reduce((a, d) => a + Math.max(0, Number(d.amount || 0) - Number(d.paid || 0)), 0)
    const savings     = (Array.isArray(savingsArr) ? savingsArr : []).reduce((a, s) => a + Number(s.balance || s.amount || 0), 0)
    const investments = holdings.reduce((a, h) => a + (Number(h.units || 0) * Number(h.price || 0)), 0)
    const assets      = assetsArr.reduce((a, it) => a + Number(it.value || 0), 0)
    const monthlyDiv  = holdings.reduce((a, h) => a + ((Number(h.units || 0) * Number(h.dpsAnnual || 0)) / 12), 0)
    const netWorth    = assets + savings + investments - liabilities
    return { liabilities, savings, investments, assets, monthlyDiv, netWorth }
  }, [debts, savingsArr, holdings, assetsArr])

  const netTone = totals.netWorth > 0 ? 'positive' : totals.netWorth < 0 ? 'negative' : 'neutral'

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold text-lg">Net Worth</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Snapshot across assets, debts, and investments.</p>
      </div>

      {/* Order: Assets, Liabilities, Investments, Monthly Passive Income, Net Worth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Assets"                   value={currency(totals.assets)} />
        <SummaryCard label="Liabilities"              value={currency(totals.liabilities)} />
        <SummaryCard label="Investments"              value={currency(totals.investments)} />
        <SummaryCard label="Monthly Passive Income"   value={`${currency(totals.monthlyDiv)} USD`} />
        <SummaryCard label="Net Worth"                value={currency(totals.netWorth)} tone={netTone} />
      </div>

      {/* Keep your existing chart/sections below if you have them */}
    </div>
  )
}
