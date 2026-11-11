import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import {
  fetchBackendNextBlockFee,
  fetchMempoolBasicData
} from '@/api/explorerMempool'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  closeElectrumClientQuietly: jest.fn(),
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
      total_fee: 34_000,
      vsize: 250_000
    })
  })
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    estimateSmartFee: jest.fn().mockImplementation((target: number) =>
      Promise.resolve({
        blocks: target,
        feerate: target === 1 ? 0.0002 : target === 3 ? 0.0001 : 0.000_05
      })
    ),
    getMempoolInfo: jest.fn().mockResolvedValue({
      bytes: 180_000,
      mempoolminfee: 0.000_01,
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
    expect(result.vsize).toBe(250_000)
    expect(result.totalFee).toBe(34_000)
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
    expect(result.vsize).toBe(180_000)
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

describe('fetchMempoolBasicData failures', () => {
  it('reports an unreachable electrum server instead of empty data', async () => {
    jest.mocked(ElectrumClient.fromUrl).mockReturnValueOnce({
      init: jest.fn().mockRejectedValue(new Error('connect timed out'))
    } as never)

    await expect(
      fetchMempoolBasicData(
        'ssl://electrum.example.com:50002',
        'electrum',
        'bitcoin'
      )
    ).rejects.toThrow('connect timed out')
  })

  it('treats a missing electrum fee histogram as empty data', async () => {
    jest.mocked(ElectrumClient.fromUrl).mockReturnValueOnce({
      getMempoolFeeHistogram: jest
        .fn()
        .mockRejectedValue(new Error('unknown method')),
      init: jest.fn().mockResolvedValue(undefined)
    } as never)

    const result = await fetchMempoolBasicData(
      'ssl://electrum.example.com:50002',
      'electrum',
      'bitcoin'
    )
    expect(result.feeHistogram).toStrictEqual([])
  })

  it('reports an unreachable esplora server instead of empty data', async () => {
    jest.mocked(Esplora).mockReturnValueOnce({
      getFeeEstimates: jest.fn().mockRejectedValue(new Error('offline')),
      getMempoolInfo: jest.fn().mockRejectedValue(new Error('offline'))
    } as never)

    await expect(
      fetchMempoolBasicData('https://example.com', 'esplora', 'bitcoin')
    ).rejects.toThrow('offline')
  })

  it('has no backend fee when the server is unreachable', async () => {
    jest.mocked(Esplora).mockReturnValueOnce({
      getFeeEstimates: jest.fn().mockRejectedValue(new Error('offline')),
      getMempoolInfo: jest.fn().mockRejectedValue(new Error('offline'))
    } as never)

    await expect(
      fetchBackendNextBlockFee('https://example.com', 'esplora', 'bitcoin')
    ).resolves.toBeNull()
  })
})
