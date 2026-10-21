import { MempoolOracle } from '@/api/blockchain'

describe('mempoolOracle.getLatestAverageHashRate', () => {
  const oracle = new MempoolOracle('https://mempool.example')

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns the most recent average hash rate', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({
      hashrates: [{ avgHashrate: 1e20 }, { avgHashrate: 2e20 }]
    })

    await expect(oracle.getLatestAverageHashRate()).resolves.toBe(2e20)
  })

  it('returns zero for an empty series', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({ hashrates: [] })

    await expect(oracle.getLatestAverageHashRate()).resolves.toBe(0)
  })

  it('rejects malformed payloads', async () => {
    jest.spyOn(oracle, 'get').mockResolvedValue({ hashrates: 'nope' })

    await expect(oracle.getLatestAverageHashRate()).rejects.toThrow(
      /Expected array|Invalid input|ZodError/i
    )
  })
})
