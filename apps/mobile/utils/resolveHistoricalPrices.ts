import { MempoolOracle } from '@/api/blockchain'
import { getLocalPriceAt, isUsablePrice } from '@/api/localPrices'
import { useSettingsStore } from '@/store/settings'
import { type Currency } from '@/types/models/Blockchain'
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

export { resolveHistoricalPrices }
