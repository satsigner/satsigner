import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import { probeConnection } from '@/services/connectionTest'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  ElectrumServerVersionSchema: { safeParse: jest.fn() },
  __esModule: true,
  closeElectrumClientQuietly: jest.fn(),
  default: { fromUrl: jest.fn() }
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn()
}))

const RPC_URL = 'http://node.local:38332'

function mockRpc(chain: string) {
  jest.mocked(BitcoinRpc).mockReturnValue({
    estimateSmartFee: jest.fn().mockResolvedValue({ feerate: 0.00002 }),
    getBlockchainInfo: jest.fn().mockResolvedValue({
      blocks: 200_000,
      chain,
      chainwork: 'abc',
      mediantime: 1_700_000_000
    }),
    getMempoolInfo: jest.fn().mockResolvedValue({ size: 12 }),
    getNetworkInfo: jest.fn().mockRejectedValue(new Error('no info')),
    hasBlockFilterIndex: jest.fn().mockResolvedValue(true)
  })
}

describe('probeConnection', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('reports node info for a Core node on the expected chain', async () => {
    mockRpc('signet')

    const probe = await probeConnection({
      backend: 'rpc',
      network: 'signet',
      url: RPC_URL
    })

    expect(probe.result).toMatchObject({
      blockFilterIndexMissing: false,
      blockHeight: 200_000,
      success: true,
      tipTimestampSec: 1_700_000_000
    })
    expect(probe.nodeInfo).toMatchObject({
      medianFee: 2,
      mempoolSize: 12,
      software: 'Bitcoin Core'
    })
  })

  it('rejects a Core node on the wrong chain', async () => {
    mockRpc('main')

    await expect(
      probeConnection({ backend: 'rpc', network: 'signet', url: RPC_URL })
    ).rejects.toThrow(RPC_URL)
  })

  it('still succeeds when the esplora tip timestamp is unavailable', async () => {
    jest.mocked(Esplora).mockReturnValue({
      _call: jest.fn().mockResolvedValue({ count: 3 }),
      getBlockAtHeight: jest.fn().mockRejectedValue(new Error('404')),
      getFeeEstimates: jest.fn().mockResolvedValue({ '6': 4 }),
      getLatestBlockHeight: jest.fn().mockResolvedValue(100)
    })

    const probe = await probeConnection({
      backend: 'esplora',
      network: 'signet',
      url: 'https://mempool.space/signet/api'
    })

    expect(probe.result).toStrictEqual({
      blockHeight: 100,
      success: true,
      tipTimestampSec: undefined
    })
    expect(probe.nodeInfo.medianFee).toBe(4)
  })
})
