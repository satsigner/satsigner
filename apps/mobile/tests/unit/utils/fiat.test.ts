import { normalizeFiatPriceApiUrl, satsToFiat } from '@/utils/fiat'

describe('satsToFiat', () => {
  it('converts sats at the given bitcoin price', () => {
    expect(satsToFiat(50_000_000, 60_000, true)).toBe(30_000)
  })

  it('is 0 when fiat prices are disabled', () => {
    expect(satsToFiat(50_000_000, 60_000, false)).toBe(0)
  })

  it('is 0 for non-positive or invalid amounts and prices', () => {
    expect(satsToFiat(0, 60_000, true)).toBe(0)
    expect(satsToFiat(-1, 60_000, true)).toBe(0)
    expect(satsToFiat(Number.NaN, 60_000, true)).toBe(0)
    expect(satsToFiat(1000, 0, true)).toBe(0)
  })
})

describe('normalizeFiatPriceApiUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeFiatPriceApiUrl('  https://example.com  ')).toBe(
      'https://example.com'
    )
  })

  it('strips trailing slashes', () => {
    expect(normalizeFiatPriceApiUrl('https://example.com///')).toBe(
      'https://example.com'
    )
  })

  it('returns an empty string for blank input', () => {
    expect(normalizeFiatPriceApiUrl('   ')).toBe('')
  })
})
