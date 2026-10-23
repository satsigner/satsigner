import {
  isHistoricalFiatAvailable,
  missingHistoricalFiatData,
  normalizeFiatPriceApiUrl,
  satsToFiat
} from '@/utils/fiat'

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

describe('missingHistoricalFiatData', () => {
  it('asks for current prices first', () => {
    expect(
      missingHistoricalFiatData({
        fetchCurrentPrices: false,
        fetchHistoricalPrices: false
      })
    ).toBe('currentPrices')
  })

  it('asks for historical prices when only current prices are on', () => {
    expect(
      missingHistoricalFiatData({
        fetchCurrentPrices: true,
        fetchHistoricalPrices: false
      })
    ).toBe('historicalPrices')
  })

  it('is null when both are on', () => {
    expect(
      missingHistoricalFiatData({
        fetchCurrentPrices: true,
        fetchHistoricalPrices: true
      })
    ).toBeNull()
  })
})

describe('isHistoricalFiatAvailable', () => {
  it('needs both current and historical prices', () => {
    expect(
      isHistoricalFiatAvailable({
        fetchCurrentPrices: true,
        fetchHistoricalPrices: true
      })
    ).toBe(true)
    expect(
      isHistoricalFiatAvailable({
        fetchCurrentPrices: false,
        fetchHistoricalPrices: true
      })
    ).toBe(false)
    expect(
      isHistoricalFiatAvailable({
        fetchCurrentPrices: true,
        fetchHistoricalPrices: false
      })
    ).toBe(false)
  })
})
