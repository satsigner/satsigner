import { MempoolOracle } from '@/api/blockchain'
import {
  getLocalPriceAt,
  getLocalPricesAt,
  isUsablePrice
} from '@/api/localPrices'
import { useSettingsStore } from '@/store/settings'
import {
  type Currency,
  CurrencySchema,
  type Prices
} from '@/types/models/Blockchain'
import { getFiatPriceApiUrl } from '@/utils/fiatData'

async function resolveHistoricalPrices(
  currency: Currency,
  timestamps: number[]
): Promise<Record<number, number>> {
  const uniqueTimestamps = [...new Set(timestamps)]
  const priceByTimestamp: Record<number, number> = {}
  const missing: number[] = []

  for (const timestamp of uniqueTimestamps) {
    const local = getLocalPriceAt(currency, timestamp)
    if (!isUsablePrice(local)) {
      missing.push(timestamp)
      continue
    }
    priceByTimestamp[timestamp] = local
  }

  const { fetchHistoricalPricesFromNetwork } = useSettingsStore.getState()
  if (!fetchHistoricalPricesFromNetwork || missing.length === 0) {
    return priceByTimestamp
  }

  const oracle = new MempoolOracle(getFiatPriceApiUrl())
  const fetched = await oracle.getPricesAt(currency, missing)
  for (const [index, timestamp] of missing.entries()) {
    const price = fetched[index]
    if (typeof price === 'number' && Number.isFinite(price)) {
      priceByTimestamp[timestamp] = price
    }
  }

  return priceByTimestamp
}

function keepUsablePrices(prices: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(prices).filter(([, price]) => isUsablePrice(price))
  )
}

/**
 * Prices in every fiat currency at `timestamp`, for showing values on a past
 * date. Uses bundled history first and, when opted in, fills the currencies
 * it lacks from the network (quoted as `currency`). Currencies with no price
 * are left out. Returns null when historical prices are off or no price is
 * found at all.
 */
async function resolvePricesAt(
  currency: Currency,
  timestamp: number
): Promise<Prices | null> {
  const { fetchHistoricalPrices, fetchHistoricalPricesFromNetwork } =
    useSettingsStore.getState()
  if (!fetchHistoricalPrices) {
    return null
  }

  const localPrices = getLocalPricesAt(timestamp)
  const localOrNull = Object.keys(localPrices).length > 0 ? localPrices : null
  const isLocalComplete = CurrencySchema.options.every(
    (fiat) => localPrices[fiat] !== undefined
  )
  if (isLocalComplete || !fetchHistoricalPricesFromNetwork) {
    return localOrNull
  }

  try {
    const oracle = new MempoolOracle(getFiatPriceApiUrl())
    const networkPrices = await oracle.getFullPriceAt(currency, timestamp)
    return { ...keepUsablePrices(networkPrices), ...localPrices }
  } catch {
    return localOrNull
  }
}

export { resolveHistoricalPrices, resolvePricesAt }
