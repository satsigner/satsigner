import {
  findClosestPrice,
  getLocalPriceAt,
  getLocalPricesAt
} from '@/api/localPrices'
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
