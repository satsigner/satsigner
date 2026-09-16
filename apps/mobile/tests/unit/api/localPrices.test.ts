import { findClosestPrice } from '@/api/localPrices'

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
})
