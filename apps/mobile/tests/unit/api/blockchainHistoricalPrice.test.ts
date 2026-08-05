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
