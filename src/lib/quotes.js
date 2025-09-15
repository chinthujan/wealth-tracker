// Price fetchers for multiple providers. All calls are client-side and optional.
// Be mindful of rate limits when using free tiers.

export async function fetchAlphaVantage(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Network error')
  const json = await res.json()
  const q = json['Global Quote']
  if (!q) throw new Error(json.Note || json['Error Message'] || 'No quote data')
  const price = Number(q['05. price'] || q['08. previous close'] || 0)
  if (!price) throw new Error('No price returned')
  return { price }
}

export async function fetchFinnhub(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Network error')
  const json = await res.json()
  const price = Number(json.c || json.pc || 0)
  if (!price) throw new Error('No price returned')
  return { price }
}

// Yahoo via RapidAPI (host varies by the provider you choose on RapidAPI, e.g. 'yahoo-finance15.p.rapidapi.com').
export async function fetchYahooRapidAPI(symbol, apiKey, host) {
  const base = `https://${host}`
  // Try a lightweight quote endpoint used by several Yahoo providers on RapidAPI
  const url = `${base}/api/yahoo/qu/quote/${encodeURIComponent(symbol)}`
  const res = await fetch(url, { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host } })
  if (!res.ok) throw new Error('Network error')
  const json = await res.json()
  // Some providers return { symbol, regularMarketPrice }, others return arrays
  let price = 0
  if (Array.isArray(json) && json.length) {
    price = Number(json[0]?.regularMarketPrice || json[0]?.ask || json[0]?.bid || 0)
  } else if (json && typeof json === 'object') {
    price = Number(json.regularMarketPrice || json.ask || json.bid || json.price || 0)
  }
  if (!price) throw new Error('No price returned')
  return { price }
}

export async function fetchPrice(symbol, provider, apiKey, host) {
  if (!provider) return null
  if (provider === 'AlphaVantage') return fetchAlphaVantage(symbol, apiKey)
  if (provider === 'Finnhub') return fetchFinnhub(symbol, apiKey)
  if (provider === 'YahooRapidAPI') return fetchYahooRapidAPI(symbol, apiKey, host)
  throw new Error('Unsupported provider')
}
