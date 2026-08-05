import { fetchMempoolBasicData } from '@/api/explorerMempool'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: {
    fromUrl: jest.fn()
  }
}))

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    getFeeEstimates: jest.fn().mockResolvedValue({
      '1': 20,
      '144': 1,
      '3': 10,
      '6': 4
    }),
    getMempoolInfo: jest.fn().mockResolvedValue({
      count: 12,
      fee_histogram: [
        [20, 600_000],
        [5, 500_000]
      ],
      total_fee: 34000,
      vsize: 250000
    })
  })
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    estimateSmartFee: jest.fn().mockImplementation((target: number) =>
      Promise.resolve({
        blocks: target,
        feerate: target === 1 ? 0.0002 : target === 3 ? 0.0001 : 0.00005
      })
    ),
    getMempoolInfo: jest.fn().mockResolvedValue({
      bytes: 180000,
      mempoolminfee: 0.00001,
      size: 8
    })
  })
}))

describe('fetchMempoolBasicData', () => {
  it('loads fees, histogram, and projected backlog from esplora', async () => {
    const result = await fetchMempoolBasicData(
      'https://example.com',
      'esplora',
      'bitcoin'
    )
    expect(result.source).toBe('backend')
    expect(result.count).toBe(12)
    expect(result.vsize).toBe(250000)
    expect(result.totalFee).toBe(34000)
    expect(result.fees).toStrictEqual({
      high: 20,
      low: 4,
      medium: 10,
      none: 1
    })
    expect(result.feeHistogram).toHaveLength(2)
    expect(result.projectedBlocks.length).toBeGreaterThan(0)
    expect(result.projectedBlocks[0]?.feeRange[0]).toBe(5)
  })

  it('loads smart-fee tiers from rpc', async () => {
    const result = await fetchMempoolBasicData(
      'http://127.0.0.1:8332',
      'rpc',
      'bitcoin',
      { password: 'p', username: 'u' }
    )
    expect(result.source).toBe('backend')
    expect(result.count).toBe(8)
    expect(result.vsize).toBe(180000)
    expect(result.minFeeRate).toBe(1)
    expect(result.fees).toStrictEqual({
      high: 20,
      low: 5,
      medium: 10,
      none: 1
    })
    expect(result.projectedBlocks).toStrictEqual([])
  })
})
