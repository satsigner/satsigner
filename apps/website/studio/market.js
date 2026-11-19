/* Live price and chain tip from mempool.space.
   Writes the globals the mockups already convert with, then redraws the open screen.
   Cached in sessionStorage so the screens grid does not refetch once per iframe. */

const MARKET_KEY = 'satsigner-market'
const MARKET_TTL = 5 * 60 * 1000

// Fixture rates already painted into the mockups. Used when mempool.space is unreachable.
const MARKET_FALLBACK = {
  usd: USD_PER_BTC,
  eur: USD_PER_BTC * 0.92,
  gbp: USD_PER_BTC * 0.79,
  cad: USD_PER_BTC * 1.37,
  chf: USD_PER_BTC * 0.88,
  jpy: USD_PER_BTC * 152,
  height: BLOCK_HEIGHT,
  fee: NEXT_BLOCK_FEE,
  fees: typeof EC_FEES !== 'undefined' ? { high: EC_FEES.high, medium: EC_FEES.medium, low: EC_FEES.low, none: EC_FEES.none } : null,
  at: 0
}

function readMarket() {
  try {
    const data = JSON.parse(sessionStorage.getItem(MARKET_KEY) || 'null')
    if (!data || Date.now() - data.at > MARKET_TTL) return null
    if (!data.usd || !data.height) return null
    return data
  } catch (e) {
    return null
  }
}

function writeMarket(data) {
  try {
    sessionStorage.setItem(MARKET_KEY, JSON.stringify(data))
  } catch (e) {}
}

function applyMarket(m) {
  if (!m || !m.usd || !m.height) return
  const prev = window.__marketApplied
  if (prev && prev.usd === m.usd && prev.height === m.height && prev.fee === m.fee) return
  USD_PER_BTC = m.usd
  if (typeof ss !== 'undefined' && ss.price) ss.price.btc = m.usd
  BLOCK_HEIGHT = m.height
  if (m.fee) NEXT_BLOCK_FEE = m.fee
  if (typeof CURRENT_BLOCK_HEIGHT !== 'undefined') {
    CURRENT_BLOCK_HEIGHT = m.height
    SAFE_TIMELOCK_LIMIT = m.height + 52560 * 2
  }
  if (typeof EC_FEES !== 'undefined' && m.fees) Object.assign(EC_FEES, m.fees)
  if (typeof EC_TIP !== 'undefined') {
    if (typeof ecState !== 'undefined' && ecState.height === EC_TIP) ecState.height = m.height
    EC_TIP = m.height
  }
  if (typeof LT_TIP !== 'undefined') {
    const prevEpoch = LT_MAX_EPOCH
    LT_TIP = m.height
    LT_MAX_EPOCH = Math.floor(LT_TIP / LT_INTERVAL)
    if (typeof ltDiff !== 'undefined' && String(ltDiff.input) === String(prevEpoch) && ltDiff.fetched == null) {
      ltDiff.input = String(LT_MAX_EPOCH)
    }
  }
  if (typeof LT_RATES !== 'undefined') {
    ;['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY'].forEach((k) => {
      const v = m[k.toLowerCase()]
      if (v) LT_RATES[k] = v
    })
  }
  if (typeof LT_HISTORY !== 'undefined') LT_HISTORY[2026] = m.usd
  if (typeof alLn !== 'undefined' && alLn.node) alLn.node.blockHeight = m.height
  if (typeof syncFromBtc === 'function') syncFromBtc()
  if (typeof renderAccounts === 'function') renderAccounts()
  const accountView = document.getElementById('view-account')
  if (accountView && !accountView.hidden && typeof renderAccount === 'function') renderAccount()
  const txView = document.getElementById('view-tx')
  if (txView && !txView.hidden && typeof renderTransaction === 'function') renderTransaction()
  const io = document.getElementById('io-preview')
  if (io && !io.hidden && typeof renderIo === 'function') renderIo()
  if (typeof kitCurrent === 'string' && kitCurrent && typeof kitScreens !== 'undefined' && kitScreens[kitCurrent]) {
    openKitScreen(kitCurrent)
  }
  window.__marketApplied = m
}

