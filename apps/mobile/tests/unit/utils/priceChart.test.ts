import { formatNumber } from '@/utils/format'
import {
  formatCompactFiat,
  formatSpotPriceDisplay,
  priceDomainFromData
} from '@/utils/priceChart'

describe('priceDomainFromData', () => {
  it('returns undefined for empty data', () => {
    expect(priceDomainFromData([])).toBeUndefined()
  })

  it('pads the y domain around priced points', () => {
    expect(
      priceDomainFromData([
        { price: 100, x: 1 },
        { price: 200, x: 2 }
      ])
    ).toStrictEqual({
      x: [1, 2],
      y: [90, 210]
    })
  })
})

describe('formatCompactFiat', () => {
  it('formats thousands and millions', () => {
    expect(formatCompactFiat(1_500)).toBe('2k')
    expect(formatCompactFiat(1_500_000)).toBe('1.5M')
  })
})

describe('formatSpotPriceDisplay', () => {
  it('shows a dash while loading without a spot price', () => {
    expect(formatSpotPriceDisplay(true, 0)).toBe('--')
  })

  it('formats a positive spot price', () => {
    expect(formatSpotPriceDisplay(false, 1000)).toBe(formatNumber(1000, 0))
  })
})
