import { MempoolOracle } from '@/api/blockchain'

describe('mempoolOracle.getHistoricalPriceSeries', () => {
  const oracle = new MempoolOracle('https://mempool.example')

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('parses, filters, and sorts price points', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({
      prices: [
        { USD: 70_000, time: 200 },
        { USD: Number.NaN, time: 150 },
        { USD: 65_000, time: 100 },
        { EUR: 60_000, time: 50 },
        { USD: 'bad', time: 25 }
      ]
    })

    await expect(oracle.getHistoricalPriceSeries('USD')).resolves.toStrictEqual(
      [
        { price: 65_000, time: 100 },
        { price: 70_000, time: 200 }
      ]
    )
  })

  it('returns an empty series for an empty payload', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({ prices: [] })
    await expect(oracle.getHistoricalPriceSeries('USD')).resolves.toStrictEqual(
      []
    )
  })

  it('rejects malformed payloads', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({ prices: 'nope' })
    await expect(oracle.getHistoricalPriceSeries('USD')).rejects.toThrow(
      /Expected array|Invalid input|ZodError/i
    )
  })
})

describe('mempoolOracle.getPriceAt', () => {
  const oracle = new MempoolOracle('https://mempool.example')

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns the requested currency price at the timestamp', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({
      exchangeRates: { USDEUR: 0.88 },
      prices: [{ EUR: 1964, USD: 2254.9, time: 1_499_904_000 }]
    })

    await expect(oracle.getPriceAt('EUR', 1_500_000_000)).resolves.toBe(1964)
  })

  it('rejects malformed payloads', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({ prices: [{ EUR: 'bad' }] })
    await expect(oracle.getPriceAt('EUR', 1_500_000_000)).rejects.toThrow(
      /expected number|Invalid input|ZodError/i
    )
  })
})

describe('mempoolOracle.getFullPriceAt', () => {
  const oracle = new MempoolOracle('https://mempool.example')
  const EUR_RESPONSE = {
    exchangeRates: { USDEUR: 0.89, USDGBP: 0.76, USDJPY: 158.64 },
    prices: [{ EUR: 1964, USD: 2254.9, time: 1_499_904_000 }]
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps the requested currency and USD prices as returned', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue(EUR_RESPONSE)

    const prices = await oracle.getFullPriceAt('EUR', 1_500_000_000)

    expect(prices.EUR).toBe(1964)
    expect(prices.USD).toBe(2254.9)
  })

  it('converts other currencies from the USD price', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue(EUR_RESPONSE)

    const prices = await oracle.getFullPriceAt('EUR', 1_500_000_000)

    expect(prices.GBP).toBeCloseTo(2254.9 * 0.76)
    expect(prices.JPY).toBeCloseTo(2254.9 * 158.64)
  })

  it('returns only the requested currency when USD is missing', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({
      exchangeRates: { USDGBP: 0.76 },
      prices: [{ EUR: 1964, time: 1_499_904_000 }]
    })

    await expect(
      oracle.getFullPriceAt('EUR', 1_500_000_000)
    ).resolves.toStrictEqual({ EUR: 1964 })
  })

  it('rejects when the requested currency is missing', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({
      exchangeRates: {},
      prices: [{ USD: 2254.9, time: 1_499_904_000 }]
    })

    await expect(oracle.getFullPriceAt('EUR', 1_500_000_000)).rejects.toThrow(
      /Unavailable price for EUR/
    )
  })
})
