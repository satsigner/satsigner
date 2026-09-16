import z from 'zod'

import { type Currency, CurrencySchema } from '@/types/models/Blockchain'

const FIAT_CURRENCIES: Currency[] = [
  'AUD',
  'CAD',
  'CHF',
  'EUR',
  'GBP',
  'JPY',
  'USD'
]

const PriceBundleSchema = z.object({
  currency: CurrencySchema,
  generatedAt: z.string(),
  prices: z.array(z.number()),
  times: z.array(z.number())
})

type PriceBundle = z.infer<typeof PriceBundleSchema>

const bundleCache = new Map<Currency, PriceBundle>()

const BUNDLE_LOADERS: Record<Currency, () => unknown> = {
  AUD: () => require('@/assets/prices/aud.json'),
  CAD: () => require('@/assets/prices/cad.json'),
  CHF: () => require('@/assets/prices/chf.json'),
  EUR: () => require('@/assets/prices/eur.json'),
  GBP: () => require('@/assets/prices/gbp.json'),
  JPY: () => require('@/assets/prices/jpy.json'),
  USD: () => require('@/assets/prices/usd.json')
}

function loadPriceBundle(currency: Currency): PriceBundle {
  const cached = bundleCache.get(currency)
  if (cached) {
    return cached
  }
  const parsed = PriceBundleSchema.parse(BUNDLE_LOADERS[currency]())
  if (parsed.times.length !== parsed.prices.length) {
    throw new Error(`Price bundle length mismatch for ${currency}`)
  }
  bundleCache.set(currency, parsed)
  return parsed
}

/**
 * Closest bundled close at or before `timestamp`.
 * Returns null if the timestamp is before the first row or after the last
 * (newer than the dataset — do not clamp to last close).
 */
function findClosestPrice(
  times: number[],
  prices: number[],
  timestamp: number
): number | null {
  if (times.length === 0 || prices.length !== times.length) {
    return null
  }
  const [first] = times
  const last = times.at(-1)
  if (first === undefined || last === undefined) {
    return null
  }
  if (timestamp < first || timestamp > last) {
    return null
  }

  let low = 0
  let high = times.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const midTime = times[mid]
    if (midTime === timestamp) {
      return prices[mid]
    }
    if (midTime < timestamp) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (high < 0) {
    return null
  }
  return prices[high]
}

function getLocalPriceAt(currency: Currency, timestamp: number): number | null {
  const bundle = loadPriceBundle(currency)
  return findClosestPrice(bundle.times, bundle.prices, timestamp)
}

function getLocalPriceSeries(
  currency: Currency
): { price: number; time: number }[] {
  const bundle = loadPriceBundle(currency)
  return bundle.times.map((time, index) => ({
    price: bundle.prices[index],
    time
  }))
}

function getLocalLatestPrice(currency: Currency): number | null {
  const bundle = loadPriceBundle(currency)
  if (bundle.prices.length === 0) {
    return null
  }
  const price = bundle.prices.at(-1)
  return price === undefined ? null : price
}

function getLocalLatestPrices(): Partial<Record<Currency, number>> {
  const prices: Partial<Record<Currency, number>> = {}
  for (const currency of FIAT_CURRENCIES) {
    const price = getLocalLatestPrice(currency)
    if (price !== null) {
      prices[currency] = price
    }
  }
  return prices
}

function getLocalLastTimestamp(currency: Currency): number | null {
  const bundle = loadPriceBundle(currency)
  if (bundle.times.length === 0) {
    return null
  }
  const time = bundle.times.at(-1)
  return time === undefined ? null : time
}

export {
  findClosestPrice,
  getLocalLastTimestamp,
  getLocalLatestPrice,
  getLocalLatestPrices,
  getLocalPriceAt,
  getLocalPriceSeries
}
