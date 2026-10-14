import { MempoolOracle } from '@/api/blockchain'
import {
  getLocalPriceAt,
  getLocalPricesAt,
  isUsablePrice
} from '@/api/localPrices'
import { useSettingsStore } from '@/store/settings'
import { type Currency, type Prices } from '@/types/models/Blockchain'
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

/**
 * Prices in every fiat currency at `timestamp`, for showing values on a past
 * date. Uses bundled history first and the network only when opted in.
 * Returns null when historical prices are off or none are found for
 * `currency`.
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
  if (localPrices[currency] !== undefined) {
    return localPrices
  }

  if (!fetchHistoricalPricesFromNetwork) {
    return null
  }

  try {
    const oracle = new MempoolOracle(getFiatPriceApiUrl())
    return await oracle.getFullPriceAt(currency, timestamp)
  } catch {
    return null
  }
}

export { resolveHistoricalPrices, resolvePricesAt }
