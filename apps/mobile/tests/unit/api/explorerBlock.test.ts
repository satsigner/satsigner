import type { MempoolOracle } from '@/api/blockchain'
import Esplora from '@/api/esplora'
import {
  fetchExplorerBlockRawHex,
  fetchExplorerBlockRawHexFromMempool
} from '@/api/explorerBlock'
import BitcoinRpc from '@/api/rpc'

const mockGetBlockRawHex = jest.fn()
const mockGetBlockHex = jest.fn()
const mockGetBlockRaw = jest.fn()

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: {
    initClientFromUrl: jest.fn()
  }
}))

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn()
}))

describe('fetchExplorerBlockRawHex', () => {
  beforeEach(() => {
    mockGetBlockRawHex.mockReset().mockResolvedValue('aa11')
    mockGetBlockHex.mockReset().mockResolvedValue('bb22')
    jest
      .mocked(Esplora)
      .mockReset()
      .mockReturnValue({
        getBlockRawHex: mockGetBlockRawHex
      } as unknown as Esplora)
    jest
      .mocked(BitcoinRpc)
      .mockReset()
      .mockReturnValue({
        getBlockHex: mockGetBlockHex
      } as unknown as BitcoinRpc)
  })

  it('uses esplora for esplora backends', async () => {
    const result = await fetchExplorerBlockRawHex(
      'hash',
      'https://esplora.example',
      'esplora'
    )
    expect(result).toStrictEqual({ hex: 'aa11', source: 'backend' })
  })

  it('uses rpc getblock verbosity 0 for rpc backends', async () => {
    const result = await fetchExplorerBlockRawHex(
      'hash',
      'http://127.0.0.1:8332',
      'rpc',
      { password: 'p', username: 'u' }
    )
    expect(result).toStrictEqual({ hex: 'bb22', source: 'backend' })
  })

  it('rejects electrum instead of falling back to mempool', async () => {
    await expect(
      fetchExplorerBlockRawHex(
        'hash',
        'ssl://electrum.example:50002',
        'electrum'
      )
    ).rejects.toThrow('electrum_unsupported')
  })
})

describe('fetchExplorerBlockRawHexFromMempool', () => {
  const mempoolOracle = {
    getBlockRaw: mockGetBlockRaw
  } as unknown as MempoolOracle

  beforeEach(() => {
    mockGetBlockRaw
      .mockReset()
      .mockResolvedValue(Uint8Array.from([0xcc, 0x33]).buffer)
  })

  it('loads raw hex from mempool when explicitly requested', async () => {
    const result = await fetchExplorerBlockRawHexFromMempool(
      'hash',
      mempoolOracle
    )
    expect(result).toStrictEqual({ hex: 'cc33', source: 'mempool' })
    expect(mockGetBlockRaw).toHaveBeenCalledWith('hash')
  })
})
