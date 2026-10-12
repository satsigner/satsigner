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
