import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { currency } from '../lib/utils'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts'

function formatDateLabel(d) {
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString()
  } catch {
    return d
  }
}

export default function NetWorth() {
  const { data, totals } = useStore()

  const netClass =
  totals.netWorth < 0
    ? 'text-red-600'
    : totals.netWorth > 0
    ? 'text-green-600'
    : 'text-neutral-900 dark:text-neutral-100'

  const [range, setRange] = useState('90') // '30' | '90' | '365' | 'all'

  // Build clean, per-day series from history; fall back to a single "today" point
  const series = useMemo(() => {
    const mapByDay = new Map()

    // 1) Ingest snapshots, keep the last one per day
    for (const h of (data.history || [])) {
      if (!h?.date) continue
      const day = String(h.date).slice(0, 10) // YYYY-MM-DD
      mapByDay.set(day, {
        date: day,
        netWorth: Number(h.netWorth ?? (Number(h.assets || 0) - Number(h.liabilities || 0))),
      })
    }

    // 2) Ensure we at least have a current point
    if (mapByDay.size === 0) {
      const today = new Date().toISOString().slice(0, 10)
      mapByDay.set(today, { date: today, netWorth: Number(totals.netWorth || 0) })
    }

    // 3) Sort by date ascending
    const arr = [...mapByDay.values()].sort((a, b) => a.date.localeCompare(b.date))

    // 4) Apply range filter
    if (range !== 'all') {
      const days = Number(range)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      return arr.filter(p => new Date(p.date) >= cutoff)
    }
    return arr
  }, [data.history, totals.netWorth, range])

  const yDomain = useMemo(() => {
    // Pad the y-axis a little so negative values have breathing room
    let min = 0, max = 0
    for (const p of series) {
      if (typeof p.netWorth === 'number') {
        min = Math.min(min, p.netWorth)
        max = Math.max(max, p.netWorth)
      }
    }
    if (min === max) {
      // Flat line — expand slightly for visibility
      const pad = Math.max(100, Math.abs(min) * 0.1 || 100)
      return [min - pad, max + pad]
    }
    const pad = Math.max(100, (max - min) * 0.05)
    return [min - pad, max + pad]
  }, [series])

  return (
    <section className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Net Worth</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Your net worth over time (assets − liabilities).
            </p>
          </div>

          {/* Time range filter */}
          <div className="flex items-center gap-2">
            {['30','90','365','all'].map(opt => (
              <button
                key={opt}
                onClick={() => setRange(opt)}
                className={`px-3 py-1.5 rounded-xl border text-sm ${
                  range === opt
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                    : 'text-neutral-600 dark:text-neutral-300 dark:border-white/10'
                }`}
                title={opt === 'all' ? 'All time' : `${opt} days`}
              >
                {opt === 'all' ? 'All' : `${opt}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Single clean line — no mirroring, negative values supported */}
      <div className="card h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              minTickGap={32}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(v) => currency(v).replace(/\.\d{2}$/, '')}
              width={80}
            />
            <Tooltip
              formatter={(value, name) => [currency(value), 'Net Worth']}
              labelFormatter={(label) => formatDateLabel(label)}
            />
            <ReferenceLine y={0} strokeOpacity={0.4} />
            <Line
              type="monotone"
              dataKey="netWorth"
              dot={false}
              strokeWidth={2.2}
              // Recharts will apply the theme's default stroke color; we avoid hard-coding a color
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Current snapshot callout (optional, not a duplicate of Overview cards) */}
     <div className="card">
  <div className="text-sm text-neutral-600 dark:text-neutral-300">
    Current net worth:&nbsp;
    <span className={`font-semibold ${netClass}`}>{currency(totals.netWorth)}</span>
  </div>
</div>
    </section>
  )
}
