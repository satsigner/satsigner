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
    getFeeEstimates: jest.fn().mockResolvedValue({ '1': 20, '144': 1 }),
    getMempoolInfo: jest.fn().mockResolvedValue({
      count: 12,
      total_fee: 34000,
      vsize: 250000
    })
  })
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    getMempoolInfo: jest.fn().mockResolvedValue({
      bytes: 180000,
      mempoolminfee: 0.00001,
      size: 8
    })
  })
}))

describe('fetchMempoolBasicData', () => {
  it('loads count and vsize from esplora', async () => {
    const result = await fetchMempoolBasicData(
      'https://example.com',
      'esplora',
      'bitcoin'
    )
    expect(result.source).toBe('backend')
    expect(result.count).toBe(12)
    expect(result.vsize).toBe(250000)
    expect(result.totalFee).toBe(34000)
  })

  it('loads count and vsize from rpc', async () => {
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
  })
})