function broadcastMarket(data) {
  document.querySelectorAll('iframe').forEach((frame) => {
    try {
      frame.contentWindow.postMessage({ type: 'satsigner-market', market: data }, location.origin)
    } catch (e) {}
  })
}

function marketResponse(url, asText) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(url)
    return asText ? r.text() : r.json()
  })
}

async function fetchMarket() {
  const [prices, heightText, fees] = await Promise.allSettled([
    marketResponse('https://mempool.space/api/v1/prices'),
    marketResponse('https://mempool.space/api/blocks/tip/height', true),
    marketResponse('https://mempool.space/api/v1/fees/recommended')
  ])
  const price = prices.status === 'fulfilled' ? prices.value : null
  const usd = price ? Number(price.USD) : 0
  const height = heightText.status === 'fulfilled' ? Number(String(heightText.value).trim()) : 0
  if (!usd && !height) throw new Error('mempool')
  const feeBody = fees.status === 'fulfilled' ? fees.value : null
  return {
    usd: usd || MARKET_FALLBACK.usd,
    eur: (price && Number(price.EUR)) || MARKET_FALLBACK.eur,
    gbp: (price && Number(price.GBP)) || MARKET_FALLBACK.gbp,
    cad: (price && Number(price.CAD)) || MARKET_FALLBACK.cad,
    chf: (price && Number(price.CHF)) || MARKET_FALLBACK.chf,
    jpy: (price && Number(price.JPY)) || MARKET_FALLBACK.jpy,
    height: height || MARKET_FALLBACK.height,
    fee: (feeBody && Number(feeBody.fastestFee)) || MARKET_FALLBACK.fee,
    fees: feeBody
      ? {
          high: Number(feeBody.fastestFee) || MARKET_FALLBACK.fee,
          medium: Number(feeBody.halfHourFee) || MARKET_FALLBACK.fee,
          low: Number(feeBody.hourFee) || MARKET_FALLBACK.fee,
          none: Number(feeBody.economyFee) || Number(feeBody.minimumFee) || MARKET_FALLBACK.fee
        }
      : MARKET_FALLBACK.fees,
    at: Date.now()
  }
}

let marketData = readMarket()
if (marketData) {
  try {
    applyMarket(marketData)
  } catch (e) {}
}

const marketEmbed = new URLSearchParams(location.search).has('embed')

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data && event.data.type === 'satsigner-market' && event.data.market) {
    marketData = event.data.market
    writeMarket(marketData)
    try {
      applyMarket(marketData)
    } catch (e) {}
  }
  if (event.data && event.data.type === 'satsigner-market-want' && marketData) {
    event.source.postMessage({ type: 'satsigner-market', market: marketData }, location.origin)
  }
})

if (!marketData) {
  if (marketEmbed && window.parent !== window) {
    window.parent.postMessage({ type: 'satsigner-market-want' }, location.origin)
  }
  const wait = marketEmbed ? 1500 : 0
  setTimeout(() => {
    if (marketData) return
    fetchMarket()
      .then((data) => {
        if (marketData) return
        marketData = data
        writeMarket(data)
        try {
          applyMarket(data)
        } catch (e) {}
        if (!marketEmbed) broadcastMarket(data)
      })
      .catch(() => {
        try {
          applyMarket(MARKET_FALLBACK)
        } catch (e) {}
      })
  }, wait)
}

if (!marketEmbed) {
  document.addEventListener('load', (event) => {
    const frame = event.target
    if (frame && frame.tagName === 'IFRAME' && marketData) {
      try {
        frame.contentWindow.postMessage({ type: 'satsigner-market', market: marketData }, location.origin)
      } catch (e) {}
    }
  }, true)
}
