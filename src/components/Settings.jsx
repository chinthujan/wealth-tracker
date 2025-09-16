import React, { useState } from 'react'
import { useStore } from '../state/store'
import ExportImport from './ExportImport'

export default function Settings() {
  const { data, setData } = useStore()
  const [currency, setCurrency] = useState(data.settings.currency || 'USD')
  const [provider, setProvider] = useState(data.settings.marketData?.provider || 'AlphaVantage')
  const [apiKey, setApiKey] = useState(data.settings.marketData?.apiKey || '')
  const [host, setHost] = useState(data.settings.marketData?.host || '')

  const apply = (e) => {
    e?.preventDefault?.()
    setData(prev => ({ ...prev, settings: { ...prev.settings, currency, marketData: { provider, apiKey, host } } }))
    alert('Settings saved.')
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold mb-3">Settings</h2>
        <form onSubmit={apply} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label className="label">Currency (display)</label>
            <select className="input w-full" value={currency} onChange={e=>setCurrency(e.target.value)}>
              {['USD','CAD','EUR','GBP','AUD','JPY','INR'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-fit">Save</button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mt-4">
          <div>
            <label className="label">Market Data Provider</label>
            <select className="input w-full" value={provider} onChange={e=>setProvider(e.target.value)}>
              <option value="AlphaVantage">AlphaVantage</option>
              <option value="Finnhub">Finnhub</option>
              <option value="YahooRapidAPI">Yahoo via RapidAPI</option>
            </select>
          </div>
          <div>
            <label className="label">API Key</label>
            <input className="input w-full" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Enter API key"/>
          </div>
          <div>
            {provider === 'YahooRapidAPI' && (
              <>
                <label className="label">RapidAPI Host</label>
                <input className="input w-full" value={host} onChange={e=>setHost(e.target.value)} placeholder="yahoo-finance15.p.rapidapi.com"/>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (provider==='AlphaVantage') alert('Get a free API key at alphavantage.co and paste it here.')
                else if (provider==='Finnhub') alert('Get a free API key at finnhub.io and paste it here.')
                else alert('Subscribe to a Yahoo Finance API on RapidAPI. Note the API host domain and your RapidAPI key, then paste both here.')
              }}
            >
              Where to get a key?
            </button>
          </div>
        </div>
      </div>

      {/* v2: Backup section with Export/Import */}
      <div className="card">
        <h3 className="font-semibold mb-2">Backup</h3>
        <ExportImport />
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          Your data is stored in your browser (local only). Export to back it up or move devices.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">Sample Data</h3>
        <button className="btn" onClick={() => { if (confirm('Load sample data? This will replace current data.')) { localStorage.clear(); location.reload() } }}>Load sample dataset</button>
        <p className="text-xs text-neutral-500 mt-2">Tip: Export your data first if you want to keep a backup.</p>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">Reset</h3>
        <button className="btn" onClick={() => { if (confirm('Reset all data?')) { localStorage.clear(); location.reload() } }}>Erase all local data</button>
      </div>
    </div>
  )
}
