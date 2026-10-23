import { SATS_PER_BITCOIN } from '@/constants/btc'

/**
 * Fiat value of `sats` at `btcPrice` (price of one bitcoin in the fiat
 * currency). Returns 0 when fiat prices are disabled, the amount is not
 * positive or the price is unknown.
 */
export function satsToFiat(sats: number, btcPrice: number, enabled: boolean) {
  if (!enabled || !(sats > 0) || !(btcPrice > 0)) {
    return 0
  }
  return (sats / SATS_PER_BITCOIN) * btcPrice
}

export function normalizeFiatPriceApiUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

type FiatPriceFetching = {
  fetchCurrentPrices: boolean
  fetchHistoricalPrices: boolean
}

export function missingHistoricalFiatData({
  fetchCurrentPrices,
  fetchHistoricalPrices
}: FiatPriceFetching) {
  if (!fetchCurrentPrices) {
    return 'currentPrices'
  }
  if (!fetchHistoricalPrices) {
    return 'historicalPrices'
  }
  return null
}

export function isHistoricalFiatAvailable(fetching: FiatPriceFetching) {
  return missingHistoricalFiatData(fetching) === null
}
