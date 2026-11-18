import {
  findClosestPrice,
  getLocalPriceAt,
  getLocalPriceCoverage,
  getLocalPricesAt
} from '@/api/localPrices'
import { MS_PER_SECOND } from '@/constants/time'
import { CurrencySchema } from '@/types/models/Blockchain'

describe('findClosestPrice', () => {
  const times = [100, 200, 300]
  const prices = [1, 2, 3]

  it('returns null for an empty series', () => {
    expect(findClosestPrice([], [], 100)).toBeNull()
  })

  it('returns null before the first timestamp', () => {
    expect(findClosestPrice(times, prices, 99)).toBeNull()
  })

  it('returns null after the last timestamp', () => {
    expect(findClosestPrice(times, prices, 301)).toBeNull()
  })

  it('returns the exact match', () => {
    expect(findClosestPrice(times, prices, 200)).toBe(2)
  })

  it('returns the bucket at or before a time in range', () => {
    expect(findClosestPrice(times, prices, 250)).toBe(2)
  })

  it('returns the first close on the first timestamp', () => {
    expect(findClosestPrice(times, prices, 100)).toBe(1)
  })

  it('returns the last close on the last timestamp', () => {
    expect(findClosestPrice(times, prices, 300)).toBe(3)
  })

  it('returns null when the closest bundled close is missing', () => {
    expect(findClosestPrice([100, 200, 300], [1, null, 3], 250)).toBeNull()
  })

  it('returns null for a negative sentinel close', () => {
    expect(findClosestPrice([100, 200], [-1, 2], 100)).toBeNull()
  })
})

describe('getLocalPricesAt', () => {
  const timestamp = 1_577_836_800

  it('returns the bundled close for each currency that has one', () => {
    const prices = getLocalPricesAt(timestamp)

    expect(prices.USD).toBeGreaterThan(0)
    for (const currency of CurrencySchema.options) {
      expect(prices[currency]).toBe(
        getLocalPriceAt(currency, timestamp) ?? undefined
      )
    }
  })

  it('is empty before the bundled history starts', () => {
    expect(getLocalPricesAt(0)).toStrictEqual({})
  })
})

describe('getLocalPriceCoverage', () => {
  it('spans the first to the last bundled day', () => {
    const coverage = getLocalPriceCoverage('USD')
    expect(coverage?.first.getTime()).toBeLessThan(
      coverage?.last.getTime() ?? 0
    )
    expect(coverage?.first.getUTCFullYear()).toBeLessThanOrEqual(2011)
  })

  it.each(CurrencySchema.options)(
    'starts and ends on days with a %s price',
    (currency) => {
      const coverage = getLocalPriceCoverage(currency)
      const first = (coverage?.first.getTime() ?? 0) / MS_PER_SECOND
      const last = (coverage?.last.getTime() ?? 0) / MS_PER_SECOND

      expect(getLocalPriceAt(currency, first)).not.toBeNull()
      expect(getLocalPriceAt(currency, first - 1)).toBeNull()
      expect(getLocalPriceAt(currency, last)).not.toBeNull()
    }
  )
})
